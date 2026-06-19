import { useCallback, useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash2,
  ArrowLeft,
  FileText,
  BarChart3,
  Edit3,
  FolderPlus,
  Folder,
  Globe2,
  Lock,
  Users,
  Sparkles,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  ChevronDown,
  Cloud,
  HardDrive,
  Link,
  Sheet,
} from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmModal, DateTimePicker, DocumentIcon, useClickOutside } from "./ui";
import { useAuth } from "./AuthProvider";

export default function Documents({ darkMode, selectedDocs, setSelectedDocs }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [canCreateFolder, setCanCreateFolder] = useState(false);
  const [canManageDocumentAccess, setCanManageDocumentAccess] = useState(false);
  const [actionPermissions, setActionPermissions] = useState({});
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ id: "", name: "", visibility: "selected", allowedUserIds: [], accessExpiresAt: "" });
  const [accessModal, setAccessModal] = useState(null);
  const [accessForm, setAccessForm] = useState({ visibility: "private", allowedUserIds: [], accessExpiresAt: "", folderId: "" });
  const [uploadAccessForm, setUploadAccessForm] = useState({ visibility: "private", allowedUserIds: [], accessExpiresAt: "" });
  const [pendingLocalFiles, setPendingLocalFiles] = useState([]);
  const [localUploadModal, setLocalUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renameModal, setRenameModal] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [processingDocs, setProcessingDocs] = useState({});
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheetModal, setSheetModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [addingSheet, setAddingSheet] = useState(false);
  const [sheetPreview, setSheetPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [driveModal, setDriveModal] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveName, setDriveName] = useState("");
  const [addingDrive, setAddingDrive] = useState(false);
  const fileInputRef = useRef(null);
  const uploadMenuRef = useRef(null);

  useClickOutside(uploadMenuRef, () => setUploadMenuOpen(false));

  const fetchDocuments = useCallback(async (showToast = true) => {
    try {
      setLoading(true);
      const response = await fetch("https://dashboard.nexarrow.eu/api/documents");
      const data = await response.json();
      setDocuments(data.documents || []);
      setFolders(data.folders || []);
      setAssignableUsers(data.users || []);
      setCanCreateFolder(Boolean(data.canCreateFolder));
      setCanManageDocumentAccess(Boolean(data.canManageDocumentAccess));
      setActionPermissions(data.actionPermissions || {});

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

  const currentFolder = folders.find((folder) => folder.id === currentFolderId) || null;
  const shouldShowFolders = !currentFolderId && folders.length > 0;
  const visibleDocuments = documents.filter((doc) => currentFolderId ? doc.folderId === currentFolderId : !shouldShowFolders);
  const canCreateFolders = canCreateFolder || user?.isSuperAdmin;
  const canManageAccess = canManageDocumentAccess || user?.isSuperAdmin;
  const canUploadDocuments = Boolean(actionPermissions.uploadDocuments || user?.isSuperAdmin);
  const canLinkSheets = Boolean(actionPermissions.linkSheets || user?.isSuperAdmin);
  const canRenameDocuments = Boolean(actionPermissions.renameDocuments || user?.isSuperAdmin);
  const canDeleteDocuments = Boolean(actionPermissions.deleteDocuments || user?.isSuperAdmin);
  const canToggleDocuments = Boolean(actionPermissions.toggleDocuments || user?.isSuperAdmin);
  const isAssignedFolderContributor = Boolean(currentFolder?.canContribute);

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

  useEffect(() => {
    function handleBackShortcut(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key.toLowerCase() === "b" && currentFolderId) {
        event.preventDefault();
        setCurrentFolderId(null);
      }
    }

    window.addEventListener("keydown", handleBackShortcut);
    return () => window.removeEventListener("keydown", handleBackShortcut);
  }, [currentFolderId]);

  const handleRefresh = async () => {
    const loadingToast = toast.loading("Refreshing documents...");
    try {
      await fetchDocuments(false);
      toast.success("Documents refreshed", { id: loadingToast });
    } catch {
      toast.error("Failed to refresh documents", { id: loadingToast });
    }
  };

  const toggleAssignedUser = (userId, setter) => {
    setter((current) => ({
      ...current,
      allowedUserIds: current.allowedUserIds.includes(userId)
        ? current.allowedUserIds.filter((id) => id !== userId)
        : [...current.allowedUserIds, userId],
    }));
  };

  const createFolder = async () => {
    if (!folderForm.name.trim()) {
      toast.error("Enter folder name");
      return;
    }
    try {
      const response = await fetch("https://dashboard.nexarrow.eu/api/document-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(folderForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create folder");
      toast.success("Folder created");
      setFolderModalOpen(false);
      setFolderForm({ id: "", name: "", visibility: "selected", allowedUserIds: [], accessExpiresAt: "" });
      await fetchDocuments(false);
    } catch (error) {
      toast.error(error.message || "Could not create folder");
    }
  };

  const openAccessModal = (doc) => {
    setAccessModal(doc);
    setAccessForm({
      visibility: doc.visibility || "public",
      allowedUserIds: doc.allowedUserIds || [],
      accessExpiresAt: "",
      folderId: doc.folderId || "",
    });
  };

  const resetUploadAccess = () => {
    setUploadAccessForm({ visibility: "private", allowedUserIds: [], accessExpiresAt: "" });
  };

  const appendAccessFields = (formData, access) => {
    formData.append("visibility", access.visibility);
    formData.append("allowedUserIds", JSON.stringify(access.allowedUserIds || []));
    if (access.accessExpiresAt) formData.append("accessExpiresAt", access.accessExpiresAt);
  };

  const openFolderModal = (folder = null) => {
    setFolderForm(folder ? {
      id: folder.id,
      name: folder.name || "",
      visibility: folder.visibility || "selected",
      allowedUserIds: folder.allowedUserIds || [],
      accessExpiresAt: "",
    } : { id: "", name: "", visibility: "selected", allowedUserIds: [], accessExpiresAt: "" });
    setFolderModalOpen(true);
  };

  const saveFolder = async () => {
    if (!folderForm.name.trim()) {
      toast.error("Enter folder name");
      return;
    }
    try {
      const response = await fetch(`https://dashboard.nexarrow.eu/api/document-folders/${folderForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(folderForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update folder");
      toast.success("Folder updated");
      setFolderModalOpen(false);
      setFolderForm({ id: "", name: "", visibility: "selected", allowedUserIds: [], accessExpiresAt: "" });
      await fetchDocuments(false);
    } catch (error) {
      toast.error(error.message || "Could not update folder");
    }
  };

  const deleteFolder = async (folder) => {
    try {
      setDeleting(true);
      const response = await fetch(`https://dashboard.nexarrow.eu/api/document-folders/${folder.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete folder");
      toast.success("Folder deleted");
      if (currentFolderId === folder.id) setCurrentFolderId(null);
      setDeleteModal(null);
      await fetchDocuments(false);
    } catch (error) {
      toast.error(error.message || "Could not delete folder");
    } finally {
      setDeleting(false);
    }
  };

  const saveAccess = async () => {
    if (!accessModal) return;
    try {
      const response = await fetch(`https://dashboard.nexarrow.eu/api/documents/${accessModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update access");
      toast.success("Document access updated");
      setAccessModal(null);
      await fetchDocuments(false);
    } catch (error) {
      toast.error(error.message || "Could not update access");
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setPendingLocalFiles(files);
    resetUploadAccess();
    setLocalUploadModal(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadLocalFiles = async () => {
    if (pendingLocalFiles.length === 0) return;
    setLocalUploadModal(false);

    for (const file of pendingLocalFiles) {
      const formData = new FormData();
      formData.append("pdf", file);
      if (currentFolderId) formData.append("folderId", currentFolderId);
      appendAccessFields(formData, uploadAccessForm);
      const uploadToast = toast.loading(`Uploading "${file.name}"...`);

      try {
        setUploading(true);
        const response = await fetch("https://dashboard.nexarrow.eu/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        if (data.success) {
          setShowProcessingModal(true);
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

    setPendingLocalFiles([]);
  };

  const pollStatus = async (documentId, fileName) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`https://dashboard.nexarrow.eu/api/status/${documentId}`);
        const data = await res.json();
        setProcessingDocs((prev) => ({
          ...prev,
          [documentId]: { name: fileName, stage: data.stage, id: documentId },
        }));
        if (data.error || data.stage === "Failed") {
          clearInterval(interval);
          setProcessingDocs((prev) => {
            const newDocs = { ...prev };
            delete newDocs[documentId];
            return newDocs;
          });
          await fetchDocuments(false);
          toast.error(data.error || `"${fileName}" failed to process`);
          return;
        }
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

  const extractDriveFileId = (url) => {
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch) return fileMatch[1];
    const workspaceMatch = url.match(/\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9-_]+)/);
    if (workspaceMatch) return workspaceMatch[1];
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("id");
    } catch {
      return /^[a-zA-Z0-9_-]{20,}$/.test(url.trim()) ? url.trim() : null;
    }
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
      const res = await fetch("https://dashboard.nexarrow.eu/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, name, folderId: currentFolderId || null, ...uploadAccessForm }),
      });
      const data = await res.json();

      if (data.success) {
        setShowProcessingModal(true);
        toast.success(`"${name}" added! Processing sheet data...`);
        setSheetModal(false);
        setSheetUrl("");
        setSheetName("");
        resetUploadAccess();
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

  const handleAddDriveDocument = async () => {
    if (!driveUrl.trim()) {
      toast.error("Please enter a Google Drive document link");
      return;
    }

    if (!extractDriveFileId(driveUrl)) {
      toast.error("Invalid Google Drive link. Make sure it contains a Drive file ID.");
      return;
    }

    const displayName = driveName.trim();
    const loadingToast = toast.loading("Adding document from Drive...");

    try {
      setAddingDrive(true);
      const response = await fetch("https://dashboard.nexarrow.eu/api/drive-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: driveUrl.trim(), name: displayName, folderId: currentFolderId || null, ...uploadAccessForm }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add Drive document");
      }

      const name = data.name || displayName || data.originalName || "Drive document";
      setShowProcessingModal(true);
      setDriveModal(false);
      setDriveUrl("");
      setDriveName("");
      resetUploadAccess();
      setProcessingDocs((prev) => ({
        ...prev,
        [data.documentId]: { name, stage: "Downloading from Drive", id: data.documentId },
      }));
      toast.success(`"${name}" added from Drive. Processing...`, { id: loadingToast });
      pollStatus(data.documentId, name);
      setTimeout(() => fetchDocuments(false), 1000);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to add Drive document", { id: loadingToast });
    } finally {
      setAddingDrive(false);
    }
  };

  const handleDelete = async (doc) => {
    try {
      setDeleting(true);
      const response = await fetch(`https://dashboard.nexarrow.eu/api/documents/${doc.id}`, {
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
    } finally {
      setDeleting(false);
    }
  };

  const openRenameModal = (doc) => {
    setRenameModal(doc);
    setRenameValue(doc.name || "");
  };

  const handleRename = async () => {
    const nextName = renameValue.trim();
    if (!renameModal || !nextName) {
      toast.error("Please enter a document name");
      return;
    }

    try {
      setRenaming(true);
      const response = await fetch(`https://dashboard.nexarrow.eu/api/documents/${renameModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to rename document");
      toast.success("Document renamed");
      setRenameModal(null);
      setRenameValue("");
      await fetchDocuments(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to rename document");
    } finally {
      setRenaming(false);
    }
  };

  const handleToggleActive = async (doc) => {
    try {
      const response = await fetch(`https://dashboard.nexarrow.eu/api/documents/${doc.id}/toggle`, {
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
      const response = await fetch(`https://dashboard.nexarrow.eu/api/sheets/${doc.id}/data`);
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

  const formatMetric = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
    return Math.round(Number(value)).toLocaleString();
  };

  const getTypeStyle = (type) => {
    const styles = {
      currency: darkMode ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-700",
      number: darkMode ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-700",
      percentage: darkMode ? "bg-cyan-500/10 text-cyan-300" : "bg-cyan-50 text-cyan-700",
      date: darkMode ? "bg-violet-500/10 text-violet-300" : "bg-violet-50 text-violet-700",
      category: darkMode ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700",
      boolean: darkMode ? "bg-lime-500/10 text-lime-300" : "bg-lime-50 text-lime-700",
      email: darkMode ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700",
      url: darkMode ? "bg-fuchsia-500/10 text-fuchsia-300" : "bg-fuchsia-50 text-fuchsia-700",
    };
    return styles[type] || (darkMode ? "bg-white/5 text-white/60" : "bg-black/5 text-black/55");
  };

  const findTabArchitecture = (sheet) =>
    sheetPreview?.architecture?.tabs?.find((tab) => tab.name === sheet.name);

  const getDocumentSource = (doc) => {
    if (doc.type === "sheet") {
      return { label: "Linked Google Sheet", Icon: Sheet };
    }
    if (doc.source === "drive") {
      return { label: "Added from Drive", Icon: Cloud };
    }
    return { label: "Added from local computer drive", Icon: HardDrive };
  };

  const renderAccessControls = (form, setter, title = "Access") => (
    <div className={`rounded-2xl border p-3 ${darkMode ? "border-white/10 bg-white/[0.03]" : "border-black/5 bg-black/[0.02]"}`}>
      <p className={`mb-3 text-xs uppercase tracking-widest ${darkMode ? "text-white/45" : "text-black/40"}`}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {[
          ["private", Lock, "Private"],
          ["selected", Users, "Selected"],
          ["public", Globe2, "Public"],
        ].map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setter((current) => ({ ...current, visibility: value }))}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
              form.visibility === value
                ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
                : darkMode ? "bg-white/5 text-white/65" : "bg-black/[0.04] text-black/60"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {form.visibility === "selected" && (
        <div className="mt-4 space-y-3">
          <div>
            <label className={`mb-2 block text-xs uppercase tracking-widest ${darkMode ? "text-white/45" : "text-black/40"}`}>
              Access expires (optional)
            </label>
            <DateTimePicker
              darkMode={darkMode}
              value={form.accessExpiresAt}
              onChange={(nextValue) => setter((current) => ({ ...current, accessExpiresAt: nextValue }))}
              placeholder="No expiry selected"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["1 day", 1],
                ["7 days", 7],
                ["30 days", 30],
              ].map(([label, days]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                    setter((current) => ({ ...current, accessExpiresAt: expiry.toISOString().slice(0, 16) }));
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs ${darkMode ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={`max-h-52 overflow-auto rounded-2xl border p-2 ${darkMode ? "border-white/10" : "border-black/5"}`}>
            {assignableUsers.length === 0 ? (
              <p className={`px-3 py-2 text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>No users available</p>
            ) : (
              assignableUsers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleAssignedUser(item.id, setter)}
                  className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                    form.allowedUserIds.includes(item.id)
                      ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
                      : darkMode ? "text-white/70 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"
                  }`}
                >
                  <span>{item.displayName}</span>
                  <span className="text-xs opacity-70">{item.username}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="flex-1 newq overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8 lg:py-8"
      style={{
        background: darkMode
          ? "linear-gradient(180deg, #111318 0%, #0c0d10 100%)"
          : "linear-gradient(180deg, #f7f6f2 0%, #f3f1ea 100%)",
      }}
    >
      <div
        className={`min-h-full rounded-[24px] newq p-4 -sm flex flex-col sm:p-6 lg:h-full lg:min-h-0 lg:rounded-[32px] lg:p-8 ${
          darkMode ? "bg-white/[0.03] border-white/10" : "bg-white/80 border-black/5"
        }`}
      >
        <div className="mb-8 flex newq flex-col gap-5 lg:flex-row lg:items-end lg:justify-between flex-shrink-0">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.32em] mb-3 ${darkMode ? "text-white/45" : "text-black/40"}`}>
              Document Library
            </p>
            <h2 className={`text-2xl small font-semibold sm:text-3xl md:text-4xl ${darkMode ? "text-white" : "text-black"}`}>
              Upload and manage your files
            </h2>
            <p className={`text-sm mt-4 max-w-2xl ${darkMode ? "text-white/55" : "text-black/45"}`}>
              {currentFolder ? `Folder: ${currentFolder.name}` : "Open a folder to view and manage its sources."}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
            {currentFolder && (
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all duration-200 sm:px-5 ${
                  darkMode ? "text-white bg-white/10" : "text-black bg-black/[0.03]"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {canCreateFolders && !currentFolder && (
              <button
              onClick={() => openFolderModal()}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all duration-200 sm:px-5 ${
                  darkMode ? "text-white bg-white/10" : "text-black bg-black/[0.03]"
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                Create Folder
              </button>
            )}
            {currentFolder && (canLinkSheets || isAssignedFolderContributor) && (
              <button
                onClick={() => {
                  resetUploadAccess();
                  setSheetModal(true);
                }}
                className="flex items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-3 text-white transition-all duration-200 sm:px-5"
              >
                <Sheet className="w-4 h-4 text-white" />
                Link Sheet
              </button>
            )}

            {currentFolder && (canUploadDocuments || isAssignedFolderContributor) && <div ref={uploadMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUploadMenuOpen((current) => !current)}
                disabled={uploading}
                className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 transition-all duration-200 disabled:opacity-60 sm:px-5 ${
                  darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
                }`}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Docs
                <ChevronDown className={`h-4 w-4 transition-transform ${uploadMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {uploadMenuOpen && !uploading && (
                <div
                  className={`absolute right-0 top-[calc(100%+10px)] z-40 w-[290px] rounded-2xl border p-2 shadow-xl ${
                    darkMode ? "border-white/10 bg-[#181a20]" : "border-black/5 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      darkMode ? "text-white/80 hover:bg-white/8" : "text-black/70 hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      darkMode ? "bg-white/5 text-[#d8f36a]" : "bg-black/[0.04] text-black"
                    }`}>
                       <img src="/localdisk.png" alt="Local Disk" className="h-7 w-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm small font-semibold">From local computer</span>
                      <span className={`block truncate text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
                        PDF, Word, Excel, CSV, text, or image
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadMenuOpen(false);
                      resetUploadAccess();
                      setDriveModal(true);
                    }}
                    className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      darkMode ? "text-white/80 hover:bg-white/8" : "text-black/70 hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      darkMode ? "bg-white/5 text-[#d8f36a]" : "bg-black/[0.04] text-black"
                    }`}>
                      <img src="/drive.svg" alt="Google Drive" className="h-7 w-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm small font-semibold">From Google Drive</span>
                      <span className={`block truncate text-xs ${darkMode ? "text-white/40" : "text-black/40"}`}>
                        Paste a Drive document link
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>}

            <button
              onClick={handleRefresh}
              disabled={loading}
              className={`col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all duration-200 disabled:opacity-60 sm:col-span-1 sm:px-5 ${
                darkMode ? "text-white bg-white/10" : "text-black bg-black/[0.03]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.csv,.xlsx,.xls,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {shouldShowFolders && (
          <div
            className={`rounded-[22px] overflow-hidden flex-1 min-h-[420px] lg:min-h-0 lg:rounded-[28px] ${
              darkMode ? "bg-white/[0.03] border-white/10" : "bg-white border-black/5"
            }`}
          >
            <div className="h-full overflow-auto newq">
              <table className="w-full min-w-[920px]">
                <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                  <tr className={`text-left ${darkMode ? "border-b border-white/10" : "border-b border-black/5"}`}>
                    {["Folder Name", "Type", "Visibility", "Sources", "Assigned Users", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-5 text-[12px] dark:text-white/85 font-medium uppercase tracking-[0.22em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => {
                    const sourceCount = documents.filter((doc) => doc.folderId === folder.id).length;
                    return (
                      <tr
                        key={folder.id}
                        onClick={() => setCurrentFolderId(folder.id)}
                        className={`cursor-pointer transition-colors ${darkMode ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]"}`}
                        style={{
                          borderBottom: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                        }}
                        title="Open folder"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                              darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-green-50 text-green-700"
                            }`}>
                              <Folder className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className={`truncate text-sm ${darkMode ? "text-white" : "text-black"}`}>{folder.name}</p>
                              <p className={`mt-1 text-xs ${darkMode ? "text-white/40" : "text-black/35"}`}>Click to open</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? "bg-white/5 text-white/55" : "bg-black/5 text-black/55"}`}>
                            Folder
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-xs ${
                            folder.visibility === "public"
                              ? darkMode ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"
                              : darkMode ? "bg-white/5 text-white/55" : "bg-black/5 text-black/55"
                          }`}>
                            {folder.visibility === "public" ? "Public" : "Selected"}
                          </span>
                        </td>
                        <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                          {sourceCount} source{sourceCount === 1 ? "" : "s"}
                        </td>
                        <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                          {folder.visibility === "public" ? "All users" : `${folder.allowedUserIds?.length || 0} user(s)`}
                        </td>
                        <td className="px-6 py-5">
                          {canManageAccess && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openFolderModal(folder);
                                }}
                                className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/10 text-white/60" : "hover:bg-black/5 text-black/50"}`}
                                title="Edit folder"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteModal({ type: "folder", item: folder });
                                }}
                                className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-red-500/10" : "hover:bg-red-50"}`}
                                title="Delete folder"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!shouldShowFolders && (
        <div
          className={`rounded-[22px] overflow-hidden flex-1 min-h-[420px] lg:min-h-0 lg:rounded-[28px] ${
            darkMode ? "bg-white/[0.03] border-white/10" : "bg-white border-black/5"
          }`}
        >
          <div className="h-full overflow-auto newq">
            <table className="w-full min-w-[920px]">
              <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                <tr className={`text-left ${darkMode ? "border-b border-white/10" : "border-b border-black/5"}`}>
                  {["Document Name", "Type", "Uploaded At", "Size", "Status", "Actions"].map((h) => (
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
                ) : visibleDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: darkMode ? "#ffffff55" : "#9ca3af" }} />
                      <p className={darkMode ? "text-white/55" : "text-black/45"}>
                        {shouldShowFolders ? "Open a folder to view sources" : "No documents uploaded yet"}
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`mt-4 text-sm underline-offset-4 ${darkMode ? "text-[#d8f36a]" : "text-black"}`}
                      >
                        Upload your first document
                      </button>
                    </td>
                  </tr>
                ) : (
                  visibleDocuments.map((doc) => {
                    const source = getDocumentSource(doc);
                    const SourceIcon = source.Icon;

                    return (
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
                            <DocumentIcon doc={doc} darkMode={darkMode} />
                          </div>
                          <button
                            // onClick={() => openSheetPreview(doc)}
                            disabled={doc.type !== "sheet" || !doc.isReady}
                            className="min-w-0 text-left "
                          >
                            <span className={`text-sm block truncate ${darkMode ? "text-white" : "text-black"}`}>
                              {doc.name}
                            </span>
                            <span className={`mt-1 flex items-center gap-1.5 text-xs ${darkMode ? "text-white/40" : "text-black/35"}`}>
                              <SourceIcon className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{source.label}</span>
                            </span>
                            {doc.type === "sheet" && doc.lastSyncedAt && (
                              <span className={`mt-0.5 block text-xs ${darkMode ? "text-white/35" : "text-black/35"}`}>
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

                      {/* <td className={`px-6 py-5 text-sm ${darkMode ? "text-white/55" : "text-black/50"}`}>
                        {doc.chunks || 0}
                      </td> */}

                      <td className="px-6 py-5">
                        {doc.isReady ? (
                          (canToggleDocuments || doc.ownerId === user?.id) ? <button onClick={() => handleToggleActive(doc)} className="flex items-center gap-2 text-sm">
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
                          </button> : (
                            <div className="flex items-center gap-2 text-sm">
                              {doc.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-black/35" />}
                              <span className={darkMode ? "text-white/60" : "text-black/50"}>{doc.isActive ? "Active" : "Inactive"}</span>
                            </div>
                          )
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
                          {(canManageAccess || doc.ownerId === user?.id) && (
                            <button
                              onClick={() => openAccessModal(doc)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                darkMode ? "hover:bg-white/10 text-white/65" : "hover:bg-black/5 text-black/55"
                              }`}
                              title="Manage access"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                          )}
                          {/* {doc.type === "sheet" && doc.isReady && (
                            <button
                              onClick={() => openSheetPreview(doc)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                darkMode ? "hover:bg-white/10 text-white/70" : "hover:bg-black/5 text-black/60"
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )} */}
                          {(canRenameDocuments || doc.ownerId === user?.id) && <button
                            onClick={() => openRenameModal(doc)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              darkMode ? "hover:bg-white/10 text-white/65" : "hover:bg-black/5 text-black/55"
                            }`}
                            title="Rename document"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>}
                          {(canDeleteDocuments || doc.ownerId === user?.id) && <button
                            onClick={() => setDeleteModal({ type: "document", item: doc })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              darkMode ? "hover:bg-red-500/10" : "hover:bg-red-50"
                            }`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {showProcessingModal && Object.keys(processingDocs).length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-xl rounded-[30px] border p-6 shadow-2xl ${
              darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Document processing
                </p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  Preparing your source
                </h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-white/50" : "text-black/45"}`}>
                  OCR, chunking, and vector generation are running in the background.
                </p>
              </div>
              <button
                onClick={() => setShowProcessingModal(false)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  darkMode ? "hover:bg-white/5" : "hover:bg-black/5"
                }`}
                title="Hide processing modal"
              >
                <X className={`h-5 w-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <div className="relative mx-auto my-8 flex h-28 w-28 items-center justify-center">
              <span className={`absolute inset-0 rounded-full ${darkMode ? "bg-[#d8f36a]/10" : "bg-black/[0.04]"}`} />
              <span className="absolute inset-3 animate-ping rounded-full bg-[#d8f36a]/25" />
              <span className={`absolute inset-5 animate-spin rounded-full border-2 border-dashed ${
                darkMode ? "border-[#d8f36a]" : "border-black"
              }`} />
              <Sparkles className={`relative h-9 w-9 ${darkMode ? "text-[#d8f36a]" : "text-black"}`} />
            </div>

            <div className="space-y-3">
              {Object.entries(processingDocs).map(([id, doc]) => (
                <div
                  key={id}
                  className={`rounded-2xl border p-4 ${
                    darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/5 bg-[#faf8f2]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Loader2 className={`h-4 w-4 animate-spin ${darkMode ? "text-[#d8f36a]" : "text-black"}`} />
                    <span className={`min-w-0 flex-1 truncate text-sm ${darkMode ? "text-white/85" : "text-black/75"}`}>
                      {doc.name}
                    </span>
                    <span className={`shrink-0 text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>
                      {doc.stage}
                    </span>
                  </div>
                  <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-black/5"}`}>
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[#d8f36a]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {localUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-xl rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>Local upload</p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  Add {pendingLocalFiles.length} file{pendingLocalFiles.length === 1 ? "" : "s"}
                </h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>
                  Choose who can see these documents before processing starts.
                </p>
              </div>
              <button
                onClick={() => {
                  setLocalUploadModal(false);
                  setPendingLocalFiles([]);
                }}
                className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`h-5 w-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className={`max-h-28 overflow-auto rounded-2xl p-3 ${darkMode ? "bg-white/5" : "bg-black/[0.03]"}`}>
                {pendingLocalFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className={`flex items-center justify-between gap-3 py-1 text-sm ${darkMode ? "text-white/70" : "text-black/65"}`}>
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs opacity-60">{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
              {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => {
                    setLocalUploadModal(false);
                    setPendingLocalFiles([]);
                  }}
                  className={`flex-1 rounded-full px-4 py-3 ${darkMode ? "bg-white/5 text-white" : "bg-black/[0.04] text-black"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={uploadLocalFiles}
                  disabled={uploading || pendingLocalFiles.length === 0}
                  className={`flex-1 rounded-full px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Start Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-xl rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>Department folder</p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  {folderForm.id ? "Edit Folder" : "Create Folder"}
                </h3>
              </div>
              <button onClick={() => setFolderModalOpen(false)} className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
                <X className={`h-5 w-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={folderForm.name}
                onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Folder name, e.g. Accounts"
                className={`w-full rounded-2xl px-4 py-4 text-sm outline-none ${darkMode ? "bg-white/5 text-white placeholder-white/25" : "bg-black/[0.03] text-black placeholder-black/30"}`}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  ["selected", Users, "Selected users"],
                  ["public", Globe2, "Public to all"],
                ].map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFolderForm((current) => ({ ...current, visibility: value }))}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                      folderForm.visibility === value
                        ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
                        : darkMode ? "bg-white/5 text-white/65" : "bg-black/[0.04] text-black/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
              {folderForm.visibility === "selected" && (
                <>
                  <div>
                    <label className={`mb-2 block text-xs uppercase tracking-widest ${darkMode ? "text-white/45" : "text-black/40"}`}>
                      Access expires (optional)
                    </label>
                    <DateTimePicker
                      darkMode={darkMode}
                      value={folderForm.accessExpiresAt}
                      onChange={(nextValue) => setFolderForm((current) => ({ ...current, accessExpiresAt: nextValue }))}
                      placeholder="No expiry selected"
                    />
                  </div>
                  <div className="max-h-56 overflow-auto rounded-2xl border p-2 border-black/5">
                    {assignableUsers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAssignedUser(item.id, setFolderForm)}
                        className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                          folderForm.allowedUserIds.includes(item.id)
                            ? darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"
                            : darkMode ? "text-white/70 hover:bg-white/5" : "text-black/65 hover:bg-black/[0.04]"
                        }`}
                      >
                        <span>{item.displayName}</span>
                        <span className="text-xs opacity-70">{item.username}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button onClick={folderForm.id ? saveFolder : createFolder} className={`w-full rounded-full px-4 py-3 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                {folderForm.id ? "Save Folder" : "Create Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-xl rounded-[28px] border p-6 ${darkMode ? "border-white/10 bg-[#121317]" : "border-black/5 bg-white"}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className={`mb-2 text-[11px] uppercase tracking-[0.28em] ${darkMode ? "text-white/40" : "text-black/35"}`}>Document access</p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>{accessModal.name}</h3>
              </div>
              <button onClick={() => setAccessModal(null)} className={`h-10 w-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
                <X className={`h-5 w-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>
            <div className="space-y-4">
              {renderAccessControls(accessForm, setAccessForm, "Document visibility")}
              <button onClick={saveAccess} className={`w-full rounded-full px-4 py-3 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
                Save Access
              </button>
            </div>
          </div>
        </div>
      )}

      {driveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-lg rounded-[28px] p-6 ${
              darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Drive Document
                </p>
                <h3 className={`text-2xl ${darkMode ? "text-white" : "text-black"}`}>
                  Add from Google Drive
                </h3>
              </div>
              <button
                onClick={() => { setDriveModal(false); setDriveUrl(""); setDriveName(""); resetUploadAccess(); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${darkMode ? "text-white/45" : "text-black/40"}`}>
                  Drive link *
                </label>
                <div className="relative">
                  <Link className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? "text-white/35" : "text-black/35"}`} />
                  <input
                    type="text"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className={`w-full rounded-2xl px-11 py-4 text-sm outline-none transition-colors ${
                      darkMode
                        ? "bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/25"
                        : "bg-black/[0.03] border-black/8 text-black placeholder-black/30 focus:border-black/20"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-xs uppercase tracking-widest mb-2 block ${darkMode ? "text-white/45" : "text-black/40"}`}>
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={driveName}
                  onChange={(e) => setDriveName(e.target.value)}
                  placeholder="e.g. Vendor agreement"
                  className={`w-full px-4 py-4 rounded-2xl text-sm outline-none transition-colors ${
                    darkMode
                      ? "bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/25"
                      : "bg-black/[0.03] border-black/8 text-black placeholder-black/30 focus:border-black/20"
                  }`}
                />
              </div>

              {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}

              <div
                className={`p-4 rounded-2xl text-xs leading-6 ${
                  darkMode ? "bg-[#d8f36a]/8 text-[#d8f36a]/80" : "bg-amber-50 text-amber-800"
                }`}
              >
                <ol className="list-decimal list-inside space-y-1">
                  <li>Share private files with the Google service account email</li>
                  <li>Google Docs, Sheets, Slides, PDFs, and images are converted into readable text</li>
                  <li>The temporary local copy is removed after vector processing</li>
                </ol>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-6 sm:flex-row">
              <button
                onClick={() => { setDriveModal(false); setDriveUrl(""); setDriveName(""); resetUploadAccess(); }}
                className={`flex-1 px-4 py-3 rounded-full transition-colors ${
                  darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddDriveDocument}
                disabled={addingDrive || !driveUrl.trim()}
                className={`flex-1 px-4 py-3 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
                }`}
              >
                {addingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {addingDrive ? "Adding..." : "Add Drive Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4">
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
                onClick={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); resetUploadAccess(); }}
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

              {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}

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

            <div className="flex flex-col gap-3 mt-6 sm:flex-row">
              <button
                onClick={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); resetUploadAccess(); }}
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
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div className={`w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[24px] p-4 sm:rounded-[30px] sm:p-7 ${darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"}`}>
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
                    ["Architecture", sheetPreview.architecture ? "Saved" : "Detected"],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                      <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>{label}</p>
                      <p className={`text-3xl mt-4 ${darkMode ? "text-white" : "text-black"}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
                    </div>
                  ))}
                </div>

                {sheetPreview.architecture?.ai && (
                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-black/50"}`} />
                      <h4 className={darkMode ? "text-white" : "text-black"}>AI architecture read</h4>
                    </div>
                    <p className={`text-sm leading-6 ${darkMode ? "text-white/65" : "text-black/55"}`}>
                      {sheetPreview.architecture.ai.purpose || "This sheet has been profiled for structure and useful views."}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(sheetPreview.architecture.ai.recommendedViews || sheetPreview.architecture.summary?.suggestedViews || []).map((view) => (
                        <span key={view} className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-green-50 text-green-700"}`}>
                          {view}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-4 mb-6">
                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className={`w-4 h-4 ${darkMode ? "text-[#d8f36a]" : "text-black/50"}`} />
                      <h4 className={darkMode ? "text-white" : "text-black"}>Numeric fields</h4>
                    </div>
                    <div className="space-y-3">
                      {(sheetPreview.architecture?.tabs || [])
                        .flatMap((tab) => tab.columns.filter((column) => column.stats).map((column) => ({ ...column, tab: tab.name })))
                        .slice(0, 6)
                        .map((column) => (
                          <div key={`${column.tab}-${column.name}`} className={`rounded-2xl p-4 ${darkMode ? "bg-black/20" : "bg-white"}`}>
                            <div className="flex justify-between gap-3 text-sm">
                              <span className={darkMode ? "text-white" : "text-black"}>{column.name}</span>
                              <span className={darkMode ? "text-white/45" : "text-black/40"}>{column.tab}</span>
                            </div>
                            <p className={`text-xs mt-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                              Avg {formatMetric(column.stats.average)} · Min {formatMetric(column.stats.min)} · Max {formatMetric(column.stats.max)}
                            </p>
                          </div>
                        ))}
                      {!sheetPreview.architecture?.tabs?.some((tab) => tab.columns.some((column) => column.stats)) && (
                        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No numeric columns detected yet.</p>
                      )}
                    </div>
                  </div>

                  <div className={`rounded-[24px] p-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <h4 className={`mb-4 ${darkMode ? "text-white" : "text-black"}`}>Categories and workflow</h4>
                    <div className="space-y-4">
                      {(sheetPreview.architecture?.tabs || [])
                        .flatMap((tab) => tab.columns.filter((column) => column.topValues).map((column) => ({ ...column, tab: tab.name })))
                        .slice(0, 5)
                        .map((column) => (
                          <div key={`${column.tab}-${column.name}`}>
                            <p className={`text-xs uppercase tracking-wider mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                              {column.name} · {column.tab}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {column.topValues.map((item) => (
                                <span key={`${column.name}-${item.value}`} className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-white/5 text-white/70" : "bg-white text-black/60"}`}>
                                  {item.value}: {item.count}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      {!sheetPreview.architecture?.tabs?.some((tab) => tab.columns.some((column) => column.topValues)) && (
                        <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/40"}`}>No category-like columns detected.</p>
                      )}
                    </div>
                  </div>
                </div>

                {(sheetPreview.sheets || []).map((sheet) => (
                  <div key={sheet.name} className={`rounded-[24px] overflow-hidden mb-5 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-black/[0.025] border border-black/5"}`}>
                    <div className={`px-5 py-4 border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h4 className={darkMode ? "text-white" : "text-black"}>{sheet.name}</h4>
                          <p className={`text-xs mt-1 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                            {sheet.rows.length} rows · {sheet.headers.length} columns
                          </p>
                        </div>
                        {findTabArchitecture(sheet) && (
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            {[
                              ["Primary", findTabArchitecture(sheet).primaryLabel],
                              ["Metrics", findTabArchitecture(sheet).keyMetrics?.join(", ")],
                              ["Workflow", findTabArchitecture(sheet).workflowColumns?.join(", ")],
                            ].filter(([, value]) => value).map(([label, value]) => (
                              <span key={label} className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-white/5 text-white/60" : "bg-white text-black/55"}`}>
                                {label}: {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {findTabArchitecture(sheet) && (
                      <div className={`px-5 py-4 border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
                        <p className={`text-[11px] uppercase tracking-[0.18em] mb-3 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                          Detected architecture
                        </p>
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {findTabArchitecture(sheet).columns.map((column) => (
                            <div key={column.name} className={`rounded-2xl p-4 ${darkMode ? "bg-black/20" : "bg-white"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`text-sm truncate ${darkMode ? "text-white" : "text-black"}`}>{column.name}</p>
                                  <p className={`text-xs mt-1 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                                    {column.role} · {column.filled} filled · {column.blank} blank
                                  </p>
                                </div>
                                <span className={`text-[11px] px-2.5 py-1 rounded-full flex-shrink-0 ${getTypeStyle(column.type)}`}>
                                  {column.type}
                                </span>
                              </div>
                              {column.examples?.length > 0 && (
                                <p className={`text-xs mt-3 truncate ${darkMode ? "text-white/40" : "text-black/35"}`}>
                                  e.g. {column.examples.join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={`px-5 py-4 border-b ${darkMode ? "border-white/10" : "border-black/5"}`}>
                      <p className={`text-[11px] uppercase tracking-[0.18em] mb-3 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                        Sheet data
                      </p>
                      <p className={`text-xs ${darkMode ? "text-white/45" : "text-black/40"}`}>
                        Showing all columns and up to 100 rows for this tab.
                      </p>
                    </div>
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                          <tr className={darkMode ? "border-b border-white/10" : "border-b border-black/5"}>
                            {sheet.headers.map((header) => (
                              <th key={header} className={`text-left px-5 py-3 font-medium whitespace-nowrap ${darkMode ? "text-white/55" : "text-black/45"}`}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(0, 100).map((row) => (
                            <tr key={row.__rowIndex} className={darkMode ? "border-b border-white/5" : "border-b border-black/5"}>
                              {sheet.headers.map((header) => (
                                <td key={header} className={`px-5 py-3 min-w-[160px] align-top ${darkMode ? "text-white/80" : "text-black/70"}`}>{row[header] || "—"}</td>
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

      {renameModal && (
        <div className="fixed inset-0 newq flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-lg rounded-[28px] p-6 ${
              darkMode ? "bg-[#121317] border border-white/10" : "bg-white border border-black/5"
            }`}
          >
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.28em] mb-2 ${darkMode ? "text-white/40" : "text-black/35"}`}>
                  Document name
                </p>
                <h3 className={`text-2xl small font-semibold ${darkMode ? "text-white" : "text-black"}`}>
                  Rename Document
                </h3>
              </div>
              <button
                onClick={() => setRenameModal(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
              >
                <X className={`w-5 h-5 ${darkMode ? "text-white/50" : "text-black/40"}`} />
              </button>
            </div>

            <input
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleRename();
              }}
              className={`w-full rounded-2xl px-4 py-4 text-sm outline-none transition-colors ${
                darkMode
                  ? "bg-white/5 border-white/10 text-white placeholder-white/25 focus:border-white/25"
                  : "bg-black/[0.03] border-black/8 text-black placeholder-black/30 focus:border-black/20"
              }`}
              placeholder="Document name"
              autoFocus
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRenameModal(null)}
                className={`flex-1 px-4 py-3 rounded-full transition-colors ${
                  darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/[0.04] text-black hover:bg-black/[0.07]"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={renaming || !renameValue.trim()}
                className={`flex-1 px-4 py-3 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  darkMode ? "bg-[#d8f36a] text-black hover:opacity-90" : "bg-black text-white hover:opacity-90"
                }`}
              >
                {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        darkMode={darkMode}
        open={Boolean(deleteModal)}
        title={deleteModal?.type === "folder" ? "Delete folder" : "Delete document"}
        message={
          deleteModal?.type === "folder"
            ? `Are you sure you want to delete "${deleteModal.item?.name}"? Documents inside it will move out of the folder.`
            : `Are you sure you want to delete "${deleteModal?.item?.name}"? This action cannot be undone.`
        }
        loading={deleting}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => {
          if (deleteModal?.type === "folder") return deleteFolder(deleteModal.item);
          return handleDelete(deleteModal.item);
        }}
      />
    </div>
  );
}
