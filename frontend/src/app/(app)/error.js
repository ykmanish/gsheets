"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useShell } from "@/components/AppShell";

// A module that crashes shows this in its place; the sidebar and navbar stay usable,
// so moving to another page still works without a reload.
export default function ModuleError({ error, unstable_retry }) {
  const darkMode = Boolean(useShell()?.darkMode);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`grid min-h-0 flex-1 place-items-center p-6 ${darkMode ? "bg-[#0b0c0f] text-white" : "bg-[#eef3f2] text-[#171714]"}`}>
      <div className={`w-full max-w-md rounded-[30px] border p-8 text-center ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#dfe7e4] bg-white"}`}>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${darkMode ? "bg-amber-400/12 text-amber-200" : "bg-amber-50 text-amber-600"}`}>
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h2 className="small mt-5 text-2xl font-semibold">This page hit a problem</h2>
        <p className={`mt-2 text-sm leading-6 ${darkMode ? "text-white/55" : "text-black/55"}`}>
          The rest of the workspace still works. Try loading this page again, or pick another page from the menu.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={`mt-6 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-95 ${darkMode ? "bg-white text-black hover:bg-white/90" : "bg-[#171714] text-white hover:bg-black/85"}`}
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
