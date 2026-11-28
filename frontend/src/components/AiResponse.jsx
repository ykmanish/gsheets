"use client";

// The Dashboard assistant's answer, rendered from markdown. Its own file so the markdown
// libraries load only when an answer is shown, not with the Dashboard.
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export default function AiResponse({ children, darkMode }) {
  const muted = darkMode ? "text-white/60" : "text-[#6b6b6b]";
  const line = darkMode ? "border-white/10" : "border-[#ececec]";
  const soft = darkMode ? "bg-white/[0.05]" : "bg-[#f4f4f2]";

  return (
    <div className={`ai-response min-w-0 text-[14px] leading-7 ${darkMode ? "text-white/80" : "text-[#242424]"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children: value }) => <h1 className="mb-3 mt-6 text-[20px] tracking-[-0.01em] first:mt-0">{value}</h1>,
          h2: ({ children: value }) => <h2 className="mb-3 mt-6 text-[17px] tracking-[-0.01em] first:mt-0">{value}</h2>,
          h3: ({ children: value }) => <h3 className="mb-2 mt-5 text-[15px] first:mt-0">{value}</h3>,
          p: ({ children: value }) => <p className="my-3 first:mt-0 last:mb-0">{value}</p>,
          strong: ({ children: value }) => <strong className={darkMode ? "text-white" : "text-[#141414]"}>{value}</strong>,
          em: ({ children: value }) => <em className="italic">{value}</em>,
          ul: ({ children: value }) => <ul className={`my-4 list-disc space-y-2 pl-6 marker:text-[10px] ${darkMode ? "marker:text-[#cff07a]" : "marker:text-[#9a9a98]"}`}>{value}</ul>,
          ol: ({ children: value }) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-[#9a9a98]">{value}</ol>,
          li: ({ children: value }) => <li className="pl-1 [&>p]:my-0">{value}</li>,
          a: ({ href, children: value }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all underline decoration-1 underline-offset-4 transition ${
                darkMode ? "text-[#cff07a] decoration-[#cff07a]/40 hover:text-white" : "text-[#2f6fc0] decoration-[#2f6fc0]/30 hover:text-[#1f4f8f]"
              }`}
            >
              {value}
            </a>
          ),
          blockquote: ({ children: value }) => <blockquote className={`my-4 border-l-2 pl-4 ${line} ${muted}`}>{value}</blockquote>,
          code: ({ className, children: value }) => className ? (
            <code className="text-[13px]">{value}</code>
          ) : (
            <code className={`rounded-md px-1.5 py-0.5 text-[13px] ${soft}`}>{value}</code>
          ),
          pre: ({ children: value }) => <pre className={`my-4 overflow-x-auto rounded-[16px] p-4 text-[13px] leading-6 ${darkMode ? "bg-white/[0.04] text-white/80" : "bg-[#f7f7f5] text-[#3d3d3b]"}`}>{value}</pre>,
          hr: () => <hr className={`my-5 border-0 border-t ${line}`} />,
          table: ({ children: value }) => <div className={`my-4 overflow-x-auto rounded-[14px] border ${line}`}><table className="min-w-full border-collapse text-left text-xs">{value}</table></div>,
          thead: ({ children: value }) => <thead>{value}</thead>,
          th: ({ children: value }) => <th className={`whitespace-nowrap border-b px-3 py-2.5 ${muted} ${line}`}>{value}</th>,
          td: ({ children: value }) => <td className={`border-b px-3 py-2.5 align-top last:border-b-0 ${line}`}>{value}</td>,
        }}
      >
        {String(children || "")}
      </ReactMarkdown>
    </div>
  );
}
