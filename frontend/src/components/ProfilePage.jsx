"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, BriefcaseBusiness, Building2, CheckCircle2, ExternalLink, Eye, EyeOff, FileText, FolderOpen, GraduationCap, HeartPulse, IdCard, KeyRound, LogIn, LogOut, Mail, MessageCircleMore, Pencil, Phone, ReceiptText, RefreshCw, Save, ShieldCheck, Upload, UserRound, X } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import UserAvatar, { beanheadPresetsForGender } from "./UserAvatar";
import { Button, Chip, IconTile, PageHeader, SelectMenu, cx, toneOf } from "./ui";

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
  aadhar_card_copy: { Icon: IdCard, tone: "peach" },
  pan_card_copy: { Icon: BadgeCheck, tone: "sky" },
  educational_certificates: { Icon: GraduationCap, tone: "lavender" },
  last_3_months_pay_slip: { Icon: ReceiptText, tone: "amber" },
  last_company_letters: { Icon: Building2, tone: "rose" },
  medical_certificate: { Icon: HeartPulse, tone: "mint" },
};

const labelClass = (darkMode) => `text-[12px] ${darkMode ? "text-white/55" : "text-[#8a8a8a]"}`;
const fieldShell = (darkMode) => cx(
  "border border-transparent transition-[background-color,border-color,box-shadow]",
  darkMode
    ? "bg-white/[0.06] text-white focus-within:bg-white/[0.09] focus-within:ring-[3px] focus-within:ring-white/10"
    : "bg-[#f4f4f2] text-[#141414] focus-within:border-[#e2e2df] focus-within:bg-white focus-within:ring-[3px] focus-within:ring-black/[0.05]",
);

function ProfileField({ darkMode, label, value, onChange, icon: Icon, className = "", ...props }) {
  const disabled = Boolean(props.disabled);
  return (
    <label className={`block ${className}`}>
      <span className={labelClass(darkMode)}>{label}</span>
      <span className="relative mt-1.5 block">
        {Icon && <Icon className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? "text-white/40" : "text-[#8a8a87]"}`} />}
        <input
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          className={cx(
            "h-11 w-full rounded-full px-4 text-[13.5px] outline-none disabled:cursor-default",
            Icon && "pl-11",
            fieldShell(darkMode),
            darkMode ? "placeholder:text-white/35" : "placeholder:text-[#a3a3a0]",
            disabled && (darkMode ? "!bg-white/[0.03] text-white/75" : "!bg-[#f7f7f5] text-[#3d3d3b]"),
          )}
          {...props}
        />
      </span>
    </label>
  );
}

function PasswordField({ darkMode, label, value, onChange, visible, onToggle, autoComplete, placeholder }) {
  return (
    <label className="block">
      <span className={labelClass(darkMode)}>{label}</span>
      <span className={cx("mt-1.5 flex h-11 items-center rounded-full pr-1.5", fieldShell(darkMode))}>
        <KeyRound className={`ml-4 h-4 w-4 shrink-0 ${darkMode ? "text-white/40" : "text-[#8a8a87]"}`} />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-w-0 flex-1 !rounded-none !border-0 !bg-transparent px-3 text-[13.5px] !shadow-none outline-none !ring-0 ${darkMode ? "text-white placeholder:text-white/35" : "text-[#141414] placeholder:text-[#a3a3a0]"}`}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${darkMode ? "text-white/55 hover:bg-white/10" : "text-[#8a8a87] hover:bg-black/5"}`}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
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
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [reportChecking, setReportChecking] = useState(true);
  const [todayReportSubmitted, setTodayReportSubmitted] = useState(false);
  const [documentUploading, setDocumentUploading] = useState("");
  const [documentUploadProgress, setDocumentUploadProgress] = useState({});
  const [attendanceData, setAttendanceData] = useState({ settings: {}, records: [], remoteWorkEnabled: false, reportExempt: false });
  const [avatarDrawerOpen, setAvatarDrawerOpen] = useState(false);
  const avatarPickerRef = useRef(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [visiblePasswords, setVisiblePasswords] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
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
  const reportExempt = Boolean(attendanceData.reportExempt);
  const mustFillReportBeforeClockOut = Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt && !todayReportSubmitted && !reportExempt);

  async function loadReportStatus() {
    try {
      setReportChecking(true);
      const response = await fetch(`${API_URL}/employee-daily-report`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load report status");
      setTodayReportSubmitted(Boolean(data.todaySubmitted));
    } catch {
      setTodayReportSubmitted(false);
    } finally {
      setReportChecking(false);
    }
  }

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
    if (attendanceSaving || !canClockOut || mustFillReportBeforeClockOut) return;
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
      void loadReportStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // The Slack reminders link here with ?attendance=clock-in|clock-out: once attendance and
  // report status have loaded, do that action (the browser supplies the location), then drop
  // the parameter so a reload doesn't repeat it.
  const slackAttendanceActionDone = useRef(false);
  useEffect(() => {
    if (slackAttendanceActionDone.current || attendanceLoading || reportChecking) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("attendance");
    if (action !== "clock-in" && action !== "clock-out") return;
    slackAttendanceActionDone.current = true;
    params.delete("attendance");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    const timer = window.setTimeout(() => {
      if (action === "clock-in") {
        if (todayAttendance?.clockInAt) toast.success("You're already clocked in for today");
        else void clockInFromProfile();
        return;
      }
      if (todayAttendance?.clockOutAt) toast.success("You're already clocked out for today");
      else if (!todayAttendance?.clockInAt) toast.error("Clock in first before clocking out");
      else if (mustFillReportBeforeClockOut) toast.error("File today's daily report first, then clock out");
      else void clockOutFromProfile();
    }, 0);
    // No cleanup: the action runs once even if a focus refresh re-renders meanwhile.
    void timer;
  }, [attendanceLoading, reportChecking]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function refreshReportStatus() {
      void loadReportStatus();
    }
    window.addEventListener("uipl:employee-daily-report-submitted", refreshReportStatus);
    window.addEventListener("focus", refreshReportStatus);
    return () => {
      window.removeEventListener("uipl:employee-daily-report-submitted", refreshReportStatus);
      window.removeEventListener("focus", refreshReportStatus);
    };
  }, []);

  function openEmployeeReport() {
    window.location.href = "/employee-daily-report";
  }

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

  async function changePassword(event) {
    event.preventDefault();
    if (passwordSaving) return;
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) return toast.error("Fill all password fields");
    if (passwordForm.newPassword.length < 6) return toast.error("New password must be at least 6 characters");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error("Passwords do not match");
    try {
      setPasswordSaving(true);
      const response = await fetch(`${API_URL}/profile/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not change password");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setVisiblePasswords({ currentPassword: false, newPassword: false, confirmPassword: false });
      toast.success("Password changed");
    } catch (error) {
      toast.error(error.message || "Could not change password");
    } finally {
      setPasswordSaving(false);
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

  const card = darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white";
  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const clockBusy = attendanceLoading || attendanceSaving || reportChecking;
  const clockedIn = Boolean(todayAttendance?.clockInAt && !todayAttendance?.clockOutAt);

  return (
    <main className={`newq min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className="mx-auto w-full max-w-[1600px]">
        <form onSubmit={saveProfile}>
          <PageHeader
            darkMode={darkMode}
            badge={editing ? "Editing profile" : "My profile"}
            badgeIcon={UserRound}
            badgeTone="sky"
            title="Profile"
            subtitle="your details, password and HR documents"
            actions={
              editing ? (
                <Button darkMode={darkMode} variant="primary" type="submit" disabled={saving} icon={Save} loading={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              ) : (
                <Button
                  darkMode={darkMode}
                  variant="primary"
                  icon={Pencil}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
              )
            }
          />

          <section className="pt-6 pb-4">
          <div className={`relative rounded-[20px] border ${card}`}>
            <div
              className={`relative h-28 rounded-t-[20px] sm:h-32 ${darkMode ? "bg-[linear-gradient(120deg,rgba(207,240,122,0.10),rgba(96,165,250,0.08))]" : "bg-[linear-gradient(120deg,#eef6e4,#e9f0f8)]"}`}
            />

            <div className="grid gap-6 px-5 pb-6 md:grid-cols-[minmax(0,1fr)_300px] md:px-7">
              <div className="relative z-10 -mt-12 min-w-0 sm:-mt-14">
                <UserAvatar user={avatarUser} name={displayName} size="xl" className={`border-[4px] bg-white ${darkMode ? "border-[#15171c]" : "border-white"}`} />
                {editing && (
                  <div ref={avatarPickerRef} className="relative mt-3 w-fit">
                    <button
                      type="button"
                      onClick={() => setAvatarDrawerOpen((current) => !current)}
                      className={`inline-flex h-8 items-center justify-center rounded-full px-3.5 text-[12.5px] transition ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}
                    >
                      Change avatar
                    </button>
                    {avatarDrawerOpen && (
                      <div style={{ boxShadow: "var(--ui-shadow-pop)" }} className={`absolute left-0 top-[calc(100%+8px)] z-[80] w-[330px] max-w-[calc(100vw-2rem)] rounded-[18px] border p-3 md:left-[calc(100%+12px)] md:top-[-116px] ${darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px]">Choose avatar</p>
                            <p className={`text-[12px] ${muted}`}>All avatars</p>
                          </div>
                          <button type="button" onClick={() => setAvatarDrawerOpen(false)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-white/[0.06] hover:bg-white/10" : "bg-[#f4f4f2] hover:bg-[#ebebe8]"}`} aria-label="Close avatar picker"><X className="h-3.5 w-3.5" /></button>
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
                                className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-[0.96] ${selected ? (darkMode ? "bg-white/10 ring-2 ring-[#cff07a]" : "bg-[#eef8cc] ring-2 ring-[#141414]") : darkMode ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-[#f7f7f5] hover:bg-[#efefec]"}`}
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
                  <h1 className={`text-[28px] leading-tight tracking-[-0.02em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{displayName}</h1>
                  <button
                    type="button"
                    onClick={mustFillReportBeforeClockOut ? openEmployeeReport : clockedIn ? clockOutFromProfile : clockInFromProfile}
                    disabled={clockBusy || (mustFillReportBeforeClockOut ? false : clockedIn ? !canClockOut : !canClockIn)}
                    className={`inline-flex h-10 w-fit min-w-[132px] items-center justify-center gap-2 rounded-full px-5 text-[13px] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                      todayAttendance?.clockOutAt
                        ? darkMode ? "bg-emerald-400/[0.12] text-[#a7e8bf]" : "bg-[#e4f1e6] text-[#2f7a4f]"
                        : mustFillReportBeforeClockOut
                          ? darkMode ? "bg-sky-400/[0.13] text-[#a9cbf7] hover:bg-sky-400/20" : "bg-[#e3eefb] text-[#2f6fc0] hover:bg-[#d6e6f9]"
                        : todayAttendance?.clockInAt
                          ? darkMode ? "bg-rose-400/[0.13] text-[#f7aab5] hover:bg-rose-400/20" : "bg-[#fbe4e6] text-[#c0394b] hover:bg-[#f8d6da]"
                          : darkMode ? "bg-[#cff07a] text-[#141414] hover:bg-[#c4e96a]" : "bg-[#141414] text-white hover:bg-black"
                    }`}
                  >
                    {clockBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : todayAttendance?.clockOutAt ? <CheckCircle2 className="h-4 w-4" /> : mustFillReportBeforeClockOut ? <FileText className="h-4 w-4" /> : todayAttendance?.clockInAt ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                    {attendanceLoading
                      ? "Checking"
                      : reportChecking
                        ? "Checking report"
                      : attendanceSaving
                        ? clockedIn ? "Clocking out" : "Clocking in"
                        : todayAttendance?.clockOutAt ? "Clocked out" : mustFillReportBeforeClockOut ? "Fill Employee Report" : todayAttendance?.clockInAt ? "Clock out" : "Clock in"}
                  </button>
                </div>
                <p className={`mt-1 text-[14px] ${darkMode ? "text-white/60" : "text-[#5f5f5c]"}`}>{form.designation || "Designation not added"}</p>
                <p className={`text-[13px] ${muted}`}>{form.department || "Department not added"} · {user?.username || "username"}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Chip tone={editing ? "lime" : "sky"} darkMode={darkMode}>{editing ? "Editing" : "Profile"}</Chip>
                  <Chip tone="outline" darkMode={darkMode}>{user?.roleName || "Team member"}</Chip>
                </div>
              </div>

              <aside className="pt-1 md:pt-6">
                <p className={`text-[12px] md:text-right ${muted}`}>Current role</p>
                <div className="mt-2 flex md:justify-end">
                  <Chip tone="neutral" darkMode={darkMode} icon={ShieldCheck}>{user?.roleName || "Team member"}</Chip>
                </div>
                <div className="mt-6">
                  <p className={`text-[12px] md:text-right ${muted}`}>Contact</p>
                  <div className="mt-2 flex flex-wrap gap-2 md:justify-end">
                    <Chip tone="neutral" darkMode={darkMode} icon={Mail}>{form.email || "No email"}</Chip>
                    <Chip tone={form.whatsappPhone ? "mint" : "amber"} darkMode={darkMode} icon={MessageCircleMore}>{form.whatsappPhone ? `+${form.whatsappPhone}` : "WhatsApp required"}</Chip>
                  </div>
                </div>
              </aside>
            </div>

          </div>
        </section>

        <section className="grid gap-4 py-2 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`rounded-[20px] border p-5 ${card}`}>
            <div className="flex items-center gap-2.5">
              <IconTile icon={UserRound} tone="sky" darkMode={darkMode} size="sm" />
              <div>
                <h3 className="text-[15px]">Personal information</h3>
                <p className={`text-[12.5px] ${muted}`}>name, role and team</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProfileField darkMode={darkMode} label="Full name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} disabled={!editing} required />
              <ProfileField darkMode={darkMode} label="Designation" value={form.designation} onChange={(value) => setForm((current) => ({ ...current, designation: value }))} disabled={!editing} placeholder="e.g. Designer" icon={BriefcaseBusiness} />
              <ProfileField darkMode={darkMode} label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} disabled={!editing} placeholder="e.g. Design" />
              <ProfileField darkMode={darkMode} label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} disabled={!editing} placeholder="name@company.com" icon={Mail} type="email" />
              <label className="block">
                <span className={labelClass(darkMode)}>Gender</span>
                <SelectMenu
                  darkMode={darkMode}
                  value={form.gender || "male"}
                  onChange={(value) => setForm((current) => ({ ...current, gender: value, avatarPreset: "" }))}
                  disabled={!editing}
                  className="mt-1.5"
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                />
              </label>
            </div>
          </div>

          <div className={`rounded-[20px] border p-5 ${card}`}>
            <div className="flex items-center gap-2.5">
              <IconTile icon={Phone} tone="mint" darkMode={darkMode} size="sm" />
              <div>
                <h3 className="text-[15px]">Phone and WhatsApp</h3>
                <p className={`text-[12.5px] ${muted}`}>where reminders reach you</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <ProfileField darkMode={darkMode} label="Phone number" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, "") }))} disabled={!editing} placeholder="919898892887" icon={Phone} inputMode="numeric" />
              <ProfileField darkMode={darkMode} label="WhatsApp number" value={form.whatsappPhone} onChange={(value) => setForm((current) => ({ ...current, whatsappPhone: value.replace(/\D/g, "") }))} disabled={!editing} placeholder="919898892887" icon={MessageCircleMore} inputMode="numeric" />
            </div>
          </div>
        </section>
        </form>

        <form onSubmit={changePassword} className={`mb-4 mt-4 rounded-[20px] border p-5 ${card}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2.5">
              <IconTile icon={KeyRound} tone="lavender" darkMode={darkMode} size="sm" />
              <div>
                <h3 className="text-[15px]">Password and security</h3>
                <p className={`text-[12.5px] ${muted}`}>Change your account password using your current password.</p>
              </div>
            </div>
            <Chip tone="mint" darkMode={darkMode} icon={ShieldCheck} className="w-fit">Secure</Chip>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <PasswordField
              darkMode={darkMode}
              label="Current password"
              value={passwordForm.currentPassword}
              onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
              visible={visiblePasswords.currentPassword}
              onToggle={() => setVisiblePasswords((current) => ({ ...current, currentPassword: !current.currentPassword }))}
              autoComplete="current-password"
              placeholder="Enter current password"
            />
            <PasswordField
              darkMode={darkMode}
              label="New password"
              value={passwordForm.newPassword}
              onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
              visible={visiblePasswords.newPassword}
              onToggle={() => setVisiblePasswords((current) => ({ ...current, newPassword: !current.newPassword }))}
              autoComplete="new-password"
              placeholder="Enter new password"
            />
            <PasswordField
              darkMode={darkMode}
              label="Confirm password"
              value={passwordForm.confirmPassword}
              onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
              visible={visiblePasswords.confirmPassword}
              onToggle={() => setVisiblePasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))}
              autoComplete="new-password"
              placeholder="Confirm new password"
            />
            <Button darkMode={darkMode} variant="primary" type="submit" disabled={passwordSaving} icon={KeyRound} loading={passwordSaving} className="h-11 w-full lg:w-auto">
              {passwordSaving ? "Changing" : "Change password"}
            </Button>
          </div>
        </form>

        <section className={`mb-6 w-full min-w-0 overflow-hidden rounded-[20px] border p-4 sm:p-5 ${card}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2.5">
              <IconTile icon={FolderOpen} tone="amber" darkMode={darkMode} size="sm" />
              <div>
                <h3 className="text-[15px]">Documents</h3>
                <p className={`text-[12.5px] ${muted}`}>Upload required HR documents. Files are saved to your Google Drive employee folder.</p>
              </div>
            </div>
            {user?.employeeDocumentsFolderId && (
              <a href={`https://drive.google.com/drive/folders/${user.employeeDocumentsFolderId}`} target="_blank" rel="noreferrer" className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13px] transition sm:w-auto ${darkMode ? "border-white/10 bg-white/[0.04] text-white hover:bg-white/10" : "border-[#e6e6e3] bg-white text-[#141414] hover:bg-[#f6f6f4]"}`}>
                <FolderOpen className="h-4 w-4" />
                Open folder
              </a>
            )}
          </div>
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {EMPLOYEE_DOCUMENT_TYPES.map((docType, index) => {
              const documents = (user?.employeeDocuments || []).filter((item) => item.type === docType.id);
              const document = documents[0];
              const multiple = MULTI_EMPLOYEE_DOCUMENT_TYPES.has(docType.id);
              const uploading = documentUploading === docType.id;
              const progress = documentUploadProgress[docType.id];
              const meta = DOCUMENT_CARD_META[docType.id] || DOCUMENT_CARD_META.aadhar_card_copy;
              const tone = toneOf(meta.tone);
              return (
                <div key={docType.id} className={`flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] border p-4 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
                  <div className="rounded-[16px] p-4" style={{ backgroundColor: darkMode ? tone[2] : tone[0] }}>
                    <div className="flex items-start justify-between gap-3">
                      <span style={{ color: darkMode ? tone[3] : tone[1] }}><meta.Icon className="h-5 w-5" strokeWidth={1.8} /></span>
                      <span className={`text-[12px] tabular-nums ${darkMode ? "text-white/40" : "text-black/30"}`}>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h4 className={`mt-6 max-w-full break-words text-[16px] leading-snug tracking-[-0.01em] ${darkMode ? "text-white" : "text-[#141414]"}`}>{docType.label}</h4>
                    <p className={`mt-1 text-[12.5px] ${darkMode ? "text-white/55" : "text-[#6b6b6b]"}`}>{progress ? `Uploading ${progress.current} of ${progress.total}` : document ? `${documents.length} file${documents.length === 1 ? "" : "s"} ready for HR review` : multiple ? "Multiple files accepted" : "No document uploaded yet"}</p>
                    {progress && (
                      <div className="mt-3">
                        <p className={`truncate text-[11px] ${darkMode ? "text-white/60" : "text-[#6b6b6b]"}`}>{progress.name}</p>
                        <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-white/15" : "bg-white/70"}`}>
                          <div className={`h-full rounded-full transition-all duration-300 ${darkMode ? "bg-white" : "bg-[#141414]"}`} style={{ width: `${Math.max(8, Math.round((progress.current / progress.total) * 100))}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Chip tone={document ? "mint" : "rose"} darkMode={darkMode}>{document ? `${documents.length} uploaded` : "Missing"}</Chip>
                    <div className="flex items-center gap-2">
                      <label className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-[12.5px] transition ${uploading ? "pointer-events-none opacity-60" : ""} ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                        {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {progress ? `Uploading ${progress.current}/${progress.total}` : uploading ? "Uploading" : multiple && document ? "Add files" : document ? "Replace" : "Upload"}
                        <input type="file" className="hidden" multiple={multiple} disabled={uploading} onChange={(event) => uploadProfileDocument(docType.id, event.target.files)} />
                      </label>
                      <a href={document?.url || "#"} target={document ? "_blank" : undefined} rel="noreferrer" onClick={(event) => { if (!document) event.preventDefault(); }} aria-label={document ? "Open document" : "No document yet"} className={`grid h-9 w-9 place-items-center rounded-full transition ${document ? "" : "opacity-50"} ${darkMode ? "bg-white/[0.07] text-white hover:bg-white/[0.11]" : "bg-[#f4f4f2] text-[#141414] hover:bg-[#ebebe8]"}`}>
                        {document ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
