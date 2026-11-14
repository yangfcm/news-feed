import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * A note's markdown: GFM (tables, task lists, strikethrough) and LaTeX through KaTeX. Rendered at
 * build time. `strict: "ignore"` keeps KaTeX quiet about Chinese text inside math.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
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
