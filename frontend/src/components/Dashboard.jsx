import { useCallback, useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  MessageCircle,
  RefreshCw,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { API_URL } from "./AuthProvider";
import DailySummary from "./DailySummary";

const CHAT_STORAGE_KEY = "raga-dashboard-chat-messages";

function AiResponse({ children, darkMode }) {
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

export default function Dashboard({ darkMode, selectedDocs, setSelectedDocs }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const storedMessages = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (!storedMessages) return [];
      const parsedMessages = JSON.parse(storedMessages);
      return Array.isArray(parsedMessages) ? parsedMessages : [];
    } catch (error) {
      console.error("Error loading saved chat:", error);
      return [];
    }
  });
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [refreshingDocs, setRefreshingDocs] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const fetchDocuments = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) setLoadingDocs(true);
      setRefreshingDocs(true);
      const response = await fetch(`${API_URL}/documents`);
      const data = await response.json();
      setDocuments(data.documents || []);

      const activeDocs = (data.documents || [])
        .filter((doc) => doc.isActive && doc.isReady)
        .map((doc) => doc.id);
      setSelectedDocs((current) => {
        const filteredCurrent = current.filter((id) => activeDocs.includes(id));
        return filteredCurrent.length === 0 && activeDocs.length > 0 ? activeDocs : filteredCurrent;
      });
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      if (showLoader) setLoadingDocs(false);
      setRefreshingDocs(false);
    }
  }, [setSelectedDocs]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchDocuments({ showLoader: true });
    }, 0);
    const interval = setInterval(() => {
      void fetchDocuments();
    }, 10000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [fetchDocuments]);

  const ask = async () => {
    if (!question.trim()) return;
    if (selectedDocs.length === 0) {
      toast.error("Please enable at least one document in the Documents section");
      return;
    }

    const userMsg = question;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setQuestion("");

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg, documentIds: selectedDocs }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not answer the question");
      setMessages((prev) => [...prev, {
        role: "ai",
        text: data.answer,
        model: data.model,
        modelTier: data.modelTier,
        routingReason: data.routingReason,
      }]);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Something went wrong");
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const clearChat = () => {
    setMessages([]);
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    toast.success("Chat cleared");
  };

  const activeDocuments = documents.filter((doc) => doc.isReady && doc.isActive);
  const totalReadyDocuments = activeDocuments.length;

  return (
    <div
      className={`flex-1 newq flex min-h-0 flex-col overflow-hidden transition-colors duration-300 ${
        darkMode
          ? "bg-[#0c0d10] text-white"
          : "bg-[#eef3f2] bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:72px_72px] text-[#171714]"
      }`}
    >
      {/* ── Chat Area ── */}
      <div className="flex-1 flex min-h-[58vh] flex-col overflow-hidden lg:min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sm:px-6 lg:px-8 lg:py-8">
          {messages.length === 0 && (
            <div className="mx-auto w-full max-w-[1600px] py-2">
              <DailySummary darkMode={darkMode} />
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[88%] break-words text-sm px-4 py-3 rounded-[22px] rounded-br-md leading-relaxed sm:max-w-[72%] sm:px-5 sm:py-3.5"
                    style={{
                      background: darkMode ? "#d8f36a" : "#111111",
                      color: darkMode ? "#111111" : "#ffffff",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex gap-2 justify-start items-end sm:gap-3">
                <div
                  className="hidden w-10 h-10 rounded-2xl flex-shrink-0 sm:block"
                  style={{
                    background: darkMode
                      ? "linear-gradient(135deg, #1b1d22, #2a2f38)"
                      : "linear-gradient(135deg, #ffffff, #f1f3f7)",
                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                />
                <div
                  className="max-w-[88%] break-words px-4 py-3 rounded-[22px] rounded-bl-md sm:max-w-[72%] sm:px-5 sm:py-3.5"
                  style={{
                    background: darkMode ? "#16181d" : "#ffffff",
                    color: darkMode ? "#e8e8e8" : "#1f2937",
                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <AiResponse darkMode={darkMode}>{msg.text}</AiResponse>
                  {msg.modelTier && (
                    <div className={`mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] ${darkMode ? "text-white/35" : "text-black/35"}`}>
                      <span>Claude {msg.modelTier}</span>
                      {msg.routingReason && <span>· {msg.routingReason}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2 justify-start items-end sm:gap-3">
              <div
                className="hidden w-10 h-10 rounded-2xl flex-shrink-0 sm:block"
                style={{
                  background: darkMode
                    ? "linear-gradient(135deg, #1b1d22, #2a2f38)"
                    : "linear-gradient(135deg, #ffffff, #f1f3f7)",
                  border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                }}
              />
              <div
                className="text-sm px-5 py-3.5 rounded-[24px] rounded-bl-md flex items-center gap-2"
                style={{
                  background: darkMode ? "#16181d" : "#ffffff",
                  color: darkMode ? "#ffffff66" : "#6b7280",
                  border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* ── Input Bar ── */}
        <div className="px-4 pb-4 pt-2 sm:px-6 lg:px-8 lg:pb-6">
          <div className="flex gap-2 mb-3 sm:gap-3">
            <button
              onClick={clearChat}
              className={`text-xs px-3 py-2 rounded-full transition-colors sm:px-4 ${
                darkMode
                  ? "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                  : "bg-white text-black/60 border border-black/5 hover:bg-black/[0.03]"
              }`}
            >
              Clear Chat
            </button>
            <button
              onClick={() => fetchDocuments()}
              className={`text-xs px-3 py-2 rounded-full transition-colors flex items-center gap-1 sm:px-4 ${
                darkMode
                  ? "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                  : "bg-white text-black/60 border border-black/5 hover:bg-black/[0.03]"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${refreshingDocs ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div
            className={`rounded-[24px] px-3 py-2.5 flex items-center gap-2 sm:rounded-full sm:px-4 sm:py-3 sm:gap-3 ${
              darkMode ? "bg-[#16181d] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                totalReadyDocuments === 0
                  ? "No documents available. Upload a file or add a Google Sheet first..."
                  : selectedDocs.length === 0
                  ? "No documents selected. Enable documents in the Documents section..."
                  : "Ask anything about your documents or sheets..."
              }
              disabled={selectedDocs.length === 0 || totalReadyDocuments === 0}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed px-2 py-1"
              style={{
                color: darkMode ? "#f3f4f6" : "#111827",
                caretColor: darkMode ? "#d8f36a" : "#111111",
              }}
            />
            <button
              onClick={ask}
              disabled={loading || selectedDocs.length === 0 || !question.trim() || totalReadyDocuments === 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 disabled:opacity-40 sm:h-11 sm:w-11 ${
                darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>


    </div>
  );
}
