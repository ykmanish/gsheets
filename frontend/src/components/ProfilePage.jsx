"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, BriefcaseBusiness, Building2, CheckCircle2, ExternalLink, FileText, FolderOpen, GraduationCap, HeartPulse, IdCard, LogIn, LogOut, Mail, MessageCircleMore, Pencil, Phone, ReceiptText, RefreshCw, Save, Upload } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import UserAvatar, { beanheadPresetsForGender } from "./UserAvatar";
import { SelectMenu } from "./ui";

const EMPLOYEE_DOCUMENT_TYPES = [
  { id: "aadhar_card_copy", label: "Aadhar card copy" },
  { id: "pan_card_copy", label: "Pan card copy" },
  { id: "last_3_months_pay_slip", label: "Last 3 months pay slip" },
  { id: "educational_certificates", label: "Educational certificates - 10th, 12th, Graduation and PG(if applicable)" },
  { id: "last_company_letters", label: "Last company appointment letter and experience relieving letter" },
  { id: "medical_certificate", label: "Medical certificate from your doctor" },
];
const MULTI_EMPLOYEE_DOCUMENT_TYPES = new Set(["last_3_months_pay_slip", "educational_certificates", "last_company_letters"]);

const DOCUMENT_CARD_META = {
  aadhar_card_copy: { Icon: IdCard, card: "bg-orange-100 text-[#171714]", icon: "bg-orange-50 text-orange-600" },
  pan_card_copy: { Icon: BadgeCheck, card: "bg-blue-100 text-[#171714]", icon: "bg-blue-50 text-blue-600" },
  educational_certificates: { Icon: GraduationCap, card: "bg-cyan-100 text-[#171714]", icon: "bg-cyan-50 text-cyan-600" },
  last_3_months_pay_slip: { Icon: ReceiptText, card: "bg-violet-100 text-[#171714]", icon: "bg-violet-50 text-violet-600" },
  last_company_letters: { Icon: Building2, card: "bg-rose-100 text-[#171714]", icon: "bg-rose-50 text-rose-600" },
  medical_certificate: { Icon: HeartPulse, card: "bg-green-100 text-[#171714]", icon: "bg-green-50 text-green-600" },
};

function ProfileField({ darkMode, label, value, onChange, icon: Icon, className = "", ...props }) {
  const disabled = Boolean(props.disabled);
  return (
    <label className={`block ${className}`}>
      <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>{label}</span>
      <span className="relative mt-2 block">
        {Icon && <Icon className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? "text-white/38" : "text-black/35"}`} />}
        <input
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:ring-4 disabled:cursor-default ${Icon ? "pl-11" : ""} ${darkMode ? "border-white/10 bg-white/[0.045] text-white placeholder:text-white/30 focus:ring-white/5 disabled:bg-white/[0.025]" : "border-black/10 bg-white text-black placeholder:text-black/35 focus:ring-emerald-500/10 disabled:bg-[#f7f8f5]"} ${disabled ? "opacity-75" : ""}`}
          {...props}
        />
      </span>
    </label>
  );
}

function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function ProfilePage({ darkMode }) {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [documentUploading, setDocumentUploading] = useState("");
  const [documentUploadProgress, setDocumentUploadProgress] = useState({});
  const [attendanceData, setAttendanceData] = useState({ settings: {}, records: [], remoteWorkEnabled: false, reportExempt: false });
  const [avatarDrawerOpen, setAvatarDrawerOpen] = useState(false);
  const avatarPickerRef = useRef(null);
  const [form, setForm] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    whatsappPhone: user?.whatsappPhone || user?.phone || "",
    department: user?.department || "",
    designation: user?.designation || "",
    gender: user?.gender || "",
    avatarPreset: user?.avatarPreset || "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm({
        displayName: user?.displayName || "",
        email: user?.email || "",
        phone: user?.phone || "",
        whatsappPhone: user?.whatsappPhone || user?.phone || "",
        department: user?.department || "",
        designation: user?.designation || "",
        gender: user?.gender || "",
        avatarPreset: user?.avatarPreset || "",
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  const displayName = form.displayName || user?.displayName || user?.username || "User";
  const avatarUser = { ...user, ...form, displayName };
  const avatarPresets = beanheadPresetsForGender("all");
  const todayAttendance = attendanceData.records.find((record) => record.userId === user?.id && record.date === todayInput());
  const attendanceConfigured = Boolean(Number(attendanceData.settings?.latitude) && Number(attendanceData.settings?.longitude));
  const remoteWorkEnabled = Boolean(attendanceData.remoteWorkEnabled || user?.remoteWorkEnabled);
  const attendanceReady = attendanceConfigured || remoteWorkEnabled;
  const canClockIn = !todayAttendance?.clockInAt && (attendanceConfigured || remoteWorkEnabled);
  const canClockOut = Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt && attendanceReady);

  async function loadAttendance() {
    try {
      const response = await fetch(`${API_URL}/hr/attendance`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load attendance");
      setAttendanceData({
        settings: data.settings || {},
        records: data.records || [],
        remoteWorkEnabled: Boolean(data.remoteWorkEnabled),
        reportExempt: Boolean(data.reportExempt),
      });
    } catch {
      setAttendanceData({ settings: {}, records: [], remoteWorkEnabled: false, reportExempt: false });
    } finally {
      setAttendanceLoading(false);
    }
  }

  function browserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
        () => reject(new Error("Could not read your current location. Please allow location access.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  async function clockInFromProfile() {
    if (attendanceSaving || !canClockIn) return;
    try {
      setAttendanceSaving(true);
      let location = {};
      try {
        location = await browserLocation();
      } catch (error) {
        if (!remoteWorkEnabled) throw error;
      }
      const response = await fetch(`${API_URL}/hr/attendance/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not clock in");
      setAttendanceData((current) => ({
        ...current,
        settings: data.settings || current.settings,
        records: [data.record, ...current.records.filter((record) => record.id !== data.record?.id)],
      }));
      toast.success("Clocked in");
    } catch (error) {
      toast.error(error.message || "Could not clock in");
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function clockOutFromProfile() {
    if (attendanceSaving || !canClockOut) return;
    try {
      setAttendanceSaving(true);
      let location = {};
      try {
        location = await browserLocation();
      } catch (error) {
        if (!remoteWorkEnabled) throw error;
      }
      const response = await fetch(`${API_URL}/hr/attendance/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not clock out");
      setAttendanceData((current) => ({
        ...current,
        settings: data.settings || current.settings,
        records: [data.record, ...current.records.filter((record) => record.id !== data.record?.id)],
      }));
      toast.success("Clocked out");
    } catch (error) {
      toast.error(error.message || "Could not clock out");
    } finally {
      setAttendanceSaving(false);
    }
  }

  useEffect(() => {
    if (!avatarDrawerOpen) return undefined;
    function closeOnOutside(event) {
      if (avatarPickerRef.current?.contains(event.target)) return;
      setAvatarDrawerOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [avatarDrawerOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avatarUrl: "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save profile");
      await refreshUser?.();
      setEditing(false);
      setAvatarDrawerOpen(false);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadProfileDocument(type, files) {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (!user?.id || !selectedFiles.length) return;
    const formData = new FormData();
    try {
      setDocumentUploading(type);
      for (const [index, file] of selectedFiles.entries()) {
        setDocumentUploadProgress((current) => ({ ...current, [type]: { current: index + 1, total: selectedFiles.length, name: file.name } }));
        formData.delete("file");
        formData.delete("type");
        formData.append("file", file);
        formData.append("type", type);
        const response = await fetch(`${API_URL}/hr/employees/${user.id}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not upload document");
      }
      await refreshUser?.();
      toast.success(selectedFiles.length > 1 ? "Documents uploaded to Drive" : "Document uploaded to Drive");
    } catch (error) {
      toast.error(error.message || "Could not upload document");
    } finally {
      setDocumentUploading("");
      setDocumentUploadProgress((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
    }
  }

  async function saveProfileDocumentLink(docType) {
    if (!user?.id) return;
    const url = window.prompt(`Paste Drive link for ${docType.label}`);
    if (!url?.trim()) return;
    const name = window.prompt("Document name", docType.label) || docType.label;
    try {
      setDocumentUploading(docType.id);
      const response = await fetch(`${API_URL}/hr/employees/${user.id}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: docType.id, name, url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save document link");
      await refreshUser?.();
      toast.success("Document link saved");
    } catch (error) {
      toast.error(error.message || "Could not save document link");
    } finally {
      setDocumentUploading("");
    }
  }

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f12] text-white" : "bg-[#f4f6f2] text-[#171714]"}`}>
      <form onSubmit={saveProfile} className="mx-auto max-w-6xl">
        <section className="pb-4">
          <div className={`relative rounded-[28px] border ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#e3e8df] bg-white"}`}>
            <div
              className="relative h-32 overflow-hidden rounded-t-[28px] bg-cover bg-center sm:h-40"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1623594845764-13991ac51774?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute right-4 top-4 flex items-center gap-2">
                {editing ? (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#72ec31] px-6 text-sm font-black text-black transition hover:bg-[#66de29] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing(true);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#72ec31] px-6 text-sm font-black text-black transition hover:bg-[#66de29] active:scale-[0.98]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-6 px-5 pb-6 md:grid-cols-[minmax(0,1fr)_300px] md:px-7">
              <div className="relative z-10 -mt-10 min-w-0 sm:-mt-12">
                <UserAvatar user={avatarUser} name={displayName} size="xl" className={`border-[3px] bg-white ${darkMode ? "border-[#15171c]" : "border-white"}`} />
                {editing && (
                  <div ref={avatarPickerRef} className="relative mt-3 w-fit">
                    <button
                      type="button"
                      onClick={() => setAvatarDrawerOpen((current) => !current)}
                      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-black transition ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#e8f6ee] text-[#15734d] hover:bg-[#dcfacb]"}`}
                    >
                      Change avatar
                    </button>
                    {avatarDrawerOpen && (
                      <div className={`absolute left-0 top-[calc(100%+10px)] z-[80] w-[330px] max-w-[calc(100vw-2rem)] rounded-[22px] border p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:left-[calc(100%+12px)] md:top-[-116px] ${darkMode ? "border-white/10 bg-[#181a20] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-[#d8f36a]" : "text-[#4b9b16]"}`}>All avatars</p>
                            <p className="text-sm font-black">Choose avatar</p>
                          </div>
                          <button type="button" onClick={() => setAvatarDrawerOpen(false)} className={`grid h-8 w-8 place-items-center rounded-full text-lg leading-none ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close avatar picker">×</button>
                        </div>
                        <div className="grid max-h-[min(16rem,calc(100vh-14rem))] grid-cols-5 gap-2 overflow-y-auto pr-1 md:max-h-[min(20rem,calc(100vh-10rem))]">
                          {avatarPresets.map((preset) => {
                            const selected = form.avatarPreset === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setForm((current) => ({ ...current, avatarPreset: preset.id }));
                                  setAvatarDrawerOpen(false);
                                }}
                                className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-[0.96] ${selected ? "bg-[#e7fadc] ring-2 ring-[#67c94a]" : darkMode ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-[#f8faf7] hover:bg-[#eef9e8]"}`}
                              >
                                <UserAvatar user={{ ...avatarUser, avatarPreset: preset.id, avatarUrl: "" }} name={displayName} size="lg" className="h-11 w-11" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <h1 className="text-3xl small text-black dark:text-white font-black tracking-tight">{displayName}</h1>
                  <button
                    type="button"
                    onClick={todayAttendance?.clockInAt && !todayAttendance?.clockOutAt ? clockOutFromProfile : clockInFromProfile}
                    disabled={attendanceLoading || attendanceSaving || (todayAttendance?.clockInAt && !todayAttendance?.clockOutAt ? !canClockOut : !canClockIn)}
                    className={`inline-flex h-12 w-fit min-w-[142px] items-center justify-center gap-2 rounded-full px-6 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      todayAttendance?.clockOutAt
                        ? darkMode ? "bg-emerald-400/16 text-emerald-100" : "bg-[#e8f6ee] text-[#15734d]"
                        : todayAttendance?.clockInAt
                          ? darkMode ? "bg-red-400/16 text-red-100 hover:bg-red-400/22" : "bg-red-500 text-white hover:bg-red-600"
                          : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                  >
                    {attendanceLoading || attendanceSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : todayAttendance?.clockOutAt ? <CheckCircle2 className="h-4 w-4" /> : todayAttendance?.clockInAt ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                    {attendanceLoading
                      ? "Checking"
                      : attendanceSaving
                        ? todayAttendance?.clockInAt && !todayAttendance?.clockOutAt ? "Clocking out" : "Clocking in"
                        : todayAttendance?.clockOutAt ? "Clocked out" : todayAttendance?.clockInAt ? "Clock out" : "Clock in"}
                  </button>
                </div>
                <p className={`mt-1 text-sm ${darkMode ? "text-white/60" : "text-black/55"}`}>{form.designation || "Designation not added"}</p>
                <p className={`text-sm ${darkMode ? "text-white/45" : "text-black/45"}`}>{form.department || "Department not added"} · {user?.username || "username"}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`rounded-full px-4 py-2 text-xs font-black ${darkMode ? "bg-[#d8f36a] text-black" : "bg-[#e8f6ee] text-[#15734d]"}`}>{editing ? "Editing" : "Profile"}</span>
                  <span className={`rounded-full border px-4 py-2 text-xs font-black ${darkMode ? "border-white/15 text-white/75" : "border-black/20 text-[#171714]"}`}>{user?.roleName || "Team member"}</span>
                </div>
              </div>

              <aside className="pt-1 md:pt-8">
                <p className={`text-right text-xs font-semibold ${darkMode ? "text-white/50" : "text-black/45"}`}>Current role</p>
                <p className={`ml-auto mt-2 w-fit rounded-full px-3 py-1.5 text-xs font-black ${darkMode ? "bg-white/10 text-white" : "bg-[#f2f4ef] text-[#171714]"}`}>{user?.roleName || "Team member"}</p>
                <div className="mt-8">
                  <p className={`text-right text-xs font-semibold ${darkMode ? "text-white/50" : "text-black/45"}`}>Contact</p>
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    {[form.email || "No email", form.whatsappPhone ? `+${form.whatsappPhone}` : "WhatsApp required"].map((item) => (
                      <span key={item} className={`rounded-full px-4 py-2 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-[#f5eee8] text-[#5b524c]"}`}>{item}</span>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

          </div>
        </section>

        <section className="grid gap-5 py-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`rounded-[26px] p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
            <h3 className="text-lg font-black">Personal information</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProfileField darkMode={darkMode} label="Full name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} disabled={!editing} required />
              <ProfileField darkMode={darkMode} label="Designation" value={form.designation} onChange={(value) => setForm((current) => ({ ...current, designation: value }))} disabled={!editing} placeholder="e.g. Designer" icon={BriefcaseBusiness} />
              <ProfileField darkMode={darkMode} label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} disabled={!editing} placeholder="e.g. Design" />
              <ProfileField darkMode={darkMode} label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} disabled={!editing} placeholder="name@company.com" icon={Mail} type="email" />
              <label className="block">
                <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "text-white/45" : "text-black/42"}`}>Gender</span>
                <SelectMenu
                  darkMode={darkMode}
                  value={form.gender || "male"}
                  onChange={(value) => setForm((current) => ({ ...current, gender: value, avatarPreset: "" }))}
                  disabled={!editing}
                  className="mt-2"
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                />
              </label>
            </div>
          </div>

          <div className={`rounded-[26px] p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
            <h3 className="text-lg font-black">Phone & WhatsApp</h3>
            <div className="mt-5 space-y-4">
              <ProfileField darkMode={darkMode} label="Phone number" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, "") }))} disabled={!editing} placeholder="919898892887" icon={Phone} inputMode="numeric" />
              <ProfileField darkMode={darkMode} label="WhatsApp number" value={form.whatsappPhone} onChange={(value) => setForm((current) => ({ ...current, whatsappPhone: value.replace(/\D/g, "") }))} disabled={!editing} placeholder="919898892887" icon={MessageCircleMore} inputMode="numeric" />
            </div>
          </div>
        </section>

        <section className={`mb-6 w-full min-w-0 overflow-hidden rounded-[22px] p-3 sm:rounded-[26px] sm:p-5 ${darkMode ? "bg-[#15171c]" : "bg-white"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black">Documents</h3>
              <p className={`mt-1 text-sm ${darkMode ? "text-white/55" : "text-black/55"}`}>Upload required HR documents. Files are saved to your Google Drive employee folder.</p>
            </div>
            {user?.employeeDocumentsFolderId && (
              <a href={`https://drive.google.com/drive/folders/${user.employeeDocumentsFolderId}`} target="_blank" rel="noreferrer" className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-black sm:w-auto ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#eef8e8] text-[#39710f] hover:bg-[#e1f7d3]"}`}>
                <FolderOpen className="h-4 w-4" />
                Open folder
              </a>
            )}
          </div>
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EMPLOYEE_DOCUMENT_TYPES.map((docType) => {
              const documents = (user?.employeeDocuments || []).filter((item) => item.type === docType.id);
              const document = documents[0];
              const multiple = MULTI_EMPLOYEE_DOCUMENT_TYPES.has(docType.id);
              const uploading = documentUploading === docType.id;
              const progress = documentUploadProgress[docType.id];
              const meta = DOCUMENT_CARD_META[docType.id] || DOCUMENT_CARD_META.aadhar_card_copy;
              const Icon = meta.Icon;
              return (
                <div key={docType.id} className={`w-full min-w-0 overflow-hidden rounded-[20px] border p-3 transition hover:-translate-y-0.5 sm:rounded-[24px] sm:p-4 ${darkMode ? "border-white/10 bg-[#191b20]" : "border-black/5 bg-white"}`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-white/10 text-white" : meta.icon}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold ${darkMode ? "text-white/55" : "text-black/50"}`}>HR Document</p>
                        <p className="truncate text-sm font-black text-[#171714] dark:text-white">{docType.label}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${document ? (darkMode ? "bg-emerald-400/18 text-emerald-100" : "bg-emerald-100 text-emerald-700") : (darkMode ? "bg-red-400/18 text-red-100" : "bg-red-100 text-red-700")}`}>{document ? `${documents.length} uploaded` : "Missing"}</span>
                  </div>
                  <div className={`relative min-h-[170px] w-full min-w-0 overflow-hidden rounded-[18px] p-5 sm:min-h-[200px] sm:p-6 ${darkMode ? "bg-white/10 text-white" : meta.card}`}>
                    <p className="text-sm font-semibold opacity-80">{document ? "Verified file" : "Pending upload"}</p>
                    <h4 className="mt-5 max-w-full break-words text-[21px] font-black leading-[1.08] text-[#171714] dark:text-white sm:max-w-[15rem] sm:text-[22px]">{docType.label}</h4>
                    <p className={`mt-2 text-xs font-semibold ${darkMode ? "text-white/70" : "text-black/55"}`}>{progress ? `Uploading ${progress.current} of ${progress.total}` : document ? `${documents.length} file${documents.length === 1 ? "" : "s"} ready for HR review` : multiple ? "Multiple files accepted" : "No document uploaded yet"}</p>
                    {progress && (
                      <div className="mt-3">
                        <p className={`truncate text-[10px] font-semibold ${darkMode ? "text-white/60" : "text-black/45"}`}>{progress.name}</p>
                        <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/15" : "bg-black/10"}`}>
                          <div className={`h-full rounded-full transition-all duration-300 ${darkMode ? "bg-white" : "bg-black"}`} style={{ width: `${Math.max(8, Math.round((progress.current / progress.total) * 100))}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <label className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-black transition ${uploading ? "pointer-events-none opacity-60" : ""} ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#f5f6f2] text-[#171714] hover:bg-[#ecefe8]"}`}>
                      {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {progress ? `Uploading ${progress.current}/${progress.total}` : uploading ? "Uploading" : multiple && document ? "Add files" : document ? "Replace" : "Upload"}
                      <input type="file" className="hidden" multiple={multiple} disabled={uploading} onChange={(event) => uploadProfileDocument(docType.id, event.target.files)} />
                    </label>
                    <a href={document?.url || "#"} target={document ? "_blank" : undefined} rel="noreferrer" onClick={(event) => { if (!document) event.preventDefault(); }} className={`grid h-10 w-12 place-items-center rounded-xl ${darkMode ? "bg-white/10 text-white" : "bg-[#f5f6f2] text-[#171714]"}`}>
                      {document ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </form>
    </main>
  );
}
