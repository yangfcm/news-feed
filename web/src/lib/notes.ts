import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { DATA_DIR } from "@/lib/data";
import { remarkHeadingIds } from "@/lib/remark-heading-ids";
import type { Note, NoteHeading, NoteNode } from "@/lib/types";

const NOTES_DIR = path.join(DATA_DIR, "notes");

function byName(a: NoteNode, b: NoteNode): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

/** Folders first, then files, each by name; folders without any note are left out. */
function readTree(dir: string, segments: string[]): NoteNode[] {
  const folders: NoteNode[] = [];
  const files: NoteNode[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      const children = readTree(path.join(dir, entry.name), [...segments, entry.name]);
      if (children.length) folders.push({ kind: "folder", name: entry.name, segments: [...segments, entry.name], children });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const name = entry.name.slice(0, -3);
      files.push({ kind: "file", name, segments: [...segments, name] });
    }
  }
  return [...folders.sort(byName), ...files.sort(byName)];
}

export const getNoteTree = cache((): NoteNode[] => {
  if (!existsSync(NOTES_DIR)) return [];
  return readTree(NOTES_DIR, []);
});

/** Every note's segments, in tree order; the first is the note /notes/ shows. */
export function getNotePaths(tree: NoteNode[] = getNoteTree()): string[][] {
  return tree.flatMap((node) => (node.kind === "folder" ? getNotePaths(node.children) : [node.segments]));
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function isSafeSegment(segment: string): boolean {
  return segment !== "" && segment !== ".." && !segment.startsWith(".") && !/[/\\]/.test(segment);
}

/** A note's file, split into its front matter, body and the body's headings. */
function readNoteFile(file: string): Pick<Note, "meta" | "content" | "headings"> | null {
  try {
    const raw = readFileSync(file, "utf8");
    const match = raw.match(FRONT_MATTER);
    const content = match ? raw.slice(match[0].length) : raw;
    return { meta: match?.[1].trim() || undefined, content, headings: readHeadings(content) };
  } catch {
    console.warn(`warning: could not read ${file}`);
    return null;
  }
}

export function getNote(segments: string[]): Note | null {
  if (!segments.length || !segments.every(isSafeSegment)) return null;
  const file = path.resolve(NOTES_DIR, ...segments) + ".md";
  if (!file.startsWith(NOTES_DIR + path.sep) || !existsSync(file)) return null;
  const note = readNoteFile(file);
  return note && { title: segments[segments.length - 1], segments, ...note };
}

/** The same remark pipeline as the Markdown component, so the ids it collects are the rendered ones. */
function readHeadings(content: string): NoteHeading[] {
  const headings: NoteHeading[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkHeadingIds, { onHeading: (heading) => headings.push(heading) });
  processor.runSync(processor.parse(content));
  return headings;
}

/** A built page's params are the raw names, which may hold a `%` that is not an escape. */
export function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Static params keyed by a note's path, for generateStaticParams. As with withEncodedSlugs, the
 * dev server checks the request's percent-encoded path against them, so a path with non-ASCII
 * characters also needs its encoded form there. The build doesn't.
 */
export function withEncodedPaths<T extends { path: string[] }>(params: T[]): T[] {
  if (process.env.NODE_ENV !== "development") return params;
  const encoded = params
    .map((param) => ({ ...param, path: param.path.map(encodeURIComponent) }))
    .filter((param, i) => param.path.join("/") !== params[i].path.join("/"));
  return [...params, ...encoded];
}
