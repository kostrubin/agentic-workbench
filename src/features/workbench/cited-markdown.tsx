import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/types";
export default function CitedMarkdown({
  answer,
  citations,
  onCitation,
}: {
  answer: string;
  citations: Citation[];
  onCitation: (citation: Citation) => void;
}) {
  const linked = answer.replace(/\[(\d+)\]/g, "[$1](#source-$1)");
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ alt }) => <span>{alt ?? "Image omitted"}</span>,
        a: ({ href, children }) => {
          const match = href?.match(/^#source-(\d+)$/);
          const citation = match
            ? citations.find((c) => c.label === Number(match[1]))
            : undefined;
          return citation ? (
            <button
              className="citation"
              onClick={() => onCitation(citation)}
              aria-label={`Open citation ${citation.label}: ${citation.title}`}
            >
              {children}
            </button>
          ) : (
            <span>{children}</span>
          );
        },
      }}
    >
      {linked}
    </Markdown>
  );
}
