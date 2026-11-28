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
  RefreshCw,
  ChevronDown,
  Cloud,
  HardDrive,
  Link,
  Sheet,
  Check,
  CircleCheck,
  Columns3,
  Files,
  FolderOpen,
  Library,
  Rows3,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Button,
  Chip,
  ConfirmModal,
  DateTimePicker,
  DocumentIcon,
  EmptyState,
  Highlight,
  IconTile,
  Notice,
  PageHeader,
  StatTile,
  Toggle,
  useClickOutside,
} from "./ui";
import { API_URL, useAuth } from "./AuthProvider";

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
      const response = await fetch(`${API_URL}/documents`);
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
      const response = await fetch(`${API_URL}/document-folders`, {
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
      const response = await fetch(`${API_URL}/document-folders/${folderForm.id}`, {
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
      const response = await fetch(`${API_URL}/document-folders/${folder.id}`, { method: "DELETE" });
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
      const response = await fetch(`${API_URL}/documents/${accessModal.id}`, {
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
        const response = await fetch(`${API_URL}/upload`, {
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
        const res = await fetch(`${API_URL}/status/${documentId}`);
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
      const res = await fetch(`${API_URL}/sheets`, {
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
      const response = await fetch(`${API_URL}/drive-documents`, {
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
      const response = await fetch(`${API_URL}/documents/${doc.id}`, {
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
      const response = await fetch(`${API_URL}/documents/${renameModal.id}`, {
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
      const response = await fetch(`${API_URL}/documents/${doc.id}/toggle`, {
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
      const response = await fetch(`${API_URL}/sheets/${doc.id}/data`);
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
    const tones = {
      currency: "mint",
      number: "sky",
      percentage: "sky",
      date: "lavender",
      category: "amber",
      boolean: "lime",
      email: "sky",
      url: "rose",
    };
    return tones[type] || "neutral";
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

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const ink = darkMode ? "text-white" : "text-[#141414]";
  const body = darkMode ? "text-white/70" : "text-[#3d3d3b]";
  const hairline = darkMode ? "border-white/[0.06]" : "border-[#f0f0ee]";
  const fieldLabel = `mb-1.5 block text-xs ${darkMode ? "text-white/55" : "text-[#8a8a8a]"}`;
  const inputClass = `h-11 w-full rounded-full border px-4 text-[13.5px] outline-none transition ${
    darkMode
      ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-[3px] focus:ring-white/10"
      : "border-transparent bg-[#f4f4f2] text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:bg-white focus:ring-[3px] focus:ring-black/[0.05]"
  }`;
  const iconButton = (danger = false) =>
    `grid h-9 w-9 place-items-center rounded-full transition-colors ${
      danger
        ? darkMode ? "text-[#f7aab5] hover:bg-red-500/10" : "text-[#c0394b] hover:bg-[#fbe4e6]"
        : darkMode ? "text-white/60 hover:bg-white/10" : "text-[#5f5f5c] hover:bg-[#f4f4f2]"
    }`;
  const panel = `rounded-[20px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`;
  const softPanel = `rounded-[16px] ${darkMode ? "bg-white/[0.04]" : "bg-[#f7f7f5]"}`;
  const thClass = `px-5 py-3 text-left text-[12px] font-normal ${muted}`;
  const readyCount = documents.filter((doc) => doc.isReady && doc.isActive).length;
  const processingCount = documents.filter((doc) => !doc.isReady).length;

  const renderUserPicker = (form, onToggle, maxHeight = "max-h-52") => (
    <div className={`${maxHeight} overflow-auto rounded-[16px] border p-1.5 ${darkMode ? "border-white/10" : "border-[#ececec]"}`}>
      {assignableUsers.length === 0 ? (
        <p className={`px-3 py-2 text-[13px] ${muted}`}>No users available</p>
      ) : (
        assignableUsers.map((item) => {
          const picked = form.allowedUserIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors ${
                picked
                  ? darkMode ? "bg-white/[0.08] text-white" : "bg-[#f4f4f2] text-[#141414]"
                  : darkMode ? "text-white/75 hover:bg-white/[0.05]" : "text-[#3d3d3b] hover:bg-[#f6f6f4]"
              }`}
            >
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border ${
                picked
                  ? darkMode ? "border-[#cff07a] bg-[#cff07a] text-black" : "border-[#141414] bg-[#141414] text-white"
                  : darkMode ? "border-white/25" : "border-[#cfcfcb] bg-white"
              }`}>
                {picked && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
              <span className={`shrink-0 text-[12px] ${muted}`}>{item.username}</span>
            </button>
          );
        })
      )}
    </div>
  );

  const renderVisibilityPills = (options, value, onPick) => (
    <div className={`inline-flex flex-wrap rounded-full p-1 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
      {options.map(([optionValue, Icon, label]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onPick(optionValue)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition ${
            value === optionValue
              ? darkMode ? "bg-[#26272d] text-white" : "bg-white text-[#141414] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
              : darkMode ? "text-white/55 hover:text-white" : "text-[#8a8a8a] hover:text-[#141414]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  const renderAccessControls = (form, setter, title = "Access") => (
    <div className={`${softPanel} p-4`}>
      <p className={`mb-3 text-[13px] ${ink}`}>{title}</p>
      {renderVisibilityPills(
        [
          ["private", Lock, "Private"],
          ["selected", Users, "Selected"],
          ["public", Globe2, "Public"],
        ],
        form.visibility,
        (value) => setter((current) => ({ ...current, visibility: value })),
      )}

      {form.visibility === "selected" && (
        <div className="mt-4 space-y-3">
          <div>
            <label className={fieldLabel}>Access expires (optional)</label>
            <DateTimePicker
              darkMode={darkMode}
              value={form.accessExpiresAt}
              onChange={(nextValue) => setter((current) => ({ ...current, accessExpiresAt: nextValue }))}
              placeholder="No expiry selected"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
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
                  className={`h-7 rounded-full border px-3 text-[12px] transition-colors ${darkMode ? "border-white/10 text-white/65 hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#3d3d3b] hover:bg-[#f6f6f4]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {renderUserPicker(form, (userId) => toggleAssignedUser(userId, setter))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex-1 newq overflow-y-auto ${darkMode ? "bg-[#121317]" : "bg-white"}`}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <PageHeader
          darkMode={darkMode}
          badge={currentFolder ? `Folder · ${currentFolder.name}` : "Document library"}
          badgeIcon={currentFolder ? FolderOpen : Library}
          badgeTone="sky"
          title={currentFolder ? currentFolder.name : "Documents"}
          subtitle={currentFolder ? "sources in this folder" : "files the assistant can read"}
          description={currentFolder ? "Upload files, link sheets and choose who can see each source." : "Open a folder to view and manage its sources."}
          actions={
            <>
              {currentFolder && (
                <Button darkMode={darkMode} variant="secondary" icon={ArrowLeft} onClick={() => setCurrentFolderId(null)}>
                  Back
                </Button>
              )}
              {canCreateFolders && !currentFolder && (
                <Button darkMode={darkMode} variant="secondary" icon={FolderPlus} onClick={() => openFolderModal()}>
                  Create folder
                </Button>
              )}
              {currentFolder && (canLinkSheets || isAssignedFolderContributor) && (
                <Button
                  darkMode={darkMode}
                  variant="secondary"
                  icon={Sheet}
                  onClick={() => {
                    resetUploadAccess();
                    setSheetModal(true);
                  }}
                >
                  Link sheet
                </Button>
              )}

              {currentFolder && (canUploadDocuments || isAssignedFolderContributor) && (
                <div ref={uploadMenuRef} className="relative">
                  <Button
                    darkMode={darkMode}
                    variant="primary"
                    icon={Upload}
                    loading={uploading}
                    iconRight={ChevronDown}
                    onClick={() => setUploadMenuOpen((current) => !current)}
                    disabled={uploading}
                  >
                    Upload docs
                  </Button>

                  {uploadMenuOpen && !uploading && (
                    <div
                      style={{ boxShadow: "var(--ui-shadow-pop)" }}
                      className={`absolute right-0 top-[calc(100%+8px)] z-40 w-[290px] rounded-[18px] border p-1.5 ${
                        darkMode ? "border-white/10 bg-[#17181c]" : "border-[#ececec] bg-white"
                      }`}
                    >
                      {[
                        {
                          key: "local",
                          img: "/localdisk.png",
                          alt: "Local Disk",
                          title: "From local computer",
                          text: "PDF, Word, Excel, CSV, text, or image",
                        },
                        {
                          key: "drive",
                          img: "/drive.svg",
                          alt: "Google Drive",
                          title: "From Google Drive",
                          text: "Paste a Drive document link",
                        },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setUploadMenuOpen(false);
                            if (item.key === "local") {
                              fileInputRef.current?.click();
                            } else {
                              resetUploadAccess();
                              setDriveModal(true);
                            }
                          }}
                          className={`flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-colors ${
                            darkMode ? "text-white hover:bg-white/[0.06]" : "text-[#141414] hover:bg-[#f6f6f4]"
                          }`}
                        >
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                            <img src={item.img} alt={item.alt} className="h-6 w-6" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px]">{item.title}</span>
                            <span className={`block truncate text-[12px] ${muted}`}>{item.text}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                darkMode={darkMode}
                variant="soft"
                onClick={handleRefresh}
                disabled={loading}
                aria-label="Refresh documents"
                title="Refresh"
                icon={RefreshCw}
                className={`w-9 shrink-0 px-0 ${loading ? "[&>svg]:animate-spin" : ""}`}
              />
            </>
          }
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.csv,.xlsx,.xls,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile darkMode={darkMode} icon={Folder} tone="sky" value={folders.length.toLocaleString()} label="Folders" />
          <StatTile darkMode={darkMode} icon={Files} tone="lavender" value={(currentFolder ? visibleDocuments.length : documents.length).toLocaleString()} label={currentFolder ? "Sources in folder" : "Sources"} />
          <StatTile darkMode={darkMode} icon={CircleCheck} tone="mint" value={readyCount.toLocaleString()} label="Active for queries" />
          <StatTile darkMode={darkMode} icon={Sparkles} tone="peach" value={processingCount.toLocaleString()} label="Processing" />
        </div>

        {shouldShowFolders && (
          <section className={`${panel} overflow-hidden`}>
            <header className="flex items-center gap-3 px-5 pb-2 pt-5">
              <IconTile icon={Folder} tone="sky" darkMode={darkMode} size="sm" />
              <div className="min-w-0">
                <h3 className={`text-[15px] ${ink}`}>Folders</h3>
                <p className={`text-[12.5px] ${muted}`}>Click a folder to open it</p>
              </div>
            </header>
            <div className="overflow-auto newq">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className={`border-b ${hairline}`}>
                    {["Folder name", "Type", "Visibility", "Sources", "Assigned users", ""].map((h) => (
                      <th key={h || "actions"} className={thClass}>{h}</th>
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
                        className={`cursor-pointer border-b transition-colors last:border-b-0 ${hairline} ${darkMode ? "hover:bg-white/[0.03]" : "hover:bg-[#fafaf9]"}`}
                        title="Open folder"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <IconTile icon={Folder} tone="lime" darkMode={darkMode} size="sm" />
                            <div className="min-w-0">
                              <p className={`truncate text-[13.5px] ${ink}`}>{folder.name}</p>
                              <p className={`text-[12px] ${muted}`}>Click to open</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Chip darkMode={darkMode} tone="neutral">Folder</Chip>
                        </td>
                        <td className="px-5 py-3.5">
                          <Chip darkMode={darkMode} tone={folder.visibility === "public" ? "sky" : "lavender"} icon={folder.visibility === "public" ? Globe2 : Users}>
                            {folder.visibility === "public" ? "Public" : "Selected"}
                          </Chip>
                        </td>
                        <td className={`px-5 py-3.5 text-[13px] ${body}`}>
                          {sourceCount} source{sourceCount === 1 ? "" : "s"}
                        </td>
                        <td className={`px-5 py-3.5 text-[13px] ${body}`}>
                          {folder.visibility === "public" ? "All users" : `${folder.allowedUserIds?.length || 0} user(s)`}
                        </td>
                        <td className="px-5 py-3.5">
                          {canManageAccess && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openFolderModal(folder);
                                }}
                                className={iconButton()}
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
                                className={iconButton(true)}
                                title="Delete folder"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </section>
        )}

        {!shouldShowFolders && (
        <section className={`${panel} overflow-hidden`}>
          <header className="flex items-center gap-3 px-5 pb-2 pt-5">
            <IconTile icon={FileText} tone="lavender" darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h3 className={`text-[15px] ${ink}`}>Sources</h3>
              <p className={`text-[12.5px] ${muted}`}>Active sources are used to answer questions</p>
            </div>
          </header>
          <div className="overflow-auto newq">
            {loading && documents.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <Loader2 className={`mx-auto mb-3 h-7 w-7 animate-spin ${muted}`} />
                <p className={`text-[13px] ${muted}`}>Loading documents...</p>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="p-5 pt-3">
                <EmptyState
                  darkMode={darkMode}
                  icon={FileText}
                  tone="lavender"
                  title={shouldShowFolders ? "Open a folder to view sources" : "No documents uploaded yet"}
                  text="Uploaded files and linked sheets appear here once they are processed."
                  action={
                    <Button darkMode={darkMode} variant="primary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                      Upload your first document
                    </Button>
                  }
                />
              </div>
            ) : (
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className={`border-b ${hairline}`}>
                  {["Document name", "Type", "Uploaded", "Size", "Status", ""].map((h) => (
                    <th key={h || "actions"} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleDocuments.map((doc) => {
                    const source = getDocumentSource(doc);
                    const SourceIcon = source.Icon;
                    const canToggle = canToggleDocuments || doc.ownerId === user?.id;

                    return (
                    <tr
                      key={doc.id}
                      className={`border-b transition-colors last:border-b-0 ${hairline} ${darkMode ? "hover:bg-white/[0.03]" : "hover:bg-[#fafaf9]"}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]"}`}>
                            <DocumentIcon doc={doc} darkMode={darkMode} />
                          </div>
                          <button
                            // onClick={() => openSheetPreview(doc)}
                            disabled={doc.type !== "sheet" || !doc.isReady}
                            className="min-w-0 text-left"
                          >
                            <span className={`block truncate text-[13.5px] ${ink}`}>
                              {doc.name}
                            </span>
                            <span className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${muted}`}>
                              <SourceIcon className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{source.label}</span>
                            </span>
                            {doc.type === "sheet" && doc.lastSyncedAt && (
                              <span className={`mt-0.5 block text-[12px] ${muted}`}>
                                Synced {new Date(doc.lastSyncedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Chip darkMode={darkMode} tone={doc.type === "sheet" ? "mint" : "neutral"}>
                          {doc.type === "sheet" ? "Sheet" : "File"}
                        </Chip>
                      </td>

                      <td className={`px-5 py-3.5 text-[13px] ${body}`}>
                        {formatDate(doc.uploadedAt)}
                      </td>

                      <td className={`px-5 py-3.5 text-[13px] ${body}`}>
                        {doc.type === "sheet" ? "—" : formatFileSize(doc.fileSize)}
                      </td>

                      <td className="px-5 py-3.5">
                        {doc.isReady ? (
                          <div className="flex items-center gap-2.5">
                            {canToggle && (
                              <Toggle
                                darkMode={darkMode}
                                size="sm"
                                checked={Boolean(doc.isActive)}
                                label={doc.isActive ? "Disable for queries" : "Enable for queries"}
                                onChange={() => handleToggleActive(doc)}
                              />
                            )}
                            <Chip darkMode={darkMode} tone={doc.isActive ? "mint" : "neutral"}>
                              {doc.isActive ? "Active" : "Inactive"}
                            </Chip>
                          </div>
                        ) : (
                          <Chip darkMode={darkMode} tone="amber" icon={Loader2} className="[&>svg]:animate-spin">
                            Processing
                          </Chip>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {(canManageAccess || doc.ownerId === user?.id) && (
                            <button
                              onClick={() => openAccessModal(doc)}
                              className={iconButton()}
                              title="Manage access"
                            >
                              <Users className="h-4 w-4" />
                            </button>
                          )}
                          {(canRenameDocuments || doc.ownerId === user?.id) && <button
                            onClick={() => openRenameModal(doc)}
                            className={iconButton()}
                            title="Rename document"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>}
                          {(canDeleteDocuments || doc.ownerId === user?.id) && <button
                            onClick={() => setDeleteModal({ type: "document", item: doc })}
                            className={iconButton(true)}
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
              </tbody>
            </table>
            )}
          </div>
        </section>
        )}
      </div>

      {showProcessingModal && Object.keys(processingDocs).length > 0 && (
        <DocModal
          darkMode={darkMode}
          icon={Sparkles}
          tone="lavender"
          title="Preparing your source"
          subtitle="OCR, chunking and vector generation run in the background."
          onClose={() => setShowProcessingModal(false)}
          closeTitle="Hide processing modal"
        >
          <div className="relative mx-auto mb-6 mt-2 flex h-24 w-24 items-center justify-center">
            <span className={`absolute inset-0 rounded-full ${darkMode ? "bg-[#cff07a]/10" : "bg-[#eef8cc]"}`} />
            <span className={`absolute inset-4 animate-spin rounded-full border-2 border-dashed ${darkMode ? "border-[#cff07a]" : "border-[#4d6b12]"}`} />
            <Sparkles className={`relative h-7 w-7 ${darkMode ? "text-[#cff07a]" : "text-[#4d6b12]"}`} />
          </div>

          <div className="space-y-2">
            {Object.entries(processingDocs).map(([id, doc]) => (
              <div key={id} className={`${softPanel} rounded-[14px] p-3.5`}>
                <div className="flex items-center gap-3">
                  <Loader2 className={`h-4 w-4 animate-spin ${muted}`} />
                  <span className={`min-w-0 flex-1 truncate text-[13.5px] ${ink}`}>
                    {doc.name}
                  </span>
                  <Chip darkMode={darkMode} tone="lavender">{doc.stage}</Chip>
                </div>
                <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-[#ebebe8]"}`}>
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-[#cff07a]" />
                </div>
              </div>
            ))}
          </div>
        </DocModal>
      )}

      {localUploadModal && (
        <DocModal
          darkMode={darkMode}
          icon={HardDrive}
          tone="sky"
          title={`Add ${pendingLocalFiles.length} file${pendingLocalFiles.length === 1 ? "" : "s"}`}
          subtitle="Choose who can see these documents before processing starts."
          onClose={() => {
            setLocalUploadModal(false);
            setPendingLocalFiles([]);
          }}
          footer={
            <>
              <Button
                darkMode={darkMode}
                variant="secondary"
                onClick={() => {
                  setLocalUploadModal(false);
                  setPendingLocalFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Upload}
                loading={uploading}
                onClick={uploadLocalFiles}
                disabled={uploading || pendingLocalFiles.length === 0}
              >
                Start upload
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className={`${softPanel} max-h-28 overflow-auto px-4 py-2.5`}>
              {pendingLocalFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className={`flex items-center justify-between gap-3 py-1 text-[13px] ${body}`}>
                  <span className="truncate">{file.name}</span>
                  <span className={`shrink-0 text-[12px] ${muted}`}>{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
            {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}
          </div>
        </DocModal>
      )}

      {folderModalOpen && (
        <DocModal
          darkMode={darkMode}
          icon={folderForm.id ? Folder : FolderPlus}
          tone="lime"
          title={folderForm.id ? "Edit folder" : "Create folder"}
          subtitle="Department folder"
          onClose={() => setFolderModalOpen(false)}
          footer={
            <>
              <Button darkMode={darkMode} variant="secondary" onClick={() => setFolderModalOpen(false)}>
                Cancel
              </Button>
              <Button darkMode={darkMode} variant="primary" onClick={folderForm.id ? saveFolder : createFolder}>
                {folderForm.id ? "Save folder" : "Create folder"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={fieldLabel}>Folder name</label>
              <input
                value={folderForm.name}
                onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Folder name, e.g. Accounts"
                className={inputClass}
              />
            </div>
            <div className={`${softPanel} p-4`}>
              <p className={`mb-3 text-[13px] ${ink}`}>Who can open it</p>
              {renderVisibilityPills(
                [
                  ["selected", Users, "Selected users"],
                  ["public", Globe2, "Public to all"],
                ],
                folderForm.visibility,
                (value) => setFolderForm((current) => ({ ...current, visibility: value })),
              )}
              {folderForm.visibility === "selected" && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className={fieldLabel}>Access expires (optional)</label>
                    <DateTimePicker
                      darkMode={darkMode}
                      value={folderForm.accessExpiresAt}
                      onChange={(nextValue) => setFolderForm((current) => ({ ...current, accessExpiresAt: nextValue }))}
                      placeholder="No expiry selected"
                    />
                  </div>
                  {renderUserPicker(folderForm, (userId) => toggleAssignedUser(userId, setFolderForm), "max-h-56")}
                </div>
              )}
            </div>
          </div>
        </DocModal>
      )}

      {accessModal && (
        <DocModal
          darkMode={darkMode}
          icon={Lock}
          tone="peach"
          title={accessModal.name}
          subtitle="Document access"
          onClose={() => setAccessModal(null)}
          footer={
            <>
              <Button darkMode={darkMode} variant="secondary" onClick={() => setAccessModal(null)}>
                Cancel
              </Button>
              <Button darkMode={darkMode} variant="primary" onClick={saveAccess}>
                Save access
              </Button>
            </>
          }
        >
          {renderAccessControls(accessForm, setAccessForm, "Document visibility")}
        </DocModal>
      )}

      {driveModal && (
        <DocModal
          darkMode={darkMode}
          icon={Cloud}
          tone="sky"
          title="Add from Google Drive"
          subtitle="Drive document"
          onClose={() => { setDriveModal(false); setDriveUrl(""); setDriveName(""); resetUploadAccess(); }}
          footer={
            <>
              <Button darkMode={darkMode} variant="secondary" onClick={() => { setDriveModal(false); setDriveUrl(""); setDriveName(""); resetUploadAccess(); }}>
                Cancel
              </Button>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Cloud}
                loading={addingDrive}
                onClick={handleAddDriveDocument}
                disabled={addingDrive || !driveUrl.trim()}
              >
                {addingDrive ? "Adding..." : "Add Drive document"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={fieldLabel}>Drive link</label>
              <div className="relative">
                <Link className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
                <input
                  type="text"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Display name (optional)</label>
              <input
                type="text"
                value={driveName}
                onChange={(e) => setDriveName(e.target.value)}
                placeholder="e.g. Vendor agreement"
                className={inputClass}
              />
            </div>

            {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}

            <Notice darkMode={darkMode} tone="amber">
              <ol className="list-inside list-decimal space-y-1">
                <li>Share private files with the Google service account email</li>
                <li>Google Docs, Sheets, Slides, PDFs, and images are converted into readable text</li>
                <li>The temporary local copy is removed after vector processing</li>
              </ol>
            </Notice>
          </div>
        </DocModal>
      )}

      {sheetModal && (
        <DocModal
          darkMode={darkMode}
          icon={Sheet}
          tone="mint"
          title="Add Google Sheet"
          subtitle="Live data source"
          onClose={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); resetUploadAccess(); }}
          footer={
            <>
              <Button darkMode={darkMode} variant="secondary" onClick={() => { setSheetModal(false); setSheetUrl(""); setSheetName(""); resetUploadAccess(); }}>
                Cancel
              </Button>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Sheet}
                loading={addingSheet}
                onClick={handleAddSheet}
                disabled={addingSheet || !sheetUrl.trim()}
              >
                {addingSheet ? "Connecting..." : "Add sheet"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={fieldLabel}>Sheet URL</label>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={fieldLabel}>Display name (optional)</label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="e.g. Sales Data Q2"
                className={inputClass}
              />
            </div>

            {renderAccessControls(uploadAccessForm, setUploadAccessForm, "Initial access")}

            <Notice darkMode={darkMode} tone="amber">
              <ol className="list-inside list-decimal space-y-1">
                <li>Share the sheet with your service account email</li>
                <li>Or make it public (&quot;Anyone with the link can view&quot;)</li>
                <li>The sheet auto-syncs when data changes (checked every 30s)</li>
              </ol>
            </Notice>
          </div>
        </DocModal>
      )}

      {sheetPreview && (
        <DocModal
          darkMode={darkMode}
          icon={BarChart3}
          tone="mint"
          title={sheetPreview.document?.name}
          subtitle={`Synced ${sheetPreview.document?.lastSyncedAt ? new Date(sheetPreview.document.lastSyncedAt).toLocaleString() : "recently"}`}
          onClose={() => setSheetPreview(null)}
          wide
        >
            {loadingPreview ? (
              <div className="flex justify-center py-20">
                <Loader2 className={`h-7 w-7 animate-spin ${muted}`} />
              </div>
            ) : (
              <>
                <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Total rows", sheetPreview.overview?.totalRows || 0, Rows3, "mint"],
                    ["Columns", sheetPreview.overview?.columns?.length || 0, Columns3, "sky"],
                    ["Tabs", sheetPreview.sheets?.length || 0, Sheet, "lavender"],
                    ["Architecture", sheetPreview.architecture ? "Saved" : "Detected", BarChart3, "peach"],
                  ].map(([label, value, Icon, tone]) => (
                    <StatTile key={label} darkMode={darkMode} icon={Icon} tone={tone} label={label} value={typeof value === "number" ? value.toLocaleString() : value} />
                  ))}
                </div>

                {sheetPreview.architecture?.ai && (
                  <Highlight
                    darkMode={darkMode}
                    icon={Sparkles}
                    className="mb-5"
                    title="AI architecture read"
                    text={sheetPreview.architecture.ai.purpose || "This sheet has been profiled for structure and useful views."}
                    action={
                      <div className="hidden max-w-[50%] flex-wrap justify-end gap-1.5 md:flex">
                        {(sheetPreview.architecture.ai.recommendedViews || sheetPreview.architecture.summary?.suggestedViews || []).map((view) => (
                          <Chip key={view} darkMode={darkMode} tone="outline">{view}</Chip>
                        ))}
                      </div>
                    }
                  />
                )}

                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <div className={`${panel} p-5`}>
                    <div className="mb-4 flex items-center gap-2.5">
                      <IconTile icon={BarChart3} tone="sky" darkMode={darkMode} size="sm" />
                      <h4 className={`text-[15px] ${ink}`}>Numeric fields</h4>
                    </div>
                    <div className="space-y-2">
                      {(sheetPreview.architecture?.tabs || [])
                        .flatMap((tab) => tab.columns.filter((column) => column.stats).map((column) => ({ ...column, tab: tab.name })))
                        .slice(0, 6)
                        .map((column) => (
                          <div key={`${column.tab}-${column.name}`} className={`${softPanel} rounded-[14px] px-4 py-3`}>
                            <div className="flex justify-between gap-3 text-[13px]">
                              <span className={ink}>{column.name}</span>
                              <span className={muted}>{column.tab}</span>
                            </div>
                            <p className={`mt-1 text-[12px] ${muted}`}>
                              Avg {formatMetric(column.stats.average)} · Min {formatMetric(column.stats.min)} · Max {formatMetric(column.stats.max)}
                            </p>
                          </div>
                        ))}
                      {!sheetPreview.architecture?.tabs?.some((tab) => tab.columns.some((column) => column.stats)) && (
                        <p className={`text-[13px] ${muted}`}>No numeric columns detected yet.</p>
                      )}
                    </div>
                  </div>

                  <div className={`${panel} p-5`}>
                    <div className="mb-4 flex items-center gap-2.5">
                      <IconTile icon={Columns3} tone="amber" darkMode={darkMode} size="sm" />
                      <h4 className={`text-[15px] ${ink}`}>Categories and workflow</h4>
                    </div>
                    <div className="space-y-4">
                      {(sheetPreview.architecture?.tabs || [])
                        .flatMap((tab) => tab.columns.filter((column) => column.topValues).map((column) => ({ ...column, tab: tab.name })))
                        .slice(0, 5)
                        .map((column) => (
                          <div key={`${column.tab}-${column.name}`}>
                            <p className={`mb-2 text-[12px] ${muted}`}>
                              {column.name} · {column.tab}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {column.topValues.map((item) => (
                                <Chip key={`${column.name}-${item.value}`} darkMode={darkMode} tone="neutral">
                                  {item.value}: {item.count}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        ))}
                      {!sheetPreview.architecture?.tabs?.some((tab) => tab.columns.some((column) => column.topValues)) && (
                        <p className={`text-[13px] ${muted}`}>No category-like columns detected.</p>
                      )}
                    </div>
                  </div>
                </div>

                {(sheetPreview.sheets || []).map((sheet) => (
                  <div key={sheet.name} className={`${panel} mb-5 overflow-hidden`}>
                    <div className={`border-b px-5 py-4 ${hairline}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-center gap-2.5">
                          <IconTile icon={Sheet} tone="mint" darkMode={darkMode} size="sm" />
                          <div>
                            <h4 className={`text-[15px] ${ink}`}>{sheet.name}</h4>
                            <p className={`text-[12px] ${muted}`}>
                              {sheet.rows.length} rows · {sheet.headers.length} columns
                            </p>
                          </div>
                        </div>
                        {findTabArchitecture(sheet) && (
                          <div className="flex flex-wrap gap-1.5 lg:justify-end">
                            {[
                              ["Primary", findTabArchitecture(sheet).primaryLabel],
                              ["Metrics", findTabArchitecture(sheet).keyMetrics?.join(", ")],
                              ["Workflow", findTabArchitecture(sheet).workflowColumns?.join(", ")],
                            ].filter(([, value]) => value).map(([label, value]) => (
                              <Chip key={label} darkMode={darkMode} tone="neutral">
                                {label}: {value}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {findTabArchitecture(sheet) && (
                      <div className={`border-b px-5 py-4 ${hairline}`}>
                        <p className={`mb-3 text-[13px] ${ink}`}>Detected architecture</p>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {findTabArchitecture(sheet).columns.map((column) => (
                            <div key={column.name} className={`${softPanel} rounded-[14px] p-3.5`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`truncate text-[13px] ${ink}`}>{column.name}</p>
                                  <p className={`mt-0.5 text-[12px] ${muted}`}>
                                    {column.role} · {column.filled} filled · {column.blank} blank
                                  </p>
                                </div>
                                <Chip darkMode={darkMode} tone={getTypeStyle(column.type)} className="h-6 shrink-0 px-2.5 text-[11px]">
                                  {column.type}
                                </Chip>
                              </div>
                              {column.examples?.length > 0 && (
                                <p className={`mt-2 truncate text-[12px] ${muted}`}>
                                  e.g. {column.examples.join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={`border-b px-5 py-3 ${hairline}`}>
                      <p className={`text-[13px] ${ink}`}>Sheet data</p>
                      <p className={`text-[12px] ${muted}`}>
                        Showing all columns and up to 100 rows for this tab.
                      </p>
                    </div>
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full min-w-[760px] text-[13px]">
                        <thead className={`sticky top-0 z-10 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
                          <tr className={`border-b ${hairline}`}>
                            {sheet.headers.map((header) => (
                              <th key={header} className={`${thClass} whitespace-nowrap`}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(0, 100).map((row) => (
                            <tr key={row.__rowIndex} className={`border-b last:border-b-0 ${hairline}`}>
                              {sheet.headers.map((header) => (
                                <td key={header} className={`min-w-[160px] px-5 py-3 align-top ${body}`}>{row[header] || "—"}</td>
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
        </DocModal>
      )}

      {renameModal && (
        <DocModal
          darkMode={darkMode}
          icon={Edit3}
          tone="amber"
          title="Rename document"
          subtitle="Document name"
          onClose={() => setRenameModal(null)}
          footer={
            <>
              <Button darkMode={darkMode} variant="secondary" onClick={() => setRenameModal(null)}>
                Cancel
              </Button>
              <Button
                darkMode={darkMode}
                variant="primary"
                icon={Edit3}
                loading={renaming}
                onClick={handleRename}
                disabled={renaming || !renameValue.trim()}
              >
                Save
              </Button>
            </>
          }
        >
          <input
            type="text"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
            }}
            className={inputClass}
            placeholder="Document name"
            autoFocus
          />
        </DocModal>
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

// Centered modal in the reference style: radius 24, icon tile header, round close button,
// pill footer buttons.
function DocModal({ darkMode, icon, tone = "neutral", title, subtitle, onClose, closeTitle = "Close", footer, wide = false, children }) {
  return (
    <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 newq">
      <div
        role="dialog"
        aria-modal="true"
        style={{ boxShadow: "var(--ui-shadow-pop)" }}
        className={`ui-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[24px] border ${wide ? "max-w-6xl" : "max-w-xl"} ${
          darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-[#ececec] bg-white text-[#141414]"
        }`}
      >
        <header className={`flex items-center justify-between gap-3 border-b px-6 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={icon} tone={tone} darkMode={darkMode} size="sm" />
            <div className="min-w-0">
              <h3 className="truncate text-[17px] tracking-[-0.01em]">{title}</h3>
              {subtitle && <p className={`truncate text-[12.5px] ${darkMode ? "text-white/45" : "text-[#8a8a8a]"}`}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={closeTitle}
            aria-label={closeTitle}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className={`flex items-center justify-end gap-2 border-t px-6 py-4 ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
