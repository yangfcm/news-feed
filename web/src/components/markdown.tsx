import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkHeadingIds } from "@/lib/remark-heading-ids";

/**
 * A note's markdown: GFM (tables, task lists, strikethrough) and LaTeX through KaTeX. Rendered at
 * build time. `strict: "ignore"` keeps KaTeX quiet about Chinese text inside math.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-40 prose-h1:border-b-2 prose-h1:pb-2 prose-h1:text-3xl prose-h2:border-b prose-h2:pb-1.5 prose-h2:text-2xl prose-h3:text-xl prose-h4:text-sm prose-h4:tracking-wide prose-h4:text-muted-foreground prose-h4:uppercase prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkHeadingIds]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore" }]]}
        components={{
          table: ({ node, ...props }) => {
            void node;
            return (
              <div className="overflow-x-auto">
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
