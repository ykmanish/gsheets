"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BriefcaseBusiness, Mail, MessageCircleMore, Pencil, Phone, Save } from "lucide-react";
import { API_URL, useAuth } from "./AuthProvider";
import UserAvatar, { beanheadPresetsForGender } from "./UserAvatar";
import { SelectMenu } from "./ui";

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

export default function ProfilePage({ darkMode }) {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
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
  }, [user]);

  const displayName = form.displayName || user?.displayName || user?.username || "User";
  const avatarUser = { ...user, ...form, displayName };
  const avatarPresets = beanheadPresetsForGender("all");

  useEffect(() => {
    if (!avatarDrawerOpen) return undefined;
    function closeOnOutside(event) {
      if (avatarPickerRef.current?.contains(event.target)) return;
      setAvatarDrawerOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [avatarDrawerOpen]);

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
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#171714] px-5 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#171714] px-5 text-sm font-black text-white transition active:scale-[0.98]"
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
                <h1 className="mt-4 text-3xl small text-black dark:text-white font-black tracking-tight">{displayName}</h1>
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
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {[form.email || "No email", form.whatsappPhone ? `+${form.whatsappPhone}` : "WhatsApp required"].map((item) => (
                      <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-[#f5eee8] text-[#5b524c]"}`}>{item}</span>
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
      </form>
    </main>
  );
}
