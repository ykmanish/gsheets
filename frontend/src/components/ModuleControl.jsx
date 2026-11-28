"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, LayoutGrid, Lock, MessageSquareText, Power, PowerOff, Save, Search, ShieldCheck, Unlock, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, useAuth } from "./AuthProvider";
import { Button, Chip, DatePicker, EmptyState, IconTile, PageHeader, StatTile, TimePicker, Toggle, cx, toneOf } from "./ui";

function formatDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function dateInputFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeInputFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isoFromLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return "";
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function displayTimeInput(value = "") {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return "Select time";
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function currentTimeInput() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function MaintenanceDatePicker({ darkMode, label, value, placeholder, onChange }) {
  return (
    <div className="relative">
      <p className={cx("text-[12.5px]", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{label}</p>
      <DatePicker darkMode={darkMode} className="mt-2" value={value || ""} placeholder={placeholder} onChange={onChange} />
    </div>
  );
}

const MAINTENANCE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: new Date(2000, 0, 1, hour, 0).toLocaleTimeString("en-IN", { hour: "numeric" }),
}));
const MAINTENANCE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function MaintenanceTimePicker({ darkMode, label, value, onChange }) {
  return (
    <div className="relative">
      <p className={cx("text-[12.5px]", darkMode ? "text-white/55" : "text-[#8a8a8a]")}>{label}</p>
      <TimePicker darkMode={darkMode} className="mt-2" value={value || ""} onChange={onChange} step={15} />
    </div>
  );
}

export default function ModuleControl({ darkMode }) {
  const { refreshUser } = useAuth();
  const [modules, setModules] = useState([]);
  const [disabledModules, setDisabledModules] = useState([]);
  const [maintenance, setMaintenance] = useState({ enabled: false, estimatedEndAt: "", message: "We are improving the workspace. Please check back soon." });
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
        setMaintenance({
          enabled: Boolean(data.maintenance?.enabled),
          estimatedEndAt: data.maintenance?.estimatedEndAt || "",
          message: data.maintenance?.message || "We are improving the workspace. Please check back soon.",
        });
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

  function updateMaintenance(patch) {
    setMaintenance((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function save() {
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/admin/module-control`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledModules, maintenance }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save module controls");
      setDisabledModules(data.disabledModules || []);
      setMaintenance({
        enabled: Boolean(data.maintenance?.enabled),
        estimatedEndAt: data.maintenance?.estimatedEndAt || "",
        message: data.maintenance?.message || "We are improving the workspace. Please check back soon.",
      });
      setDirty(false);
      await refreshUser();
      toast.success("Module visibility updated");
    } catch (error) {
      toast.error(error.message || "Could not save module controls");
    } finally {
      setSaving(false);
    }
  }

  const muted = darkMode ? "text-white/45" : "text-[#8a8a8a]";
  const maintenanceDate = dateInputFromIso(maintenance.estimatedEndAt);
  const maintenanceTime = timeInputFromIso(maintenance.estimatedEndAt);
  function updateMaintenanceEnd(nextDate = maintenanceDate, nextTime = maintenanceTime || currentTimeInput()) {
    updateMaintenance({ estimatedEndAt: isoFromLocalDateTime(nextDate, nextTime) });
  }

  const rowLine = darkMode ? "border-white/[0.07]" : "border-[#f0f0ee]";
  const softPanel = cx("rounded-[16px] p-4", darkMode ? "bg-white/[0.035]" : "bg-[#f7f7f5]");
  const modeTone = toneOf(maintenance.enabled ? "rose" : "mint");

  return (
    <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 ${darkMode ? "text-white" : "text-[#141414]"}`}>
      <div className="mx-auto w-full max-w-[1400px]">
        <PageHeader
          darkMode={darkMode}
          badge="Access · Module control"
          badgeIcon={Power}
          badgeTone="mint"
          title="Module control"
          subtitle="what is switched on for everyone"
          description="Turn platform modules on or off for every user, or hold everyone at a maintenance screen."
          actions={(
            <Button darkMode={darkMode} variant="primary" icon={Save} onClick={save} disabled={!dirty || saving} loading={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          )}
        />

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile darkMode={darkMode} icon={LayoutGrid} tone="sky" value={modules.length} label="modules" />
          <StatTile darkMode={darkMode} icon={CheckCircle2} tone="mint" value={enabledCount} label="switched on" />
          <StatTile darkMode={darkMode} icon={PowerOff} tone="peach" value={Math.max(0, modules.length - enabledCount)} label="hidden for everyone" />
          <StatTile darkMode={darkMode} icon={maintenance.enabled ? Lock : Unlock} tone={maintenance.enabled ? "rose" : "lavender"} value={maintenance.enabled ? "Locked" : "Open"} label="maintenance mode" hint={dirty ? "Unsaved changes" : undefined} />
        </div>

        <section className={cx("mt-6 rounded-[20px] border p-5 sm:p-6", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
            <div>
              <div className="flex items-center gap-3">
                <IconTile icon={Wrench} tone="peach" darkMode={darkMode} size="sm" />
                <div>
                  <h2 className="text-[15px]">Maintenance lock</h2>
                  <p className={`text-[12.5px] ${muted}`}>Everyone except Super Admin sees a maintenance screen with your timer</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip darkMode={darkMode} tone={maintenance.enabled ? "rose" : "neutral"} icon={Wrench}>{maintenance.enabled ? "Maintenance on" : "Maintenance off"}</Chip>
                <Chip darkMode={darkMode} tone="outline" icon={ShieldCheck}>Super Admin stays active</Chip>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <label className={cx("block", softPanel)}>
                  <span className={`mb-2 flex items-center gap-2 text-[13px] ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}><CalendarDays className="h-4 w-4" /> End date</span>
                  <MaintenanceDatePicker darkMode={darkMode} label="Date" value={maintenanceDate} placeholder="Select date" onChange={(date) => updateMaintenanceEnd(date, maintenanceTime || currentTimeInput())} />
                </label>
                <label className={cx("block", softPanel)}>
                  <span className={`mb-2 flex items-center gap-2 text-[13px] ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}><Clock3 className="h-4 w-4" /> End time</span>
                  <MaintenanceTimePicker darkMode={darkMode} label="Time" value={maintenanceTime} onChange={(time) => updateMaintenanceEnd(maintenanceDate || dateInputFromIso(new Date().toISOString()), time)} />
                </label>
              </div>
              <label className={cx("mt-3 block", softPanel)}>
                <span className={`mb-2 flex items-center gap-2 text-[13px] ${darkMode ? "text-white/80" : "text-[#3d3d3b]"}`}><MessageSquareText className="h-4 w-4" /> User message</span>
                <textarea
                  rows={3}
                  value={maintenance.message}
                  onChange={(event) => updateMaintenance({ message: event.target.value })}
                  placeholder="We are improving the workspace. Please check back soon."
                  className={cx(
                    "min-h-[96px] w-full resize-none rounded-[16px] border px-4 py-3 text-[13.5px] leading-6 outline-none transition",
                    darkMode ? "border-transparent bg-white/[0.06] text-white placeholder:text-white/35 focus:ring-[3px] focus:ring-white/10" : "border-transparent bg-white text-[#141414] placeholder:text-[#a3a3a0] focus:border-[#e2e2df] focus:ring-[3px] focus:ring-black/[0.05]",
                  )}
                />
              </label>
            </div>
            <aside style={{ backgroundColor: darkMode ? modeTone[2] : modeTone[0] }} className="flex flex-col justify-between rounded-[20px] p-5">
              <div>
                <span style={{ color: darkMode ? modeTone[3] : modeTone[1] }}>
                  {maintenance.enabled ? <Lock className="h-5 w-5" strokeWidth={1.8} /> : <Unlock className="h-5 w-5" strokeWidth={1.8} />}
                </span>
                <p className={`mt-5 text-[12.5px] ${darkMode ? "text-white/55" : "text-[#6b6b6b]"}`}>Current mode</p>
                <h3 className="mt-1 text-[34px] leading-none tracking-[-0.03em]">{maintenance.enabled ? "Locked" : "Open"}</h3>
                <p className={`mt-3 text-[13px] leading-5 ${darkMode ? "text-white/60" : "text-[#3d3d3b]"}`}>{maintenance.enabled ? "Users are held at the maintenance screen." : "Users can access assigned modules normally."}</p>
              </div>
              <div className={cx("mt-6 flex items-center justify-between gap-4 rounded-full py-1.5 pl-4 pr-1.5", darkMode ? "bg-black/20" : "bg-white/70")}>
                <span className="text-[13px]">{maintenance.enabled ? "On" : "Off"}</span>
                <Toggle darkMode={darkMode} checked={maintenance.enabled} onChange={() => updateMaintenance({ enabled: !maintenance.enabled })} label="Maintenance lock" />
              </div>
            </aside>
          </div>
        </section>

        <section className={cx("mt-6 rounded-[20px] border", darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white")}>
          <div className="flex flex-col gap-4 px-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <IconTile icon={LayoutGrid} tone="sky" darkMode={darkMode} size="sm" />
              <div>
                <h2 className="text-[15px]">Module records</h2>
                <p className={`text-[12.5px] ${muted}`}>Global module visibility and platform status</p>
              </div>
            </div>
            <label className={cx("flex h-10 w-full items-center gap-2.5 rounded-full px-4 lg:w-[340px]", darkMode ? "bg-white/[0.06]" : "bg-[#f4f4f2]")}>
              <Search className={`h-4 w-4 shrink-0 ${muted}`} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search module, status..." className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-current placeholder:opacity-50" />
            </label>
          </div>

          <div className="overflow-x-auto px-5 pb-3 pt-4">
            {loading ? (
              <div className={`p-10 text-center text-[13px] ${muted}`}>Loading modules...</div>
            ) : filteredModules.length ? (
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr>{["Module", "Status", "Availability", ""].map((heading) => <th key={heading || "control"} className={`border-b px-3 pb-3 text-[12px] ${rowLine} ${muted}`}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredModules.map((module) => {
                    const enabled = module.locked || !disabledSet.has(module.id);
                    return (
                      <tr key={module.id} className={cx("border-b transition-colors last:border-b-0", rowLine, darkMode ? "hover:bg-white/[0.025]" : "hover:bg-[#fafaf9]")}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <IconTile icon={module.locked ? ShieldCheck : enabled ? CheckCircle2 : Power} tone={module.locked ? "lavender" : enabled ? "mint" : "neutral"} darkMode={darkMode} size="sm" />
                            <div><p className="text-[14px]">{module.label}</p><p className={`text-[12px] ${muted}`}>{module.id}</p></div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><Chip darkMode={darkMode} tone={module.locked ? "lavender" : enabled ? "mint" : "rose"}>{module.locked ? "Always on" : enabled ? "Enabled" : "Disabled"}</Chip></td>
                        <td className={`px-3 py-3 text-[13px] ${muted}`}>{module.locked ? "Protected platform module" : enabled ? "Visible in assigned sidebars" : "Hidden for every user"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-[12.5px] ${enabled ? (darkMode ? "text-white/80" : "text-[#141414]") : muted}`}>{module.locked ? "Locked" : enabled ? "On" : "Off"}</span>
                            <Toggle darkMode={darkMode} checked={enabled} disabled={module.locked} onChange={() => toggleModule(module)} label={`${enabled ? "Disable" : "Enable"} ${module.label}`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState darkMode={darkMode} icon={Search} className="mb-2" title="No modules match this search" text="Try a module name or id." />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
