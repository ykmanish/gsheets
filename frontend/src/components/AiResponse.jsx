"use client";

// The Dashboard assistant's answer, rendered from markdown. Its own file so the markdown
// libraries load only when an answer is shown, not with the Dashboard.
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export default function AiResponse({ children, darkMode }) {
  const muted = darkMode ? "text-white/65" : "text-black/65";
  const line = darkMode ? "border-white/10" : "border-black/10";
  const soft = darkMode ? "bg-white/[0.05]" : "bg-black/[0.035]";

  return (
    <div className={`ai-response min-w-0 text-[14px] leading-7 ${darkMode ? "text-white/80" : "text-[#242424]"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children: value }) => <h1 className="mb-3 mt-6 text-xl font-semibold first:mt-0">{value}</h1>,
          h2: ({ children: value }) => <h2 className="mb-3 mt-6 text-lg font-semibold first:mt-0">{value}</h2>,
          h3: ({ children: value }) => <h3 className="mb-2 mt-5 text-base font-semibold first:mt-0">{value}</h3>,
          p: ({ children: value }) => <p className="my-3 first:mt-0 last:mb-0">{value}</p>,
          strong: ({ children: value }) => <strong className={`font-semibold ${darkMode ? "text-white" : "text-black"}`}>{value}</strong>,
          em: ({ children: value }) => <em className="italic">{value}</em>,
          ul: ({ children: value }) => <ul className={`my-4 list-disc space-y-2 pl-6 marker:text-[10px] ${darkMode ? "marker:text-[#d8f36a]" : "marker:text-black/65"}`}>{value}</ul>,
          ol: ({ children: value }) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:font-semibold">{value}</ol>,
          li: ({ children: value }) => <li className="pl-1 [&>p]:my-0">{value}</li>,
          a: ({ href, children: value }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all font-medium underline decoration-1 underline-offset-4 transition ${
                darkMode ? "text-[#d8f36a] decoration-[#d8f36a]/40 hover:text-white" : "text-blue-700 decoration-blue-700/30 hover:text-blue-900"
              }`}
            >
              {value}
            </a>
          ),
          blockquote: ({ children: value }) => <blockquote className={`my-4 border-l-2 pl-4 ${line} ${muted}`}>{value}</blockquote>,
          code: ({ className, children: value }) => className ? (
            <code className="text-[13px]">{value}</code>
          ) : (
            <code className={`rounded-md px-1.5 py-0.5 text-[13px] font-medium ${soft}`}>{value}</code>
          ),
          pre: ({ children: value }) => <pre className={`my-4 overflow-x-auto rounded-2xl p-4 text-[13px] leading-6 ${darkMode ? "bg-black/30 text-white/80" : "bg-[#f5f4ef] text-black/75"}`}>{value}</pre>,
          hr: () => <hr className={`my-5 border-0 border-t ${line}`} />,
          table: ({ children: value }) => <div className={`my-4 overflow-x-auto rounded-xl border ${line}`}><table className="min-w-full border-collapse text-left text-xs">{value}</table></div>,
          thead: ({ children: value }) => <thead className={soft}>{value}</thead>,
          th: ({ children: value }) => <th className={`whitespace-nowrap border-b px-3 py-2.5 font-semibold ${line}`}>{value}</th>,
          td: ({ children: value }) => <td className={`border-b px-3 py-2.5 align-top last:border-b-0 ${line}`}>{value}</td>,
        }}
      >
        {String(children || "")}
      </ReactMarkdown>
    </div>
  );
}
