import { FileTextIcon, PodcastIcon, SquarePlayIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Blog: FileTextIcon,
  Podcast: PodcastIcon,
  YouTube: SquarePlayIcon,
};

export function EntryTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? FileTextIcon;
  return (
    <Icon role="img" className={cn("size-3.5 shrink-0 text-muted-foreground", className)}>
      <title>{type}</title>
    </Icon>
  );
}
