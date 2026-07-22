"use client";

const DICEBEAR_STYLE = "lorelei";
const DICEBEAR_BASE = `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg`;

function buildPresets(gender) {
  const prefix = gender === "female" ? "uipl-female" : "uipl-male";
  return Array.from({ length: 80 }, (_, index) => ({
    id: `${gender}-${index + 1}`,
    seed: `${prefix}-${index + 1}`,
    gender,
  }));
}

const AVATAR_PRESETS = {
  male: buildPresets("male"),
  female: buildPresets("female"),
};

export const BEANHEAD_PRESETS = [...AVATAR_PRESETS.male, ...AVATAR_PRESETS.female];

export function beanheadPresetsForGender(gender = "male") {
  if (gender === "all") return BEANHEAD_PRESETS;
  if (gender === "female") return AVATAR_PRESETS.female;
  return AVATAR_PRESETS.male;
}

function initials(name = "U") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function seedFromText(value = "user") {
  return encodeURIComponent(String(value || "user").trim() || "user");
}

function presetFor(user = {}, name = "") {
  const wanted = user.avatarPreset && BEANHEAD_PRESETS.find((item) => item.id === user.avatarPreset);
  if (wanted) return wanted;
  const gender = user.gender === "female" ? "female" : "male";
  const presets = beanheadPresetsForGender(gender);
  const seed = String(user.id || user.username || name || "user");
  const sum = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return presets[sum % presets.length] || presets[0];
}

function diceBearUrl(preset, fallbackSeed) {
  const seed = seedFromText(preset?.seed || preset?.id || fallbackSeed);
  const radius = 50;
  const backgroundColor = preset?.gender === "female"
    ? "ffd5dc,c0aede,ffdfbf,b6e3f4"
    : "b6e3f4,c0aede,d1d4f9,ffdfbf";
  return `${DICEBEAR_BASE}?seed=${seed}&radius=${radius}&backgroundColor=${backgroundColor}`;
}

export default function UserAvatar({ user, name, size = "md", className = "", rounded = "full" }) {
  const label = name || user?.displayName || user?.username || "User";
  const sizes = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-14 w-14" : size === "xl" ? "h-28 w-28" : "h-9 w-9";
  const shape = rounded === "lg" ? "rounded-2xl" : "rounded-full";
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={label} className={`${sizes} ${shape} object-cover ${className}`} />;
  }
  if (user) {
    const preset = presetFor(user, label);
    return <img src={diceBearUrl(preset, label)} alt={label} title={label} className={`${sizes} ${shape} shrink-0 object-contain ${className}`} />;
  }
  return <span title={label} className={`inline-grid shrink-0 place-items-center bg-[#10a66b] text-sm font-black text-white ${sizes} ${shape} ${className}`}>{initials(label)}</span>;
}
