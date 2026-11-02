import { EntryCard } from "@/components/entry-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Entry } from "@/lib/types";

/**
 * The entry as the Article view shows it, player included, in a modal. Opened by any
 * DialogTrigger among the children; closing it unmounts the player, which stops playback.
 */
export function EntryDialog({
  entry,
  sourceHref,
  children,
}: {
  entry: Entry;
  sourceHref?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog disablePointerDismissal>
      {children}
      <DialogContent
        aria-label={entry.title}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl *:data-[slot=card]:ring-0 **:data-[slot=card-header]:pr-12"
      >
        <EntryCard entry={entry} eager sourceHref={sourceHref} />
      </DialogContent>
    </Dialog>
  );
}
