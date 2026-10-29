// HTTP with the retry policy the skill promises: 20s timeout, one retry after 10s.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const TIMEOUT_MS = 20_000;
export const RETRY_DELAY_MS = 10_000;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(err) {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return `timed out after ${TIMEOUT_MS / 1000}s`;
  const message = err?.message || String(err);
  // Node reports DNS/TLS/socket problems as a bare "fetch failed"; the cause has the detail.
  const cause = err?.cause;
  if (cause && message === "fetch failed") {
    const detail = cause.code || cause.message;
    if (detail) return `fetch failed (${detail})`;
  }
  return message;
}

async function once(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", Cookie: "CONSENT=YES+1" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Keep the body: YouTube explains refusals (bad key, quota) in its JSON error.
    let detail = "";
    try {
      const body = await res.text();
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message || body.slice(0, 200);
    } catch {
      detail = "";
    }
    const err = new Error(`HTTP ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

/** Fetch a URL as text, retrying once after RETRY_DELAY_MS before giving up. */
export async function fetchText(url) {
  try {
    return await once(url);
  } catch (first) {
    await sleep(RETRY_DELAY_MS);
    try {
      return await once(url);
    } catch (second) {
      throw new Error(`${describe(first)}; retried: ${describe(second)}`);
    }
  }
}

export async function fetchJson(url) {
  const body = await fetchText(url);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("response was not valid JSON");
  }
}

/** Run fn over items with at most `limit` in flight, preserving input order. */
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
