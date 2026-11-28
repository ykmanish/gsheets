"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Plus, X, FileText, Moon, Sparkles, Sun } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { API_URL } from "./AuthProvider";
import { IconTile } from "./ui";

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
      const response = await fetch(`${API_URL}/upload`, {
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
        const res = await fetch(`${API_URL}/status/${documentId}`);
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
      const response = await fetch(`${API_URL}/chat`, {
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const aiBubble = darkMode ? "border-white/10 bg-[#15171c] text-white/85" : "border-[#ececec] bg-white text-[#242424]";
  const roundButton = `grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/75 hover:bg-white/10" : "bg-[#f4f4f2] text-[#3d3d3b] hover:bg-[#ebebe8]"}`;

  return (
    <div className={`newq flex min-h-screen w-full items-center justify-center p-4 transition-colors duration-300 ${darkMode ? "bg-[#121317]" : "bg-[#f7f7f5]"}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "999px",
            background: darkMode ? "#17181c" : "#fff",
            color: darkMode ? "#ffffff" : "#141414",
            border: darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ececec",
            fontSize: "13.5px",
          },
        }}
      />

      {/* Card */}
      <div className={`flex h-[85vh] w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border transition-colors duration-300 ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 sm:px-8 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <div className="flex items-center gap-3">
            <IconTile icon={FileText} tone="lime" darkMode={darkMode} size="sm" />
            <div>
              <h1 className="text-[17px] tracking-[-0.01em]">UIPL Docs</h1>
              <p className={`text-[12.5px] ${muted}`}>chat with a document</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button onClick={() => setDarkMode(!darkMode)} className={roundButton} title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Close / Reset Button */}
            <button onClick={resetChat} className={roundButton} aria-label="Reset chat">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6 sm:px-8">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <IconTile icon={FileText} tone="lime" darkMode={darkMode} size="lg" />
              <h2 className="mt-2 text-[22px] leading-[1.15] tracking-[-0.02em]">Upload a document</h2>
              <p className={`-mt-3 text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>to begin</p>
              <p className={`max-w-xl text-[13.5px] ${muted}`}>
                Upload a PDF, CSV, or spreadsheet and start chatting with it instantly.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={i} className="flex justify-center">
                  <span className={`rounded-full px-3.5 py-1.5 text-[12px] ${darkMode ? "bg-white/[0.06] text-white/60" : "bg-[#f4f4f2] text-[#6b6b6b]"}`}>
                    {msg.text}
                  </span>
                </div>
              );
            }
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className={`max-w-[70%] rounded-[20px] rounded-br-md px-5 py-3 text-[14px] leading-relaxed ${darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"}`}>
                    {msg.text}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex items-end justify-start gap-3">
                <IconTile icon={Sparkles} tone="lavender" darkMode={darkMode} size="sm" />
                <div className={`max-w-[70%] whitespace-pre-wrap rounded-[20px] rounded-bl-md border px-5 py-3 text-[14px] leading-relaxed ${aiBubble}`}>
                  {msg.text}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-end justify-start gap-3">
              <IconTile icon={Sparkles} tone="lavender" darkMode={darkMode} size="sm" />
              <div className={`flex items-center gap-2 rounded-[20px] rounded-bl-md border px-5 py-3 text-[13.5px] ${aiBubble} ${darkMode ? "!text-white/50" : "!text-[#8a8a8a]"}`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}

          {status && !ready && documentId && (
            <div className="flex justify-center">
              <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] ${darkMode ? "bg-sky-400/[0.13] text-[#a9cbf7]" : "bg-[#e3eefb] text-[#2f6fc0]"}`}>
                <Loader2 className="h-3 w-3 animate-spin" />
                {status}
              </span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-6 pb-6 pt-2 sm:px-8">
          <div className={`flex items-center gap-2 rounded-full border border-transparent py-1.5 pl-2 pr-1.5 transition ${darkMode ? "bg-white/[0.06] focus-within:bg-white/[0.09]" : "bg-[#f4f4f2] focus-within:border-[#e2e2df] focus-within:bg-white"}`}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${darkMode ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-[#8a8a87] hover:bg-[#ebebe8] hover:text-[#141414]"}`}
              title="Upload file"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
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
              className={`min-w-0 flex-1 !rounded-none !border-0 !bg-transparent py-2 text-[14px] !shadow-none outline-none !ring-0 disabled:cursor-not-allowed ${darkMode ? "text-white placeholder:text-white/35" : "text-[#141414] placeholder:text-[#a3a3a0]"}`}
              style={{ caretColor: darkMode ? "#cff07a" : "#141414" }}
            />

            <button
              onClick={ask}
              disabled={loading || !ready || !question.trim()}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${darkMode ? "bg-[#cff07a] text-[#141414]" : "bg-[#141414] text-white"}`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
