import Image from "next/image";
import { AudioPlayer } from "@/components/audio-player";
import { YouTubePlayer } from "@/components/youtube-player";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import type { Entry } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** One entry, laid out like its section in the day's Markdown note. */
export function EntryCard({ entry, eager = false }: { entry: Entry; eager?: boolean }) {
  const loading = eager ? "eager" : "lazy";
  const fields = (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      <Field label="Source">
        <span className="flex flex-wrap items-center gap-1.5">
          {entry.source}
          <Badge>{entry.type}</Badge>
        </span>
      </Field>
      <Field label="Published">{entry.publishedAt}</Field>
      {entry.duration ? <Field label="Duration">{formatDuration(entry.duration)}</Field> : null}
      {entry.category.length ? (
        <Field label="Category">
          <span className="flex flex-wrap gap-1">
            {entry.category.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </span>
        </Field>
      ) : null}
      {entry.tags.length ? (
        <Field label="Tags">
          <span className="flex flex-wrap gap-1">
            {entry.tags.map((t) => (
              <Badge key={t} variant="outline">
                #{t}
              </Badge>
            ))}
          </span>
        </Field>
      ) : null}
    </dl>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg leading-snug">
          <h2>
            <a href={entry.link} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              {entry.title}
            </a>
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entry.videoId ? (
          <>
            <YouTubePlayer videoId={entry.videoId} title={entry.title} thumbnail={entry.thumbnail} loading={loading} />
            {fields}
          </>
        ) : (
          <div className="flex gap-4">
            {entry.thumbnail ? (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted sm:size-24">
                <Image src={entry.thumbnail} alt="" fill sizes="96px" loading={loading} className="object-cover" />
              </div>
            ) : null}
            {fields}
          </div>
        )}
        {entry.audioLink ? <AudioPlayer src={entry.audioLink} title={entry.title} /> : null}
        {/* Digests made without Claude have no summary (or tags), so neither is shown. */}
        {entry.summary?.trim() ? <p className="leading-relaxed">{entry.summary}</p> : null}
      </CardContent>
    </Card>
  );
}
