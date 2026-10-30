import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <g className="fill-none stroke-background" strokeWidth="3" strokeLinecap="round">
        <path d="M10 15a7 7 0 0 1 7 7" />
        <path d="M10 9a13 13 0 0 1 13 13" />
      </g>
      <circle cx="10" cy="22" r="2.5" className="fill-background" />
    </svg>
  );
}
