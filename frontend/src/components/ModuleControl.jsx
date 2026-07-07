"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Power, Save, Search, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";

export default function ModuleControl({ darkMode }) {
  const { refreshUser } = useAuth();
  const [modules, setModules] = useState([]);
  const [disabledModules, setDisabledModules] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`${API_URL}/admin/module-control`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load module controls");
        if (ignore) return;
        setModules(data.modules || []);
        setDisabledModules(data.disabledModules || []);
      } catch (error) {
        if (!ignore) toast.error(error.message || "Could not load module controls");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => { ignore = true; };
  }, []);

  const filteredModules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return modules.filter((module) => !needle || `${module.label} ${module.id}`.toLowerCase().includes(needle));
  }, [modules, query]);

  const disabledSet = useMemo(() => new Set(disabledModules), [disabledModules]);
  const enabledCount = modules.filter((module) => module.locked || !disabledSet.has(module.id)).length;

  function toggleModule(module) {
    if (module.locked) return;
    setDisabledModules((current) => (
      current.includes(module.id) ? current.filter((id) => id !== module.id) : [...current, module.id]
    ));
    setDirty(true);
  }

  async function save() {
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/admin/module-control`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledModules }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save module controls");
      setDisabledModules(data.disabledModules || []);
      setDirty(false);
      await refreshUser();
      toast.success("Module visibility updated");
    } catch (error) {
      toast.error(error.message || "Could not save module controls");
    } finally {
      setSaving(false);
    }
  }

  const muted = darkMode ? "text-white/45" : "text-black/45";

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
      <section className={`relative mb-5 overflow-hidden rounded-[30px] p-6 sm:p-8 ${darkMode ? "border-white/10 bg-[#202328]" : "border-black/[0.06] bg-[#fbfbfd]"}`}>
        {!darkMode && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/80 to-transparent" />
            <span className="absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
            <span className="absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f5f8]" />
          </>
        )}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.06] bg-white text-black/70 shadow-[0_10px_24px_rgba(31,35,40,0.08)]"}`}>
                <ShieldCheck className="h-4 w-4" /> Access administration
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#fff1a8] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {modules.length} modules
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold ${darkMode ? "border-white/10 bg-white/10 text-white/75" : "border-black/[0.04] bg-[#d5f3f0] text-black/70 shadow-[0_8px_18px_rgba(31,35,40,0.08)]"}`}>
                {enabledCount} active
              </span>
            </div>
            <h1 className={`mt-5 max-w-4xl text-4xl small font-black leading-[0.96] tracking-tight ${darkMode ? "text-white" : "text-[#161616]"}`}>Module access, made simple.</h1>
            <p className={`mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base ${darkMode ? "text-white/65" : "text-black/58"}`}>Turn platform modules on or off and control sidebar availability for every user in one clean workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button type="button" onClick={save} disabled={!dirty || saving} className={`flex h-12 items-center justify-center gap-2 rounded-3xl px-5 text-sm shadow-[0_14px_28px_rgba(31,35,40,0.16)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "bg-[#d8f36a] text-black" : "bg-black text-white"}`}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </section>

      <section className={`overflow-hidden rounded-[30px] border p-5 sm:p-7 ${darkMode ? "border-white/10 bg-[#15171c]" : "border-black/[0.06] bg-white"}`}>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl small font-semibold">Module records</h2>
            <p className={`mt-1 text-sm ${muted}`}>Global module visibility and platform status list.</p>
          </div>
          <label className={`flex h-12 w-full items-center gap-3 rounded-2xl border px-4 lg:w-[360px] ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
            <Search className={`h-4 w-4 shrink-0 ${muted}`} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search module, status..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current placeholder:opacity-40" />
          </label>
        </div>

        <div className="overflow-x-auto pt-3">
          {loading ? (
            <div className={`p-10 text-center text-sm ${muted}`}>Loading modules...</div>
          ) : (
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left">
              <thead className={darkMode ? "bg-[#15171c]" : "bg-white"}>
                <tr>{["Module", "Status", "Availability", "Control"].map((heading) => <th key={heading} className={`px-4 py-3 text-[11px] font-semibold ${muted}`}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => {
                  const enabled = module.locked || !disabledSet.has(module.id);
                  return (
                    <tr key={module.id} className={`transition ${darkMode ? "bg-white/[0.035] hover:bg-white/[0.06]" : "bg-[#f8f9fc] hover:bg-[#f3f5f9]"}`}>
                      <td className="rounded-l-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${enabled ? darkMode ? "bg-[#d8f36a]/10 text-[#d8f36a]" : "bg-cyan-100 text-cyan-700" : darkMode ? "bg-white/[0.06] text-white/35" : "bg-slate-200 text-slate-500"}`}>
                            {module.locked ? <ShieldCheck className="h-4 w-4" /> : enabled ? <CheckCircle2 className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </span>
                          <div><p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{module.label}</p><p className={`mt-0.5 text-xs ${muted}`}>{module.id}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>{module.locked ? "Always on" : enabled ? "Enabled" : "Disabled"}</span></td>
                      <td className={`px-4 py-3 text-sm ${muted}`}>{module.locked ? "Protected platform module" : enabled ? "Visible in assigned sidebars" : "Hidden for every user"}</td>
                      <td className="rounded-r-xl px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`text-xs font-semibold ${enabled ? "text-emerald-600" : muted}`}>{module.locked ? "Locked" : enabled ? "On" : "Off"}</span>
                          <button type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${module.label}`} disabled={module.locked} onClick={() => toggleModule(module)} className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition ${enabled ? "bg-emerald-500" : darkMode ? "bg-white/15" : "bg-black/15"} disabled:cursor-not-allowed disabled:opacity-55`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !filteredModules.length && <div className={`p-10 text-center text-sm ${muted}`}>No modules match this search.</div>}
        </div>
      </section>
    </main>
  );
}
