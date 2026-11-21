// The users table: made on a user's first visit with a verified email, refreshed on later ones.

import type { Identity } from "./token.ts";
import { isoSeconds } from "./time.ts";

export type User = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "active" | "disabled";
  timeZone: string;
  country: string | null;
  createdAt: string;
  approvedAt: string | null;
};

type UserRow = {
  id: string;
  email: string;
  role: User["role"];
  status: User["status"];
  time_zone: string;
  country: string | null;
  created_at: string;
  approved_at: string | null;
  last_seen_at: string | null;
};

export type SyncResult = { user: User } | { error: "email_in_use" | "not_configured" };

/** last_seen_at is written at most this often, to spare D1's daily write allowance. */
const SEEN_EVERY_MS = 60 * 60 * 1000;

const COLUMNS = "id, email, role, status, time_zone, country, created_at, approved_at, last_seen_at";

/**
 * The user behind `identity`, made if this is their first visit: pending when the site
 * requires approval, else active. On later visits the email is refreshed from the token, and
 * last_seen_at at most once an hour. `timeZone` and `country` are only used for a new user.
 */
export async function syncUser(
  db: D1Database,
  identity: Identity,
  { timeZone, country, now = new Date() }: { timeZone: string; country: string | null; now?: Date },
): Promise<SyncResult> {
  const at = isoSeconds(now);
  let row = await findBySubject(db, identity.subject);

  if (!row) {
    // One statement reads the setting and inserts, so it holds even if the setting changes
    // meanwhile. DO NOTHING covers two first visits racing each other; the loser reads the
    // row the winner made.
    await db
      .prepare(
        `INSERT INTO users (id, auth_subject, email, status, time_zone, country, created_at, approved_at, last_seen_at)
         SELECT ?1, ?2, ?3,
                CASE WHEN signup_requires_approval = 1 THEN 'pending' ELSE 'active' END,
                ?4, ?5, ?6,
                CASE WHEN signup_requires_approval = 1 THEN NULL ELSE ?6 END,
                ?6
         FROM app_settings WHERE id = 1
         ON CONFLICT DO NOTHING`,
      )
      .bind(crypto.randomUUID(), identity.subject, identity.email, timeZone, country, at)
      .run();
    row = await findBySubject(db, identity.subject);
    if (!row) {
      // Nothing was inserted: either another user already has this email (a Firebase account
      // deleted and made again gets a new uid), or the settings row is missing.
      const taken = await db.prepare("SELECT 1 FROM users WHERE email = ?1").bind(identity.email).first();
      return { error: taken ? "email_in_use" : "not_configured" };
    }
    return { user: toUser(row) };
  }

  const stale = !row.last_seen_at || Date.parse(row.last_seen_at) <= now.getTime() - SEEN_EVERY_MS;
  if (row.email !== identity.email || stale) {
    try {
      await db
        .prepare("UPDATE users SET email = ?1, last_seen_at = ?2 WHERE id = ?3")
        .bind(identity.email, at, row.id)
        .run();
      row = { ...row, email: identity.email, last_seen_at: at };
    } catch (err) {
      // The new email belongs to another user row. Keep the old one rather than fail the visit.
      if (!String(err).includes("UNIQUE")) throw err;
      console.warn(`user ${row.id}: email ${identity.email} is taken by another user; kept ${row.email}`);
    }
  }
  return { user: toUser(row) };
}

function findBySubject(db: D1Database, subject: string): Promise<UserRow | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM users WHERE auth_subject = ?1`).bind(subject).first<UserRow>();
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    timeZone: row.time_zone,
    country: row.country,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}
