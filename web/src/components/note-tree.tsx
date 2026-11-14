"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { noteHref } from "@/lib/note-href";
import { cn } from "@/lib/utils";
import type { NoteHeading, NoteNode } from "@/lib/types";

function nodeKey(segments: string[]): string {
  return segments.join("/");
}

function ancestorKeys(segments: string[] = []): string[] {
  return segments.slice(0, -1).map((_, i) => nodeKey(segments.slice(0, i + 1)));
}

type HeadingNode = { heading: NoteHeading; children: HeadingNode[] };

const HEADING_ICONS = [Heading1Icon, Heading2Icon, Heading3Icon, Heading4Icon];

/** Nests each heading under the nearest shallower one before it. */
function nestHeadings(headings: NoteHeading[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const open: HeadingNode[] = [];
  for (const heading of headings) {
    const node = { heading, children: [] };
    while (open.length && open[open.length - 1].heading.depth >= heading.depth) open.pop();
    (open.length ? open[open.length - 1].children : root).push(node);
    open.push(node);
  }
  return root;
}

function toggled(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * The sidebar tree of every note, folders expanding on click, with the selected note's
 * headings nested under it as links into the page. Only the selected note's headings are
 * known: parsing every note for the tree would cost the build N² parses and ship every
 * heading on every page. The App Router keeps this component mounted between note pages,
 * so the folders of a newly selected note are opened during render rather than from an
 * effect.
 */
export function NoteTree({
  tree,
  selected,
  headings = [],
}: {
  tree: NoteNode[];
  selected?: string[];
  headings?: NoteHeading[];
}) {
  const selectedKey = selected ? nodeKey(selected) : undefined;
  const [expanded, setExpanded] = useState(() => new Set(ancestorKeys(selected)));
  const [collapsedHeadings, setCollapsedHeadings] = useState(() => new Set<string>());
  const [headingsCollapsed, setHeadingsCollapsed] = useState(false);
  const [lastSelected, setLastSelected] = useState(selectedKey);

  if (selectedKey !== lastSelected) {
    setLastSelected(selectedKey);
    setExpanded(new Set([...expanded, ...ancestorKeys(selected)]));
    setCollapsedHeadings(new Set());
    setHeadingsCollapsed(false);
  }

  if (!tree.length) return null;

  function renderHeadings(nodes: HeadingNode[], depth: number, level: number) {
    return (
      <ul className="flex flex-col">
        {nodes.map(({ heading, children }) => {
          const open = !collapsedHeadings.has(heading.id);
          const HeadingIcon = HEADING_ICONS[heading.depth - 1] ?? Heading4Icon;
          return (
            <li key={heading.id}>
              <div
                style={{ paddingLeft: `${2.25 + depth + level * 0.75}rem` }}
                className="flex items-center gap-1 rounded-md pr-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {children.length ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? "Collapse" : "Expand"}
                    onClick={() => setCollapsedHeadings((prev) => toggled(prev, heading.id))}
                    className="cursor-pointer rounded-sm p-0.5 hover:bg-foreground/10"
                  >
                    {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
                  </button>
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <a href={`#${heading.id}`} title={heading.text} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
                  <HeadingIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{heading.text}</span>
                </a>
              </div>
              {open && children.length ? renderHeadings(children, depth, level + 1) : null}
            </li>
          );
        })}
      </ul>
    );
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
                  onClick={() => setExpanded((prev) => toggled(prev, key))}
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
          const hasHeadings = current && headings.length > 0;
          return (
            <li key={key}>
              <div
                style={indent}
                className={cn(
                  "flex items-center gap-1.5 rounded-md pr-2 text-sm transition-colors hover:bg-muted",
                  current
                    ? "bg-brand font-medium text-brand-foreground hover:bg-brand/80"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {hasHeadings ? (
                  <button
                    type="button"
                    aria-expanded={!headingsCollapsed}
                    aria-label={headingsCollapsed ? "Show headings" : "Hide headings"}
                    onClick={() => setHeadingsCollapsed((prev) => !prev)}
                    className="cursor-pointer rounded-sm hover:bg-brand-foreground/20"
                  >
                    {headingsCollapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                  </button>
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <Link
                  href={noteHref(node.segments)}
                  aria-current={current ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
                >
                  <FileTextIcon className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{node.name}</span>
                </Link>
              </div>
              {hasHeadings && !headingsCollapsed ? renderHeadings(nestHeadings(headings), depth, 0) : null}
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
