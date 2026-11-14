"use client";

import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, FileTextIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { noteHref } from "@/lib/note-href";
import { cn } from "@/lib/utils";
import type { NoteNode } from "@/lib/types";

function nodeKey(segments: string[]): string {
  return segments.join("/");
}

function ancestorKeys(segments: string[] = []): string[] {
  return segments.slice(0, -1).map((_, i) => nodeKey(segments.slice(0, i + 1)));
}

/**
 * The sidebar tree of every note, folders expanding on click. The App Router keeps this
 * component mounted between note pages, so the folders of a newly selected note are opened
 * during render rather than from an effect.
 */
export function NoteTree({ tree, selected }: { tree: NoteNode[]; selected?: string[] }) {
  const selectedKey = selected ? nodeKey(selected) : undefined;
  const [expanded, setExpanded] = useState(() => new Set(ancestorKeys(selected)));
  const [lastSelected, setLastSelected] = useState(selectedKey);

  if (selectedKey !== lastSelected) {
    setLastSelected(selectedKey);
    setExpanded(new Set([...expanded, ...ancestorKeys(selected)]));
  }

  if (!tree.length) return null;

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderNodes(nodes: NoteNode[], depth: number) {
    return (
      <ul className="flex flex-col">
        {nodes.map((node) => {
          const key = nodeKey(node.segments);
          const indent = { paddingLeft: `${0.5 + depth * 1}rem` };
          if (node.kind === "folder") {
            const open = expanded.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(key)}
                  style={indent}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {open ? <ChevronDownIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0" />}
                  {open ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0" />}
                  <span className="min-w-0 truncate">{node.name}</span>
                </button>
                {open ? renderNodes(node.children, depth + 1) : null}
              </li>
            );
          }
          const current = key === selectedKey;
          return (
            <li key={key}>
              <Link
                href={noteHref(node.segments)}
                aria-current={current ? "page" : undefined}
                style={indent}
                className={cn(
                  "flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors hover:bg-muted",
                  current
                    ? "bg-brand font-medium text-brand-foreground hover:bg-brand/80"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileTextIcon className="ml-5.5 size-4 shrink-0" />
                <span className="min-w-0 truncate">{node.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent>{renderNodes(tree, 0)}</CardContent>
    </Card>
  );
}
