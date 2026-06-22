import { useCallback, useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  FileText,
  RefreshCw,
  Eye,
  X,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { DocumentIcon } from "./ui";
import { API_URL } from "./AuthProvider";

const CHAT_STORAGE_KEY = "raga-dashboard-chat-messages";

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
  const [folders, setFolders] = useState([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [refreshingDocs, setRefreshingDocs] = useState(false);
  const [viewDocument, setViewDocument] = useState(null);
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
      setFolders(data.folders || []);

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
  const activeDocumentCount = activeDocuments.filter((d) => selectedDocs.includes(d.id)).length;
  const totalReadyDocuments = activeDocuments.length;
  const sourceQuery = sourceSearch.trim().toLowerCase();
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const filteredActiveSources = activeDocuments.filter((doc) => {
    if (!sourceQuery) return true;
    const folderName = folderMap.get(doc.folderId)?.name || "Unfiled sources";
    return `${doc.name} ${doc.type} ${folderName}`.toLowerCase().includes(sourceQuery);
  });
  const groupedActiveSources = filteredActiveSources.reduce((groups, doc) => {
    const folderName = folderMap.get(doc.folderId)?.name || "Unfiled sources";
    const existingGroup = groups.find((group) => group.name === folderName);
    if (existingGroup) {
      existingGroup.docs.push(doc);
      return groups;
    }
    groups.push({ name: folderName, docs: [doc] });
    return groups;
  }, []);
  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div
      className="flex-1 newq flex min-h-0 flex-col overflow-hidden lg:flex-row"
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #111318 0%, #0c0d10 100%)"
          : "linear-gradient(180deg, #f7f6f2 0%, #f3f1ea 100%)",
      }}
    >
      {/* ── Chat Area ── */}
      <div className="flex-1 flex min-h-[58vh] flex-col overflow-hidden lg:min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sm:px-6 lg:px-8 lg:py-8">
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
                <h2 className={`text-2xl small font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>
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
                  className="max-w-[88%] break-words text-sm px-4 py-3 rounded-[22px] rounded-bl-md leading-relaxed whitespace-pre-wrap sm:max-w-[72%] sm:px-5 sm:py-3.5"
                  style={{
                    background: darkMode ? "#16181d" : "#ffffff",
                    color: darkMode ? "#e8e8e8" : "#1f2937",
                    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {msg.text}
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

      {/* ── Sidebar ── */}
      <div
        className={`w-full border-t px-4 py-5 overflow-y-auto lg:w-80 lg:border-l lg:border-t-0 lg:px-6 lg:py-6 ${
          darkMode ? "bg-[#0c0d10] border-white/10" : "bg-[#fbfaf7] border-black/5"
        }`}
      >
        {/* <div className="flex items-center justify-between mb-4">
          <p className={`text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>
            Action Notifications
          </p>
          <span className={`min-w-6 h-6 px-2 rounded-full text-xs flex items-center justify-center ${
            connectedDocuments.length > 0
              ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
              : darkMode ? "bg-white/5 text-white/40" : "bg-black/5 text-black/40"
          }`}>
            {connectedDocuments.length}
          </span>
        </div> */}

        {/* <div className={`rounded-2xl overflow-hidden mb-6 border lg:mb-8 ${
          darkMode ? "bg-white/[0.03] border-white/10" : "bg-white border-black/5"
        }`}>
          {loadingDocs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: darkMode ? "#ffffff55" : "#9ca3af" }} />
            </div>
          ) : connectedDocuments.length === 0 ? (
            <div className={`p-4 text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>
              No connected documents yet.
            </div>
          ) : (
            <div className="max-h-56 overflow-auto">
              <table className="w-full min-w-[300px] text-left">
                <thead className={darkMode ? "bg-[#0c0d10]" : "bg-[#fbfaf7]"}>
                  <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                    {["Document", "Type", "View"].map((header) => (
                      <th key={header} className={`px-3 py-3 text-[10px] uppercase tracking-[0.18em] font-medium ${darkMode ? "text-white/45" : "text-black/35"}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {connectedDocuments.map((doc) => (
                    <tr key={doc.id} className={darkMode ? "border-b border-white/5 last:border-0" : "border-b border-black/5 last:border-0"}>
                      <td className="px-3 py-3 min-w-0">
                        <span className={`block max-w-[130px] truncate text-xs ${darkMode ? "text-white" : "text-black"}`}>
                          {doc.name}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-xs ${darkMode ? "text-white/55" : "text-black/45"}`}>
                        {doc.type === "sheet" ? "Sheet" : "File"}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setViewDocument(doc)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            darkMode ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-black/[0.04] text-black/60 hover:bg-black/[0.07]"
                          }`}
                          title="View document details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          )}
        </div> */}

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className={`text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>
            Active Sources
          </p>
          <span className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/5 text-white/45" : "bg-black/5 text-black/45"}`}>
            {filteredActiveSources.length}
          </span>
        </div>

        <div
          className={`mb-4 flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${
            darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/5 bg-white"
          }`}
        >
          <Search className={`h-4 w-4 flex-shrink-0 ${darkMode ? "text-white/35" : "text-black/35"}`} />
          <input
            value={sourceSearch}
            onChange={(event) => setSourceSearch(event.target.value)}
            placeholder="Search files or folders..."
            className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
              darkMode ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/35"
            }`}
          />
          {sourceSearch && (
            <button
              type="button"
              onClick={() => setSourceSearch("")}
              className={`flex h-7 w-7 items-center justify-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
              title="Clear search"
            >
              <X className={`h-3.5 w-3.5 ${darkMode ? "text-white/45" : "text-black/40"}`} />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {loadingDocs && documents.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: darkMode ? "#ffffff55" : "#9ca3af" }} />
            </div>
          ) : activeDocuments.length === 0 ? (
            <p className={`text-sm text-center py-8 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              No active sources available.
              <br />
              Enable a ready source in Documents to use it here.
            </p>
          ) : groupedActiveSources.length === 0 ? (
            <p className={`text-sm text-center py-8 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              No sources match your search.
            </p>
          ) : (
            groupedActiveSources.map((group) => (
              <section key={group.name}>
                <div className={`mb-2 flex items-center justify-between text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
                  <span className="max-w-[210px] truncate uppercase tracking-[0.18em]">{group.name}</span>
                  <span>{group.docs.length}</span>
                </div>
                <div className="space-y-2">
                  {group.docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setViewDocument(doc)}
                      className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition ${
                        darkMode ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]" : "bg-white border-black/5 hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                            darkMode ? "bg-white/5" : "bg-black/[0.04]"
                          }`}
                        >
                          <DocumentIcon doc={doc} darkMode={darkMode} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${darkMode ? "text-white" : "text-black"}`}>
                            {doc.name}
                          </span>
                          <span className={`mt-0.5 block text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
                            {doc.type === "sheet" ? "Live Sheet" : doc.source === "drive" ? "Drive file" : "File"}
                          </span>
                        </div>
                      </div>
                      <Eye className={`h-4 w-4 flex-shrink-0 ${darkMode ? "text-white/35" : "text-black/35"}`} />
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {documents.filter((d) => d.isActive && !d.isReady).length > 0 && (
          <div
            className="mt-4 p-4 rounded-2xl border"
            style={{
              background: darkMode ? "rgba(216,243,106,0.08)" : "#fff9db",
              borderColor: darkMode ? "rgba(216,243,106,0.15)" : "#fde68a",
            }}
          >
            <p className={`text-xs leading-5 ${darkMode ? "text-[#d8f36a]" : "text-[#92400e]"}`}>
              {documents.filter((d) => d.isActive && !d.isReady).length} source(s) are still processing.
            </p>
          </div>
        )}
      </div>

      {viewDocument && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] p-5 sm:rounded-[28px] sm:p-6 ${
              darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Document details
                </p>
                <h3 className={`text-2xl small font-semibold truncate ${darkMode ? "text-white" : "text-black"}`}>
                  {viewDocument.name}
                </h3>
              </div>
              <button
                onClick={() => setViewDocument(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  darkMode ? "hover:bg-white/5" : "hover:bg-black/5"
                }`}
                title="Close"
              >
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Type", viewDocument.type === "sheet" ? "Google Sheet" : "File"],
                ["Status", viewDocument.isReady ? "Ready" : "Processing"],
                ["Query state", viewDocument.isActive ? "Active" : "Inactive"],
                ["Chunks", viewDocument.chunks || 0],
                ["Uploaded", formatDateTime(viewDocument.uploadedAt)],
                ["Last synced", formatDateTime(viewDocument.lastSyncedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={`rounded-2xl p-4 ${darkMode ? "bg-white/[0.04]" : "bg-black/[0.025]"}`}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${darkMode ? "text-white/35" : "text-black/35"}`}>
                    {label}
                  </p>
                  <p className={`text-sm mt-2 break-words ${darkMode ? "text-white/80" : "text-black/70"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
