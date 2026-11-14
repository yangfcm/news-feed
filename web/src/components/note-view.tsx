import { Markdown } from "@/components/markdown";
import { SidebarMenu } from "@/components/sidebar-menu";
import type { Note } from "@/lib/types";

/** A note's page: its heading (file name and path from the notes folder), then the rendered markdown. */
export function NoteView({ note }: { note: Note }) {
  const notePath = ["Notes", ...note.segments].join("/");

  return (
    <>
      <div className="sticky top-14 z-30 -mt-3 mb-3 flex flex-col gap-1 bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <p className="text-sm text-muted-foreground">{notePath}</p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-semibold tracking-tight">{note.title}</h1>
          <div className="flex shrink-0 items-center gap-2 py-0.5">
            <SidebarMenu />
          </div>
        </div>
      </div>
      {note.meta ? <p className="mb-6 text-sm whitespace-pre-line text-muted-foreground">{note.meta}</p> : null}
      <Markdown content={note.content} />
    </>
  );
}
