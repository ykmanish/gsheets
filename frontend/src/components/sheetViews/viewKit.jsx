// Shared look for the sheet dashboards: the kit's pastel stat tiles and a chart palette
// drawn from the same tones. Presentation only; no data logic lives here.

import { Sparkles } from "lucide-react";
import { Badge, StatTile } from "../ui";

// Chart colours: the pastel tones, deep enough to read on white and on the dark panel.
export const PALETTE = ["#b9d65a", "#78a9e3", "#e2b84a", "#9b87e6", "#7fbf8e", "#e88a98", "#ee9a72", "#d9737f"];

// Old accent hexes and palette entries both resolve to a kit tone.
const ACCENT_TONES = {
  "#d8f36a": "lime", "#b9d65a": "lime", "#84cc16": "lime",
  "#3b82f6": "sky", "#78a9e3": "sky", "#06b6d4": "sky",
  "#f59e0b": "amber", "#e2b84a": "amber",
  "#a855f7": "lavender", "#9b87e6": "lavender",
  "#22c55e": "mint", "#7fbf8e": "mint",
  "#ec4899": "rose", "#e88a98": "rose", "#ef4444": "rose", "#d9737f": "rose",
  "#ee9a72": "peach",
};

export const accentTone = (accent) => ACCENT_TONES[String(accent || "").toLowerCase()] || "neutral";

// A KPI tile. Long money values get a slightly smaller number so they fit a narrow grid.
export function Metric({ darkMode, icon, label, value, note, accent }) {
  const long = String(value ?? "").length > 9;
  return (
    <StatTile
      darkMode={darkMode}
      icon={icon}
      tone={accentTone(accent)}
      value={<span className={long ? "break-words text-[21px] sm:text-[23px]" : ""}>{value}</span>}
      label={label}
      hint={note}
    />
  );
}

export function SnapshotBadge({ darkMode, children }) {
  return <Badge icon={Sparkles} tone="lime" darkMode={darkMode} className="mb-3">{children}</Badge>;
}
