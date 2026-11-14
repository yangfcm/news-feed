import GithubSlugger from "github-slugger";
import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { NoteHeading } from "@/lib/types";

const MAX_DEPTH = 4;

/**
 * Gives every h1–h4 an id made from its text, as GitHub does, and reports each to `onHeading`.
 * The sidebar and the rendered note both run it on the same tree, so their ids agree.
 */
export function remarkHeadingIds({ onHeading }: { onHeading?: (heading: NoteHeading) => void } = {}) {
  return (tree: Root) => {
    const slugger = new GithubSlugger();
    visit(tree, "heading", (node) => {
      if (node.depth > MAX_DEPTH) return;
      const text = toString(node);
      const id = slugger.slug(text);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      onHeading?.({ depth: node.depth, text, id });
    });
  };
}
