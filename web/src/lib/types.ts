// Shapes of the files the news-feed skill writes to output/data/ (see SKILL.md, Step 3).

export type Entry = {
  title: string;
  source: string;
  type: string;
  publisher: string;
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
  /** Hours of the latest run's window. Missing in day files written before it existed. */
  coverage?: number | null;
  entryCount: number;
  entries: Entry[];
  errors: FetchError[];
};

export type IndexDate = {
  date: string;
  coverage?: number | null;
  entryCount: number;
  /** Relative to output/data/. */
  path: string;
  indexPath?: string;
};

export type GlobalIndex = {
  updatedAt?: string;
  dates: IndexDate[];
};
