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
