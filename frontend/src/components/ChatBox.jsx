"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Plus, X, FileText, Moon, Sun } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function ChatBox() {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    await uploadPDF(selected);
  };

  const uploadPDF = async (selectedFile) => {
    const f = selectedFile || file;
    if (!f) return;

    const formData = new FormData();
    formData.append("pdf", f);
    const uploadToast = toast.loading(`Uploading "${f.name}"...`);

    try {
      setUploading(true);
      setStatus("Uploading...");
      const response = await fetch("http://localhost:5000/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setDocumentId(data.documentId);
      toast.success("Uploaded! Processing...", { id: uploadToast });
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `"${f.name}" uploaded. Processing...` },
      ]);
    } catch (err) {
      console.error(err);
      setStatus("Upload Failed");
      toast.error("Upload failed", { id: uploadToast });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!documentId) return;
    const processingToast = toast.loading("Processing document...");

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/status/${documentId}`);
        const data = await res.json();
        setStatus(data.stage);
        if (data.ready) {
          setReady(true);
          clearInterval(interval);
          toast.success("PDF is ready! Ask anything.", { id: processingToast });
          setMessages((prev) => [
            ...prev,
            { role: "system", text: "PDF ready! Ask me anything about it." },
          ]);
        }
      } catch (error) {
        console.error(error);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      toast.dismiss(processingToast);
    };
  }, [documentId]);

  const ask = async () => {
    if (!question.trim()) return;
    if (!ready) {
      toast.error("Upload and process a PDF first");
      return;
    }
    const userMsg = question;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setQuestion("");
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg, documentId }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Something went wrong." },
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

  const resetChat = () => {
    setMessages([]);
    setFile(null);
    setDocumentId("");
    setReady(false);
    setStatus("");
    setQuestion("");
  };

  return (
    <div
      className="min-h-screen newq w-full flex items-center justify-center p-4 font-sans transition-colors duration-300"
      style={{
        background: darkMode
          ? "#0f0f0f"
          : "linear-gradient(135deg, #eff6ff, #eef2ff, #f5f3ff)",
      }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "12px",
            background: darkMode ? "#1a1a1a" : "#fff",
            color: darkMode ? "#e8e8e8" : "#374151",
            border: darkMode ? "1px solid #2a2a2a" : "1px solid #f3f4f6",
            fontSize: "14px",
          },
        }}
      />

      {/* Card */}
      <div
        className="w-full newq max-w-7xl rounded-3xl overflow-hidden flex flex-col h-[85vh] transition-all duration-300"
        style={{
          background: darkMode ? "#111111" : "#ffffff",
          border: darkMode ? "1px solid #2a2a2a" : "1px solid #f3f4f6",
          box: darkMode
            ? "0 20px 60px -15px rgba(0,0,0,0.8)"
            : "0 20px 60px -15px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-6 transition-colors duration-300"
          style={{
            borderBottom: darkMode ? "1px solid #2a2a2a" : "1px solid #f3f4f6",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center -md transition-colors duration-300"
              style={{ background: darkMode ? "#1a1a1a" : "#000000", border: darkMode ? "1px solid #2a2a2a" : "none" }}
            >
              <FileText className="w-4 h-4" style={{ color: darkMode ? "#c8f135" : "#ffffff" }} />
            </div>
            <h1
              className="text-lg small font-semibold transition-colors duration-300"
              style={{ color: darkMode ? "#e8e8e8" : "#1f2937" }}
            >
              UIPL Docs
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                background: darkMode ? "#1a1a1a" : "#f3f4f6",
                border: darkMode ? "1px solid #2a2a2a" : "1px solid transparent",
                color: darkMode ? "#c8f135" : "#6b7280",
              }}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Close / Reset Button */}
            <button
              onClick={resetChat}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                color: darkMode ? "#888888" : "#9ca3af",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = darkMode ? "#e8e8e8" : "#374151")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = darkMode ? "#888888" : "#9ca3af")
              }
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-8 py-6 space-y-4 transition-colors duration-300"
          style={{ background: darkMode ? "#111111" : "#ffffff" }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center -lg transition-colors duration-300"
                style={{
                  background: darkMode ? "#1a1a1a" : "#000000",
                  border: darkMode ? "1px solid #2a2a2a" : "none",
                }}
              >
                <FileText
                  className="w-6 h-6"
                  style={{ color: darkMode ? "#c8f135" : "#ffffff" }}
                />
              </div>
              <h2
                className="text-2xl small font-semibold transition-colors duration-300"
                style={{ color: darkMode ? "#e8e8e8" : "#1f2937" }}
              >
                Upload a document to begin
              </h2>
              <p
                className="text-sm max-w-xl transition-colors duration-300"
                style={{ color: darkMode ? "#888888" : "#9ca3af" }}
              >
                Upload a PDF, CSV, or spreadsheet and start chatting with it instantly.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={i} className="flex justify-center">
                  <span
                    className="text-xs px-4 py-1.5 rounded-full transition-colors duration-300"
                    style={{
                      color: darkMode ? "#888888" : "#6b7280",
                      background: darkMode ? "#1a1a1a" : "#f9fafb",
                      border: darkMode ? "1px solid #2a2a2a" : "1px solid #f3f4f6",
                    }}
                  >
                    {msg.text}
                  </span>
                </div>
              );
            }
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[70%] text-sm px-5 py-3 rounded-2xl rounded-br-md leading-relaxed transition-colors duration-300"
                    style={{
                      background: darkMode ? "#1e2a1a" : "#dbeafe",
                      color: darkMode ? "#c8f135" : "#1e3a8a",
                      border: darkMode ? "1px solid #2a3a1a" : "none",
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
                  className="w-8 h-8 rounded-full flex-shrink-0 -sm"
                  style={{
                    background: darkMode
                      ? "linear-gradient(135deg, #1a1a1a, #2a2a2a)"
                      : "linear-gradient(135deg, #93c5fd, #818cf8, #c084fc)",
                    border: darkMode ? "1px solid #c8f135" : "none",
                  }}
                />
                <div
                  className="max-w-[70%] text-sm px-5 py-3 rounded-2xl rounded-bl-md leading-relaxed whitespace-pre-wrap transition-colors duration-300"
                  style={{
                    background: darkMode ? "#1a1a1a" : "#f3f4f6",
                    color: darkMode ? "#e8e8e8" : "#374151",
                    border: darkMode ? "1px solid #2a2a2a" : "none",
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
                className="w-8 h-8 rounded-full flex-shrink-0 -sm"
                style={{
                  background: darkMode
                    ? "linear-gradient(135deg, #1a1a1a, #2a2a2a)"
                    : "linear-gradient(135deg, #93c5fd, #818cf8, #c084fc)",
                  border: darkMode ? "1px solid #c8f135" : "none",
                }}
              />
              <div
                className="text-sm px-5 py-3 rounded-2xl rounded-bl-md flex items-center gap-2 transition-colors duration-300"
                style={{
                  background: darkMode ? "#1a1a1a" : "#f3f4f6",
                  color: darkMode ? "#888888" : "#9ca3af",
                  border: darkMode ? "1px solid #2a2a2a" : "none",
                }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}

          {status && !ready && documentId && (
            <div className="flex justify-center">
              <span
                className="inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full transition-colors duration-300"
                style={{
                  background: darkMode ? "#1a1a1a" : "#eff6ff",
                  border: darkMode ? "1px solid #c8f135" : "1px solid #bfdbfe",
                  color: darkMode ? "#c8f135" : "#2563eb",
                }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                {status}
              </span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="px-8 pb-6 pt-2 transition-colors duration-300"
          style={{ background: darkMode ? "#111111" : "#ffffff" }}
        >
          <div
            className="rounded-full px-5 py-2 flex items-center gap-3 transition-colors duration-300"
            style={{
              background: darkMode ? "#1a1a1a" : "#f9fafb",
              border: darkMode ? "1px solid #2a2a2a" : "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="transition-colors disabled:opacity-50"
              style={{ color: darkMode ? "#888888" : "#9ca3af" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = darkMode ? "#c8f135" : "#3b82f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = darkMode ? "#888888" : "#9ca3af")
              }
              title="Upload file"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.csv,.xlsx,.xls,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
              className="hidden"
              onChange={handleFileChange}
            />

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ready ? "How else can I help?" : "Upload a PDF to begin..."}
              disabled={!ready}
              className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed py-2 transition-colors duration-300"
              style={{
                color: darkMode ? "#e8e8e8" : "#374151",
                caretColor: darkMode ? "#c8f135" : "#3b82f6",
              }}
            />

            <button
              onClick={ask}
              disabled={loading || !ready || !question.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 disabled:opacity-40"
              style={{
                background: darkMode ? "#2a2a2a" : "#f3f4f6",
                color: darkMode ? "#c8f135" : "#374151",
                border: darkMode ? "1px solid #3a3a3a" : "none",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
