import type { Metadata } from "next";
import { NoteTree } from "@/components/note-tree";
import { NoteView } from "@/components/note-view";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getNote, getNotePaths, getNoteTree } from "@/lib/notes";

export const metadata: Metadata = { title: "News Feed · Notes" };

/** Opens on the first note in tree order; each note also has its own page under /notes/. */
export default function NotesPage() {
  const tree = getNoteTree();
  const first = getNotePaths(tree)[0];
  const note = first ? getNote(first) : null;

  if (!note) {
    return (
      <PageShell>
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Notes</h1>
        <Card>
          <CardContent className="text-muted-foreground">
            <p>No notes yet. Markdown files under content/data/notes/ appear here.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell sidebar={<NoteTree tree={tree} selected={note.segments} headings={note.headings} />}>
      <NoteView note={note} />
    </PageShell>
  );
}
