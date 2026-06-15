import { useCallback, useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash2,
  FileText,
  BarChart3,
  Eye,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Link,
  Sheet,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Documents({ darkMode, selectedDocs, setSelectedDocs }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [processingDocs, setProcessingDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [sheetModal, setSheetModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [addingSheet, setAddingSheet] = useState(false);
  const [sheetPreview, setSheetPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async (showToast = true) => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/documents");
      const data = await response.json();
      setDocuments(data.documents || []);

      const activeDocs = (data.documents || [])
        .filter((doc) => doc.isActive && doc.isReady)
        .map((doc) => doc.id);
      setSelectedDocs(activeDocs);

      if (showToast) {
        toast.success("Documents refreshed");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      if (showToast) toast.error("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, [setSelectedDocs]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchDocuments(false);
    }, 0);
    const interval = setInterval(() => {
      void fetchDocuments(false);
    }, 5 * 60 * 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [fetchDocuments]);

  const handleRefresh = async () => {
    const loadingToast = toast.loading("Refreshing documents...");
    try {
      await fetchDocuments(false);
      toast.success("Documents refreshed", { id: loadingToast });
    } catch {
      toast.error("Failed to refresh documents", { id: loadingToast });
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append("pdf", file);
      const uploadToast = toast.loading(`Uploading "${file.name}"...`);

      try {
        setUploading(true);
        const response = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        if (data.success) {
          setProcessingDocs((prev) => ({
            ...prev,
            [data.documentId]: { name: file.name, stage: "Uploaded", id: data.documentId },
          }));
          toast.success(`"${file.name}" uploaded! Processing...`, { id: uploadToast });
          pollStatus(data.documentId, file.name);
          setTimeout(() => fetchDocuments(false), 1000);
        } else {
          toast.error(`Failed to upload "${file.name}"`, { id: uploadToast });
        }
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload "${file.name}"`, { id: uploadToast });
      } finally {
        setUploading(false);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pollStatus = async (documentId, fileName) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/status/${documentId}`);
        const data = await res.json();
        setProcessingDocs((prev) => ({
          ...prev,
          [documentId]: { name: fileName, stage: data.stage, id: documentId },
        }));
        if (data.ready) {
          clearInterval(interval);
          setProcessingDocs((prev) => {
            const newDocs = { ...prev };
            delete newDocs[documentId];
            return newDocs;
          });
          await fetchDocuments(false);
          toast.success(`"${fileName}" is ready!`);
        }
      } catch (error) {
        console.error(error);
      }
    }, 2000);
  };

  const extractSheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleAddSheet = async () => {
    if (!sheetUrl.trim()) {
      toast.error("Please enter a Google Sheet URL");
      return;
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("Invalid Google Sheet URL. Make sure it contains /spreadsheets/d/...");
      return;
    }

    const name = sheetName.trim() || `Sheet-${sheetId.slice(0, 8)}`;

    try {
      setAddingSheet(true);
      const res = await fetch("http://localhost:5000/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, name }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`"${name}" added! Processing sheet data...`);
        setSheetModal(false);
        setSheetUrl("");
        setSheetName("");
        setProcessingDocs((prev) => ({
          ...prev,
          [data.documentId]: { name, stage: "Fetching Sheet", id: data.documentId },
        }));
        pollStatus(data.documentId, name);
        setTimeout(() => fetchDocuments(false), 1000);
      } else {
        toast.error(data.error || "Failed to add sheet");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add sheet. Check if the backend is running.");
    } finally {
      setAddingSheet(false);
    }
  };

  const handleDelete = async (doc) => {
    try {
      const response = await fetch(`http://localhost:5000/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success(`"${doc.name}" deleted`);
        await fetchDocuments(false);
        setDeleteModal(null);
      } else {
        toast.error("Failed to delete document");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete document");
    }
  };

  const handleToggleActive = async (doc) => {
    try {
      const response = await fetch(`http://localhost:5000/documents/${doc.id}/toggle`, {
        method: "PATCH",
      });
      if (response.ok) {
        const data = await response.json();
        await fetchDocuments(false);
        toast.success(`"${doc.name}" ${data.isActive ? "enabled" : "disabled"} for queries`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to toggle document");
    }
  };

  const openSheetPreview = async (doc) => {
    if (doc.type !== "sheet" || !doc.isReady) return;
    try {
      setLoadingPreview(true);
      setSheetPreview({ document: doc, sheets: [], overview: null });
      const response = await fetch(`http://localhost:5000/sheets/${doc.id}/data`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSheetPreview(data);
    } catch (error) {
      toast.error(error.message || "Could not load sheet data");
      setSheetPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${Math.round(bytes / Math.pow(1024, i), 2)} ${sizes[i]}`;
  };

  return (
    <div
      className="flex-1 newq overflow-y-auto px-8 py-8"
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #111318 0%, #0c0d10 100%)"
          : "linear-gradient(180deg, #f7f6f2 0%, #f3f1ea 100%)",
      }}
    >
      <div
        className={`rounded-[32px] newq p-8 -sm ${
          darkMode ? "bg-white/[0.03] border-white/10" : "bg-white/80 border-black/5"
        }`}
      >
        <div className="mb-8 flex newq flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              Document Library
            </p>
            <h2 className={`text-4xl small md:text-4xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>
              Upload and manage your files
            </h2>
            <p className={`text-sm mt-4 max-w-2xl ${darkMode ? "text-white/55" : "text-black/45"}`}>
              Upload documents or connect live Google Sheets.
            </p>
          </div>

          <div className="flex newq gap-3 flex-wrap">
            <button
              onClick={() => setSheetModal(true)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-200 ${
                darkMode ? "bg-green-500 text-white" : "bg-green-500 text-white"
              }`}
            >
              <Sheet className="w-4 h-4 text-white" />
              Link Sheet
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-200 disabled:opacity-60 ${
                darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
              }`}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Docs
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-200 disabled:opacity-60 ${
                darkMode ? "text-white bg-white/10" : "text-black bg-black/[0.03]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {Object.keys(processingDocs).length > 0 && (
          <div className="mb-8">
            <p className={`text-[11px] uppercase tracking-[0.28em] mb-3 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              Processing
            </p>
            <div className="space-y-2">
              {Object.entries(processingDocs).map(([id, doc]) => (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-4 rounded-2xl border ${
                    darkMode ? "bg-white/[0.04] border-white/10" : "bg-[#faf8f2] border-black/5"
                  }`}
                >
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: darkMode ? "#d8f36a" : "#111111" }} />
                  <span className={`text-sm flex-1 ${darkMode ? "text-white/85" : "text-black/75"}`}>{doc.name}</span>
                  <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>{doc.stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className={`rounded-[28px] overflow-hidden ${
            darkMode ? "bg-white/[0.03] border-white/10" : "bg-white border-black/5"
          }`}
        >
          <div className="overflow-x-auto newq">
            <table className="w-full">
              <thead>
                <tr className={`text-left ${darkMode ? "border-b border-white/10" : "border-b border-black/5"}`}>
                  {["Document Name", "Type", "Uploaded At", "Size", "Chunks", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-5 text-[12px] dark:text-white/85 font-medium uppercase tracking-[0.22em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && documents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: darkMode ? "#ffffff66" : "#9ca3af" }} />
                      <p className={darkMode ? "text-white/55" : "text-black/45"}>Loading documents...</p>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: darkMode ? "#ffffff55" : "#9ca3af" }} />
                      <p className={darkMode ? "text-white/55" : "text-black/45"}>No documents uploaded yet</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`mt-4 text-sm underline-offset-4 ${darkMode ? "text-[#d8f36a]" : "text-black"}`}
                      >
                        Upload your first document
                      </button>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`transition-colors ${darkMode ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]"}`}
                      style={{
                        borderBottom: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                            darkMode ? "bg-white/5" : "bg-black/[0.04]"
                          }`}>
                            {doc.type === "sheet" ? (
                              <Sheet className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-green-600"}`} />
                            ) : (
                              <FileText className={`w-4 h-4 ${darkMode ? "text-white/55" : "text-black/45"}`} />
                            )}
                          </div>
                          <button
                            onClick={() => openSheetPreview(doc)}
                            disabled={doc.type !== "sheet" || !doc.isReady}
                            className="min-w-0 text-left disabled:cursor-default"
                          >
                            <span className={`text-sm block truncate ${darkMode ? "text-white" : "text-black"}`}>
                              {doc.name}
                            </span>
                            {doc.type === "sheet" && doc.lastSyncedAt && (
                              <span className={`text-xs ${darkMode ? "text-white/35" : "text-black/35"}`}>
                                Synced {new Date(doc.lastSyncedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${
                            doc.type === "sheet"
                              ? darkMode
                                ? "bg-[#d8f36a]/10 text-[#d8f36a]"
                                : "bg-green-50 text-green-700"
                              : darkMode
                              ? "bg-white/5 text-white/50"
                              : "bg-black/5 text-black/50"
                          }`}
                        >
                          {doc.type === "sheet" ? "Sheet" : "File"}
                        </span>
                      </td>

                      <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                        {formatDate(doc.uploadedAt)}
                      </td>

                      <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                        {doc.type === "sheet" ? "—" : formatFileSize(doc.fileSize)}
                      </td>

                      <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                        {doc.chunks || 0}
                      </td>

                      <td className="px-6 py-5">
                        {doc.isReady ? (
                          <button onClick={() => handleToggleActive(doc)} className="flex items-center gap-2 text-sm">
                            {doc.isActive ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-500" />
                                <span className={darkMode ? "text-white/60" : "text-black/50"}>Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-black/35" />
                                <span className={darkMode ? "text-white/60" : "text-black/50"}>Inactive</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>
                              Processing
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          {doc.type === "sheet" && doc.isReady && (
                            <button
                              onClick={() => openSheetPreview(doc)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                darkMode ? "hover:bg-white/10 text-white/70" : "hover:bg-black/5 text-black/60"
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteModal(doc)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              darkMode ? "hover:bg-red-500/10" : "hover:bg-red-50"
                            }`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sheetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-[28px] p-6 ${
              darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Live Data Source
                </p>
                <h3 className={`text-2xl ${darkMode ? "text-white" : "text-black"}`}>
                  Add Google Sheet
                </h3>
              </div>
              <button
                onClick={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${darkMode ? "text-white/45" : "text-black/40"}`}>
                  Sheet URL *
                </label>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={`w-full px-4 py-4 rounded-2xl text-sm outline-none transition-colors ${
                    darkMode
                      ? "bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/25"
                      : "bg-black/[0.03] border-black/8 text-black placeholder-black/30 focus:border-black/20"
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${darkMode ? "text-white/45" : "text-black/40"}`}>
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g. Sales Data Q2"
                  className={`w-full px-4 py-4 rounded-2xl text-sm outline-none transition-colors ${
                    darkMode
                      ? "bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/25"
                      : "bg-black/[0.03] border-black/8 text-black placeholder-black/30 focus:border-black/20"
                  }`}
                />
              </div>

              <div
                className={`p-4 rounded-2xl text-xs leading-6 ${
                  darkMode ? "bg-[#d8f36a]/8 text-[#d8f36a]/80" : "bg-amber-50 text-amber-800"
                }`}
              >
                <ol className="list-decimal list-inside space-y-1">
                  <li>Share the sheet with your service account email</li>
                  <li>Or make it public (&quot;Anyone with the link can view&quot;)</li>
                  <li>The sheet auto-syncs when data changes (checked every 30s)</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); }}
                className={`flex-1 px-4 py-3 rounded-full transition-colors ${
                  darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSheet}
                disabled={addingSheet || !sheetUrl.trim()}
                className={`flex-1 px-4 py-3 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
                }`}
              >
                {addingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
                {addingSheet ? "Connecting..." : "Add Sheet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetPreview && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-5">
          <div className={`w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[30px] p-7 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Sheet dashboard
                </p>
                <h3 className={`text-2xl font-semibold ${darkMode ? "text-white" : "text-black"}`}>{sheetPreview.document?.name}</h3>
                <p className={`text-sm mt-2 ${darkMode ? "text-white/45" : "text-black/40"}`}>
                  Synced {sheetPreview.document?.lastSyncedAt ? new Date(sheetPreview.document.lastSyncedAt).toLocaleString() : "recently"}
                </p>
              </div>
              <button onClick={() => setSheetPreview(null)} className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            {loadingPreview ? (
              <div className="py-20 flex justify-center">
                <Loader2 className={`w-7 h-7 animate-spin ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    ["Total rows", sheetPreview.overview?.totalRows || 0],
                    ["Columns", sheetPreview.overview?.columns?.length || 0],
                    ["Tabs", sheetPreview.sheets?.length || 0],
                    ["Numeric fields", Object.keys(sheetPreview.overview?.numeric || {}).length],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                      <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>{label}</p>
                      <p className={`text-3xl mt-4 ${darkMode ? "text-white" : "text-black"}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-4 mb-6">
                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-black/50"}`} />
                      <h4 className={darkMode ? "text-white" : "text-black"}>Numeric summary</h4>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(sheetPreview.overview?.numeric || {}).slice(0, 6).map(([column, stat]) => (
                        <div key={column} className={`rounded-2xl p-4 ${darkMode ? "bg-black/20" : "bg-white"}`}>
                          <div className="flex justify-between text-sm">
                            <span className={darkMode ? "text-white" : "text-black"}>{column}</span>
                            <span className={darkMode ? "text-white/45" : "text-black/40"}>{Math.round(stat.total).toLocaleString()}</span>
                          </div>
                          <p className={`text-xs mt-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                            Avg {Math.round(stat.average).toLocaleString()} · Min {Math.round(stat.min).toLocaleString()} · Max {Math.round(stat.max).toLocaleString()}
                          </p>
                        </div>
                      ))}
                      {Object.keys(sheetPreview.overview?.numeric || {}).length === 0 && (
                        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No numeric columns detected yet.</p>
                      )}
                    </div>
                  </div>

                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <h4 className={`mb-4 ${darkMode ? "text-white" : "text-black"}`}>Status breakdown</h4>
                    <div className="space-y-3">
                      {Object.entries(sheetPreview.overview?.statusBreakdown || {}).slice(0, 3).map(([column, values]) => (
                        <div key={column}>
                          <p className={`text-xs uppercase tracking-wider mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>{column}</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(values).map(([value, count]) => (
                              <span key={value} className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-white/5 text-white/70" : "bg-white text-black/60"}`}>
                                {value}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {Object.keys(sheetPreview.overview?.statusBreakdown || {}).length === 0 && (
                        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No status-like columns detected.</p>
                      )}
                    </div>
                  </div>
                </div>

                {(sheetPreview.sheets || []).map((sheet) => (
                  <div key={sheet.name} className={`rounded-[24px] overflow-hidden mb-4 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <div className={`px-5 py-4 border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
                      <h4 className={darkMode ? "text-white" : "text-black"}>{sheet.name}</h4>
                      <p className={`text-xs mt-1 ${darkMode ? "text-white/40" : "text-black/35"}`}>{sheet.rows.length} rows</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                            {sheet.headers.slice(0, 10).map((header) => (
                              <th key={header} className={`text-left px-5 py-3 font-medium ${darkMode ? "text-white/55" : "text-black/45"}`}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(0, 12).map((row) => (
                            <tr key={row.__rowIndex} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                              {sheet.headers.slice(0, 10).map((header) => (
                                <td key={header} className={`px-5 py-3 ${darkMode ? "text-white/80" : "text-black/70"}`}>{row[header] || "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 newq flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-[28px] p-6 -2xl ${
              darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Confirmation
                </p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  Delete Document
                </h3>
              </div>
              <button
                onClick={() => setDeleteModal(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <p className={`text-sm newq mb-6 leading-6 ${darkMode ? "text-white/70" : "text-black/90"}`}>
              Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className={`flex-1 px-4 py-3 rounded-full transition-colors ${
                  darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteModal)}
                className="flex-1 px-4 py-3 rounded-full transition-colors bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
