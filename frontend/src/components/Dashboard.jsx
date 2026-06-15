import { useCallback, useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Sheet,
  Bell,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard({ darkMode, selectedDocs, setSelectedDocs }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const response = await fetch("http://localhost:5000/documents");
      const data = await response.json();
      setDocuments(data.documents || []);

      const activeDocs = (data.documents || [])
        .filter((doc) => doc.isActive && doc.isReady)
        .map((doc) => doc.id);
      setSelectedDocs((current) => current.length === 0 && activeDocs.length > 0 ? activeDocs : current);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoadingDocs(false);
    }
  }, [setSelectedDocs]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/notifications");
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchDocuments();
      void fetchNotifications();
    }, 0);
    const interval = setInterval(() => {
      void fetchDocuments();
      void fetchNotifications();
    }, 10000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [fetchDocuments, fetchNotifications]);

  const markNotificationRead = async (notification) => {
    if (!notification.readAt) {
      await fetch(`http://localhost:5000/notifications/${notification.id}/read`, { method: "PATCH" });
      await fetchNotifications();
    }
  };

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
      const response = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg, documentIds: selectedDocs }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
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
    toast.success("Chat cleared");
  };

  const activeDocumentCount = documents.filter((d) => selectedDocs.includes(d.id) && d.isReady).length;
  const totalReadyDocuments = documents.filter((d) => d.isReady).length;

  return (
    <div
      className="flex-1 newq flex overflow-hidden"
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #111318 0%, #0c0d10 100%)"
          : "linear-gradient(180deg, #f7f6f2 0%, #f3f1ea 100%)",
      }}
    >
      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-16">
              <div
                className="w-18 h-18 rounded-[28px] flex items-center justify-center"
                style={{ background: darkMode ? "#1b1d22" : "#ffffff" }}
              >
                <FileText className="w-8 h-8" style={{ color: darkMode ? "#d8f36a" : "#111111" }} />
              </div>

              <div>
                <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Ask anything
                </p>
                <h2 className={`text-3xl small md:text-4xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  Chat with your documents
                </h2>
                <p className={`text-sm mt-4 max-w-xl ${darkMode ? "text-white/55" : "text-black/45"}`}>
                  {totalReadyDocuments === 0
                    ? "No documents ready. Go to Documents to upload files or add a Google Sheet."
                    : selectedDocs.length === 0
                    ? "No documents selected. Go to Documents and enable at least one document."
                    : `Querying ${activeDocumentCount} of ${totalReadyDocuments} source(s). Ask anything!`}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[72%] text-sm px-5 py-3.5 rounded-[24px] rounded-br-md leading-relaxed"
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
              <div key={i} className="flex gap-3 justify-start items-end">
                <div
                  className="w-10 h-10 rounded-2xl flex-shrink-0"
                  style={{
                    background: darkMode
                      ? "linear-gradient(135deg, #1b1d22, #2a2f38)"
                      : "linear-gradient(135deg, #ffffff, #f1f3f7)",
                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                />
                <div
                  className="max-w-[72%] text-sm px-5 py-3.5 rounded-[24px] rounded-bl-md leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: darkMode ? "#16181d" : "#ffffff",
                    color: darkMode ? "#e8e8e8" : "#1f2937",
                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start items-end">
              <div
                className="w-10 h-10 rounded-2xl flex-shrink-0"
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
        <div className="px-8 pb-6 pt-2">
          <div className="flex gap-3 mb-3">
            <button
              onClick={clearChat}
              className={`text-xs px-4 py-2 rounded-full transition-colors ${
                darkMode
                  ? "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                  : "bg-white text-black/60 border border-black/5 hover:bg-black/[0.03]"
              }`}
            >
              Clear Chat
            </button>
            <button
              onClick={fetchDocuments}
              className={`text-xs px-4 py-2 rounded-full transition-colors flex items-center gap-1 ${
                darkMode
                  ? "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                  : "bg-white text-black/60 border border-black/5 hover:bg-black/[0.03]"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${loadingDocs ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div
            className={`rounded-full px-4 py-3 flex items-center gap-3 ${
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
              className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed px-2 py-1"
              style={{
                color: darkMode ? "#f3f4f6" : "#111827",
                caretColor: darkMode ? "#d8f36a" : "#111111",
              }}
            />
            <button
              onClick={ask}
              disabled={loading || selectedDocs.length === 0 || !question.trim() || totalReadyDocuments === 0}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 disabled:opacity-40 ${
                darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div
        className={`w-80 border-l px-6 py-6 overflow-y-auto ${
          darkMode ? "bg-[#0c0d10] border-white/10" : "bg-[#fbfaf7] border-black/5"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <p className={`text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>
            Action Notifications
          </p>
          <span className={`min-w-6 h-6 px-2 rounded-full text-xs flex items-center justify-center ${
            unreadCount > 0
              ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
              : darkMode ? "bg-white/5 text-white/40" : "bg-black/5 text-black/40"
          }`}>
            {unreadCount}
          </span>
        </div>

        <div className="space-y-2 mb-8">
          {notifications.length === 0 ? (
            <div className={`rounded-2xl p-4 text-sm ${darkMode ? "bg-white/[0.03] text-white/45" : "bg-white text-black/40"}`}>
              Automation results will appear here.
            </div>
          ) : notifications.slice(0, 3).map((notification) => (
            <button
              key={notification.id}
              onClick={() => markNotificationRead(notification)}
              className={`w-full text-left rounded-2xl p-4 border transition-colors ${
                darkMode ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]" : "bg-white border-black/5 hover:bg-black/[0.02]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  notification.errors > 0
                    ? "bg-red-500/10 text-red-500"
                    : darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-green-50 text-green-700"
                }`}>
                  {notification.severity === "warning" ? <Bell className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!notification.readAt && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    <p className={`text-sm truncate ${darkMode ? "text-white" : "text-black"}`}>{notification.title || notification.automationName}</p>
                  </div>
                  <p className={`text-xs leading-5 mt-1 ${darkMode ? "text-white/45" : "text-black/40"}`}>
                    {(notification.message || "").slice(0, 90)}{(notification.message || "").length > 90 ? "..." : ""}
                  </p>
                  <p className={`text-[11px] mt-1 ${darkMode ? "text-white/30" : "text-black/30"}`}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className={`text-[11px] uppercase tracking-[0.28em] mb-4 ${darkMode ? "text-white/40" : "text-black/35"}`}>
          Active Sources
        </p>
        {/* <h3 className={`text-2xl font-semibold mb-6 ${darkMode ? "text-white" : "text-black"}`}>
          {selectedDocs.length}
        </h3> */}

        <div className="space-y-3">
          {loadingDocs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: darkMode ? "#ffffff55" : "#9ca3af" }} />
            </div>
          ) : documents.length === 0 ? (
            <p className={`text-sm text-center py-8 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              No documents uploaded yet.
              <br />
              Go to Documents to upload files or add a Google Sheet.
            </p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-4 rounded-2xl  ${
                  darkMode ? "bg-white/[0.03] border-white/10" : "bg-white border-black/5"
                }`}
                style={{ opacity: doc.isReady ? 1 : 0.55 }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      darkMode ? "bg-white/5" : "bg-black/[0.04]"
                    }`}
                  >
                    {doc.type === "sheet" ? (
                      <Sheet className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-green-600"}`} />
                    ) : (
                      <FileText className={`w-4 h-4 ${darkMode ? "text-white/50" : "text-black/40"}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm truncate block ${darkMode ? "text-white" : "text-black"}`}>
                      {doc.name}
                    </span>
                    {doc.type === "sheet" && doc.isReady ? (
                      <span className={`text-xs ${darkMode ? "text-[#d8f36a]/60" : "text-green-600/70"}`}>
                        Live Sheet
                      </span>
                    ) : !doc.isReady ? (
                      <span className={`text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
                        Processing...
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* {doc.isReady &&
                  (selectedDocs.includes(doc.id) ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className={`w-4 h-4 flex-shrink-0 ${darkMode ? "text-white/30" : "text-black/30"}`} />
                  ))} */}
              </div>
            ))
          )}
        </div>

        {documents.filter((d) => !d.isReady).length > 0 && (
          <div
            className="mt-4 p-4 rounded-2xl border"
            style={{
              background: darkMode ? "rgba(216,243,106,0.08)" : "#fff9db",
              borderColor: darkMode ? "rgba(216,243,106,0.15)" : "#fde68a",
            }}
          >
            <p className={`text-xs leading-5 ${darkMode ? "text-[#d8f36a]" : "text-[#92400e]"}`}>
              ⚡ {documents.filter((d) => !d.isReady).length} source(s) are still processing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
