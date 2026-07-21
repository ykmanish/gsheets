"use client";

import { AlertCircle, Bell, CheckCircle2, Info, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

const meta = {
  success: {
    Icon: CheckCircle2,
    bubble: "bg-emerald-500 text-white ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700",
    label: "Completed",
  },
  error: {
    Icon: AlertCircle,
    bubble: "bg-red-500 text-white ring-red-100",
    badge: "bg-red-50 text-red-700",
    label: "Failed",
  },
  loading: {
    Icon: Loader2,
    bubble: "bg-amber-500 text-white ring-amber-100",
    badge: "bg-amber-50 text-amber-700",
    label: "Working",
  },
  notification: {
    Icon: Bell,
    bubble: "bg-blue-600 text-white ring-blue-100",
    badge: "bg-blue-50 text-blue-700",
    label: "New",
  },
  info: {
    Icon: Info,
    bubble: "bg-slate-700 text-white ring-slate-100",
    badge: "bg-slate-100 text-slate-700",
    label: "Info",
  },
};

function ToastPill({ id, message, detail, type = "info", darkMode = false, label }) {
  const item = meta[type] || meta.info;
  const Icon = item.Icon;

  return (
    <div className={`flex min-h-14 max-w-[92vw] items-center overflow-hidden rounded-full border shadow-[0_18px_48px_rgba(15,23,42,0.16)] ${darkMode ? "border-white/10 bg-[#101318] text-white" : "border-black/10 bg-white text-[#171714]"}`}>
      <div className={`ml-3 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ${item.bubble}`}>
        <Icon className={`h-4 w-4 ${type === "loading" ? "animate-spin" : ""}`} />
      </div>
      <div className="min-w-0 px-4 py-2">
        <p className="truncate text-sm font-medium">{message}</p>
        {detail && <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-white/50" : "text-black/45"}`}>{detail}</p>}
      </div>
      <div className={`hidden h-14 items-center border-l px-4 sm:flex ${darkMode ? "border-white/10" : "border-black/10"}`}>
        <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${item.badge}`}>
          <Icon className="h-3.5 w-3.5" /> {label || item.label}
        </span>
      </div>
      <button type="button" onClick={() => toast.dismiss(id)} className={`mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${darkMode ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-black/45 hover:bg-black/[0.05] hover:text-black"}`}>
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
