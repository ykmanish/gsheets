"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { Button, IconTile } from "@/components/ui";

// A module that crashes shows this in its place; the sidebar and navbar stay usable,
// so moving to another page still works without a reload.
export default function ModuleError({ error, unstable_retry }) {
  const darkMode = Boolean(useShell()?.darkMode);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`newq grid min-h-0 flex-1 place-items-center p-6 ${darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"}`}>
      <div className={`w-full max-w-md rounded-[24px] border p-8 text-center ${darkMode ? "border-white/10 bg-[#15171c]" : "border-[#ececec] bg-white"}`}>
        <IconTile icon={TriangleAlert} tone="amber" darkMode={darkMode} size="lg" className="mx-auto" />
        <h2 className="mt-5 text-[22px] leading-[1.15] tracking-[-0.02em]">This page hit a problem</h2>
        <p className={`text-[22px] leading-[1.15] tracking-[-0.02em] ${darkMode ? "text-white/40" : "text-[#9a9a98]"}`}>the rest still works</p>
        <p className={`mt-3 text-[13.5px] leading-6 ${darkMode ? "text-white/55" : "text-[#7a7a78]"}`}>
          Try loading this page again, or pick another page from the menu.
        </p>
        <Button darkMode={darkMode} variant="primary" size="lg" icon={RotateCcw} onClick={() => unstable_retry()} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
