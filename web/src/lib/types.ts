// Shapes of the files the news-feed skill writes to content/data/ (see SKILL.md, Step 3).

export type Entry = {
  title: string;
  source: string;
  type: string;
  sourceLink: string;
  publishedAt: string;
  link: string;
  thumbnail: string;
  category: string[];
  summary: string;
  tags: string[];
  audioLink: string | null;
  videoId: string | null;
  /** Whole seconds. */
  duration: number | null;
};

export type FetchError = {
  source: string;
  type: string;
  link: string;
  error: string;
};

export type Day = {
  date: string;
  updatedAt: string;
  entryCount: number;
  entries: Entry[];
  errors: FetchError[];
};

export type IndexDate = {
  date: string;
  entryCount: number;
  /** Relative to content/data/. */
  path: string;
};

export type GlobalIndex = {
  updatedAt?: string;
  dates: IndexDate[];
};

/** One row of sources/index.json. */
export type SourceSummary = {
  name: string;
  /** The URL segment of the source's page; the file is sources/<slug>.json. */
  slug: string;
  type: string;
  category: string[];
  sourceLink: string;
  entryCount: number;
  /** "" when the source has no entries yet. */
  latestPublishedAt: string;
  /** Relative to content/data/. */
  path: string;
};

export type SourceIndex = {
  updatedAt?: string;
  sourceCount: number;
  entryCount: number;
  sources: SourceSummary[];
};

/** A source file: everything one source has published, newest first. */
export type Source = {
  name: string;
  slug: string;
  type: string;
  category: string[];
  sourceLink: string;
  updatedAt: string;
  entryCount: number;
  entries: Entry[];
};

/** An h1–h4 of a note; `id` is the heading element's id, for linking to it. */
export type NoteHeading = {
  depth: number;
  text: string;
  id: string;
};

/** A folder or a .md file under content/data/notes/; `segments` is its path from there, without .md. */
export type NoteNode =
  | { kind: "folder"; name: string; segments: string[]; children: NoteNode[] }
  | { kind: "file"; name: string; segments: string[] };

export type Note = {
  title: string;
  segments: string[];
  /** The front matter between the leading `---` lines, if any, without them. */
  meta?: string;
  content: string;
  headings: NoteHeading[];
};
