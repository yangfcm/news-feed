import type { Metadata } from "next";
import Link from "next/link";
import { NoteTree } from "@/components/note-tree";
import { NoteView } from "@/components/note-view";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { decodeSegment, getNote, getNotePaths, getNoteTree, withEncodedPaths } from "@/lib/notes";

// Only the notes on disk exist; a static export cannot render others on demand.
export const dynamicParams = false;

// A static export fails on an empty list, so without any note a single
// placeholder page is generated instead.
const NO_NOTES = ["no-notes-yet"];

export function generateStaticParams() {
  const paths = getNotePaths();
  return withEncodedPaths((paths.length ? paths : [NO_NOTES]).map((path) => ({ path })));
}

export async function generateMetadata({ params }: PageProps<"/notes/[...path]">): Promise<Metadata> {
  const segments = (await params).path.map(decodeSegment);
  return { title: `News Feed · ${segments[segments.length - 1]}` };
}

export default async function NotePage({ params }: PageProps<"/notes/[...path]">) {
  const segments = (await params).path.map(decodeSegment);
  const note = getNote(segments);
  const tree = getNoteTree();

  if (!note) {
    return (
      <PageShell>
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Note</h1>
        <Card>
          <CardContent className="flex flex-col gap-2 text-muted-foreground">
            <p>No such note.</p>
            <p>
              <Link href="/notes/" className="text-foreground underline underline-offset-4">
                All notes
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell sidebar={<NoteTree tree={tree} selected={note.segments} />}>
      <NoteView note={note} />
    </PageShell>
  );
}
