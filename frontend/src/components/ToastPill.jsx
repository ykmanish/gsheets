"use client";

import { AlertCircle, Bell, CheckCircle2, Info, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

// Pastel tone per toast type: [light bg, light fg, dark bg, dark fg], same values as the kit's TONES.
const meta = {
  success: { Icon: CheckCircle2, tone: ["#e4f1e6", "#2f7a4f", "rgba(74,222,128,0.12)", "#a7e8bf"], label: "Completed" },
  error: { Icon: AlertCircle, tone: ["#fbe4e6", "#c0394b", "rgba(251,113,133,0.13)", "#f7aab5"], label: "Failed" },
  loading: { Icon: Loader2, tone: ["#fbf0d4", "#8a6200", "rgba(251,191,36,0.13)", "#f5d27a"], label: "Working" },
  notification: { Icon: Bell, tone: ["#e3eefb", "#2f6fc0", "rgba(96,165,250,0.13)", "#a9cbf7"], label: "New" },
  info: { Icon: Info, tone: ["#f4f4f2", "#3d3d3b", "rgba(255,255,255,0.07)", "rgba(255,255,255,0.78)"], label: "Info" },
};

function ToastPill({ id, message, detail, type = "info", darkMode = false, label }) {
  const item = meta[type] || meta.info;
  const Icon = item.Icon;
  const toneStyle = { backgroundColor: darkMode ? item.tone[2] : item.tone[0], color: darkMode ? item.tone[3] : item.tone[1] };

  return (
    <div
      style={{ boxShadow: "var(--ui-shadow-pop)" }}
      className={`newq flex min-h-14 max-w-[92vw] items-center overflow-hidden rounded-full border sm:max-w-md ${darkMode ? "border-white/10 bg-[#17181c] text-white" : "border-[#ececec] bg-white text-[#141414]"}`}
    >
      <div style={toneStyle} className="ml-2.5 grid h-9 w-9 shrink-0 place-items-center rounded-full">
        <Icon className={`h-4 w-4 ${type === "loading" ? "animate-spin" : ""}`} />
      </div>
      <div className="min-w-0 px-3.5 py-2">
        <p className="truncate text-[13.5px]">{message}</p>
        {detail && <p className={`mt-0.5 truncate text-[12px] ${darkMode ? "text-white/50" : "text-[#8a8a8a]"}`}>{detail}</p>}
      </div>
      <div className={`hidden h-14 items-center border-l px-3.5 sm:flex ${darkMode ? "border-white/10" : "border-[#f0f0ee]"}`}>
        <span style={toneStyle} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px]">
          <Icon className="h-3.5 w-3.5" /> {label || item.label}
        </span>
      </div>
      <button type="button" onClick={() => toast.dismiss(id)} aria-label="Dismiss" className={`mr-2.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white" : "bg-[#f4f4f2] text-[#5f5f5c] hover:bg-[#ebebe8] hover:text-[#141414]"}`}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function showAppToast(message, options = {}) {
  const { type = "info", darkMode = false, detail, label, duration = 3200 } = options;
  return toast.custom(
    (toastItem) => (
      <ToastPill id={toastItem.id} message={message} detail={detail} type={type} darkMode={darkMode} label={label} />
    ),
    { duration },
  );
}
