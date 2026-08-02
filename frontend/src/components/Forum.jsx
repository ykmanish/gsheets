"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AtSign, Check, CheckCheck, ChevronDown, ChevronUp, CircleDot, Compass, Copy, ExternalLink, File, FileArchive, FileCode, FileSpreadsheet, FileText, Gem, Globe2, ImageIcon, Info, Landmark, Layers3, Link as LinkIcon, LoaderCircle, LockKeyhole, Maximize, Minimize, MessageCircleMore, MessagesSquare, Monitor, MoreVertical, Network, Pencil, Pin, Plus, Reply, Rocket, Search, Send, Settings, ShieldCheck, Smile, SmilePlus, Sparkles, Star, Sticker, SunMedium, Trash2, Upload, UsersRound, Waves, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { showAppToast } from "./ToastPill";
import { API_URL, getStoredAuth } from "./AuthProvider";
import { playForumNotificationSound } from "./forumNotificationSound";
import UserAvatar from "./UserAvatar";
import EmojiPicker from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || "eGCEt3kYBuQiWaTPQhS2lSod97pS9Fpi");

const GROUP_ID = "workspace-forum";

const GROUP_AVATAR_PRESETS = [
  ["ocean", "linear-gradient(135deg,#2563eb,#06b6d4)", MessagesSquare],
  ["emerald", "linear-gradient(135deg,#059669,#84cc16)", Sparkles],
  ["sunset", "linear-gradient(135deg,#f97316,#ec4899)", Rocket],
  ["violet", "linear-gradient(135deg,#7c3aed,#2563eb)", Globe2],
  ["rose", "linear-gradient(135deg,#e11d48,#fb7185)", Network],
  ["amber", "linear-gradient(135deg,#f59e0b,#ef4444)", Compass],
  ["cyan", "linear-gradient(135deg,#0891b2,#22c55e)", Zap],
  ["indigo", "linear-gradient(135deg,#4f46e5,#8b5cf6)", Star],
  ["lime", "linear-gradient(135deg,#65a30d,#14b8a6)", ShieldCheck],
  ["pink", "linear-gradient(135deg,#db2777,#9333ea)", Gem],
  ["sky", "linear-gradient(135deg,#0284c7,#38bdf8)", Layers3],
  ["forest", "linear-gradient(135deg,#166534,#0f766e)", CircleDot],
  ["coral", "linear-gradient(135deg,#fb7185,#f97316)", SunMedium],
  ["royal", "linear-gradient(135deg,#1d4ed8,#7c3aed)", Waves],
  ["mint", "linear-gradient(135deg,#10b981,#a3e635)", Landmark],
  ["fire", "linear-gradient(135deg,#dc2626,#f59e0b)", MessagesSquare],
  ["plum", "linear-gradient(135deg,#9333ea,#e879f9)", Sparkles],
  ["teal", "linear-gradient(135deg,#0d9488,#06b6d4)", Rocket],
  ["gold", "linear-gradient(135deg,#ca8a04,#facc15)", Globe2],
  ["night", "linear-gradient(135deg,#111827,#2563eb)", Network],
  ["grape", "linear-gradient(135deg,#581c87,#c026d3)", Compass],
  ["leaf", "linear-gradient(135deg,#15803d,#4ade80)", Zap],
  ["ruby", "linear-gradient(135deg,#9f1239,#f43f5e)", Star],
  ["aqua", "linear-gradient(135deg,#0e7490,#67e8f9)", ShieldCheck],
  ["orchid", "linear-gradient(135deg,#a21caf,#f0abfc)", Gem],
  ["steel", "linear-gradient(135deg,#334155,#64748b)", Layers3],
  ["peach", "linear-gradient(135deg,#fb923c,#fda4af)", CircleDot],
  ["bluegrass", "linear-gradient(135deg,#1d4ed8,#22c55e)", SunMedium],
  ["magenta", "linear-gradient(135deg,#be185d,#7c3aed)", Waves],
  ["slate", "linear-gradient(135deg,#0f172a,#475569)", Landmark],
].map(([id, gradient, Icon]) => ({ id, gradient, Icon }));

const EMOJI_KEYWORDS = {
  "😀": "grinning happy smile face joy",
  "😃": "smiley happy face joy smile",
  "😄": "smile happy face joy laugh",
  "😁": "grin happy face teeth smile",
  "😆": "laughing XD happy face joy",
  "😅": "sweat smile happy relief face",
  "🤣": "rofl laughing floor joy lol face",
  "😂": "joy tears happy laugh face lol",
  "🙂": "slightly smiling happy face",
  "🙃": "upside down silly face",
  "🫠": "melting face hot liquid",
  "😉": "wink face flirty playful",
  "😊": "blush happy smile face sweet",
  "😇": "halo angel innocent good face",
  "🥰": "hearts in love romantic face",
  "😍": "heart eyes love romantic face",
  "🤩": "star struck amazed excited face",
  "😘": "kiss blow kiss love romance face",
  "😗": "kissing face love",
  "😚": "kissing closed eyes love face",
  "😙": "kissing smiling eyes face",
  "🥲": "smiling tear happy sad bittersweet",
  "😋": "yum delicious food taste face",
  "😛": "tongue out silly playful face",
  "😜": "wink tongue crazy silly face",
  "🤪": "zany goofy crazy silly face",
  "😝": "squint tongue silly funny face",
  "🤑": "money mouth rich cash face",
  "🤗": "hug hugging warmth embrace face",
  "🫣": "peeking eye shy scared face",
  "🤫": "shh quiet silence secret face",
  "🤔": "thinking think wonder curious face",
  "🫡": "salute respect officer honor face",
  "🤐": "zipper mouth quiet secret face",
  "🤨": "raised eyebrow skeptical suspicious face",
  "😐": "neutral poker face meh",
  "😑": "expressionless meh blank face",
  "😶": "no mouth silent quiet face",
  "🫥": "dotted line invisible ghost hidden face",
  "😏": "smirk sly coy flirty face",
  "😒": "unamused bored annoyed face",
  "🙄": "eye roll annoyed whatever face",
  "😬": "grimace awkward nervous face",
  "🤥": "lying pinocchio long nose lie face",
  "🫨": "shaking shocked earthquake face",
  "😌": "relieved peaceful calm face",
  "😔": "pensive sad depressed sorrow face",
  "😪": "sleepy snot tired face",
  "🤤": "drooling hungry food sleep face",
  "😴": "sleeping zzz asleep rest face",
  "😷": "mask medical sick doctor virus face",
  "🤒": "thermometer sick fever ill face",
  "🤕": "bandage hurt injury pain face",
  "🤢": "nauseated gross sick vomit face",
  "🤮": "vomiting puke gross sick face",
  "🤧": "sneezing cold flu tissue face",
  "🥵": "hot heat sweat red face",
  "🥶": "cold freezing ice frozen face",
  "🥴": "woozy drunk dizzy face",
  "😵": "dizzy dead shocked face",
  "😵‍💫": "spiral eyes dizzy confused face",
  "🤯": "exploding head mind blown shocked face",
  "🤠": "cowboy hat Sheriff face",
  "🥳": "party celebrate birthday hat blower face",
  "🥸": "disguise glasses mustache hidden face",
  "😎": "cool sunglasses awesome style face",
  "🤓": "nerd glasses smart geek face",
  "🧐": "monocle inspecting investigate face",
  "😕": "confused puzzled face",
  "🫤": "slanted mouth skeptical meh face",
  "😟": "worried anxious concerned face",
  "🙁": "slightly frowning sad face",
  "😮": "open mouth shocked surprised face",
  "😯": "hushed surprised quiet face",
  "😲": "astonished shocked amazed face",
  "😳": "flustered embarrassed shocked face",
  "🥺": "pleading begging puppy eyes cute face sad",
  "🥹": "holding back tears touched emotional face sad",
  "😦": "frowning open mouth sad face",
  "😧": "anguished pained shocked face sad",
  "😮‍💨": "exhale sigh relief tired face",
  "😭": "loudly crying cry sad tears sob face sorrow",
  "😱": "scream fearful terrified shocked face",
  "😖": "confounded pained frustrated face",
  "😣": "persevering struggling pained face",
  "😞": "disappointed sad regret face sorrow",
  "😓": "sweat sad depressed face",
  "😩": "weary exhausted crying sad face",
  "😫": "tired exhausted crying face sad",
  "🥱": "yawning bored sleepy face",
  "😤": "triumph huff proud angry face",
  "😡": "pouting mad angry rage red face",
  "😠": "angry mad annoyed face",
  "🤬": "swearing cursing symbols mad face",
  "😈": "smiling devil evil horn mischief",
  "👿": "angry devil imp evil purple",
  "💀": "skull dead death skeleton ghost",
  "☠️": "skull crossbones danger poison death",
  "💩": "poop dung crap funny",
  "🤡": "clown joke fool circus",
  "👹": "ogre demon monster japanese",
  "👺": "goblin red nose monster japanese",
  "👻": "ghost halloween spooky",
  "👽": "alien space ufo extraterrestrial",
  "👾": "alien monster space invader game",
  "🤖": "robot bot machine tech",
  "😢": "crying sad tear sorrow face hurt sob",
  "🙏": "pray thanks please hope hands folded thank",
  "👍": "thumbs up good agree approve like yes ok okay",
  "👎": "thumbs down bad disapprove no dislike",
  "❤️": "heart love red romance care passion",
  "🔥": "fire hot lit flame burn lit",
  "✨": "sparkles magic shiny star clean gold",
  "🎉": "tada party celebration confetti birthday",
  "💯": "100 hundred perfect score A+",
};

function matchEmojiSearch(emoji, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (emoji.includes(q)) return true;
  const keywords = EMOJI_KEYWORDS[emoji] || "";
  return keywords.toLowerCase().includes(q);
}

const EMOJI_CATEGORIES = [
  {
    id: "recents",
    label: "Recent reactions",
    icon: "🕒",
    emojis: ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "✨"]
  },
  {
    id: "smileys",
    label: "Smileys & People",
    icon: "😃",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "🫠", "😉", "😊", "😇",
      "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑",
      "🤗", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄",
      "😬", "🤥", "🫨", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
      "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤",
      "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "📁", "😮‍💨", "😭", "😱",
      "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀",
      "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "👋", "🤚", "🖐️", "✋", "🖖",
      "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈",
      "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌",
      "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪"
    ]
  },
  {
    id: "animals",
    label: "Animals & Nature",
    icon: "🐻",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷",
      "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅",
      "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰",
      "🪲", "🪳", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑",
      "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🦭", "🐊", "🐅", "🐆",
      "zebra", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂",
      "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛",
      "🌸", "🌺", "🌻", "🌹", "🌷", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀",
      "🍁", "🍂", "🍃"
    ]
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: "☕",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭",
      "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒",
      "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞",
      "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆",
      "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟",
      "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧",
      "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛",
      "🍼", "🫖", "☕️", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸",
      "🍹", "🍾", "🧊"
    ]
  },
  {
    id: "activities",
    label: "Activities & Sports",
    icon: "⚽",
    emojis: [
      "⚽️", "🏀", "🏈", "⚾️", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒",
      "🏑", "🥍", "🏏", "🪃", "🥅", "⛳️", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹",
      "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️‍♂️", "🤼‍♂️", "🤸‍♂️", "⛹️‍♂️", "🤺",
      "🤾‍♂️", "🏌️‍♂️", "🏇", "🧘‍♂️", "🏄‍♂️", "🏊‍♂️", "🤽‍♂️", "🚣‍♂️", "🧗‍♂️", "🚵‍♂️", "🚴‍♂️",
      "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️", "🎪", "🤹‍♂️", "🎭", "🩰",
      "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻"
    ]
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: "🚗",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜",
      "🦯", "🦽", "🦼", "🛴", "🚲", "🛵", "🏍️", "🛺", "🚨", "🚔", "🚘", "🚝",
      "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🛰️",
      "🚀", "🛸", "🚁", "🛶", "⛵️", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓️", "🛟", "🚧", "⛽️",
      "🚏", "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲️", "🏖️", "🏝️",
      "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "⛺️", "🛖", "🏠", "🏡", "🏢", "🏣", "🏥", "🏦"
    ]
  },
  {
    id: "objects",
    label: "Objects & Symbols",
    icon: "💡",
    emojis: [
      "⌚️", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿",
      "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻",
      "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛️", "⏳", "📡", "🔋", "🔌", "💡", "🔦",
      "🕯️", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "🪙", "💰", "💳", "💎", "⚖️", "🪜",
      "🧰", "🪛", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🪓", "⚙️", "🔗", "⛓️", "🧲", "🔫", "💣",
      "🧨", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "🪦", "⚱️", "🏺", "🔮", "🪄", "🧿",
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "✨", "🌟", "💫", "💥", "💯", "💢",
      "💬", "👁️‍🗨️", "🗯️", "💭", "💤"
    ]
  }
];

function groupAvatarPreset(id) {
  return GROUP_AVATAR_PRESETS.find((preset) => preset.id === id) || GROUP_AVATAR_PRESETS[0];
}

function GroupAvatar({ group, className = "h-11 w-11", iconClassName = "h-5 w-5", rounded = "full" }) {
  if (group?.avatarUrl) {
    const src = group.avatarUrl.startsWith("blob:") || group.avatarUrl.startsWith("data:") ? group.avatarUrl : `${API_URL}${group.avatarUrl}`;
    return (
      <img src={src} alt="" className={`shrink-0 object-cover ${rounded === "lg" ? "rounded-2xl" : "rounded-full"} ${className}`} />
    );
  }
  const preset = groupAvatarPreset(group?.avatarPreset);
  const Icon = preset.Icon || MessagesSquare;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${rounded === "lg" ? "rounded-2xl" : "rounded-full"} text-white ${className}`} style={{ background: preset.gradient }}>
      <Icon className={iconClassName} />
    </span>
  );
}

function TinySpinner({ className = "h-3.5 w-3.5" }) {
  return <LoaderCircle className={`${className} animate-spin`} />;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Forum request failed");
  return data;
}

function apiFormWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const { token } = getStoredAuth();
    xhr.open("POST", `${API_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.max(1, Math.min(95, Math.round((event.loaded / event.total) * 95))));
    };
    xhr.onload = () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText || "{}");
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Forum request failed"));
    };
    xhr.onerror = () => reject(new Error("Forum request failed"));
    xhr.send(formData);
  });
}

function socketUrl() {
  const { token } = getStoredAuth();
  const base = API_URL.replace(/^http/, "ws").replace(/\/api$/, "");
  return `${base}/forum/socket?token=${encodeURIComponent(token || "")}`;
}

const SCREEN_SHARE_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 10, max: 15 },
};

const SCREEN_SHARE_MAX_VIDEO_BITRATE = 700_000;

async function capScreenShareSender(sender) {
  if (!sender?.getParameters) return;
  const params = sender.getParameters();
  params.encodings = params.encodings?.length ? params.encodings : [{}];
  params.encodings[0] = {
    ...params.encodings[0],
    maxBitrate: SCREEN_SHARE_MAX_VIDEO_BITRATE,
    maxFramerate: 15,
    scaleResolutionDownBy: Math.max(Number(params.encodings[0]?.scaleResolutionDownBy) || 1, 1),
  };
  await sender.setParameters(params).catch(() => {});
}

function screenShareIceServers() {
  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || "";
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "";
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(turnUrls.length && turnUsername && turnCredential
      ? [{ urls: turnUrls, username: turnUsername, credential: turnCredential }]
      : [
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ]),
  ];
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatListTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? formatTime(value) : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function messageDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function sameConversation(a, b) {
  return String(a) === String(b);
}

function mentionHandleForUser(user = {}) {
  return String(user.username || user.displayName || "user")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

function renderMessageText(text, query, active = false, users = [], onMentionClick, mine = false) {
  const value = String(text || "");
  const needle = query.trim();
  const inlinePattern = /(https?:\/\/[^\s<>()]+)|@([a-zA-Z0-9_.-]+)/g;
  const parts = [];
  let lastIndex = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const start = match.index || 0;
    if (start > lastIndex) parts.push(value.slice(lastIndex, start));
    if (match[1]) {
      const url = match[1].replace(/[.,!?;:]+$/, "");
      const suffix = match[1].slice(url.length);
      parts.push(
        <a key={`${start}-${url}`} href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`inline-flex max-w-full align-baseline rounded-full px-3 py-1.5 text-sm font-medium no-underline ${mine ? "bg-white text-[#2563eb] hover:bg-[#f8fbff]" : "bg-white text-[#2563eb] hover:bg-[#f8fafc]"}`}>
          <span className="block max-w-full truncate">{url}</span>
        </a>
      );
      if (suffix) parts.push(suffix);
    } else {
      const username = match[2].toLowerCase();
      const user = users.find((item) => mentionHandleForUser(item).toLowerCase() === username);
      parts.push(
        <button key={`${start}-${match[0]}`} type="button" onClick={() => user && onMentionClick?.(user)} className={`font-normal underline underline-offset-2 ${mine ? "text-[#2563eb] decoration-[#2563eb]/35" : "text-[#2563eb] decoration-[#2563eb]/35"}`}>
          {match[0]}
        </button>
      );
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  const rendered = parts.length ? parts : [value];
  if (!needle) return rendered;
  return rendered.map((part, index) => {
    if (typeof part !== "string") return part;
    const lower = part.toLowerCase();
    const start = lower.indexOf(needle.toLowerCase());
    if (start === -1) return part;
    return (
      <span key={`highlight-${index}`}>
        {part.slice(0, start)}
        <mark className={`rounded px-0.5 ${active ? "bg-[#22c55e] text-[#052e16]" : "bg-[#86efac] text-[#052e16]"}`}>{part.slice(start, start + needle.length)}</mark>
        {part.slice(start + needle.length)}
      </span>
    );
  });
}

function getMessageStatus(message, selectedConversation, currentUserId, onlineUserIds = []) {
  if (!message || message.senderId !== currentUserId) return null;
  const readBy = message.readBy || {};
  const deliveredTo = message.deliveredTo || {};
  const participantIds = selectedConversation?.participantIds || selectedConversation?.participants?.map(p => p.id) || [];
  const recipients = participantIds.filter((id) => String(id) !== String(currentUserId));

  if (!recipients.length) return "read";

  const isRead = recipients.every((id) => Boolean(readBy[String(id)]));
  if (isRead) return "read";

  const isDelivered = recipients.some((id) => Boolean(deliveredTo[String(id)] || readBy[String(id)] || onlineUserIds.map(String).includes(String(id))));
  if (isDelivered) return "delivered";

  return "sent";
}

function firstUrlFromText(text = "") {
  const match = String(text || "").match(/https?:\/\/[^\s<>()]+/i);
  return match ? match[0].replace(/[.,!?;:]+$/, "") : "";
}

function textWithoutUrls(text = "") {
  return String(text || "").replace(/https?:\/\/[^\s<>()]+/gi, "").trim();
}

function linkPreviewMeta(url = "") {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname || ""}${parsed.search || ""}`.replace(/^\/$/, "");
    return {
      host: parsed.hostname.replace(/^www\./, ""),
      title: parsed.hostname.replace(/^www\./, ""),
      detail: path ? `/${path}` : parsed.origin,
    };
  } catch {
    return null;
  }
}

function compactUrlLabel(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = `${parsed.pathname || ""}${parsed.search || ""}`.replace(/^\/$/, "");
    return path ? `${host}/${path.replace(/^\//, "")}` : host;
  } catch {
    return url;
  }
}

function preferredFaviconSources(host = "", url = "") {
  const cleanHost = String(host || "").replace(/^www\./, "");
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  const pathname = parsedUrl?.pathname || "";
  const productIcons = {
    "drive.google.com": "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
    "docs.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png",
    "sheets.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png",
    "slides.google.com": "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png",
    "mail.google.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "gmail.com": "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    "meet.google.com": "https://www.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png",
    "maps.google.com": "https://www.gstatic.com/images/branding/product/1x/maps_48dp.png",
  };
  const productIcon = cleanHost === "docs.google.com" && pathname.startsWith("/spreadsheets")
    ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png"
    : cleanHost === "docs.google.com" && pathname.startsWith("/presentation")
      ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png"
      : cleanHost === "docs.google.com" && pathname.startsWith("/forms")
        ? "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_form_x32.png"
        : productIcons[cleanHost] || ((cleanHost === "google.com" && pathname.startsWith("/maps")) ? "https://www.gstatic.com/images/branding/product/1x/maps_48dp.png" : "");
  return [
    productIcon,
    `https://icons.duckduckgo.com/ip3/${cleanHost}.ico`,
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanHost)}&sz=128`,
  ].filter(Boolean);
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function fileVisualForAttachment(attachment = {}) {
  const name = String(attachment.name || "").toLowerCase();
  const mime = String(attachment.mimeType || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (mime.includes("pdf") || ext === "pdf") return { Icon: FileText, label: "PDF", color: "bg-red-500" };
  if (["doc", "docx"].includes(ext) || mime.includes("word")) return { Icon: FileText, label: "DOC", color: "bg-blue-600" };
  if (["xls", "xlsx", "csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) return { Icon: FileSpreadsheet, label: "XLS", color: "bg-emerald-600" };
  if (["html", "htm", "js", "jsx", "ts", "tsx", "css", "json"].includes(ext) || mime.includes("javascript") || mime.includes("html")) return { Icon: FileCode, label: ext ? ext.toUpperCase() : "CODE", color: "bg-violet-600" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) return { Icon: FileArchive, label: "ZIP", color: "bg-amber-600" };
  return { Icon: File, label: ext ? ext.toUpperCase().slice(0, 4) : "FILE", color: "bg-slate-600" };
}

function attachmentImageUrl(attachment = {}) {
  if (attachment.driveFileId) {
    const { token } = getStoredAuth();
    return `${API_URL}/forum/files/${encodeURIComponent(attachment.driveFileId)}/preview?token=${encodeURIComponent(token || "")}`;
  }
  if (attachment.previewUrl) return attachment.previewUrl;
  return attachment.openUrl || attachment.downloadUrl || "";
}

function FileAttachmentCard({ attachment, mine, darkMode, time, status = null, isEdited = false }) {
  if (!attachment) return null;
  const { Icon, label, color } = fileVisualForAttachment(attachment);
  const isUploading = attachment.uploading;
  const actionClass = darkMode ? "bg-white/[0.12] text-white hover:bg-white/[0.18]" : "bg-[#f3f6f8] text-[#0f766e] hover:bg-[#e9eef3]";
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-[18px]">
      <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white ${color}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{attachment.name || "Shared file"}</span>
          <span className={`mt-0.5 block truncate text-[11px] ${darkMode ? "text-white/55" : "text-black/45"}`}>
            {[label, formatFileSize(attachment.size)].filter(Boolean).join(" • ")}
          </span>
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : darkMode ? "text-white/50" : "text-black/45"}`}>
          {isEdited && <span className="opacity-70">Edited</span>}
          <span>{time}</span>
          {mine && status && (
            status === "read" ? <CheckCheck className="h-3.5 w-3.5 text-[#3b82f6]" /> : <Check className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
      {isUploading ? (
        <div className="px-3 pb-3 pt-1.5">
          <div className={`mb-1 flex items-center justify-between text-[11px] font-semibold ${darkMode ? "text-white/60" : "text-black/45"}`}>
            <span>Uploading...</span>
            <span className="tabular-nums transition-all duration-300">{Math.round(attachment.progress || 0)}%</span>
          </div>
          <div className={`h-1 overflow-hidden rounded-full ${darkMode ? "bg-white/15" : "bg-white/80"}`}>
            <div className="h-full rounded-full bg-black transition-all duration-500 ease-out" style={{ width: `${Math.max(2, Math.min(100, attachment.progress || 0))}%` }} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1">
          <a href={attachment.openUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold no-underline ${actionClass}`}>
            Open
          </a>
          <a href={attachment.downloadUrl || attachment.openUrl} target="_blank" rel="noreferrer" download onClick={(event) => event.stopPropagation()} className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold no-underline ${actionClass}`}>
            Download
          </a>
        </div>
      )}
    </div>
  );
}

function ImageAttachmentCard({ attachment, mine, darkMode, time, status = null, onOpen, onMissing }) {
  if (!attachment) return null;
  const caption = String(attachment.caption || "").trim();
  const imageUrl = attachmentImageUrl(attachment);
  return (
    <button type="button" onClick={onOpen} className="block w-full min-w-0 overflow-hidden rounded-[18px] text-left">
      <span className={`block overflow-hidden rounded-[16px] ${darkMode ? "bg-black/20" : "bg-white/35"}`}>
        <img
        src={imageUrl}
        alt={attachment.name || "Shared image"}
        className="max-h-[320px] w-full object-contain"
        onError={onMissing}
      />
      </span>
      {caption && (
        <p className="whitespace-pre-wrap break-words px-2 pb-1 pt-2 text-sm leading-6 [overflow-wrap:anywhere]">
          {caption}
        </p>
      )}
      <span className={`flex items-center justify-end gap-1.5 px-3 pb-1.5 pt-1 text-[10px] leading-none ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : darkMode ? "text-white/50" : "text-black/45"}`}>
        <span>{time}</span>
        {mine && status && (
          status === "read" ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#3b82f6]" /> : <Check className="h-3.5 w-3.5 shrink-0" />
        )}
      </span>
    </button>
  );
}

function getSavedReactionsMap() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("raga_forum_message_reactions") : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMessageReaction(messageId, reactions) {
  try {
    if (typeof window === "undefined") return;
    const map = getSavedReactionsMap();
    map[messageId] = reactions;
    localStorage.setItem("raga_forum_message_reactions", JSON.stringify(map));
  } catch {}
}

function conversationPreviewText(message, fallback) {
  if (message?.attachmentMissing) return fallback;
  if (message?.system) return message.text || fallback;
  if (message?.attachment?.kind === "image" || String(message?.attachment?.mimeType || "").startsWith("image/")) return message.attachment.caption || "Photo";
  if (message?.attachment?.name) return `File: ${message.attachment.name}`;
  const text = String(message?.text || "").trim();
  if (!text) return fallback;
  const url = firstUrlFromText(text);
  if (!url) return text.length > 90 ? `${text.slice(0, 90).trim()}...` : text;
  const rest = textWithoutUrls(text);
  const preview = rest || compactUrlLabel(url);
  return preview.length > 90 ? `${preview.slice(0, 90).trim()}...` : preview;
}

function pinnedPreviewText(pin) {
  if (!pin) return "";
  const text = String(pin.text || "").trim();
  if (pin.attachment?.kind === "image") return `${pin.senderName || "User"}: Photo`;
  if (pin.attachment?.name) return `${pin.senderName || "User"}: ${pin.attachment.name}`;
  return `${pin.senderName || "User"}: ${text || "Message"}`;
}

function pinActivityText(pin, currentUserId) {
  if (!pin) return "";
  return String(pin.pinnedBy || "") === String(currentUserId || "")
    ? "You pinned a message"
    : `${pin.pinnedByName || "Someone"} pinned a message`;
}

function systemMessageText(message, currentUserId) {
  if (message?.event === "pin:pin") {
    return String(message.senderId || "") === String(currentUserId || "")
      ? "You pinned a message"
      : `${message.sender?.displayName || "Someone"} pinned a message`;
  }
  return message?.text || "";
}

function LinkPreviewCard({ url, mine, darkMode, time, embedded = false, status = null, isEdited = false }) {
  const [faviconSourceIndex, setFaviconSourceIndex] = useState(0);
  const meta = linkPreviewMeta(url);
  if (!meta) return null;
  const faviconSources = preferredFaviconSources(meta.host, url);
  const faviconUrl = faviconSources[faviconSourceIndex];
  const compactUrl = compactUrlLabel(url);
  const surfaceClass = embedded
    ? darkMode ? "bg-white/10 hover:bg-white/15" : "bg-black/5 hover:bg-black/10"
    : mine
      ? darkMode ? "bg-[#181a20] hover:bg-[#1f222a]" : "bg-[#e5f1ff] hover:bg-[#d6e8fb]"
      : darkMode ? "bg-[#252830] hover:bg-[#2c303a]" : "bg-[#f0f2f5] hover:bg-[#e4e7ec]";
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`flex w-full min-w-0 max-w-full items-center gap-2.5 rounded-[20px] px-3 py-2.5 text-left transition sm:gap-3 sm:px-4 ${surfaceClass}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white sm:h-11 sm:w-11">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            onError={() => setFaviconSourceIndex((current) => current + 1)}
            className="h-6 w-6 rounded-md object-contain sm:h-7 sm:w-7"
          />
        ) : (
          <Globe2 className="h-6 w-6 text-[#2563eb] sm:h-7 sm:w-7" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${darkMode ? "text-white" : "text-[#14213d]"}`}>{meta.title}</span>
        <span className={`mt-0.5 block truncate text-xs ${darkMode ? "text-white/70" : "text-[#525866]"}`}>{compactUrl}</span>
      </span>
      {!embedded && (
        <span className={`self-end inline-flex items-center gap-1 shrink-0 whitespace-nowrap pb-0.5 text-[10px] ${mine ? darkMode ? "text-white/60" : "text-[#71809a]" : darkMode ? "text-white/50" : "text-black/45"}`}>
          {isEdited && <span className="opacity-70">Edited</span>}
          <span>{time}</span>
          {mine && status && (
            <span className="inline-flex items-center justify-center">
              {status === "read" ? (
                <CheckCheck className="h-3.5 w-3.5 text-[#3b82f6]" title="Read" />
              ) : status === "delivered" ? (
                <CheckCheck className={`h-3.5 w-3.5 ${darkMode ? "text-white/60" : "text-[#71809a]"}`} title="Delivered" />
              ) : (
                <Check className={`h-3.5 w-3.5 ${darkMode ? "text-white/60" : "text-[#71809a]"}`} title="Sent" />
              )}
            </span>
          )}
        </span>
      )}
    </a>
  );
}

function UserInfoPanel({ darkMode, user, online, muted, onDirect, onBack, activeDirectUserId, embedded = false, widgetControls = null }) {
  const panelBg = darkMode ? "bg-[#15171c] text-white" : "bg-[#fbfcff] text-black";
  const softBlock = darkMode ? "bg-white/[0.05]" : "bg-[#f4f7fb]";
  const divider = darkMode ? "border-white/[0.06]" : "border-[#eef1f5]";
  const isActiveDirectUser = activeDirectUserId && String(activeDirectUserId) === String(user?.id);
  if (!user) return null;
  return (
    <aside className={`hidden min-h-0 w-[min(30vw,340px)] min-w-[280px] shrink-0 flex-col overflow-hidden ${panelBg} xl:flex`}>
      <div className={`flex h-16 shrink-0 items-center ${embedded && widgetControls ? "justify-end" : "justify-center"} border-b px-4 ${divider}`}>
        {embedded && widgetControls ? (
          widgetControls
        ) : (
          <span className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm font-normal ${darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
            <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
            <span>Messages are end-to-end encrypted</span>
          </span>
        )}
        {onBack && (
          <button type="button" onClick={onBack} className={`ml-2 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/[0.05] hover:bg-white/10" : "bg-[#f4f7fb] hover:bg-[#edf1f7]"}`}>
            Back
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex w-[calc(100%-40px)] max-w-[320px] flex-col py-7">
      <UserAvatar user={user} name={user.displayName} className="mx-auto h-24 w-24" />
      <h2 className="small mt-5 text-center text-2xl font-bold leading-tight">{user.displayName}</h2>
      {user.username && <p className={`mt-1 truncate text-center text-sm ${muted}`}>@{user.username}</p>}
      <div className="mt-3 flex justify-center">
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${online.has(user.id) ? "bg-[#dcfce7] text-[#16a34a]" : "bg-slate-100 text-slate-500"}`}>
          {online.has(user.id) ? "Online" : "Offline"}
        </span>
      </div>
      {!isActiveDirectUser && (
        <button type="button" onClick={() => onDirect(user)} className={`mt-8 flex w-full max-w-full items-center justify-center gap-2 rounded-[14px] px-4 py-4 text-sm font-semibold ${softBlock}`}>
          <MessageCircleMore className="h-4 w-4 text-[#2563eb]" />
          Add Chat
        </button>
      )}
      <PanelSection title="Profile" muted={muted}>
        {[
          ["Designation", user.designation],
          ["Department", user.department],
          ["Email", user.email],
          ["Phone", user.phone],
        ].map(([label, value]) => (
          <div key={label} className="py-1.5">
            <p className={`text-xs ${muted}`}>{label}</p>
            <p className="mt-0.5 min-w-0 break-words text-sm font-bold">{value || "-"}</p>
          </div>
        ))}
      </PanelSection>
        </div>
      </div>
    </aside>
  );
}

function MobileUserProfileSheet({ darkMode, user, online, muted, onClose, onDirect, activeDirectUserId }) {
  const softBlock = darkMode ? "bg-white/[0.06]" : "bg-[#f4f7fb]";
  const isActiveDirectUser = activeDirectUserId && String(activeDirectUserId) === String(user?.id);
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-end bg-black/45 backdrop-blur-[2px] xl:hidden" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className={`max-h-[88vh] w-full overflow-hidden rounded-t-[28px] shadow-[0_-18px_60px_rgba(0,0,0,0.28)] animate-in slide-in-from-bottom-8 fade-in duration-200 ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-black"}`}>
        <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-white/20" />
        <div className="max-h-[calc(88vh-16px)] overflow-y-auto px-7 pb-8 pt-6">
          <div className="relative">
            <button type="button" onClick={onClose} className={`absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close profile">
              <X className="h-4 w-4" />
            </button>
            <UserAvatar user={user} name={user.displayName} className="mx-auto h-24 w-24" />
            <h2 className="small mt-5 text-center text-2xl font-bold leading-tight">{user.displayName || user.username || "User"}</h2>
            {user.username && <p className={`mt-1 truncate text-center text-sm ${muted}`}>@{mentionHandleForUser(user)}</p>}
            <div className="mt-3 flex justify-center">
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${online.has(user.id) ? "bg-[#dcfce7] text-[#16a34a]" : "bg-slate-100 text-slate-500"}`}>
                {online.has(user.id) ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          {!isActiveDirectUser && (
            <button type="button" onClick={() => onDirect(user)} className={`mt-8 flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-4 text-sm font-semibold ${softBlock}`}>
              <MessageCircleMore className="h-4 w-4 text-[#2563eb]" />
              Add Chat
            </button>
          )}
          <PanelSection title="Profile" muted={muted}>
            {[
              ["Designation", user.designation],
              ["Department", user.department],
              ["Email", user.email],
              ["Phone", user.phone],
            ].map(([label, value]) => (
              <div key={label} className="py-1.5">
                <p className={`text-xs ${muted}`}>{label}</p>
                <p className="mt-0.5 min-w-0 break-words text-sm font-bold">{value || "-"}</p>
              </div>
            ))}
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

function ForumInfoPanel({ darkMode, group, users, currentUser, groupParticipants, online, onlineUserIds, muted, onDirect, onSelectUser, onUpdateGroup, embedded = false, widgetControls = null }) {
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState(group?.name || "Group Forum");
  const [editingName, setEditingName] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const avatarPickerRef = useRef(null);
  const memberPickerRef = useRef(null);
  const panelBg = darkMode ? "bg-[#15171c] text-white" : "bg-[#fbfcff] text-black";
  const visibleMembers = showAllMembers ? groupParticipants : groupParticipants.slice(0, 4);
  const adminIds = new Set((group?.adminIds || []).map(String));
  const participantIds = new Set((group?.participantIds || groupParticipants.map((member) => member.id)).map(String));
  const canManage = Boolean(currentUser?.isSuperAdmin || adminIds.has(String(currentUser?.id || "")));
  const availableUsers = users.filter((user) => user.id && !participantIds.has(String(user.id)));

  useEffect(() => {
    if (!memberPickerOpen) return undefined;
    function closeOnOutside(event) {
      if (memberPickerRef.current?.contains(event.target)) return;
      setMemberPickerOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [memberPickerOpen]);

  useEffect(() => {
    if (!avatarPickerOpen) return undefined;
    function closeOnOutside(event) {
      if (avatarPickerRef.current?.contains(event.target)) return;
      setAvatarPickerOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [avatarPickerOpen]);

  async function saveGroup(update, action = "group") {
    try {
      setPendingAction(action);
      await onUpdateGroup(update);
    } finally {
      setPendingAction("");
    }
  }

  function participantListWith(userId, included) {
    const next = new Set(participantIds);
    if (included) next.add(String(userId));
    else next.delete(String(userId));
    return [...next];
  }

  function adminListWith(userId, included) {
    const next = new Set(adminIds);
    if (included) next.add(String(userId));
    else next.delete(String(userId));
    return [...next];
  }

  return (
    <aside className={`hidden min-h-0 w-[min(30vw,340px)] min-w-[280px] shrink-0 flex-col overflow-hidden ${panelBg} xl:flex`}>
      <div className={`flex h-16 shrink-0 items-center ${embedded && widgetControls ? "justify-end" : "justify-center"} border-b px-4 ${darkMode ? "border-white/[0.06]" : "border-[#eef1f5]"}`}>
        {embedded && widgetControls ? (
          widgetControls
        ) : (
          <span className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm font-normal ${darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
            <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
            <span>Messages are end-to-end encrypted</span>
          </span>
        )}
      </div>
      <div className="min-h-0 overflow-x-hidden overflow-y-auto px-5 py-7 2xl:px-6">
      <div className="mx-auto flex w-full max-w-[320px] flex-col">
        <div ref={avatarPickerRef} className="relative mx-auto">
          <GroupAvatar group={group} className="h-20 w-20 min-w-20" iconClassName="h-9 w-9" />
          {pendingAction === "avatar" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/50 text-white">
              <TinySpinner className="h-6 w-6" />
            </div>
          )}
          {canManage && (
            <button type="button" onClick={() => setAvatarPickerOpen((open) => !open)} className={`absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 ${darkMode ? "border-[#15171c] bg-[#1c1f26] hover:bg-[#252934]" : "border-[#fbfcff] bg-white hover:bg-[#f4f7fb]"}`} aria-label="Change group avatar">
              <Pencil className={`h-3.5 w-3.5 ${muted}`} />
            </button>
          )}
          {canManage && avatarPickerOpen && (
            <div className={`absolute left-1/2 top-[calc(100%+12px)] z-40 w-[304px] -translate-x-1/2 rounded-[22px] border p-3 shadow-2xl ${darkMode ? "border-white/10 bg-[#1c1f26] text-white" : "border-black/10 bg-white text-black"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${muted}`}>Group avatar</p>
                  <p className="text-sm font-black">Choose avatar</p>
                </div>
                <button type="button" onClick={() => setAvatarPickerOpen(false)} className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close avatar picker">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-3">
                <label className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border p-2 text-sm font-bold transition active:scale-[0.98] ${darkMode ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onClick={(event) => { event.target.value = null; }}
                    onChange={async (event) => {
                      const file = event.target.files[0];
                      if (!file) return;
                      setAvatarPickerOpen(false);
                      const formData = new FormData();
                      formData.append("avatar", file);
                      const endpoint = group.id === GROUP_ID ? "/forum/group/avatar" : `/forum/conversations/${encodeURIComponent(group.id)}/avatar`;
                      try {
                        setPendingAction("avatar");
                        const data = await apiFormWithProgress(endpoint, formData);
                        if (data.error) throw new Error(data.error);
                      } catch (error) {
                        toast.error(error.message || "Could not upload avatar");
                      } finally {
                        setPendingAction("");
                      }
                    }}
                  />
                  <Upload className="h-4 w-4" />
                  Upload Custom Image
                </label>
              </div>
              <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto p-2 -m-2">
                {GROUP_AVATAR_PRESETS.map((preset) => {
                  const selected = (group?.avatarPreset || "ocean") === preset.id;
                  const Icon = preset.Icon || MessagesSquare;
                  return (
                    <button key={preset.id} type="button" disabled={Boolean(pendingAction)} onClick={() => { void saveGroup({ avatarPreset: preset.id }, "avatar"); setAvatarPickerOpen(false); }} className={`grid h-12 w-12 place-items-center rounded-full outline-none focus:outline-none transition active:scale-[0.96] disabled:cursor-wait disabled:opacity-60 ${selected ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-white dark:ring-offset-[#1c1f26]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label={`Choose ${preset.id} avatar`}>
                      <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: preset.gradient }}>
                        <Icon className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {canManage && editingName ? (
            <div className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 ${darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-white"}`}>
              <input value={groupNameDraft} autoFocus onChange={(event) => setGroupNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { void saveGroup({ name: groupNameDraft }, "name").then(() => setEditingName(false)); } }} className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold outline-none" />
              <button type="button" disabled={Boolean(pendingAction) || !groupNameDraft.trim()} onClick={() => { void saveGroup({ name: groupNameDraft }, "name").then(() => setEditingName(false)); }} className="grid h-7 w-7 place-items-center rounded-full bg-[#2563eb] text-white disabled:opacity-35" aria-label="Save group name">
                {pendingAction === "name" ? <TinySpinner /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => { setGroupNameDraft(group?.name || "Group Forum"); setEditingName(false); }} className={`grid h-7 w-7 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label="Cancel group name edit">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <h2 className="min-w-0 truncate text-center text-lg font-bold">{group?.name || "Group Forum"}</h2>
              {canManage && (
                <button type="button" onClick={() => { setGroupNameDraft(group?.name || "Group Forum"); setEditingName(true); }} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label="Edit group name">
                  <Pencil className={`h-4 w-4 ${muted}`} />
                </button>
              )}
            </>
          )}
        </div>
        <p className="mt-1 text-center text-xs font-semibold text-[#22c55e]">{groupParticipants.length} members · {onlineUserIds.length} online</p>

        {canManage && (
          <PanelSection title="Group settings" muted={muted}>
            <div className="space-y-3">
              <button type="button" disabled={Boolean(pendingAction)} onClick={() => saveGroup({ adminOnlyMessages: !group?.adminOnlyMessages }, "adminOnlyMessages")} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-wait disabled:opacity-75 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f7fb]"}`}>
                <span>Only admins can message</span>
                <span className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${group?.adminOnlyMessages ? "bg-[#2563eb]" : darkMode ? "bg-white/15" : "bg-black/10"}`}>
                  <span className={`absolute top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm transition-all duration-300 ${group?.adminOnlyMessages ? "left-6" : "left-1"}`}>
                    {pendingAction === "adminOnlyMessages" && <TinySpinner className="h-3 w-3 text-[#2563eb]" />}
                  </span>
                </span>
              </button>
              <div className={`rounded-2xl p-3 ${darkMode ? "bg-white/[0.04]" : "bg-[#f4f7fb]"}`}>
                <span className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] ${muted}`}>Add member</span>
                <div className="flex gap-2">
                  <div ref={memberPickerRef} className="relative min-w-0 flex-1">
                    <button type="button" onClick={() => setMemberPickerOpen((open) => !open)} className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-semibold outline-none ${darkMode ? "border-white/10 bg-[#15171c] text-white" : "border-black/10 bg-white text-black"}`}>
                      <span className={memberToAdd ? "truncate" : `truncate ${muted}`}>{availableUsers.find((user) => user.id === memberToAdd)?.displayName || "Choose user"}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition ${memberPickerOpen ? "rotate-180" : ""} ${muted}`} />
                    </button>
                    {memberPickerOpen && (
                      <div className={`absolute left-0 top-[calc(100%+8px)] z-30 max-h-64 w-full overflow-y-auto rounded-2xl border p-1.5 shadow-2xl ${darkMode ? "border-white/10 bg-[#1c1f26]" : "border-black/10 bg-white"}`}>
                        {availableUsers.map((user) => (
                          <button key={user.id} type="button" onClick={() => { setMemberToAdd(user.id); setMemberPickerOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold ${memberToAdd === user.id ? "bg-[#2563eb] text-white" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}>
                            <UserAvatar user={user} name={user.displayName} className="h-6 w-6" />
                            <span className="min-w-0 flex-1 truncate">{user.displayName || user.username}</span>
                          </button>
                        ))}
                        {!availableUsers.length && <p className={`px-3 py-3 text-xs ${muted}`}>All users are already added.</p>}
                      </div>
                    )}
                  </div>
                  <button type="button" disabled={Boolean(pendingAction) || !memberToAdd} onClick={() => { const addingUserId = memberToAdd; void saveGroup({ participantIds: participantListWith(addingUserId, true) }, `add:${addingUserId}`).then(() => setMemberToAdd("")); }} className="inline-flex min-w-14 items-center justify-center gap-1.5 rounded-xl bg-[#2563eb] px-3 text-xs font-bold text-white transition disabled:cursor-wait disabled:opacity-35">
                    {pendingAction.startsWith("add:") ? <TinySpinner /> : null}
                    Add
                  </button>
                </div>
              </div>
            </div>
          </PanelSection>
        )}

        <PanelSection
          title="Members"
          action={groupParticipants.length > 4 ? (showAllMembers ? "Show less" : "View all") : null}
          muted={muted}
          onAction={() => setShowAllMembers((current) => !current)}
        >
          <div className="space-y-2">
            {visibleMembers.map((member) => (
              <button key={member.id} type="button" disabled={pendingAction === `member:${member.id}` || pendingAction === `remove:${member.id}`} onClick={() => onSelectUser(member)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition disabled:cursor-wait disabled:opacity-75 ${darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                <span className="relative shrink-0">
                  <UserAvatar user={member} name={member.displayName} className="h-8 w-8" />
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${darkMode ? "border-[#15171c]" : "border-white"} ${online.has(member.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{member.displayName}</span>
                    {adminIds.has(String(member.id)) && <span className="shrink-0 rounded-full bg-[#dbeafe] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#2563eb]">Admin</span>}
                  </span>
                  <span className={`block truncate text-[10px] ${muted}`}>{member.designation || member.department || member.username}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {canManage && !member.isSuperAdmin && String(member.id) !== String(currentUser?.id || "") && (
                    <>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) }, `member:${member.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ adminIds: adminListWith(member.id, !adminIds.has(String(member.id))) }, `member:${member.id}`);
                          }
                        }}
                        className={`inline-flex min-w-[58px] items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${darkMode ? "bg-white/10 text-white/70" : "bg-white text-[#2563eb]"}`}
                      >
                        {pendingAction === `member:${member.id}` && <TinySpinner className="h-3 w-3" />}
                        {adminIds.has(String(member.id)) ? "Demote" : "Promote"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) }, `remove:${member.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            void saveGroup({ participantIds: participantListWith(member.id, false), adminIds: adminListWith(member.id, false) }, `remove:${member.id}`);
                          }
                        }}
                        className="inline-flex min-w-[54px] items-center justify-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                      >
                        {pendingAction === `remove:${member.id}` && <TinySpinner className="h-3 w-3" />}
                        Remove
                      </span>
                    </>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDirect(member);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onDirect(member);
                      }
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                    aria-label={`Message ${member.displayName}`}
                  >
                    <MessageCircleMore className={`h-4 w-4 ${muted}`} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </PanelSection>
      </div>
      </div>
    </aside>
  );
}

function PanelSection({ title, action, muted, children, onAction }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold">{title}</h3>
        {action && (
          <button type="button" onClick={onAction} className="shrink-0 text-[10px] font-semibold text-[#2563eb]">
            {action}
          </button>
        )}
      </div>
      <div className={muted ? "" : ""}>{children}</div>
    </section>
  );
}

export default function Forum({ darkMode, onMobileChatOpenChange, forceMobileView = false, embedded = false, widgetControls = null }) {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [selectedId, setSelectedId] = useState(GROUP_ID);
  const [messages, setMessages] = useState([]);
  const selectedIdRef = useRef(GROUP_ID);
  const messagesCacheRef = useRef({});
  const messagesLoadSeqRef = useRef(0);
  const [composer, setComposer] = useState("");
  const [search, setSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [starredOnlyOpen, setStarredOnlyOpen] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState("emoji");
  const [giphySearch, setGiphySearch] = useState("");
  const mediaPickerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (mediaPickerOpen && mediaPickerRef.current && !mediaPickerRef.current.contains(event.target)) {
        setMediaPickerOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [mediaPickerOpen]);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [unreadByConversation, setUnreadByConversation] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const [sidebarUser, setSidebarUser] = useState(null);
  const [mobileProfileUser, setMobileProfileUser] = useState(null);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("smileys");
  const [messageInfoTarget, setMessageInfoTarget] = useState(null);
  const [copyFeedbackId, setCopyFeedbackId] = useState("");
  const [reactionsPopoverTarget, setReactionsPopoverTarget] = useState(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState(null);
  const [deleteSelectionTarget, setDeleteSelectionTarget] = useState(null);
  const [pinMessageTarget, setPinMessageTarget] = useState(null);
  const [pinDurationHours, setPinDurationHours] = useState(24 * 7);
  const [pinSaving, setPinSaving] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [selectionDeleting, setSelectionDeleting] = useState(false);
  const [forwardMessageIds, setForwardMessageIds] = useState([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardTargetIds, setForwardTargetIds] = useState([]);
  const [forwardSending, setForwardSending] = useState(false);
  const [forumSettingsOpen, setForumSettingsOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupStep, setCreateGroupStep] = useState(1);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupAvatar, setCreateGroupAvatar] = useState("ocean");
  const [createGroupAvatarFile, setCreateGroupAvatarFile] = useState(null);
  const [createGroupMemberIds, setCreateGroupMemberIds] = useState([]);
  const [createGroupSearch, setCreateGroupSearch] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [forumDriveFolderUrl, setForumDriveFolderUrl] = useState("");
  const [forumDriveConnectedUrl, setForumDriveConnectedUrl] = useState("");
  const [savingForumSettings, setSavingForumSettings] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [imageDraft, setImageDraft] = useState(null);
  const [imageCaption, setImageCaption] = useState("");
  const [refiningMessage, setRefiningMessage] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editingMessageTarget, setEditingMessageTarget] = useState(null);
  const [replyToMessageTarget, setReplyToMessageTarget] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeScreenShareUserId, setActiveScreenShareUserId] = useState(null);
  const [activeScreenShareId, setActiveScreenShareId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const activeScreenShareIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    if (localVideoRef.current && !localStream) localVideoRef.current.srcObject = null;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      const playPromise = remoteVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setAutoplayBlocked(true);
        });
      }
    }
    if (remoteVideoRef.current && !remoteStream) remoteVideoRef.current.srcObject = null;
  }, [remoteStream]);
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef(new Map());
  const chatMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const optimisticMessageCounterRef = useRef(0);
  const composerRef = useRef(null);
  const documentInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const mainChatRef = useRef(null);
  const messagesPaneRef = useRef(null);
  const scrollAnimationRef = useRef(null);
  const swipeRef = useRef({ active: false, messageId: null, message: null, startX: 0, startY: 0, currentX: 0, locked: false });
  const typingClearTimersRef = useRef({});
  const [swipeOffset, setSwipeOffset] = useState({ id: null, x: 0 });

  const surface = darkMode ? "bg-[#15171c]" : "bg-white";
  const subSurface = darkMode ? "bg-[#101116]" : "bg-[#f7f8fb]";
  const divider = darkMode ? "border-white/[0.06]" : "border-[#eef1f5]";
  const muted = darkMode ? "text-white/45" : "text-black/45";
  const softText = darkMode ? "text-white/72" : "text-black/68";
  const effectiveMobileViewport = forceMobileView || isMobileViewport;

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth < 1024);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);


  useEffect(() => {
    onMobileChatOpenChange?.(effectiveMobileViewport && !mobileListOpen);
    return () => onMobileChatOpenChange?.(false);
  }, [effectiveMobileViewport, mobileListOpen, onMobileChatOpenChange]);

  useEffect(() => {
    return () => {
      if (imageDraft?.previewUrl) URL.revokeObjectURL(imageDraft.previewUrl);
    };
  }, [imageDraft?.previewUrl]);
  const selectedConversation = selectedId ? conversations.find((item) => item.id === selectedId) || null : null;
  const selectedIsGroup = selectedConversation?.type === "group";
  const online = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const currentUser = getStoredAuth().user;

  const scrollMessagesToBottom = useCallback((behavior = "auto") => {
    if (scrollAnimationRef.current) {
      window.cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    window.requestAnimationFrame(() => {
      const pane = messagesPaneRef.current;
      if (!pane) return;
      const target = pane.scrollHeight - pane.clientHeight;
      if (behavior !== "gentle") {
        pane.scrollTop = target;
        return;
      }
      const start = pane.scrollTop;
      const distance = target - start;
      if (Math.abs(distance) < 2) {
        pane.scrollTop = target;
        return;
      }
      const duration = Math.min(620, Math.max(320, Math.abs(distance) * 0.45));
      const startedAt = performance.now();
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        pane.scrollTop = start + distance * easeOutCubic(progress);
        if (progress < 1) scrollAnimationRef.current = window.requestAnimationFrame(step);
        else scrollAnimationRef.current = null;
      };
      scrollAnimationRef.current = window.requestAnimationFrame(step);
    });
  }, []);

  const clearMessageAnimation = useCallback((messageId) => {
    window.setTimeout(() => {
      setMessages((current) => current.map((message) => (
        message.id === messageId ? { ...message, animate: false } : message
      )));
    }, 220);
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) messagesCacheRef.current[selectedId] = messages;
  }, [messages, selectedId]);

  const resetScreenSharePeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
  }, []);

  const stopScreenShare = useCallback(() => {
    const shareId = activeScreenShareIdRef.current;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    resetScreenSharePeers();
    setRemoteStream(null);
    setActiveScreenShareUserId(null);
    setActiveScreenShareId(null);
    activeScreenShareIdRef.current = null;

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN && selectedId) {
      socket.send(JSON.stringify({
        type: "forum:screenShareStop",
        conversationId: selectedId,
        shareId,
        recipientIds: selectedConversation?.type === "direct" ? selectedConversation.participantIds : undefined,
      }));
    }
  }, [resetScreenSharePeers, selectedId, selectedConversation]);

  useEffect(() => {
    return () => stopScreenShare();
  }, [selectedId, stopScreenShare]);

  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) window.cancelAnimationFrame(scrollAnimationRef.current);
      Object.values(typingClearTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      scrollAnimationRef.current = null;
      typingClearTimersRef.current = {};
    };
  }, []);

  const startScreenShare = async () => {
    try {
      const shareId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      activeScreenShareIdRef.current = shareId;
      setActiveScreenShareId(shareId);
      resetScreenSharePeers();
      setRemoteStream(null);
      setAutoplayBlocked(false);

      let stream;
      if (!navigator.mediaDevices.getDisplayMedia) {
        toast.error("Screen sharing is not supported by this mobile browser.");
        return;
      }
      
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: SCREEN_SHARE_VIDEO_CONSTRAINTS,
          audio: true,
        });
      } catch (err) {
        if (err.name === 'NotAllowedError') return; // User cancelled
        console.error("Screen share error", err);
        toast.error("Failed to start screen sharing.");
        return;
      }
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveScreenShareUserId(currentUser?.id);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN && selectedId) {
        socket.send(JSON.stringify({
          type: "forum:screenShareStart",
          conversationId: selectedId,
          shareId,
          recipientIds: selectedConversation?.type === "direct" ? selectedConversation.participantIds : undefined,
        }));
      }
    } catch (err) {
      console.error("Error sharing screen", err);
      toast.error("Could not start sharing");
    }
  };

  const createPeerConnection = useCallback((targetUserId, { fresh = false, shareId = activeScreenShareIdRef.current } = {}) => {
    const existing = peerConnectionsRef.current.get(targetUserId);
    if (fresh && existing) {
      existing.close();
      peerConnectionsRef.current.delete(targetUserId);
    } else if (existing && existing.connectionState !== "closed") {
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: screenShareIceServers(),
      bundlePolicy: "max-bundle",
    });
    pc.shareId = shareId;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (pc.shareId && activeScreenShareIdRef.current && pc.shareId !== activeScreenShareIdRef.current) return;
        const sendCandidate = () => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: "forum:screenShareCandidate",
              conversationId: selectedId,
              targetUserId,
              shareId: pc.shareId,
              candidate: event.candidate
            }));
          } else if (socketRef.current) {
            setTimeout(sendCandidate, 200);
          }
        };
        sendCandidate();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE State (${targetUserId}):`, pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        toast.error("Screen share connection failed. Add a TURN server or check AWS/Nginx websocket proxying.");
        pc.restartIce?.();
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(pc.connectionState)) {
        console.warn(`Screen share peer ${targetUserId} ${pc.connectionState}`);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams.length > 0) {
        setRemoteStream(new MediaStream(event.streams[0].getTracks()));
      } else {
        setRemoteStream(prev => {
          const stream = prev ? new MediaStream(prev.getTracks()) : new MediaStream();
          stream.addTrack(event.track);
          return stream;
        });
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current);
        if (track.kind === "video") void capScreenShareSender(sender);
      });
    } else {
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
    }

    peerConnectionsRef.current.set(targetUserId, pc);
    return pc;
  }, [selectedId]);

  useEffect(() => {
    if (selectedConversation?.activeScreenShareUserId && selectedConversation.activeScreenShareUserId !== currentUser?.id) {
      const sharerId = selectedConversation.activeScreenShareUserId;
      const shareId = selectedConversation.activeScreenShareId || `${selectedId}-${sharerId}`;
      activeScreenShareIdRef.current = shareId;
      window.setTimeout(() => setActiveScreenShareId(shareId), 0);
      window.setTimeout(() => setActiveScreenShareUserId(sharerId), 0);
      if (!peerConnectionsRef.current.has(sharerId)) {
        const pc = createPeerConnection(sharerId, { shareId });
        pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
          const sendOffer = () => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: "forum:screenShareOffer",
                conversationId: selectedId,
                targetUserId: sharerId,
                shareId,
                offer: pc.localDescription
              }));
            } else if (socketRef.current) {
              setTimeout(sendOffer, 200);
            }
          };
          sendOffer();
        }).catch(console.error);
      }
    } else if (!selectedConversation?.activeScreenShareUserId && !localStreamRef.current) {
       window.setTimeout(() => {
         setActiveScreenShareUserId(null);
         setActiveScreenShareId(null);
         setRemoteStream(null);
       }, 0);
    }
  }, [selectedConversation?.activeScreenShareId, selectedConversation?.activeScreenShareUserId, selectedId, currentUser?.id, createPeerConnection]);

  const searchedUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((user) => user.id && [user.displayName, user.username, user.department, user.designation].join(" ").toLowerCase().includes(term))
      .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || (a.displayName || "").localeCompare(b.displayName || ""));
  }, [online, search, users]);

  const filteredDirectConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((item) => item.type === "direct")
      .filter((item) => !term || [item.name, item.lastMessage?.text].join(" ").toLowerCase().includes(term));
  }, [conversations, search]);

  const forwardTargets = useMemo(() => {
    const term = forwardSearch.trim().toLowerCase();
    const items = [];
    for (const group of conversations.filter((item) => item.type === "group")) {
      items.push({ key: `group:${group.id}`, type: "group", id: group.id, title: group.name || "Group Forum", subtitle: group.id === GROUP_ID ? "Workspace group" : "Group chat", avatarUser: null, group });
    }
    for (const conversation of conversations.filter((item) => item.type === "direct")) {
      const other = conversation.participants?.find((user) => String(user.id) !== String(currentUser?.id));
      items.push({
        key: `conversation:${conversation.id}`,
        type: "conversation",
        id: conversation.id,
        title: conversation.name || other?.displayName || "Direct message",
        subtitle: other?.designation || other?.department || "Recent chat",
        avatarUser: other,
      });
    }
    for (const user of users) {
      if (!user.id || String(user.id) === String(currentUser?.id)) continue;
      if (items.some((item) => item.avatarUser?.id === user.id)) continue;
      items.push({
        key: `user:${user.id}`,
        type: "user",
        id: user.id,
        title: user.displayName || user.username || "User",
        subtitle: [user.designation, user.department].filter(Boolean).join(" • ") || user.email || "User",
        avatarUser: user,
      });
    }
    return items.filter((item) => !term || [item.title, item.subtitle].join(" ").toLowerCase().includes(term));
  }, [conversations, currentUser?.id, forwardSearch, users]);

  const groupConversation = conversations.find((item) => item.id === GROUP_ID);
  const groupConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((item) => item.type === "group")
      .filter((item) => !term || [item.name, item.lastMessage?.text].join(" ").toLowerCase().includes(term));
  }, [conversations, search]);
  const selectedOtherUser = selectedConversation?.type === "direct"
    ? selectedConversation.participants?.find((user) => user.id !== getStoredAuth().user?.id)
    : null;
  const groupAdminIds = useMemo(() => new Set((selectedConversation?.type === "group" ? selectedConversation.adminIds || [] : []).map(String)), [selectedConversation?.adminIds, selectedConversation?.type]);
  const currentUserIsGroupAdmin = Boolean(currentUser?.isSuperAdmin || groupAdminIds.has(String(currentUser?.id || "")));
  const canSendSelectedConversation = Boolean(selectedConversation && (selectedConversation.type !== "group" || !selectedConversation.adminOnlyMessages || currentUserIsGroupAdmin));
  const messageMatches = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    if (!term) return [];
    return messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => String(message.text || "").toLowerCase().includes(term));
  }, [messageSearch, messages]);
  const visibleMessages = useMemo(() => (
    starredOnlyOpen ? messages.filter((message) => message.isStarred) : messages
  ), [messages, starredOnlyOpen]);
  const groupParticipants = useMemo(() => {
    const byId = new Map();
    for (const user of selectedConversation?.type === "group" ? selectedConversation.participants || [] : []) byId.set(user.id, user);
    return [...byId.values()].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || (a.displayName || "").localeCompare(b.displayName || ""));
  }, [online, selectedConversation?.participants, selectedConversation?.type]);
  const mentionQuery = useMemo(() => {
    if (!selectedIsGroup) return null;
    const match = composer.match(/(^|\s)@([a-zA-Z0-9_.-]*)$/);
    return match ? match[2].toLowerCase() : null;
  }, [composer, selectedIsGroup]);
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    return groupParticipants
      .filter((user) => user.id !== currentUser?.id)
      .filter((user) => {
        const searchable = [user.displayName, user.username, mentionHandleForUser(user)].join(" ").toLowerCase();
        return !mentionQuery || searchable.includes(mentionQuery);
      })
      .slice(0, 8);
  }, [currentUser?.id, groupParticipants, mentionQuery]);
  const createGroupUsers = useMemo(() => {
    const term = createGroupSearch.trim().toLowerCase();
    return users
      .filter((user) => user.id && String(user.id) !== String(currentUser?.id))
      .filter((user) => !term || [user.displayName, user.username, user.department, user.designation, user.email].join(" ").toLowerCase().includes(term))
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [createGroupSearch, currentUser?.id, users]);

  const loadBootstrap = useCallback(async () => {
    const data = await api("/forum/bootstrap");
    const list = data.conversations || [];
    setConversations(list);
    setSelectedId((current) => list.some((item) => item.id === current) ? current : (list[0]?.id || GROUP_ID));
    setUnreadByConversation(() => {
      const next = {};
      for (const conversation of list) {
        if (conversation.unreadCount > 0) {
          next[conversation.id] = {
            count: conversation.unreadCount,
            mentioned: Boolean(conversation.unreadMentioned),
          };
        }
      }
      return next;
    });
    setUsers(data.users || []);
    setOnlineUserIds(data.onlineUserIds || []);
    api("/forum/settings").then((settings) => {
      setForumDriveFolderUrl(settings.driveFolderUrl || "");
      setForumDriveConnectedUrl(settings.driveFolderUrl || "");
    }).catch(() => {});
    return data;
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    const loadSeq = ++messagesLoadSeqRef.current;
    const data = await api(`/forum/conversations/${encodeURIComponent(conversationId)}/messages`);
    const savedMap = getSavedReactionsMap();
    const fetchedMessages = (data.messages || []).map((msg) => ({
      ...msg,
      reactions: savedMap[msg.id] || msg.reactions || [],
    }));
    messagesCacheRef.current[conversationId] = fetchedMessages;
    if (selectedIdRef.current === conversationId && loadSeq === messagesLoadSeqRef.current) {
      setMessages(fetchedMessages);
      scrollMessagesToBottom("gentle");
    }
  }, [scrollMessagesToBottom]);

  const selectConversation = useCallback((conversationId) => {
    selectedIdRef.current = conversationId;
    messagesLoadSeqRef.current += 1;
    setSelectedId(conversationId);
    setMessages(messagesCacheRef.current[conversationId] || []);
    setMobileListOpen(false);
    scrollMessagesToBottom("gentle");
  }, [scrollMessagesToBottom]);

  // Request browser notification permission & mark forum page as active
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    window.__forumPageActive = true;
    return () => { window.__forumPageActive = false; };
  }, []);

  useEffect(() => {
    let stopped = false;
    async function boot() {
      try {
        setLoading(true);
        await loadBootstrap();
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void boot();
    return () => { stopped = true; };
  }, [loadBootstrap]);

  useEffect(() => {
    if (!selectedId || !selectedConversation) return;
    const timer = window.setTimeout(() => {
      void loadMessages(selectedId).catch((error) => toast.error(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages, selectedConversation, selectedId]);

  useEffect(() => {
    setStarredOnlyOpen(false);
  }, [selectedId]);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer = null;
    function connectSocket() {
      const ws = new WebSocket(socketUrl());
      socketRef.current = ws;
      ws.onmessage = (event) => {
      const payload = JSON.parse(event.data || "{}");
      if (payload.type === "forum:presence") setOnlineUserIds(payload.onlineUserIds || []);
      if (payload.type === "forum:conversation" && payload.conversation) {
        setConversations((current) => [payload.conversation, ...current.filter((item) => item.id !== payload.conversation.id)]);
      }
      if (payload.type === "forum:pin" && payload.conversation) {
        setConversations((current) => [payload.conversation, ...current.filter((item) => item.id !== payload.conversation.id)]);
      }
      if (payload.type === "forum:message") {
        const isIncomingMessage = payload.message?.senderId !== currentUser?.id;
        const isSelectedConversation = sameConversation(payload.conversationId, selectedId);
        const isVisibleSelectedConversation = isSelectedConversation && document.visibilityState === "visible";
        if (isIncomingMessage && !isVisibleSelectedConversation) {
          playForumNotificationSound();
        }
        if (typingClearTimersRef.current[payload.conversationId]) {
          window.clearTimeout(typingClearTimersRef.current[payload.conversationId]);
          delete typingClearTimersRef.current[payload.conversationId];
        }
        setConversations((current) => current.map((item) => (
          item.id === payload.conversationId
            ? { ...item, lastMessage: payload.message, updatedAt: payload.message.createdAt }
            : item
        )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
        setTypingByConversation((current) => ({ ...current, [payload.conversationId]: [] }));
        if (isSelectedConversation) {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.message.id)) return current;
            clearMessageAnimation(payload.message.id);
            return [...current, { ...payload.message, animate: true }];
          });
          scrollMessagesToBottom("auto");
        } else if (isIncomingMessage) {
          const mentionNeedle = `@${currentUser?.username || ""}`.toLowerCase();
          const mentioned = mentionNeedle.length > 1 && String(payload.message?.text || "").toLowerCase().includes(mentionNeedle);
          setUnreadByConversation((current) => {
            const previous = current[payload.conversationId] || { count: 0, mentioned: false };
            return {
              ...current,
              [payload.conversationId]: {
                count: previous.count + 1,
                mentioned: previous.mentioned || mentioned,
              },
            };
          });

          // Notify for messages in other conversations
          const senderName = payload.message?.sender?.displayName || payload.message?.sender?.username || "Someone";
          const fullText = String(payload.message?.text || "").trim();
          const previewText = fullText.length > 35 ? `${fullText.slice(0, 35)}…` : fullText;
          showAppToast(`${senderName}: ${previewText}`, {
            type: "notification",
            darkMode,
            detail: mentioned ? "You were mentioned" : "New forum message",
            label: "Message",
            duration: 4500,
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            try {
              const browserNotif = new Notification(senderName, {
                body: previewText || "Sent a message",
                icon: "/favicon.ico",
                tag: `forum-${payload.conversationId}-${payload.message?.id}`,
              });
                browserNotif.onclick = () => {
                  window.focus();
                  selectConversation(payload.conversationId);
                  browserNotif.close();
                };
            } catch {}
          }
        }
      }
      if (payload.type === "forum:reaction") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === payload.messageId ? { ...msg, reactions: payload.reactions || [] } : msg
            )
          );
          setReactionsPopoverTarget((current) => (
            current?.message?.id === payload.messageId
              ? { ...current, width: current.width || Math.min(288, Math.max(240, window.innerWidth - 24)), message: { ...current.message, reactions: payload.reactions || [] } }
              : current
          ));
          saveMessageReaction(payload.messageId, payload.reactions || []);
        }
      }
      if (payload.type === "forum:star") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) => current.map((message) => (
            message.id === payload.messageId ? { ...message, ...payload.message } : message
          )));
          setMessageMenu((current) => (
            current?.message?.id === payload.messageId ? { ...current, message: { ...current.message, ...payload.message } } : current
          ));
        }
      }
      if (payload.type === "forum:read") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) =>
            current.map((msg) => {
              if (msg.senderId === currentUser?.id) {
                return {
                  ...msg,
                  readBy: { ...(msg.readBy || {}), [payload.userId]: payload.readAt },
                  deliveredTo: { ...(msg.deliveredTo || {}), [payload.userId]: payload.readAt },
                };
              }
              return msg;
            })
          );
        }
        setConversations((current) =>
          current.map((c) => {
            if (sameConversation(c.id, payload.conversationId)) {
              if (c.lastMessage && c.lastMessage.senderId === currentUser?.id) {
                return {
                  ...c,
                  lastMessage: {
                    ...c.lastMessage,
                    readBy: { ...(c.lastMessage.readBy || {}), [payload.userId]: payload.readAt },
                    deliveredTo: { ...(c.lastMessage.deliveredTo || {}), [payload.userId]: payload.readAt },
                  }
                };
              }
            }
            return c;
          })
        );
      }
      if (payload.type === "forum:messageDeleted") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) => current.filter((message) => message.id !== payload.messageId));
          setSelectedMessageIds((current) => current.filter((id) => id !== payload.messageId));
        }
        setMessageMenu((current) => current?.message?.id === payload.messageId ? null : current);
        setDeleteMessageTarget((current) => current?.id === payload.messageId ? null : current);
      }
      if (payload.type === "forum:messageEdited") {
        if (sameConversation(payload.conversationId, selectedId)) {
          setMessages((current) => current.map((message) => 
            message.id === payload.messageId 
              ? { ...message, text: payload.text, isEdited: true, updatedAt: payload.updatedAt } 
              : message
          ));
        }
      }
      if (payload.type === "forum:typing") {
        if (typingClearTimersRef.current[payload.conversationId]) {
          window.clearTimeout(typingClearTimersRef.current[payload.conversationId]);
          delete typingClearTimersRef.current[payload.conversationId];
        }
        const applyTyping = () => {
          setTypingByConversation((current) => {
            const list = (current[payload.conversationId] || []).filter((item) => item.id !== payload.user?.id);
            return {
              ...current,
              [payload.conversationId]: payload.typing ? [...list, payload.user] : list,
            };
          });
        };
        if (payload.typing) applyTyping();
        else typingClearTimersRef.current[payload.conversationId] = window.setTimeout(applyTyping, 900);
      }
      if (payload.type === "forum:cleared") {
        setConversations((current) => current.map((item) => (
          item.id === payload.conversationId ? { ...item, lastMessage: null, updatedAt: new Date().toISOString() } : item
        )));
        if (sameConversation(payload.conversationId, selectedId)) setMessages([]);
      }
      if (payload.type === "forum:screenShareStart") {
        const shareId = payload.shareId || `${payload.conversationId}-${payload.userId}-${Date.now()}`;
        setConversations(current => current.map(c => c.id === payload.conversationId ? { ...c, activeScreenShareUserId: payload.userId, activeScreenShareId: shareId } : c));
        if (sameConversation(payload.conversationId, selectedId)) {
          activeScreenShareIdRef.current = shareId;
          resetScreenSharePeers();
          setRemoteStream(null);
          setAutoplayBlocked(false);
          setActiveScreenShareId(shareId);
          setActiveScreenShareUserId(payload.userId);
          if (payload.userId !== currentUser?.id) {
            const pc = createPeerConnection(payload.userId, { fresh: true, shareId });
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
              const sendOffer = () => {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                  socketRef.current.send(JSON.stringify({
                    type: "forum:screenShareOffer",
                    conversationId: payload.conversationId,
                    targetUserId: payload.userId,
                    shareId,
                    offer: pc.localDescription
                  }));
                } else if (socketRef.current) {
                  setTimeout(sendOffer, 200);
                }
              };
              sendOffer();
            }).catch(console.error);
          }
        }
      }
      if (payload.type === "forum:screenShareStop") {
        setConversations(current => current.map(c => c.id === payload.conversationId ? { ...c, activeScreenShareUserId: null, activeScreenShareId: null } : c));
        if (sameConversation(payload.conversationId, selectedId)) {
          resetScreenSharePeers();
          setRemoteStream(null);
          setActiveScreenShareId(null);
          activeScreenShareIdRef.current = null;
          setActiveScreenShareUserId(null);
        }
      }
      if (payload.type === "forum:screenShareOffer" && payload.targetUserId === currentUser?.id) {
        if (sameConversation(payload.conversationId, selectedId)) {
          if (activeScreenShareIdRef.current && payload.shareId && payload.shareId !== activeScreenShareIdRef.current) return;
          const shareId = payload.shareId || activeScreenShareIdRef.current;
          const pc = createPeerConnection(payload.fromUserId, { fresh: true, shareId });
          pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
            .then(() => {
              if (pc.candidateQueue) {
                pc.candidateQueue.forEach(c => pc.addIceCandidate(c).catch(console.error));
                pc.candidateQueue = [];
              }
            })
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => {
              const sendAnswer = () => {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                  socketRef.current.send(JSON.stringify({
                    type: "forum:screenShareAnswer",
                    conversationId: selectedId,
                    targetUserId: payload.fromUserId,
                    shareId,
                    answer: pc.localDescription
                  }));
                } else if (socketRef.current) {
                  setTimeout(sendAnswer, 200);
                }
              };
              sendAnswer();
            }).catch(console.error);
        }
      }
      if (payload.type === "forum:screenShareAnswer" && payload.targetUserId === currentUser?.id) {
        if (activeScreenShareIdRef.current && payload.shareId && payload.shareId !== activeScreenShareIdRef.current) return;
        const pc = peerConnectionsRef.current.get(payload.fromUserId);
        if (pc && (!payload.shareId || !pc.shareId || payload.shareId === pc.shareId)) {
          pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
            .then(() => {
              if (pc.candidateQueue) {
                pc.candidateQueue.forEach(c => pc.addIceCandidate(c).catch(console.error));
                pc.candidateQueue = [];
              }
            })
            .catch(console.error);
        }
      }
      if (payload.type === "forum:screenShareCandidate" && payload.targetUserId === currentUser?.id) {
        if (activeScreenShareIdRef.current && payload.shareId && payload.shareId !== activeScreenShareIdRef.current) return;
        const pc = peerConnectionsRef.current.get(payload.fromUserId);
        if (pc && (!payload.shareId || !pc.shareId || payload.shareId === pc.shareId)) {
          const candidate = new RTCIceCandidate(payload.candidate);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            pc.addIceCandidate(candidate).catch(console.error);
          } else {
            if (!pc.candidateQueue) pc.candidateQueue = [];
            pc.candidateQueue.push(candidate);
          }
        }
      }
      if (payload.type === "forum:deleted") {
        setConversations((current) => current.filter((item) => item.id !== payload.conversationId));
        if (sameConversation(payload.conversationId, selectedId)) {
          selectConversation(GROUP_ID);
        }
      }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (stopped) return;
        reconnectTimer = window.setTimeout(connectSocket, 2500);
      };
    }
    connectSocket();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [clearMessageAnimation, createPeerConnection, currentUser?.id, currentUser?.username, darkMode, resetScreenSharePeers, scrollMessagesToBottom, selectConversation, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnreadByConversation((current) => {
        if (!current[selectedId]) return current;
        const next = { ...current };
        delete next[selectedId];
        return next;
      });
      if (selectedId) {
        api(`/forum/conversations/${encodeURIComponent(selectedId)}/read`, { method: "POST" }).catch(() => {});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, messages.length]);

  useEffect(() => {
    setSelectedMessageIds([]);
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveMatchIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [messageSearch, selectedId]);

  useEffect(() => {
    const match = messageMatches[activeMatchIndex];
    if (!match) return;
    const node = messageRefs.current.get(match.message.id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, messageMatches]);

  useEffect(() => {
    if (!chatMenuOpen) return;
    function closeOnOutside(event) {
      if (chatMenuRef.current?.contains(event.target)) return;
      setChatMenuOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [chatMenuOpen]);

  useEffect(() => {
    if (!messageMenu) return undefined;
    function closeMessageMenu(event) {
      if (messageMenuRef.current?.contains(event.target)) return;
      setMessageMenu(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setMessageMenu(null);
    }
    window.addEventListener("mousedown", closeMessageMenu);
    window.addEventListener("resize", closeMessageMenu);
    window.addEventListener("scroll", closeMessageMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMessageMenu);
      window.removeEventListener("resize", closeMessageMenu);
      window.removeEventListener("scroll", closeMessageMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [messageMenu]);

  async function startDirect(user) {
    try {
      const data = await api("/forum/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      selectConversation(data.conversation.id);
      setSidebarUser(null);
    } catch (error) {
      toast.error(error.message);
    }
  }

  function scrollToMessage(messageId) {
    const node = messageRefs.current.get(messageId);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }

  async function sendMessage(event) {
    event?.preventDefault?.();
    const giphy = event?.giphy;
    const text = composer.trim();
    if (!text && !giphy) return;
    if (!canSendSelectedConversation) {
      toast.error("Only group admins can message right now");
      return;
    }

    if (editingMessageTarget) {
      const targetId = editingMessageTarget.id;
      setComposer("");
      setEditingMessageTarget(null);
      window.setTimeout(() => composerRef.current?.focus(), 0);
      try {
        setMessages((current) => current.map((m) => m.id === targetId ? { ...m, text, isEdited: true } : m));
        const data = await api(`/forum/conversations/${encodeURIComponent(selectedId)}/messages/${encodeURIComponent(targetId)}`, {
          method: "PUT",
          body: JSON.stringify({ text }),
        });
        if (!data.success) throw new Error("Could not edit message");
      } catch (error) {
        setMessages((current) => current.map((m) => m.id === targetId ? { ...m, text: editingMessageTarget.text, isEdited: editingMessageTarget.isEdited } : m));
        toast.error(error.message);
      }
      return;
    }

    const currentReply = replyToMessageTarget
      ? {
          id: replyToMessageTarget.id,
          senderName: String(replyToMessageTarget.senderId) === String(currentUser?.id) ? "You" : replyToMessageTarget.sender?.displayName || replyToMessageTarget.sender?.username || "User",
          text: replyToMessageTarget.text,
        }
      : null;

    setComposer("");
    setReplyToMessageTarget(null);
    window.setTimeout(() => composerRef.current?.focus(), 0);
    emitTyping(false);
    optimisticMessageCounterRef.current += 1;
    const tempMessage = {
      id: `temp-${optimisticMessageCounterRef.current}`,
      clientKey: `client-${optimisticMessageCounterRef.current}`,
      conversationId: selectedId,
      type: selectedConversation?.type || "group",
      senderId: currentUser?.id,
      sender: currentUser,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
      animate: true,
      replyToMessage: currentReply,
    };
    
    // Check if the event has a giphy object (passed from media picker)
    if (giphy?.url) {
      tempMessage.attachment = {
        kind: giphy.type === "sticker" ? "sticker" : "gif",
        openUrl: giphy.url,
        name: giphy.type === "sticker" ? "Sticker" : "GIF",
      };
      if (!tempMessage.text) tempMessage.text = giphy.type === "sticker" ? "Sticker" : "GIF";
    }

    setMessages((current) => [...current, tempMessage]);
    setConversations((current) => current.map((item) => (
      item.id === selectedId
        ? { ...item, lastMessage: tempMessage, updatedAt: tempMessage.createdAt }
        : item
    )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    scrollMessagesToBottom("auto");
    try {
      const data = await api(`/forum/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ text, replyToMessage: currentReply, giphy }),
      });
      if (data.message) {
        setConversations((current) => current.map((item) => (
          item.id === selectedId
            ? { ...item, lastMessage: data.message, updatedAt: data.message.createdAt }
            : item
        )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
        setMessages((current) => [
          ...current.filter((message) => message.id !== tempMessage.id && message.id !== data.message.id),
          { ...data.message, clientKey: tempMessage.clientKey, animate: false },
        ]);
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== tempMessage.id));
      setComposer(text);
      window.setTimeout(() => composerRef.current?.focus(), 0);
      toast.error(error.message);
    }
  }

  async function saveForumDriveSettings(event) {
    event?.preventDefault();
    const driveFolderUrl = forumDriveFolderUrl.trim();
    if (!driveFolderUrl) {
      toast.error("Paste the Drive folder link first");
      return;
    }
    try {
      setSavingForumSettings(true);
      const data = await api("/forum/settings", {
        method: "PUT",
        body: JSON.stringify({ driveFolderUrl }),
      });
      setForumDriveFolderUrl(data.driveFolderUrl || driveFolderUrl);
      setForumDriveConnectedUrl(data.driveFolderUrl || driveFolderUrl);
      setForumSettingsOpen(false);
      toast.success("Drive folder connected");
    } catch (error) {
      toast.error(error.message || "Could not connect Drive folder");
    } finally {
      setSavingForumSettings(false);
    }
  }

  async function uploadForumFile(file, { caption = "" } = {}) {
    if (!file) return;
    if (!canSendSelectedConversation) {
      toast.error("Only group admins can message right now");
      return;
    }
    if (!forumDriveConnectedUrl) {
      setForumSettingsOpen(true);
      toast.error("Connect a Drive folder first");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);
    optimisticMessageCounterRef.current += 1;
    const tempId = `temp-file-${optimisticMessageCounterRef.current}`;
    const tempMessage = {
      id: tempId,
      clientKey: `client-file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: selectedId,
      type: selectedConversation?.type || "group",
      senderId: currentUser?.id,
      sender: currentUser,
      text: file.type?.startsWith("image/") ? (caption || "Photo") : file.name,
      createdAt: new Date().toISOString(),
      pending: true,
      animate: true,
      attachment: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size || 0,
        uploading: true,
        progress: 1,
        kind: file.type?.startsWith("image/") ? "image" : "file",
        caption,
        openUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
      },
    };
    setMessages((current) => [...current, tempMessage]);
    scrollMessagesToBottom("auto");
    try {
      const data = await apiFormWithProgress(`/forum/conversations/${encodeURIComponent(selectedId)}/files`, formData, (progress) => {
        setMessages((current) => current.map((message) => (
          message.id === tempId
            ? { ...message, attachment: { ...message.attachment, progress } }
            : message
        )));
      });
      if (data.message) {
        setMessages((current) => [
          ...current.filter((message) => message.id !== tempId && message.id !== data.message.id),
          { ...data.message, clientKey: tempMessage.clientKey, animate: false },
        ]);
        setConversations((current) => current.map((item) => (
          item.id === selectedId
            ? { ...item, lastMessage: data.message, updatedAt: data.message.createdAt }
            : item
        )).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      toast.error(error.message || "Could not upload file");
    } finally {
      if (documentInputRef.current) documentInputRef.current.value = "";
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function handlePhotoSelected(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (imageDraft?.previewUrl) URL.revokeObjectURL(imageDraft.previewUrl);
    setImageDraft({ file, previewUrl: URL.createObjectURL(file) });
    setImageCaption("");
  }

  function handleComposerPaste(event) {
    if (!canSendSelectedConversation) return;
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const imageFile = Array.from(clipboard.files || []).find((file) => file.type?.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      handlePhotoSelected(imageFile);
      return;
    }
    const imageItem = Array.from(clipboard.items || []).find((item) => item.type?.startsWith("image/"));
    const pastedFile = imageItem?.getAsFile?.();
    if (pastedFile) {
      event.preventDefault();
      const extension = pastedFile.type.split("/")[1] || "png";
      const namedFile = new File([pastedFile], pastedFile.name || `pasted-image.${extension}`, { type: pastedFile.type || "image/png" });
      handlePhotoSelected(namedFile);
    }
  }

  async function sendImageDraft(event) {
    event?.preventDefault();
    if (!imageDraft?.file) return;
    const file = imageDraft.file;
    const previewUrl = imageDraft.previewUrl;
    const caption = imageCaption.trim();
    setImageDraft(null);
    setImageCaption("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    await uploadForumFile(file, { caption });
  }

  function emitTyping(isTyping = true) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !selectedId) return;
    socket.send(JSON.stringify({
      type: "forum:typing",
      conversationId: selectedId,
      typing: isTyping,
      recipientIds: selectedConversation?.participantIds || selectedConversation?.participants?.map((user) => user.id) || [],
    }));
  }

  function updateComposer(value) {
    setComposer(value);
    emitTyping(Boolean(value.trim()));
  }

  async function refineComposerMessage() {
    const text = composer.trim();
    if (!text || refiningMessage || !canSendSelectedConversation) return;
    try {
      setRefiningMessage(true);
      composerRef.current?.focus?.({ preventScroll: true });
      const result = await api("/forum/refine-message", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (result.refined) {
        updateComposer(result.refined);
        window.setTimeout(() => composerRef.current?.focus?.({ preventScroll: true }), 0);
      }
    } catch (error) {
      toast.error(error.message || "Could not refine message");
    } finally {
      setRefiningMessage(false);
    }
  }

  function selectMention(user) {
    const handle = mentionHandleForUser(user);
    const next = composer.replace(/(^|\s)@([a-zA-Z0-9_.-]*)$/, `$1@${handle} `);
    updateComposer(next);
    setActiveMentionIndex(0);
    emitTyping(true);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function openMentionProfile(user) {
    if (!user) return;
    if (effectiveMobileViewport) {
      setMobileProfileUser(user);
      return;
    }
    setSidebarUser(user);
  }

  async function startDirectFromProfile(user) {
    await startDirect(user);
    setMobileProfileUser(null);
    setSidebarUser(null);
  }

  function navigateMatch(direction) {
    if (!messageMatches.length) return;
    setActiveMatchIndex((current) => (current + direction + messageMatches.length) % messageMatches.length);
  }

  async function handleEmojiReaction(targetMessage, emoji) {
    if (!targetMessage) return;
    setMessageMenu(null);
    setMessages((currentMessages) =>
      currentMessages.map((msg) => {
        if (msg.id === targetMessage.id) {
          const currentReactions = msg.reactions || [];
          const existingIndex = currentReactions.findIndex((r) => String(r.userId) === String(currentUser?.id));
          let newReactions;
          if (existingIndex > -1) {
            if (currentReactions[existingIndex].emoji === emoji) {
              newReactions = currentReactions.filter((_, i) => i !== existingIndex);
            } else {
              newReactions = currentReactions.map((r, i) =>
                i === existingIndex ? { ...r, emoji, user: currentUser } : r
              );
            }
          } else {
            newReactions = [...currentReactions, { emoji, userId: currentUser?.id, user: currentUser }];
          }
          saveMessageReaction(targetMessage.id, newReactions);
          return { ...msg, reactions: newReactions };
        }
        return msg;
      })
    );

    try {
      const data = await api(`/forum/messages/${encodeURIComponent(targetMessage.id)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      if (data?.reactions) {
        setMessages((currentMessages) =>
          currentMessages.map((msg) =>
            msg.id === targetMessage.id ? { ...msg, reactions: data.reactions } : msg
          )
        );
        saveMessageReaction(targetMessage.id, data.reactions);
      }
    } catch (error) {
      console.error("Reaction save error:", error);
    }
  }

  async function removeMyReaction(targetMessage) {
    if (!targetMessage) return;
    const myEmoji = (targetMessage.reactions || []).find((r) => String(r.userId) === String(currentUser?.id))?.emoji;
    setMessages((currentMessages) =>
      currentMessages.map((msg) => {
        if (msg.id === targetMessage.id) {
          const currentReactions = (msg.reactions || []).filter((r) => String(r.userId) !== String(currentUser?.id));
          saveMessageReaction(targetMessage.id, currentReactions);
          return { ...msg, reactions: currentReactions };
        }
        return msg;
      })
    );

    if (myEmoji) {
      try {
        const data = await api(`/forum/messages/${encodeURIComponent(targetMessage.id)}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji: myEmoji }),
        });
        if (data?.reactions) {
          setMessages((currentMessages) =>
            currentMessages.map((msg) =>
              msg.id === targetMessage.id ? { ...msg, reactions: data.reactions } : msg
            )
          );
          saveMessageReaction(targetMessage.id, data.reactions);
        }
      } catch (error) {
        console.error("Reaction remove error:", error);
      }
    }
  }

  function closeChat() {
    setSelectedId(null);
    setMessages([]);
    setMobileListOpen(true);
    setMessageSearch("");
    setMessageSearchOpen(false);
    setChatMenuOpen(false);
    setSidebarUser(null);
  }

  const touchTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const SWIPE_REPLY_THRESHOLD = 80;

  function handleMessageTouchStart(event, message) {
    const touch = event.touches?.[0];
    if (!touch) return;
    if (selectedMessageIds.length) return;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    swipeRef.current = { active: true, messageId: message.id, message, startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX, locked: false };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      if (!swipeRef.current.locked) {
        if (event.cancelable) event.preventDefault();
        window.getSelection?.().removeAllRanges();
        document.activeElement?.blur?.();
        swipeRef.current.active = false;
        openMessageMenu({ preventDefault: () => {}, clientX: touchStartPosRef.current.x, clientY: touchStartPosRef.current.y }, message);
      }
    }, 450);
  }

  function handleMessageTouchMove(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    const sw = swipeRef.current;
    const dx = touch.clientX - sw.startX;
    const dy = touch.clientY - sw.startY;

    if (!sw.locked && Math.abs(dx) > 10) {
      if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
        sw.locked = true;
        if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
      } else {
        sw.active = false;
        if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
        return;
      }
    }

    if (sw.locked && sw.active) {
      const clampedX = Math.max(0, Math.min(dx, 120));
      sw.currentX = touch.clientX;
      setSwipeOffset({ id: sw.messageId, x: clampedX });
    } else if (touchTimerRef.current) {
      const dist = Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y);
      if (dist > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  }

  function handleMessageTouchEnd() {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    const sw = swipeRef.current;
    if (sw.locked && sw.active) {
      const dx = sw.currentX - sw.startX;
      if (dx >= SWIPE_REPLY_THRESHOLD && sw.message) {
        setReplyToMessageTarget(sw.message);
        if (composerRef.current) composerRef.current.focus();
      }
      setSwipeOffset({ id: null, x: 0 });
    }
    swipeRef.current = { active: false, messageId: null, message: null, startX: 0, startY: 0, currentX: 0, locked: false };
  }

  function openMessageMenu(event, message) {
    event.preventDefault();
    if (selectedMessageIds.length) {
      toggleSelectedMessage(message);
      return;
    }
    const mine = message.senderId === currentUser?.id;
    const mainBounds = mainChatRef.current?.getBoundingClientRect() || {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    };
    const menuWidth = 260;
    const viewport = window.visualViewport;
    const safeTop = Math.max(mainBounds.top, viewport?.offsetTop || 0);
    const safeBottom = Math.min(mainBounds.bottom, (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight));
    const safeLeft = Math.max(mainBounds.left, viewport?.offsetLeft || 0);
    const safeRight = Math.min(mainBounds.right, (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth));
    const isTouchViewport = effectiveMobileViewport || (viewport?.width || window.innerWidth) < 768;
    const menuHeight = isTouchViewport ? Math.min(520, safeBottom - safeTop - 24) : 470;
    const padding = 12;

    const messageNode = messageRefs.current.get(message.id);
    const clickX = event.clientX || 100;
    const clickY = event.clientY || 100;
    const rect = message.attachment?.kind === "image" || String(message.attachment?.mimeType || "").startsWith("image/")
      ? {
          left: clickX,
          right: clickX + 1,
          top: clickY,
          bottom: clickY + 1,
        }
      : messageNode ? messageNode.getBoundingClientRect() : {
      left: event.clientX || 100,
      right: (event.clientX || 100) + 120,
      top: event.clientY || 100,
      bottom: (event.clientY || 100) + 40,
    };

    let x;
    if (isTouchViewport) {
      x = Math.max(safeLeft + padding, Math.min((safeLeft + safeRight - menuWidth) / 2, safeRight - menuWidth - padding));
    } else if (mine) {
      x = Math.max(mainBounds.left + padding, Math.min(rect.right - menuWidth, mainBounds.right - menuWidth - padding));
    } else {
      x = Math.max(mainBounds.left + padding, Math.min(rect.left, mainBounds.right - menuWidth - padding));
    }

    let y;
    if (rect.bottom + 8 + menuHeight <= safeBottom - padding) {
      y = rect.bottom + 8;
    } else if (rect.top - 8 - menuHeight >= safeTop + padding) {
      y = rect.top - menuHeight - 8;
    } else {
      y = Math.max(safeTop + padding, Math.min(rect.bottom + 8, safeBottom - menuHeight - padding));
    }

    setEmojiPickerOpen(false);
    setEmojiSearch("");
    setMessageMenu({ message, x, y, mine, maxActionsHeight: Math.max(180, safeBottom - y - 86), touchViewport: isTouchViewport });
  }

  useEffect(() => {
    if (!messageMenu || !messageMenuRef.current) return;
    const menuNode = messageMenuRef.current;
    const rect = menuNode.getBoundingClientRect();
    const mainBounds = mainChatRef.current?.getBoundingClientRect() || {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    };
    const viewport = window.visualViewport;
    const viewportBottom = Math.min(mainBounds.bottom, (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight));
    const viewportTop = Math.max(mainBounds.top, viewport?.offsetTop || 0);
    const viewportLeft = Math.max(mainBounds.left, viewport?.offsetLeft || 0);
    const viewportRight = Math.min(mainBounds.right, (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth));
    const padding = 12;

    let newX = messageMenu.x;
    let newY = messageMenu.y;

    if (messageMenu.touchViewport) {
      newX = Math.max(viewportLeft + padding, Math.min((viewportLeft + viewportRight - rect.width) / 2, viewportRight - rect.width - padding));
    } else if (rect.right > mainBounds.right - padding) {
      newX = Math.max(mainBounds.left + padding, mainBounds.right - rect.width - padding);
    }
    if (newX < viewportLeft + padding) {
      newX = viewportLeft + padding;
    }
    if (rect.bottom > viewportBottom - padding) {
      newY = Math.max(viewportTop + padding, viewportBottom - rect.height - padding);
    }
    if (newY < viewportTop + padding) {
      newY = viewportTop + padding;
    }
    const maxActionsHeight = Math.max(180, viewportBottom - newY - 86);

    if (Math.abs(newX - messageMenu.x) > 1 || Math.abs(newY - messageMenu.y) > 1 || Math.abs((messageMenu.maxActionsHeight || 0) - maxActionsHeight) > 1) {
      setMessageMenu((prev) => (prev ? { ...prev, x: newX, y: newY, maxActionsHeight } : null));
    }
  }, [messageMenu, emojiPickerOpen]);

  async function copyMessageText(message) {
    const text = String(message?.text || "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedbackId(message.id);
      setMessageMenu(null);
      window.setTimeout(() => setCopyFeedbackId((current) => current === message.id ? "" : current), 1400);
    } catch (error) {
      toast.error("Could not copy message");
    }
  }

  async function toggleMessageStar(message) {
    if (!message?.id || String(message.id).startsWith("temp-")) return;
    setMessageMenu(null);
    try {
      const data = await api(`/forum/messages/${encodeURIComponent(message.id)}/star`, { method: "POST" });
      if (data.message) {
        setMessages((current) => current.map((item) => item.id === data.message.id ? { ...item, ...data.message } : item));
      }
    } catch (error) {
      toast.error(error.message || "Could not update star");
    }
  }

  function toggleSelectedMessage(message) {
    if (!message?.id || String(message.id).startsWith("temp-")) return;
    setSelectedMessageIds((current) => (
      current.includes(message.id)
        ? current.filter((id) => id !== message.id)
        : [...current, message.id]
    ));
  }

  function startMessageSelection(message) {
    setMessageMenu(null);
    setEmojiPickerOpen(false);
    if (!message?.id || String(message.id).startsWith("temp-")) return;
    setSelectedMessageIds([message.id]);
  }

  async function copySelectedMessages() {
    const selected = messages.filter((message) => selectedMessageIds.includes(message.id));
    const text = selected.map((message) => String(message.text || "")).filter(Boolean).join("\n");
    if (!text) {
      toast.error("No text to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${selected.length} message${selected.length === 1 ? "" : "s"} copied`);
      setSelectedMessageIds([]);
    } catch {
      toast.error("Could not copy messages");
    }
  }

  async function deleteSelectedMessages(mode = null) {
    const selected = (deleteSelectionTarget?.messages || messages.filter((message) => selectedMessageIds.includes(message.id))).filter((message) => !String(message.id).startsWith("temp-"));
    if (!selected.length || selectionDeleting) return;
    try {
      setSelectionDeleting(true);
      await Promise.all(selected.map((message) => {
        const finalMode = mode || "me";
        return api(`/forum/conversations/${encodeURIComponent(message.conversationId || selectedId)}/messages/${encodeURIComponent(message.id)}?mode=${finalMode}`, { method: "DELETE" });
      }));
      setMessages((current) => current.filter((message) => !selected.some((item) => item.id === message.id)));
      setSelectedMessageIds([]);
      setDeleteSelectionTarget(null);
      toast.success(`${selected.length} message${selected.length === 1 ? "" : "s"} deleted`);
    } catch (error) {
      toast.error(error.message || "Could not delete selected messages");
    } finally {
      setSelectionDeleting(false);
    }
  }

  async function savePinnedMessage(action = "pin") {
    const target = pinMessageTarget;
    if (pinSaving || (!selectedId && action === "unpin") || (!target && action !== "unpin")) return;
    try {
      setPinSaving(true);
      const data = await api(`/forum/conversations/${encodeURIComponent(selectedId)}/pin`, {
        method: "POST",
        body: JSON.stringify(action === "unpin"
          ? { action: "unpin" }
          : { action: "pin", messageId: target.id, durationHours: pinDurationHours }),
      });
      if (data.conversation) {
        setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      }
      setPinMessageTarget(null);
    } catch (error) {
      toast.error(error.message || "Could not update pin");
    } finally {
      setPinSaving(false);
    }
  }

  function openPinDialog(message) {
    if (!message?.id || String(message.id).startsWith("temp-")) return;
    setMessageMenu(null);
    setEmojiPickerOpen(false);
    setPinDurationHours(24 * 7);
    setPinMessageTarget(message);
  }

  function requestDeleteSelectedMessages() {
    const selected = messages.filter((message) => selectedMessageIds.includes(message.id) && !String(message.id).startsWith("temp-"));
    if (!selected.length) return;
    const allMine = selected.every((message) => String(message.senderId) === String(currentUser?.id));
    if (allMine) {
      setDeleteSelectionTarget({ messages: selected });
      return;
    }
    void deleteSelectedMessages("me");
  }

  function openForwardDialog(messageIds) {
    const ids = [...new Set((Array.isArray(messageIds) ? messageIds : [messageIds]).filter(Boolean))];
    if (!ids.length) return;
    setMessageMenu(null);
    setEmojiPickerOpen(false);
    setForwardMessageIds(ids);
    setForwardTargetIds([]);
    setForwardSearch("");
  }

  function toggleForwardTarget(targetKey) {
    setForwardTargetIds((current) => (
      current.includes(targetKey)
        ? current.filter((id) => id !== targetKey)
        : [...current, targetKey]
    ));
  }

  async function sendForwardedMessages() {
    if (!forwardMessageIds.length || !forwardTargetIds.length || forwardSending) return;
    const targets = forwardTargets
      .filter((target) => forwardTargetIds.includes(target.key))
      .map(({ type, id }) => ({ type, id }));
    try {
      setForwardSending(true);
      await api("/forum/messages/forward", {
        method: "POST",
        body: JSON.stringify({ messageIds: forwardMessageIds, targets }),
      });
      toast.success("Message forwarded");
      setForwardMessageIds([]);
      setForwardTargetIds([]);
      setForwardSearch("");
      setSelectedMessageIds([]);
      void loadBootstrap().catch(() => {});
    } catch (error) {
      toast.error(error.message || "Could not forward message");
    } finally {
      setForwardSending(false);
    }
  }

  async function deleteSingleMessage(mode = "everyone") {
    if (!deleteMessageTarget || deletingMessage) return;
    const finalMode = typeof mode === "string" ? mode : "everyone";
    try {
      setDeletingMessage(true);
      await api(`/forum/conversations/${encodeURIComponent(deleteMessageTarget.conversationId || selectedId)}/messages/${encodeURIComponent(deleteMessageTarget.id)}?mode=${finalMode}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== deleteMessageTarget.id));
      setDeleteMessageTarget(null);
      setMessageMenu(null);
    } catch (error) {
      toast.error(error.message || "Could not delete message");
    } finally {
      setDeletingMessage(false);
    }
  }

  async function clearChat() {
    try {
      await api(`/forum/conversations/${encodeURIComponent(selectedId)}/messages`, { method: "DELETE" });
      setMessages([]);
      setConversations((current) => current.map((item) => item.id === selectedId ? { ...item, lastMessage: null } : item));
      setChatMenuOpen(false);
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deleteChat() {
    if (selectedConversation?.type !== "direct") {
      toast.error("Only direct chats can be deleted");
      return;
    }
    try {
      await api(`/forum/conversations/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      setConversations((current) => current.filter((item) => item.id !== selectedId));
      selectConversation(GROUP_ID);
      setChatMenuOpen(false);
      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function updateGroup(update) {
    try {
      const endpoint = selectedId === GROUP_ID ? "/forum/group" : `/forum/conversations/${encodeURIComponent(selectedId)}/group`;
      const data = await api(endpoint, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  async function createGroup(event) {
    event?.preventDefault();
    const name = createGroupName.trim();
    if (!name) return toast.error("Enter group name");
    if (!createGroupMemberIds.length) return toast.error("Add at least one member");
    try {
      setCreatingGroup(true);
      const data = await api("/forum/conversations/group", {
        method: "POST",
        body: JSON.stringify({ name, avatarPreset: createGroupAvatar, participantIds: createGroupMemberIds }),
      });
      let createdConversation = data.conversation;
      if (createGroupAvatarFile) {
        const formData = new FormData();
        formData.append("avatar", createGroupAvatarFile);
        try {
          const avatarData = await apiFormWithProgress(`/forum/conversations/${encodeURIComponent(createdConversation.id)}/avatar`, formData);
          if (avatarData.conversation) createdConversation = avatarData.conversation;
        } catch (error) {
          toast.error("Group created, but avatar upload failed");
        }
      }
      setConversations((current) => [createdConversation, ...current.filter((item) => item.id !== createdConversation.id)]);
      selectConversation(createdConversation.id);
      setCreateGroupOpen(false);
      setCreateGroupStep(1);
      setCreateGroupName("");
      setCreateGroupAvatar("ocean");
      setCreateGroupAvatarFile(null);
      setCreateGroupMemberIds([]);
      setCreateGroupSearch("");
      toast.success("Group created");
    } catch (error) {
      toast.error(error.message || "Could not create group");
    } finally {
      setCreatingGroup(false);
    }
  }

  // Auto-resize composer textarea height as content changes
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [composer]);

  // Dynamic mobile visualViewport height handling (WhatsApp style)
  useEffect(() => {
    if (!effectiveMobileViewport || mobileListOpen) {
      setMobileViewportHeight(null);
      return;
    }
    const updateViewport = () => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      if (window.visualViewport) {
        setMobileViewportHeight(window.visualViewport.height);
      }
    };
    updateViewport();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateViewport);
      vv.addEventListener("scroll", updateViewport);
    }
    window.addEventListener("scroll", updateViewport);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateViewport);
        vv.removeEventListener("scroll", updateViewport);
      }
      window.removeEventListener("scroll", updateViewport);
    };
  }, [effectiveMobileViewport, mobileListOpen]);

  if (loading) {
    return (
      <div className={`grid ${embedded ? "h-full min-h-0" : "h-[calc(100dvh-24px)] min-h-[560px]"} place-items-center ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f2f4f1] text-black"}`}>
        <MessageCircleMore className="h-8 w-8 animate-pulse text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className={`min-h-0 w-full max-w-full ${embedded ? "h-full" : "flex-1"} overflow-hidden ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f7f8fb] text-black"}`}>
      <div className={`grid h-full min-h-0 w-full max-w-full overflow-hidden ${forceMobileView ? "" : "lg:grid-cols-[320px_minmax(0,1fr)]"} ${surface}`}>
        <aside className={`min-h-0 min-w-0 w-screen max-w-full flex-col overflow-hidden border-x ${forceMobileView ? "" : "lg:w-full lg:flex"} ${darkMode ? "border-white/[0.06]" : "border-[#eef1f5]"} ${mobileListOpen ? "flex" : forceMobileView ? "hidden" : "hidden lg:flex"}`}>
          <div className={`min-w-0 shrink-0 overflow-hidden border-b p-4 ${divider}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#10b981] text-white">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="truncate text-lg font-semibold">Forum</h1>
                <p className={`truncate text-xs ${muted}`}>{onlineUserIds.length} online now</p>
              </div>
              <button
                type="button"
                onClick={() => setForumSettingsOpen(true)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f3f4f6]"}`}
                aria-label="Forum Drive settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            <div className={`mt-4 flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-2xl px-3 ${darkMode ? "bg-white/[0.06]" : "bg-[#f3f4f6]"}`}>
              <Search className={`h-4 w-4 ${muted}`} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats and people" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/30" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Group</p>
              <button type="button" onClick={() => setCreateGroupOpen(true)} className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${darkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#eef4ff] text-[#2563eb] hover:bg-[#e0ecff]"}`}>
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            <div className="min-w-0 space-y-1 overflow-hidden px-2">
              {groupConversations.map((conversation) => {
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                const pinActivity = pinActivityText(conversation.pinnedMessage, currentUser?.id);
                const previewText = pinActivity || conversationPreviewText(conversation.lastMessage, conversation.id === GROUP_ID ? "Workspace group forum" : "Group chat");
                return (
                  <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    {conversation.type === "group" ? (
                      <GroupAvatar group={conversation} className="h-11 w-11" iconClassName="h-5 w-5" />
                    ) : (
                      <UserAvatar user={conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={conversation.name} className="h-11 w-11" />
                    )}
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.pinnedMessage?.pinnedAt || conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 flex max-w-full items-center gap-1 truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`} title={typingUsers.length ? `${typingUsers[0].displayName} typing...` : previewText}>
                        {typingUsers.length ? `${typingUsers[0].displayName} typing...` : (
                          <>
                            {!pinActivity && String(conversation.lastMessage?.senderId || "") === String(currentUser?.id || "") && (
                              getMessageStatus(conversation.lastMessage, conversation, currentUser?.id, onlineUserIds) === "read"
                                ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#3b82f6]" />
                                : getMessageStatus(conversation.lastMessage, conversation, currentUser?.id, onlineUserIds) === "delivered"
                                ? <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                                : <Check className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="min-w-0 truncate">{previewText}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className={`px-4 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Direct messages</p>
            <div className="min-w-0 space-y-1 overflow-hidden px-2 pb-4">
              {filteredDirectConversations.map((conversation) => {
                const other = conversation.participants?.find((user) => user.id !== getStoredAuth().user?.id);
                const active = conversation.id === selectedId;
                const unread = unreadByConversation[conversation.id];
                const typingUsers = typingByConversation[conversation.id] || [];
                const pinActivity = pinActivityText(conversation.pinnedMessage, currentUser?.id);
                const previewText = pinActivity || conversationPreviewText(conversation.lastMessage, "Direct message");
                return (
                  <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left transition ${active ? darkMode ? "bg-white/10" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                    <span className="relative shrink-0">
                      <UserAvatar user={other} name={conversation.name} className="h-10 w-10" />
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${darkMode ? "border-[#15171c]" : "border-white"} ${online.has(other?.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold">{conversation.name}</span>
                        {unread?.count ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread.mentioned ? "@" : unread.count}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[11px] ${muted}`}>{formatListTime(conversation.pinnedMessage?.pinnedAt || conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                        )}
                      </span>
                      <span className={`mt-1 flex max-w-full items-center gap-1 truncate text-xs ${typingUsers.length ? "text-[#2563eb]" : muted}`} title={typingUsers.length ? "typing..." : previewText}>
                        {typingUsers.length ? "typing..." : (
                          <>
                            {!pinActivity && String(conversation.lastMessage?.senderId || "") === String(currentUser?.id || "") && (
                              getMessageStatus(conversation.lastMessage, conversation, currentUser?.id, onlineUserIds) === "read"
                                ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#3b82f6]" />
                                : getMessageStatus(conversation.lastMessage, conversation, currentUser?.id, onlineUserIds) === "delivered"
                                ? <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                                : <Check className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="min-w-0 truncate">{previewText}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!filteredDirectConversations.length && (
                <p className={`px-3 py-3 text-sm ${muted}`}>No direct conversations yet</p>
              )}
              {searchedUsers.length > 0 && (
                <>
                  <p className={`px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>People</p>
                  {searchedUsers.map((user) => (
                    <button key={user.id} type="button" onClick={() => startDirect(user)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}>
                      <UserAvatar user={user} name={user.displayName} className="h-10 w-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                        <span className={`block truncate text-xs ${muted}`}>{user.designation || user.department || user.username}</span>
                      </span>
                      <Plus className={`h-4 w-4 ${muted}`} />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </aside>

        <main
          ref={mainChatRef}
          style={effectiveMobileViewport && !mobileListOpen && mobileViewportHeight ? { height: `${mobileViewportHeight}px` } : undefined}
          className={`min-h-0 min-w-0 w-screen max-w-full overflow-hidden ${forceMobileView ? "" : "lg:w-auto"} ${mobileListOpen ? forceMobileView ? "hidden" : "hidden lg:flex" : "flex"} ${darkMode ? "bg-[#15171c]" : "bg-white"}`}
        >
          {!selectedConversation ? (
            <div className={`flex flex-1 flex-col items-center justify-center p-8 text-center ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-black"}`}>
              <div className={`grid h-16 w-16 place-items-center rounded-full ${darkMode ? "bg-white/5" : "bg-[#f2f4f8]"}`}>
                <MessagesSquare className="h-8 w-8 text-[#2563eb]" />
              </div>
              <h3 className="mt-4 text-lg font-bold">Select a conversation</h3>
              <p className={`mt-1 max-w-sm text-sm ${muted}`}>Choose a chat from the sidebar to start messaging.</p>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                <header className={`sticky top-0 z-20 flex h-16 w-full shrink-0 items-center gap-3 border-b border-t-0 px-4 ${divider} ${surface}`}>
                  <button type="button" onClick={closeChat} className={`h-9 w-9 shrink-0 place-items-center rounded-full ${messageSearchOpen ? "hidden" : "grid lg:hidden"} ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Back to chats">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className={`flex min-w-0 items-center gap-3 overflow-hidden text-left transition-[max-width,opacity,transform] duration-300 ease-out ${messageSearchOpen ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[320px] flex-1 opacity-100 xl:max-w-none"}`}>
                    {selectedConversation?.type === "group" ? (
                      <GroupAvatar group={selectedConversation} className="h-10 w-10" iconClassName="h-5 w-5" />
                    ) : (
                      <UserAvatar user={selectedConversation?.participants?.find((user) => user.id !== getStoredAuth().user?.id)} name={selectedConversation?.name} className="h-10 w-10" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{selectedConversation?.name || "Group Forum"}</span>
                      {selectedConversation?.type === "direct" && selectedOtherUser && (
                        <span className={`block truncate text-[11px] leading-4 lg:hidden ${online.has(selectedOtherUser.id) ? "text-[#22c55e]" : muted}`}>
                          {online.has(selectedOtherUser.id) ? "Online" : "Offline"}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={`flex h-10 items-center gap-2 overflow-hidden rounded-full px-3 transition-[width,background-color] duration-300 ease-out ${messageSearchOpen ? "w-full flex-1" : "hidden"} ${darkMode ? "bg-white/[0.045]" : "bg-[#f7f8fb]"}`}>
                    <button type="button" onClick={() => setMessageSearchOpen(true)} className="flex h-7 shrink-0 items-center gap-2 rounded-full" aria-label="Search messages">
                      <Search className={`h-4 w-4 ${muted}`} />
                      <span className={`hidden text-xs font-semibold transition-opacity duration-200 lg:inline ${messageSearchOpen ? "w-0 opacity-0" : "opacity-100"} ${muted}`}>Search</span>
                    </button>
                    <input
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder="Search messages..."
                      className={`w-full bg-transparent text-xs font-normal outline-none ${softText}`}
                    />
                    {messageMatches.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className={`text-[11px] font-semibold ${muted}`}>{activeMatchIndex + 1}/{messageMatches.length}</span>
                        <button type="button" onClick={() => navigateMatch(-1)} className={`grid h-6 w-6 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => navigateMatch(1)} className={`grid h-6 w-6 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <button type="button" onClick={() => { setMessageSearch(""); setMessageSearchOpen(false); }} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {!messageSearchOpen && (
                    <>
                      {(!activeScreenShareUserId || activeScreenShareUserId === currentUser?.id) ? (
                        <button
                          type="button"
                          onClick={activeScreenShareUserId === currentUser?.id ? stopScreenShare : startScreenShare}
                          className={`hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-full ${activeScreenShareUserId === currentUser?.id ? "bg-red-500 text-white hover:bg-red-600" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}
                          aria-label="Share Screen"
                        >
                          {activeScreenShareUserId === currentUser?.id ? <X className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className={`hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-30 cursor-not-allowed ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}
                          aria-label="Someone is already sharing"
                        >
                          <Monitor className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => setMessageSearchOpen(true)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Search messages">
                        <Search className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <div className="relative shrink-0">
                    <button type="button" onClick={() => setChatMenuOpen((current) => !current)} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="More chat options">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {chatMenuOpen && (
                      <div ref={chatMenuRef} className={`absolute right-0 top-11 z-30 w-44 rounded-2xl border p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${darkMode ? "border-white/10 bg-[#1c1f26] text-white" : "border-black/10 bg-white text-[#111827]"}`}>
                        <button type="button" onClick={() => { setStarredOnlyOpen((current) => !current); setChatMenuOpen(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}>
                          <Star className={`h-3.5 w-3.5 ${starredOnlyOpen ? "fill-amber-400 text-amber-400" : "text-[#2563eb]"}`} />
                          {starredOnlyOpen ? "Show all messages" : "Starred messages"}
                        </button>
                        <button type="button" onClick={clearChat} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}>
                          <Sparkles className="h-3.5 w-3.5 text-[#2563eb]" />
                          Clear messages
                        </button>
                        <button type="button" onClick={deleteChat} disabled={selectedConversation?.type !== "direct"} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-normal text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete chat
                        </button>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={closeChat} className={`h-9 w-9 place-items-center rounded-full ${messageSearchOpen ? "hidden" : "grid"} ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`} aria-label="Close chat">
                    <X className="h-4 w-4" />
                  </button>
                </header>

                {selectedConversation?.pinnedMessage && (
                  <button
                    type="button"
                    onClick={() => scrollToMessage(selectedConversation.pinnedMessage.messageId)}
                    className={`flex h-11 shrink-0 items-center gap-3 border-b px-4 text-left transition ${darkMode ? "border-white/[0.06] bg-[#111318] hover:bg-[#171a20]" : "border-[#e5e7eb] bg-white hover:bg-[#f7f8fb]"}`}
                  >
                    <Pin className={`h-4 w-4 shrink-0 ${darkMode ? "text-white/70" : "text-black/60"}`} />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      <span className="font-bold">Pinned</span>
                      <span className={`ml-2 ${muted}`}>{pinnedPreviewText(selectedConversation.pinnedMessage)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void savePinnedMessage("unpin");
                      }}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
                      aria-label="Unpin message"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                )}

                {(localStream || remoteStream) && (
                  <div id="screen-share-container" className={`relative flex w-full justify-center overflow-hidden border-b shrink-0 ${darkMode ? "bg-black border-white/[0.06]" : "bg-[#f0f2f5] border-[#eef1f5]"} ${isFullscreen ? "h-screen w-screen border-none bg-black flex-col" : "max-h-[40vh]"}`}>
                    <video
                      ref={localStream ? localVideoRef : remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={!!localStream}
                      className={`w-full h-full object-contain ${isFullscreen ? "" : "max-h-[40vh]"}`}
                    />
                    
                    {!localStream && (
                      <div className="absolute right-3 top-3 z-10 flex gap-2">
                        <button 
                          type="button" 
                          onClick={() => {
                            const container = document.getElementById("screen-share-container");
                            if (!document.fullscreenElement && container) {
                              container.requestFullscreen().catch(console.error);
                            } else if (document.fullscreenElement) {
                              document.exitFullscreen().catch(console.error);
                            }
                          }} 
                          className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </button>
                      </div>
                    )}

                    {localStream && (
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2 text-white backdrop-blur-md">
                        <Monitor className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold">You are sharing</span>
                        <button type="button" onClick={stopScreenShare} className="ml-2 rounded-full bg-red-500 px-3 py-1 text-xs font-bold hover:bg-red-600">
                          Stop
                        </button>
                      </div>
                    )}
                    {autoplayBlocked && !localStream && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (remoteVideoRef.current) {
                              remoteVideoRef.current.play().then(() => setAutoplayBlocked(false)).catch(console.error);
                            }
                          }}
                          className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black hover:bg-white/90"
                        >
                          Tap to Play Screen Share
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {imageDraft && (
                  <div className={`flex min-h-0 flex-1 flex-col animate-in fade-in zoom-in-95 duration-150 ${subSurface}`}>
                    <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 ${divider}`}>
                      <button type="button" onClick={() => {
                        if (imageDraft?.previewUrl) URL.revokeObjectURL(imageDraft.previewUrl);
                        setImageDraft(null);
                      }} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close image preview">
                        <X className="h-5 w-5" />
                      </button>
                      <span className="text-sm font-semibold">Photo</span>
                      <span className="h-9 w-9" />
                    </div>
                    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                      <img src={imageDraft.previewUrl} alt="" className="max-h-[min(46vh,420px)] max-w-full rounded-xl object-contain shadow-[0_18px_50px_rgba(15,23,42,0.18)]" />
                    </div>
                    <form onSubmit={sendImageDraft} className={`shrink-0 border-t px-4 py-3 ${divider}`}>
                      <div className="mx-auto flex max-w-3xl items-center gap-3">
                        <input
                          value={imageCaption}
                          onChange={(event) => setImageCaption(event.target.value)}
                          placeholder="Type a message"
                          className={`h-12 min-w-0 flex-1 rounded-2xl px-4 text-sm outline-none ${darkMode ? "bg-[#23262d] text-white placeholder:text-white/30" : "bg-white text-black placeholder:text-black/45"}`}
                        />
                        <button type="submit" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#10b981] text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]">
                          <Send className="h-5 w-5" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {!imageDraft && (
                <>
                <section ref={messagesPaneRef} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 ${subSurface}`}>
                  <div className="mx-auto flex w-full max-w-4xl flex-col">
                    {starredOnlyOpen && !visibleMessages.some((message) => message.isStarred) && (
                      <div className={`my-8 text-center text-sm ${muted}`}>No starred messages</div>
                    )}
                    {visibleMessages.map((message, index) => {
                      if (message.attachmentMissing) return null;
                      const nextMessage = messages[index + 1];
                      const previousMessage = messages[index - 1];
                      const showDate = messageDateKey(message.createdAt) !== messageDateKey(previousMessage?.createdAt);
                      if (message.system) {
                        return (
                          <div key={message.id} className="min-w-0 mt-3 first:mt-0">
                            {showDate && (
                              <div className="sticky top-2 z-10 my-2 flex justify-center">
                                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? "bg-[#1f232b] text-white/70" : "bg-white text-black/45"}`}>
                                  {formatMessageDate(message.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className="my-2 flex justify-center">
                              <span className={`rounded-xl px-3 py-1.5 text-xs ${darkMode ? "bg-[#252830] text-white/70" : "bg-white text-black/60"}`}>
                                {systemMessageText(message, currentUser?.id)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      const mine = message.senderId === getStoredAuth().user?.id;
                      const groupedWithNext = nextMessage?.senderId === message.senderId;
                      const groupedWithPrevious = !showDate && previousMessage?.senderId === message.senderId;
                      const compactWithPrevious = groupedWithPrevious || (!showDate && message.attachment && previousMessage?.attachment);
                      const messageTopMargin = compactWithPrevious ? "mt-1" : message.attachment ? "mt-2" : "mt-3";

                      const isGroupChat = selectedConversation?.type === "group";
                      const showAvatar = isGroupChat && !mine && !groupedWithNext;
                      const showName = isGroupChat && !mine && !groupedWithPrevious;
                      const isContextTarget = messageMenu?.message?.id === message.id || reactionsPopoverTarget?.message?.id === message.id || messageInfoTarget?.id === message.id;
                      const matchPosition = messageMatches.findIndex((match) => match.message.id === message.id);
                      const isActiveMatch = matchPosition === activeMatchIndex && messageSearch.trim();
                      const isSelectionMode = selectedMessageIds.length > 0;
                      const isSelectedMessage = selectedMessageIds.includes(message.id);
                      const isStarred = Boolean(message.isStarred);
                      const previewUrl = message.attachment ? "" : firstUrlFromText(message.text);
                      const displayText = message.attachment ? "" : (previewUrl ? textWithoutUrls(message.text) : message.text);
                      const isGroupedWithNext = groupedWithNext && (nextMessage ? messageDateKey(nextMessage.createdAt) === messageDateKey(message.createdAt) : false);

                      // Smooth 18px rounded speech bubble with soft 4px tail
                      const bubbleRounding = mine ? "rounded-t-[18px] rounded-bl-[18px] rounded-br-[4px]" : "rounded-t-[18px] rounded-br-[18px] rounded-bl-[4px]";
                      const bubbleTone = isActiveMatch
                        ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#bbf7d0] text-[#052e16]"
                        : isStarred ? darkMode ? "bg-[#3a2f13] text-[#fff7d6]" : "bg-[#fff4c7] text-[#14213d]"
                        : mine ? darkMode ? "bg-[#181a20] text-white" : "bg-[#e5f1ff] text-[#14213d]" : darkMode ? "bg-[#252830] text-white" : "bg-white text-[#14213d]";
                      const starMark = isStarred ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null;
                      return (
                        <div key={message.clientKey || message.id} className={`min-w-0 ${messageTopMargin} first:mt-0`}>
                          {showDate && (
                            <div className="sticky top-2 z-10 my-2 flex justify-center">
                              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? "bg-[#1f232b] text-white/70" : "bg-white text-black/45"}`}>
                                {formatMessageDate(message.createdAt)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`relative min-w-0 overflow-hidden transition-colors ${isSelectedMessage ? darkMode ? "bg-[#123c2c]/70" : "bg-[#dff8e8]" : ""}`}
                            onClick={() => {
                              if (isSelectionMode) toggleSelectedMessage(message);
                            }}
                            onTouchStart={(event) => handleMessageTouchStart(event, message)}
                            onTouchMove={handleMessageTouchMove}
                            onTouchEnd={handleMessageTouchEnd}
                            onTouchCancel={handleMessageTouchEnd}
                          >
                          {isSelectionMode && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSelectedMessage(message);
                              }}
                              className={`absolute right-1 top-1/2 z-20 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border text-white shadow-sm ${isSelectedMessage ? "border-emerald-500 bg-emerald-500" : darkMode ? "border-white/20 bg-black/40" : "border-black/10 bg-white"}`}
                              aria-label={isSelectedMessage ? "Deselect message" : "Select message"}
                            >
                              {isSelectedMessage && <Check className="h-4 w-4" />}
                            </button>
                          )}
                          {/* Swipe reply icon */}
                          {swipeOffset.id === message.id && swipeOffset.x > 0 && (
                            <div
                              className="absolute left-0 top-0 bottom-0 flex items-center pl-2 pointer-events-none"
                              style={{ opacity: Math.min(swipeOffset.x / SWIPE_REPLY_THRESHOLD, 1), transform: `scale(${Math.min(swipeOffset.x / SWIPE_REPLY_THRESHOLD, 1)})` }}
                            >
                              <div className={`grid h-8 w-8 place-items-center rounded-full ${swipeOffset.x >= SWIPE_REPLY_THRESHOLD ? "bg-[#2563eb] text-white" : darkMode ? "bg-white/10 text-white/60" : "bg-black/10 text-black/50"}`} style={{ transition: "background-color 150ms, color 150ms" }}>
                                <Reply className="h-4 w-4" />
                              </div>
                            </div>
                          )}
                          <div
                            ref={(node) => {
                              if (node) messageRefs.current.set(message.id, node);
                              else messageRefs.current.delete(message.id);
                            }}
                            onContextMenu={(event) => openMessageMenu(event, message)}
                            style={{
                              userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
                              transform: swipeOffset.id === message.id ? `translateX(${swipeOffset.x}px)` : undefined,
                              transition: swipeOffset.id === message.id ? "none" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                            }}
                            className={`forum-chat-message flex min-w-0 items-end gap-2 sm:gap-3 duration-200 ${mine ? "justify-end" : "justify-start"} ${isContextTarget ? "relative z-[86] scale-[1.01]" : ""}`}
                          >
                          {!mine && isGroupChat && (showAvatar ? (
                            <span className="self-end">
                              <UserAvatar user={message.sender} name={message.sender?.displayName} className="h-7 w-7 sm:h-8 sm:w-8" />
                            </span>
                          ) : <span className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />)}
                          <div className={`${message.animate ? "forum-msg-pop" : ""} flex min-w-0 flex-col ${mine ? "max-w-[85%] items-end sm:max-w-[75%]" : isGroupChat ? "max-w-[calc(100%-36px)] items-start sm:max-w-[86%] xl:max-w-[82%]" : "max-w-[85%] items-start sm:max-w-[75%]"}`}>
                            {showName && (
                              <div className={`mb-1 flex items-center gap-2 text-xs ${muted}`}>
                                {mine || !message.sender ? (
                                  <span>{mine ? "You" : selectedConversation?.name || "User"}</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSidebarUser(message.sender)}
                                    className="font-normal hover:text-[#2563eb] hover:underline hover:underline-offset-2"
                                  >
                                    {message.sender.displayName || "User"}
                                  </button>
                                )}
                              </div>
                            )}
                            {message.attachment && (
                              <div className={`w-full max-w-[420px] min-w-0 ${bubbleRounding} p-1.5 transition-colors ${highlightedMessageId === message.id ? "forum-msg-highlight" : ""} ${isSelectedMessage ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#dff8e8] text-[#052e16]" : isActiveMatch ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#bbf7d0] text-[#052e16]" : bubbleTone}`}>
                                {starMark && <div className="mb-1 flex justify-end px-1">{starMark}</div>}
                                {message.forwardedFrom && (
                                  <div className={`mb-1 px-2 text-[11px] font-normal not-italic ${darkMode ? "text-[#ffffff]" : "text-[#000000]"}`}>
                                    Forwarded from {message.forwardedFrom.senderName || "User"}
                                  </div>
                                )}
                                {message.attachment.kind === "image" || message.attachment.kind === "gif" || message.attachment.kind === "sticker" || String(message.attachment.mimeType || "").startsWith("image/") ? (
                                  <ImageAttachmentCard
                                    attachment={message.attachment}
                                    mine={mine}
                                    darkMode={darkMode}
                                    time={formatTime(message.createdAt)}
                                    status={getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds)}
                                    onOpen={() => {
                                      if (selectedMessageIds.length || messageMenu) return;
                                      setFullscreenImage(message.attachment);
                                    }}
                                    onMissing={() => {
                                      setMessages((current) => current.filter((item) => item.id !== message.id));
                                    }}
                                  />
                                ) : (
                                  <FileAttachmentCard
                                    attachment={message.attachment}
                                    mine={mine}
                                    darkMode={darkMode}
                                    time={formatTime(message.createdAt)}
                                    status={getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds)}
                                    isEdited={message.isEdited}
                                  />
                                )}
                              </div>
                            )}
                            {displayText && previewUrl && (
                              <div className={`w-full max-w-full min-w-0 ${bubbleRounding} p-2.5 transition-colors ${highlightedMessageId === message.id ? "forum-msg-highlight" : ""} ${isSelectedMessage ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#dff8e8] text-[#052e16]" : bubbleTone}`}>
                                {message.forwardedFrom && (
                                  <div className={`mb-1 px-2 text-[11px] font-normal not-italic ${darkMode ? "text-[#ffffff]" : "text-[#000000]"}`}>
                                    Forwarded from {message.forwardedFrom.senderName || "User"}
                                  </div>
                                )}
                                {message.replyToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => scrollToMessage(message.replyToMessage.id)}
                                    className={`mb-1 flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-colors ${mine ? darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-[#2563eb]/[0.07] hover:bg-[#2563eb]/[0.12]" : darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                                  >
                                    <div className={`w-[3px] shrink-0 self-stretch rounded-full ${mine ? "bg-[#2563eb]" : "bg-[#10b981]"}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate text-[11px] ${mine ? "text-[#2563eb]" : "text-[#10b981]"}`}>{message.replyToMessage.senderName}</p>
                                      <p className={`truncate text-[11px] ${muted}`}>{message.replyToMessage.text}</p>
                                    </div>
                                  </button>
                                )}
                                <LinkPreviewCard url={previewUrl} mine={mine} darkMode={darkMode} time={formatTime(message.createdAt)} embedded />
                                <p className="flex min-w-0 items-end gap-3 px-2 pb-1 pt-2 text-sm leading-6">
                                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                    {renderMessageText(displayText, messageSearch, isActiveMatch, users, openMentionProfile, mine)}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap align-baseline text-[10px] leading-none ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : muted}`}>
                                    {starMark}
                                    <span>{formatTime(message.createdAt)}</span>
                                    {mine && (
                                      <span className="inline-flex items-center justify-center translate-y-[0.5px]">
                                        {getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds) === "read" ? (
                                          <CheckCheck className="h-3.5 w-3.5 text-[#3b82f6]" title="Read" />
                                        ) : getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds) === "delivered" ? (
                                          <CheckCheck className={`h-3.5 w-3.5 ${darkMode ? "text-white/50" : "text-[#71809a]"}`} title="Delivered" />
                                        ) : (
                                          <Check className={`h-3.5 w-3.5 ${darkMode ? "text-white/50" : "text-[#71809a]"}`} title="Sent" />
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </p>
                              </div>
                            )}
                            {displayText && !previewUrl && (
                              <div className={`min-w-[112px] max-w-full ${bubbleRounding} px-3.5 py-2 transition-colors ${highlightedMessageId === message.id ? "forum-msg-highlight" : ""} ${isSelectedMessage ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#dff8e8] text-[#052e16]" : bubbleTone}`}>
                                {message.forwardedFrom && (
                                  <div className={`mb-1 text-[11px] font-normal not-italic ${darkMode ? "text-[#ffffff]" : "text-[#000000]"}`}>
                                    Forwarded from {message.forwardedFrom.senderName || "User"}
                                  </div>
                                )}
                                {message.replyToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => scrollToMessage(message.replyToMessage.id)}
                                    className={`mb-2 flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-colors ${mine ? darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-[#2563eb]/[0.07] hover:bg-[#2563eb]/[0.12]" : darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                                  >
                                    <div className={`w-[3px] shrink-0 self-stretch rounded-full ${mine ? "bg-[#2563eb]" : "bg-[#10b981]"}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate text-[11px] ${mine ? "text-[#2563eb]" : "text-[#10b981]"}`}>{message.replyToMessage.senderName}</p>
                                      <p className={`truncate text-[11px] ${muted}`}>{message.replyToMessage.text}</p>
                                    </div>
                                  </button>
                                )}
                                <div className="flex min-w-0 items-end gap-3">
                                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
                                  {renderMessageText(displayText, messageSearch, isActiveMatch, users, openMentionProfile, mine)}
                                  </p>
                                  <span className={`inline-flex min-w-[72px] shrink-0 items-center justify-end gap-1 whitespace-nowrap pb-[3px] text-[10px] leading-none ${mine ? darkMode ? "text-white/50" : "text-[#71809a]" : muted}`}>
                                    {starMark}
                                    {message.isEdited && <span className="opacity-70">Edited</span>}
                                    <span>{formatTime(message.createdAt)}</span>
                                    {mine && (
                                      <span className="inline-flex items-center justify-center translate-y-[0.5px]">
                                        {getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds) === "read" ? (
                                          <CheckCheck className="h-3.5 w-3.5 text-[#3b82f6]" title="Read" />
                                        ) : getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds) === "delivered" ? (
                                          <CheckCheck className={`h-3.5 w-3.5 ${darkMode ? "text-white/50" : "text-[#71809a]"}`} title="Delivered" />
                                        ) : (
                                          <Check className={`h-3.5 w-3.5 ${darkMode ? "text-white/50" : "text-[#71809a]"}`} title="Sent" />
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                            {previewUrl && !displayText && (
                              <div className={`w-full max-w-full min-w-0 ${bubbleRounding} p-2.5 transition-colors ${highlightedMessageId === message.id ? "forum-msg-highlight" : ""} ${isSelectedMessage ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#dff8e8] text-[#052e16]" : isActiveMatch ? darkMode ? "bg-[#123c2c] text-[#dcfce7]" : "bg-[#bbf7d0] text-[#052e16]" : bubbleTone}`}>
                                {starMark && <div className="mb-1 flex justify-end px-1">{starMark}</div>}
                                {message.forwardedFrom && (
                                  <div className={`mb-1 px-2 text-[11px] font-normal not-italic ${darkMode ? "text-[#ffffff]" : "text-[#000000]"}`}>
                                    Forwarded from {message.forwardedFrom.senderName || "User"}
                                  </div>
                                )}
                                {message.replyToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => scrollToMessage(message.replyToMessage.id)}
                                    className={`mb-1 flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-colors ${mine ? darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-[#2563eb]/[0.07] hover:bg-[#2563eb]/[0.12]" : darkMode ? "bg-white/[0.06] hover:bg-white/[0.1]" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                                  >
                                    <div className={`w-[3px] shrink-0 self-stretch rounded-full ${mine ? "bg-[#2563eb]" : "bg-[#10b981]"}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate text-[11px] font-semibold ${mine ? "text-[#2563eb]" : "text-[#10b981]"}`}>{message.replyToMessage.senderName}</p>
                                      <p className={`truncate text-[11px] ${muted}`}>{message.replyToMessage.text}</p>
                                    </div>
                                  </button>
                                )}
                                <LinkPreviewCard url={previewUrl} mine={mine} darkMode={darkMode} time={formatTime(message.createdAt)} status={getMessageStatus(message, selectedConversation, currentUser?.id, onlineUserIds)} isEdited={message.isEdited} />
                              </div>
                            )}
                            {message.reactions && message.reactions.length > 0 && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  const viewportBounds = {
                                    left: 0,
                                    right: window.innerWidth,
                                    top: 0,
                                    bottom: window.innerHeight,
                                  };
                                  const popoverWidth = Math.min(288, Math.max(240, window.innerWidth - 24));
                                  const popoverHeight = 230;
                                  const padding = 12;

                                  let targetX = mine ? rect.right - popoverWidth : rect.left;
                                  if (targetX + popoverWidth > viewportBounds.right - padding) {
                                    targetX = viewportBounds.right - popoverWidth - padding;
                                  }
                                  if (targetX < viewportBounds.left + padding) {
                                    targetX = viewportBounds.left + padding;
                                  }

                                  let targetY = rect.bottom + 6;
                                  if (targetY + popoverHeight > viewportBounds.bottom - padding) {
                                    targetY = rect.top - popoverHeight - 6;
                                  }
                                  targetY = Math.max(viewportBounds.top + padding, Math.min(targetY, viewportBounds.bottom - popoverHeight - padding));

                                  setReactionsPopoverTarget({
                                    message,
                                    x: targetX,
                                    y: targetY,
                                    width: popoverWidth,
                                  });
                                }}
                                className={`-mt-2 z-20 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all hover:scale-110 active:scale-95 ${mine ? "self-end" : "self-start"} ${darkMode ? "bg-[#181a20] text-white border border-white/10" : "bg-white text-black border border-black/10"}`}
                              >
                                {Array.from(new Set(message.reactions.map((r) => r.emoji))).map((emoji) => (
                                  <span key={emoji}>{emoji}</span>
                                ))}
                                {message.reactions.length > 1 && (
                                  <span className="text-[10px] font-bold opacity-75">{message.reactions.length}</span>
                                )}
                              </button>
                            )}
                            {copyFeedbackId === message.id && (
                              <span className={`mt-1 inline-flex animate-pulse items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${darkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-600"}`}>
                                <Check className="h-3 w-3" />
                                Copied
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })}
                  {(typingByConversation[selectedId] || []).length > 0 && (
                    <div className="flex items-end gap-2 sm:gap-3">
                      {selectedConversation?.type === "group" && <span className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />}
                      <div className={`flex items-center gap-1 rounded-[18px] rounded-bl-[6px] px-4 py-3 ${darkMode ? "bg-white/[0.08]" : "bg-white"}`} aria-label={`${(typingByConversation[selectedId] || []).map((user) => user.displayName).join(", ")} typing`}>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb] [animation-delay:0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb] [animation-delay:0.3s]" />
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </section>

              <form onSubmit={sendMessage} className={`relative shrink-0 px-3 py-2 sm:px-6 ${subSurface}`}>
                {mentionOptions.length > 0 && (
                  <div className={`absolute bottom-[76px] left-6 z-30 w-80 max-w-[calc(100vw-48px)] overflow-hidden rounded-[18px] p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-black"}`}>
                    <div className={`px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}>Mention</div>
                    {mentionOptions.map((user, index) => {
                      const active = index === Math.min(activeMentionIndex, mentionOptions.length - 1);
                      return (
                      <button key={user.id} type="button" onMouseEnter={() => setActiveMentionIndex(index)} onClick={() => selectMention(user)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${active ? darkMode ? "bg-white/12" : "bg-[#eef4ff]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f7f8fb]"}`}>
                        <span className="relative shrink-0">
                          <UserAvatar user={user} name={user.displayName} className="h-9 w-9" />
                          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${darkMode ? "border-[#1c1f26]" : "border-white"} ${online.has(user.id) ? "bg-[#22c55e]" : "bg-slate-300"}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{user.displayName || user.username || "User"}</span>
                          <span className={`block truncate text-xs ${muted}`}>@{mentionHandleForUser(user)}</span>
                        </span>
                        <AtSign className={`h-4 w-4 shrink-0 ${active ? "text-[#2563eb]" : muted}`} />
                      </button>
                      );
                    })}
                  </div>
                )}
                {selectedMessageIds.length > 0 && (
                  <div className={`mx-auto mb-2 flex max-w-4xl items-center gap-3 rounded-2xl px-3 py-2.5 ${darkMode ? "bg-[#111318] text-white" : "bg-white text-[#111827]"}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedMessageIds([])}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
                      aria-label="Clear selected messages"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <p className="min-w-0 flex-1 text-sm font-bold">
                      {selectedMessageIds.length} selected
                    </p>
                    <button
                      type="button"
                      onClick={copySelectedMessages}
                      className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10 text-white/80" : "hover:bg-black/5 text-black/70"}`}
                      aria-label="Copy selected messages"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={selectionDeleting}
                      onClick={requestDeleteSelectedMessages}
                      className="grid h-9 w-9 place-items-center rounded-full text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                      aria-label="Delete selected messages"
                    >
                      {selectionDeleting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openForwardDialog(selectedMessageIds)}
                      className={`grid h-9 w-9 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10 text-white/80" : "hover:bg-black/5 text-black/70"}`}
                      aria-label="Forward selected messages"
                    >
                      <Reply className="h-5 w-5 rotate-180" />
                    </button>
                  </div>
                )}
                {editingMessageTarget && (
                  <div className={`mx-auto mb-2 flex max-w-4xl items-center gap-3 rounded-2xl px-4 py-2.5 forum-reply-card-in ${darkMode ? "bg-white/[0.06]" : "bg-[#f0f4fa]"}`}>
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "bg-[#2563eb]/20 text-[#60a5fa]" : "bg-[#2563eb]/10 text-[#2563eb]"}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#2563eb]">Editing message</p>
                      <p className={`truncate text-xs ${muted}`}>{editingMessageTarget.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageTarget(null);
                        setComposer("");
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <X className={`h-4 w-4 ${muted}`} />
                    </button>
                  </div>
                )}
                {replyToMessageTarget && (
                  <div className={`mx-auto mb-2 flex max-w-4xl items-center gap-3 rounded-2xl px-4 py-2.5 forum-reply-card-in ${darkMode ? "bg-white/[0.06]" : "bg-[#f0f4fa]"}`}>
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "bg-[#2563eb]/20 text-[#60a5fa]" : "bg-[#2563eb]/10 text-[#2563eb]"}`}>
                      <Reply className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#2563eb]">
                        {String(replyToMessageTarget.senderId) === String(currentUser?.id) ? "You" : replyToMessageTarget.sender?.displayName || replyToMessageTarget.sender?.username || "User"}
                      </p>
                      <p className={`truncate text-xs ${muted}`}>{replyToMessageTarget.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMessageTarget(null)}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="mx-auto mb-2 flex max-w-4xl justify-start lg:hidden">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={refineComposerMessage}
                    disabled={!composer.trim() || refiningMessage || !canSendSelectedConversation}
                    title={refiningMessage ? "Refining with AI" : "Refine with AI"}
                    className={`inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-xs font-normal transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? "text-white/60 hover:text-white" : "text-black/50 hover:text-black"}`}
                    aria-label="Refine with AI"
                  >
                    <Sparkles className={`h-[17px] w-[17px] transition ${refiningMessage ? "animate-spin text-[#10b981]" : ""}`} />
                    <span>Refine with AI</span>
                  </button>
                </div>
                <div className="mx-auto flex max-w-4xl items-end gap-2">
                  <input
                    ref={documentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => uploadForumFile(event.target.files?.[0])}
                  />
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handlePhotoSelected(event.target.files?.[0])}
                  />
                  <label className={`relative flex min-h-12 flex-1 items-center rounded-[20px] pl-2 pr-4 transition-all ${refiningMessage ? "forum-composer-refining" : ""} ${darkMode ? "bg-[#23262d]" : "bg-white"}`} ref={mediaPickerRef}>
                    <div className="relative shrink-0">
                      {attachmentMenuOpen && (
                        <div className={`absolute bottom-14 left-0 z-30 w-56 origin-bottom-left rounded-[18px] border-0 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] forum-ctx-actions ${darkMode ? "bg-[#1b1e25] text-white" : "bg-white text-[#111827]"}`}>
                          <button type="button" onClick={() => { setAttachmentMenuOpen(false); documentInputRef.current?.click(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${darkMode ? "hover:bg-white/[0.07]" : "hover:bg-[#f4f7fb]"}`}>
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "bg-violet-400/15 text-violet-300" : "bg-violet-50 text-violet-600"}`}>
                              <FileText className="h-4 w-4" />
                            </span>
                            Document
                          </button>
                          <button type="button" onClick={() => { setAttachmentMenuOpen(false); photoInputRef.current?.click(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${darkMode ? "hover:bg-white/[0.07]" : "hover:bg-[#f4f7fb]"}`}>
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "bg-sky-400/15 text-sky-300" : "bg-sky-50 text-sky-600"}`}>
                              <ImageIcon className="h-4 w-4" />
                            </span>
                            Photos
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setAttachmentMenuOpen((current) => !current); setMediaPickerOpen(false); }}
                        disabled={!canSendSelectedConversation}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 ${attachmentMenuOpen ? "rotate-45" : ""} ${darkMode ? "text-white/60 hover:text-white" : "text-black/50 hover:text-black"}`}
                        aria-label="Add attachment"
                      >
                        <Plus className="h-[22px] w-[22px]" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerOpen(!mediaPickerOpen);
                        if (!mediaPickerOpen) setAttachmentMenuOpen(false);
                      }}
                      title="Emojis, GIFs, Stickers"
                      disabled={!canSendSelectedConversation}
                      className={`mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 ${darkMode ? "text-white/60 hover:text-white" : "text-black/50 hover:text-black"}`}
                    >
                      <Smile className={`h-[22px] w-[22px] transition ${mediaPickerOpen ? "text-[#2563eb]" : ""}`} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={refineComposerMessage}
                      disabled={!composer.trim() || refiningMessage || !canSendSelectedConversation}
                      title={refiningMessage ? "Refining with AI" : "Refine with AI"}
                      className={`mr-2 hidden h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 lg:grid ${darkMode ? "text-white/60 hover:text-white" : "text-black/50 hover:text-black"}`}
                      aria-label="Refine with AI"
                    >
                      <Sparkles className={`h-[17px] w-[17px] transition ${refiningMessage ? "animate-spin text-[#10b981]" : ""}`} />
                    </button>
                    
                    {mediaPickerOpen && (
                      <div className={`absolute bottom-[calc(100%+8px)] left-0 z-30 flex h-[420px] w-[360px] flex-col overflow-hidden rounded-[18px] border-0 shadow-[0_18px_50px_rgba(15,23,42,0.25)] forum-ctx-actions ${darkMode ? "bg-[#1b1e25] text-white" : "bg-white text-[#111827]"}`}>
                        <div className="flex-1 overflow-hidden">
                          {mediaPickerTab === "emoji" ? (
                            <EmojiPicker
                              theme={darkMode ? "dark" : "light"}
                              width="100%"
                              height="100%"
                              previewConfig={{ showPreview: false }}
                              onEmojiClick={(emojiData) => {
                                updateComposer(composer + emojiData.emoji);
                              }}
                            />
                          ) : (
                            <div className="flex h-full flex-col">
                              <div className="p-3">
                                <input
                                  type="text"
                                  placeholder={`Search ${mediaPickerTab === "gif" ? "GIFs" : "Stickers"} via GIPHY`}
                                  value={giphySearch}
                                  onChange={(e) => setGiphySearch(e.target.value)}
                                  className={`w-full rounded-full border px-4 py-2 text-sm outline-none ${darkMode ? "border-white/10 bg-black/20 focus:border-[#2563eb]" : "border-black/10 bg-black/5 focus:border-[#2563eb]"}`}
                                />
                              </div>
                              <div className="flex-1 overflow-y-auto px-2 pb-2">
                                <Grid
                                  key={`${mediaPickerTab}-${giphySearch}`}
                                  width={340}
                                  columns={mediaPickerTab === "gif" ? 2 : 3}
                                  fetchGifs={(offset) => giphySearch ? gf.search(giphySearch, { offset, limit: 20, type: mediaPickerTab === "sticker" ? "stickers" : "gifs" }) : gf.trending({ offset, limit: 20, type: mediaPickerTab === "sticker" ? "stickers" : "gifs" })}
                                  onGifClick={(gif, e) => {
                                    e.preventDefault();
                                    setMediaPickerOpen(false);
                                    sendMessage({
                                      preventDefault: () => {},
                                      giphy: { url: gif.images.original.url, type: mediaPickerTab }
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 border-t p-2 ${darkMode ? "border-white/10 bg-[#16181d]" : "border-black/10 bg-[#f4f7fb]"}`}>
                          <button
                            type="button"
                            onClick={() => { setMediaPickerTab("emoji"); setGiphySearch(""); }}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${mediaPickerTab === "emoji" ? (darkMode ? "bg-white/15 text-white" : "bg-white text-black") : (darkMode ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black")}`}
                          >
                            Emoji
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMediaPickerTab("gif"); setGiphySearch(""); }}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${mediaPickerTab === "gif" ? (darkMode ? "bg-white/15 text-white" : "bg-white text-black") : (darkMode ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black")}`}
                          >
                            GIF
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMediaPickerTab("sticker"); setGiphySearch(""); }}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${mediaPickerTab === "sticker" ? (darkMode ? "bg-white/15 text-white" : "bg-white text-black") : (darkMode ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black")}`}
                          >
                            Sticker
                          </button>
                        </div>
                      </div>
                    )}
                    <textarea
                      ref={composerRef}
                      value={composer}
                      disabled={!canSendSelectedConversation}
                      onChange={(event) => updateComposer(event.target.value)}
                      onPaste={handleComposerPaste}
                      onFocus={() => {
                        if (effectiveMobileViewport) {
                          window.scrollTo(0, 0);
                          document.body.scrollTop = 0;
                        }
                      }}
                      onBlur={() => emitTyping(false)}
                      onKeyDown={(event) => {
                        if (mentionOptions.length > 0) {
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActiveMentionIndex((current) => (current + 1) % mentionOptions.length);
                            return;
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveMentionIndex((current) => (current - 1 + mentionOptions.length) % mentionOptions.length);
                            return;
                          }
                          if (event.key === "Enter" || event.key === "Tab") {
                            event.preventDefault();
                            selectMention(mentionOptions[Math.min(activeMentionIndex, mentionOptions.length - 1)] || mentionOptions[0]);
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            updateComposer(composer.replace(/(^|\s)@([a-zA-Z0-9_.-]*)$/, "$1"));
                            return;
                          }
                        }
                        if (!effectiveMobileViewport && event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage(event);
                        }
                      }}
                      enterKeyHint={effectiveMobileViewport ? "enter" : "send"}
                      rows={1}
                      placeholder={canSendSelectedConversation ? "Write Something" : "Only group admins can message"}
                      className={`max-h-32 min-h-7 flex-1 resize-none bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 ${softText}`}
                    />
                  </label>
                  <button type="submit" onMouseDown={(event) => event.preventDefault()} onPointerDown={(event) => event.preventDefault()} disabled={!composer.trim() || !canSendSelectedConversation} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#d1d5db]" aria-label="Send message">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
              </>
                )}
            </div>

            {sidebarUser || selectedConversation?.type === "direct" ? (
              <UserInfoPanel
                darkMode={darkMode}
                user={sidebarUser || selectedOtherUser}
                online={online}
                muted={muted}
                onDirect={startDirect}
                onBack={sidebarUser ? () => setSidebarUser(null) : null}
                activeDirectUserId={selectedConversation?.type === "direct" ? selectedOtherUser?.id : null}
                embedded={embedded}
                widgetControls={widgetControls}
              />
            ) : (
              <ForumInfoPanel
                key={`${selectedConversation?.id || GROUP_ID}-${selectedConversation?.name || "Group Forum"}`}
                darkMode={darkMode}
                group={selectedConversation}
                users={users}
                currentUser={currentUser}
                groupParticipants={groupParticipants}
                online={online}
                onlineUserIds={onlineUserIds}
                muted={muted}
                onDirect={startDirect}
                onSelectUser={setSidebarUser}
                onUpdateGroup={updateGroup}
                embedded={embedded}
                widgetControls={widgetControls}
              />
            )}
          </>
        )}
        </main>
        {mobileProfileUser && (
          <MobileUserProfileSheet
            darkMode={darkMode}
            user={mobileProfileUser}
            online={online}
            muted={muted}
            onClose={() => setMobileProfileUser(null)}
            onDirect={startDirectFromProfile}
            activeDirectUserId={selectedConversation?.type === "direct" ? selectedOtherUser?.id : null}
          />
        )}
        {createGroupOpen && (
          <div
            className="fixed inset-0 z-[95] grid place-items-center bg-black/55 px-4 backdrop-blur-[2px] transition-all animate-in fade-in duration-200"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !creatingGroup) setCreateGroupOpen(false);
            }}
          >
            <form onSubmit={createGroup} className={`w-full max-w-lg rounded-[26px] p-5 shadow-2xl animate-in zoom-in-95 duration-200 ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-[#111827]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black">Create group</h3>
                  <p className={`mt-1 text-xs ${muted}`}>{createGroupStep === 1 ? "Step 1 of 2: name and avatar" : "Step 2 of 2: add members"}</p>
                </div>
                <button type="button" onClick={() => { setCreateGroupOpen(false); setCreateGroupStep(1); }} disabled={creatingGroup} className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`} aria-label="Close create group">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className={`h-1.5 rounded-full ${createGroupStep >= 1 ? "bg-[#2563eb]" : darkMode ? "bg-white/10" : "bg-black/10"}`} />
                <span className={`h-1.5 rounded-full ${createGroupStep >= 2 ? "bg-[#2563eb]" : darkMode ? "bg-white/10" : "bg-black/10"}`} />
              </div>

              {createGroupStep === 1 ? (
                <>
                  <div className="mt-6 flex items-center gap-4">
                    <GroupAvatar group={{ name: createGroupName || "Group", avatarPreset: createGroupAvatar, avatarUrl: createGroupAvatarFile ? URL.createObjectURL(createGroupAvatarFile) : "" }} className="h-16 w-16" iconClassName="h-7 w-7" />
                    <label className="min-w-0 flex-1">
                      <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] ${muted}`}>Group name</span>
                      <input value={createGroupName} onChange={(event) => setCreateGroupName(event.target.value)} maxLength={80} placeholder="Enter group name" className={`h-11 w-full rounded-2xl px-3 text-sm font-semibold outline-none ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f6f8]"}`} />
                    </label>
                  </div>

                  <div className="mt-6">
                    <p className={`mb-3 text-[11px] font-bold uppercase tracking-[0.12em] ${muted}`}>Avatar</p>
                    <div className="grid max-h-72 grid-cols-6 gap-3 overflow-y-auto p-2 -m-2 sm:grid-cols-8">
                      <label className={`cursor-pointer grid h-11 w-11 place-items-center rounded-full outline-none focus:outline-none transition ${createGroupAvatarFile ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-white dark:ring-offset-[#1c1f26]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label="Upload custom avatar">
                        <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onClick={(e) => { e.target.value = null; }} onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setCreateGroupAvatarFile(file);
                            setCreateGroupAvatar("");
                          }
                        }} />
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gray-500 text-white">
                          <Upload className="h-4 w-4" />
                        </span>
                      </label>
                      {GROUP_AVATAR_PRESETS.map((preset) => {
                        const Icon = preset.Icon || MessagesSquare;
                        const selected = !createGroupAvatarFile && createGroupAvatar === preset.id;
                        return (
                          <button key={preset.id} type="button" onClick={() => { setCreateGroupAvatar(preset.id); setCreateGroupAvatarFile(null); }} className={`grid h-11 w-11 place-items-center rounded-full outline-none focus:outline-none transition ${selected ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-white dark:ring-offset-[#1c1f26]" : darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`} aria-label={`Choose ${preset.id}`}>
                            <span className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: preset.gradient }}>
                              <Icon className="h-4 w-4" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black">{createGroupName || "New group"}</p>
                      <p className={`text-xs ${muted}`}>Choose people to add</p>
                    </div>
                    <span className={`text-xs ${muted}`}>{createGroupMemberIds.length} selected</span>
                  </div>
                  <div className={`mb-3 flex h-10 items-center gap-2 rounded-2xl px-3 ${darkMode ? "bg-white/[0.06]" : "bg-[#f4f6f8]"}`}>
                    <Search className={`h-4 w-4 ${muted}`} />
                    <input value={createGroupSearch} onChange={(event) => setCreateGroupSearch(event.target.value)} placeholder="Search users" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </div>
                  <div className="max-h-[52vh] space-y-1 overflow-y-auto pr-1">
                    {createGroupUsers.map((user) => {
                      const selected = createGroupMemberIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setCreateGroupMemberIds((current) => selected ? current.filter((id) => id !== user.id) : [...current, user.id])}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${selected ? darkMode ? "bg-emerald-500/15" : "bg-emerald-50" : darkMode ? "hover:bg-white/[0.06]" : "hover:bg-[#f5f7fb]"}`}
                        >
                          <UserAvatar user={user} name={user.displayName} className="h-9 w-9" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                            <span className={`block truncate text-xs ${muted}`}>{user.designation || user.department || user.email || user.username}</span>
                          </span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/20" : "border-black/15"}`}>
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                {createGroupStep === 2 ? (
                  <button type="button" onClick={() => setCreateGroupStep(1)} disabled={creatingGroup} className={`h-11 rounded-full px-5 text-sm font-bold ${darkMode ? "bg-white/10 hover:bg-white/15" : "bg-[#f4f6f8] hover:bg-[#eef1f5]"}`}>
                    Back
                  </button>
                ) : <span />}
                {createGroupStep === 1 ? (
                  <button type="button" onClick={() => setCreateGroupStep(2)} disabled={!createGroupName.trim()} className="h-11 min-w-28 rounded-full bg-[#2563eb] px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    Next
                  </button>
                ) : (
                  <button type="submit" disabled={creatingGroup || !createGroupName.trim() || !createGroupMemberIds.length} className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-full bg-[#2563eb] px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {creatingGroup && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Create group
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
        {forumSettingsOpen && (
          <div
            className="fixed inset-0 z-[95] grid place-items-center bg-black/55 px-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !savingForumSettings) setForumSettingsOpen(false);
            }}
          >
            <form
              onSubmit={saveForumDriveSettings}
              className={`w-full max-w-md rounded-[24px] p-5 ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#111827]"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${darkMode ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-50 text-emerald-600"}`}>
                  <Settings className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold">Forum Drive folder</h3>
                  <p className={`mt-1 text-sm ${muted}`}>Files shared in groups and DMs will upload to this folder.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForumSettingsOpen(false)}
                  disabled={savingForumSettings}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"}`}
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mt-5 block">
                <span className={`mb-2 block text-xs font-semibold ${muted}`}>Drive folder link</span>
                <input
                  value={forumDriveFolderUrl}
                  onChange={(event) => setForumDriveFolderUrl(event.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className={`h-12 w-full rounded-2xl px-4 text-sm outline-none ${darkMode ? "bg-white/[0.08] text-white placeholder:text-white/30" : "bg-[#f4f7fb] text-black placeholder:text-black/35"}`}
                />
              </label>
              {forumDriveConnectedUrl && (
                <a href={forumDriveConnectedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-xs font-semibold text-[#10b981] no-underline">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Connected folder</span>
                </a>
              )}
              <button
                type="submit"
                disabled={savingForumSettings || !forumDriveFolderUrl.trim()}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-4 text-sm font-bold text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {savingForumSettings ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Connect folder
              </button>
            </form>
          </div>
        )}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[97] grid place-items-center overflow-hidden bg-black/90 p-3 sm:p-6 animate-in fade-in duration-150" onClick={() => setFullscreenImage(null)}>
            <button type="button" onClick={() => setFullscreenImage(null)} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close image">
              <X className="h-5 w-5" />
            </button>
            <img
              src={attachmentImageUrl(fullscreenImage)}
              alt={fullscreenImage.name || "Shared image"}
              className="h-auto max-h-[calc(100dvh-48px)] w-auto max-w-[calc(100vw-32px)] rounded-xl object-contain animate-in zoom-in-95 duration-150"
              onClick={(event) => event.stopPropagation()}
              onError={() => setFullscreenImage(null)}
            />
          </div>
        )}
        {pinMessageTarget && (
          <div className="fixed inset-0 z-[96] grid place-items-center bg-black/45 px-4 backdrop-blur-[1px]" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pinSaving) setPinMessageTarget(null);
          }}>
            <div className={`w-full max-w-md rounded-[24px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-in zoom-in-95 duration-150 ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#111827]"}`}>
              <h3 className="text-xl font-semibold">Choose how long your pin lasts</h3>
              <p className={`mt-4 text-sm ${muted}`}>You can unpin at any time.</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: "24 hours", value: 24 },
                  { label: "7 days", value: 24 * 7 },
                  { label: "30 days", value: 24 * 30 },
                ].map((item) => (
                  <label key={item.value} className="flex cursor-pointer items-center gap-3 text-sm">
                    <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${pinDurationHours === item.value ? "border-[#10b981]" : darkMode ? "border-white/35" : "border-black/35"}`}>
                      {pinDurationHours === item.value && <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />}
                    </span>
                    <input type="radio" className="sr-only" checked={pinDurationHours === item.value} onChange={() => setPinDurationHours(item.value)} />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="mt-10 flex justify-end gap-3">
                <button type="button" onClick={() => setPinMessageTarget(null)} disabled={pinSaving} className="rounded-full px-5 py-2 text-sm font-bold text-[#0f766e] disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={() => savePinnedMessage("pin")} disabled={pinSaving} className="inline-flex min-w-20 items-center justify-center gap-2 rounded-full bg-[#10b981] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {pinSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Pin
                </button>
              </div>
            </div>
          </div>
        )}
        {messageMenu && (
          <>
            <div
              className="fixed inset-0 z-[75] bg-black/65 backdrop-blur-[2px] forum-ctx-backdrop"
              onClick={() => {
                setMessageMenu(null);
                setEmojiPickerOpen(false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMessageMenu(null);
                setEmojiPickerOpen(false);
              }}
            />
            <div
              ref={messageMenuRef}
              style={{
                left: messageMenu.x,
                top: messageMenu.y,
                maxHeight: "calc(100dvh - 24px)",
              }}
              className={`fixed z-[95] flex flex-col gap-2.5 overflow-visible forum-ctx-container ${messageMenu.mine ? "items-end origin-top-right" : "items-start origin-top-left"}`}
            >
              {/* WhatsApp Style Floating Emoji Reaction Bar */}
              <div className={`flex items-center gap-1 rounded-full px-2.5 py-2 shadow-[0_16px_60px_rgba(0,0,0,0.18)] forum-ctx-emoji-bar ${darkMode ? "bg-[#12141a] text-white" : "bg-white text-[#111827]"}`}>
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      handleEmojiReaction(messageMenu.message, emoji);
                      setEmojiPickerOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-base transition-transform duration-150 hover:scale-130 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen((prev) => !prev)}
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs transition ${emojiPickerOpen ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-white/10 " + muted}`}
                  title="More reactions"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* EmojiPicker for Reactions */}
              {emojiPickerOpen ? (
                <div className={`w-[320px] h-[400px] overflow-hidden max-w-[calc(100vw-32px)] rounded-[22px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] forum-ctx-picker border-0 ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-[#111827]"}`}>
                  <EmojiPicker
                    theme={darkMode ? "dark" : "light"}
                    width="100%"
                    height="100%"
                    previewConfig={{ showPreview: false }}
                    onEmojiClick={(emojiData) => {
                      handleEmojiReaction(messageMenu.message, emojiData.emoji);
                      setEmojiPickerOpen(false);
                    }}
                  />
                </div>
              ) : (
                /* WhatsApp Style Context Menu */
                <div
                  style={{ maxHeight: messageMenu.maxActionsHeight || 320 }}
                  className={`w-52 overflow-y-auto overscroll-contain rounded-[22px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.18)] forum-ctx-actions ${darkMode ? "bg-[#12141a] text-white" : "bg-white text-[#111827]"}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setReplyToMessageTarget(messageMenu.message);
                      setMessageMenu(null);
                      if (composerRef.current) composerRef.current.focus();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Reply className="h-4 w-4 text-[#2563eb]" />
                    Reply
                  </button>
                  {messageMenu.message?.senderId === currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessageInfoTarget(messageMenu.message);
                        setMessageMenu(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                    >
                      <Info className="h-4 w-4 text-[#2563eb]" />
                      Message info
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copyMessageText(messageMenu.message)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Copy className="h-4 w-4 text-[#2563eb]" />
                    Copy
                  </button>
                  <button
                    type="button"
                    disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                    onClick={() => startMessageSelection(messageMenu.message)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Check className="h-4 w-4 text-[#2563eb]" />
                    Select
                  </button>
                  <button
                    type="button"
                    disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                    onClick={() => openForwardDialog(messageMenu.message?.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Reply className="h-4 w-4 rotate-180 text-[#2563eb]" />
                    Forward
                  </button>
                  <button
                    type="button"
                    disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                    onClick={() => toggleMessageStar(messageMenu.message)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Star className={`h-4 w-4 ${messageMenu.message?.isStarred ? "fill-amber-400 text-amber-400" : "text-[#2563eb]"}`} />
                    {messageMenu.message?.isStarred ? "Unstar" : "Star message"}
                  </button>
                  <button
                    type="button"
                    disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                    onClick={() => {
                      if (selectedConversation?.pinnedMessage?.messageId === messageMenu.message?.id) {
                        setMessageMenu(null);
                        void savePinnedMessage("unpin");
                      } else {
                        openPinDialog(messageMenu.message);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <Pin className="h-4 w-4 text-[#2563eb]" />
                    {selectedConversation?.pinnedMessage?.messageId === messageMenu.message?.id ? "Unpin" : "Pin message"}
                  </button>
                  {messageMenu.message?.senderId === currentUser?.id && !messageMenu.message?.forwardedFrom && !messageMenu.message?.attachment && (
                    <button
                      type="button"
                      disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                      onClick={() => {
                        setEditingMessageTarget(messageMenu.message);
                        setComposer(messageMenu.message.text || "");
                        setMessageMenu(null);
                        window.setTimeout(() => composerRef.current?.focus(), 0);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f4f7fb]"}`}
                    >
                      <Pencil className="h-4 w-4 text-[#2563eb]" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={String(messageMenu.message?.id || "").startsWith("temp-")}
                    onClick={() => {
                      setDeleteMessageTarget(messageMenu.message);
                      setMessageMenu(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {reactionsPopoverTarget && (
          <>
            <div
              className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-[2px] forum-ctx-backdrop"
              onMouseDown={() => setReactionsPopoverTarget(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setReactionsPopoverTarget(null);
              }}
            />
            <div
              style={{
                left: reactionsPopoverTarget.x,
                top: reactionsPopoverTarget.y,
                width: reactionsPopoverTarget.width || 288,
                maxWidth: "calc(100vw - 24px)",
              }}
              className={`fixed z-[90] rounded-[22px] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] forum-ctx-reactions border-0 ${darkMode ? "bg-[#1c1f26] text-white" : "bg-white text-[#111827]"}`}
            >
              {/* Header with count and reaction filter tabs */}
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-bold opacity-80">
                  {reactionsPopoverTarget.message.reactions?.length || 0} reaction{reactionsPopoverTarget.message.reactions?.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2 forum-ctx-reaction-tabs">
                  <div className={`grid h-8 w-8 place-items-center rounded-full border ${darkMode ? "border-white/10 bg-white/5 text-white/70" : "border-black/10 bg-black/5 text-black/70"}`}>
                    <SmilePlus className="h-4 w-4" />
                  </div>
                  {Array.from(new Set((reactionsPopoverTarget.message.reactions || []).map((r) => r.emoji))).map((emoji) => {
                    const count = (reactionsPopoverTarget.message.reactions || []).filter((r) => r.emoji === emoji).length;
                    return (
                      <div
                        key={emoji}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border border-emerald-300"}`}
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`my-3 border-b ${darkMode ? "border-white/10" : "border-black/10"}`} />

              {/* Reactors list */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1 forum-ctx-reactor-list">
                {(reactionsPopoverTarget.message.reactions || []).map((reaction, idx) => {
                  const isMe = String(reaction.userId) === String(currentUser?.id);
                  const userObj = reaction.user || users.find((u) => String(u.id) === String(reaction.userId)) || (isMe ? currentUser : null);
                  const name = isMe ? "You" : userObj?.displayName || "User";
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (isMe) {
                          removeMyReaction(reactionsPopoverTarget.message);
                          setReactionsPopoverTarget(null);
                          toast.success("Reaction removed");
                        }
                      }}
                      className={`flex items-center justify-between rounded-xl px-2 py-2 transition ${isMe ? "cursor-pointer" : ""} ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={userObj} name={name} className="h-10 w-10 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{name}</p>
                          {isMe && <p className={`text-xs ${muted}`}>Click to remove</p>}
                        </div>
                      </div>
                      <span className="text-xl shrink-0 ml-2">{reaction.emoji}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {forwardMessageIds.length > 0 && (
          <div
            className="fixed inset-0 z-[92] grid place-items-center bg-black/55 px-4 backdrop-blur-[2px] dark:bg-black/75"
            onMouseDown={() => {
              if (!forwardSending) {
                setForwardMessageIds([]);
                setForwardTargetIds([]);
                setForwardSearch("");
              }
            }}
          >
            <div
              onMouseDown={(event) => event.stopPropagation()}
              className={`flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#111827]"}`}
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  disabled={forwardSending}
                  onClick={() => {
                    setForwardMessageIds([]);
                    setForwardTargetIds([]);
                    setForwardSearch("");
                  }}
                  className={`grid h-9 w-9 place-items-center rounded-full ${darkMode ? "hover:bg-white/10" : "hover:bg-black/5"} disabled:opacity-50`}
                  aria-label="Close forward dialog"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black">Forward message</h3>
                  <p className={`text-xs ${muted}`}>{forwardMessageIds.length} message{forwardMessageIds.length === 1 ? "" : "s"} selected</p>
                </div>
              </div>
              <div className="px-5 pb-3">
                <label className={`flex h-11 items-center gap-2 rounded-2xl px-3 ${darkMode ? "bg-white/10" : "bg-[#f3f5f8]"}`}>
                  <Search className={`h-4 w-4 ${muted}`} />
                  <input
                    value={forwardSearch}
                    onChange={(event) => setForwardSearch(event.target.value)}
                    placeholder="Search people or group"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {forwardTargets.map((target) => {
                  const selected = forwardTargetIds.includes(target.key);
                  return (
                    <button
                      key={target.key}
                      type="button"
                      onClick={() => toggleForwardTarget(target.key)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${selected ? darkMode ? "bg-emerald-500/15" : "bg-emerald-50" : darkMode ? "hover:bg-white/8" : "hover:bg-[#f6f8fb]"}`}
                    >
                      {target.type === "group" ? (
                        <GroupAvatar group={target.group} className="h-10 w-10" iconClassName="h-5 w-5" />
                      ) : (
                        <UserAvatar user={target.avatarUser} name={target.title} className="h-10 w-10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{target.title}</span>
                        <span className={`block truncate text-xs ${muted}`}>{target.subtitle}</span>
                      </span>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? "border-emerald-500 bg-emerald-500 text-white" : darkMode ? "border-white/20" : "border-black/15"}`}>
                        {selected && <Check className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
                {!forwardTargets.length && (
                  <p className={`px-4 py-8 text-center text-sm ${muted}`}>No contacts found.</p>
                )}
              </div>
              <div className={`flex items-center gap-3 border-t px-5 py-4 ${darkMode ? "border-white/10" : "border-black/10"}`}>
                <p className="min-w-0 flex-1 text-sm font-bold">{forwardTargetIds.length} selected</p>
                <button
                  type="button"
                  disabled={!forwardTargetIds.length || forwardSending}
                  onClick={sendForwardedMessages}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2563eb] px-5 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
                >
                  {forwardSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
        {messageInfoTarget && (
          <div
            className={`fixed inset-0 z-[95] grid place-items-center transition-all duration-200 px-4 animate-in fade-in duration-150 ${darkMode ? "bg-black/80" : "bg-black/40"}`}
            onMouseDown={() => setMessageInfoTarget(null)}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-full max-w-md overflow-hidden rounded-[24px] p-6 shadow-none border-0 animate-in zoom-in-95 duration-150 ${darkMode ? "bg-[#0b0d12] text-white" : "bg-white text-[#111827]"}`}
            >
              <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2563eb]/10 text-[#2563eb]">
                    <Info className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold">Message info</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageInfoTarget(null)}
                  className={`grid h-8 w-8 place-items-center rounded-full transition ${darkMode ? "hover:bg-white/10" : "hover:bg-[#f2f4f8]"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Message Preview */}
              <div className="my-5">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>Message</p>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-6 border-0 shadow-none ${darkMode ? "bg-[#13151b] text-white" : "bg-[#f3f4f6] text-[#14213d]"}`}>
                  <p className="whitespace-pre-wrap break-words">{messageInfoTarget.text}</p>
                </div>
              </div>

              {/* Receipts Info */}
              <div className="space-y-4 pt-2">
                {/* Read Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                      <CheckCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Read</p>
                      <p className={`text-xs ${muted}`}>
                        {getMessageStatus(messageInfoTarget, selectedConversation, currentUser?.id, onlineUserIds) === "read"
                          ? Object.values(messageInfoTarget.readBy || {})[0]
                            ? new Date(Object.values(messageInfoTarget.readBy)[0]).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                            : "Read"
                          : "Not read yet"}
                      </p>
                    </div>
                  </div>
                  {getMessageStatus(messageInfoTarget, selectedConversation, currentUser?.id, onlineUserIds) === "read" ? (
                    <span className="text-xs font-bold text-[#3b82f6]">Read</span>
                  ) : (
                    <span className={`text-xs font-medium ${muted}`}>-</span>
                  )}
                </div>

                {/* Delivered Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-white/10 text-white/70" : "bg-black/5 text-black/60"}`}>
                      <CheckCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Delivered</p>
                      <p className={`text-xs ${muted}`}>
                        {getMessageStatus(messageInfoTarget, selectedConversation, currentUser?.id, onlineUserIds) !== "sent"
                          ? Object.values(messageInfoTarget.deliveredTo || {})[0]
                            ? new Date(Object.values(messageInfoTarget.deliveredTo)[0]).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                            : "Delivered"
                          : "Not delivered"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${muted}`}>
                    {getMessageStatus(messageInfoTarget, selectedConversation, currentUser?.id, onlineUserIds) !== "sent" ? "Delivered" : "-"}
                  </span>
                </div>

                {/* Sent Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-full ${darkMode ? "bg-white/10 text-white/70" : "bg-black/5 text-black/60"}`}>
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Sent</p>
                      <p className={`text-xs ${muted}`}>
                        {messageInfoTarget.createdAt ? new Date(messageInfoTarget.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Sent"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${muted}`}>Sent</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {(deleteMessageTarget || deleteSelectionTarget) && (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 dark:bg-black/80" onMouseDown={() => {
            if (deletingMessage || selectionDeleting) return;
            setDeleteMessageTarget(null);
            setDeleteSelectionTarget(null);
          }}>
            <div onMouseDown={(event) => event.stopPropagation()} className={`relative w-full max-w-[420px] rounded-[22px] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.28)] ${darkMode ? "bg-[#15171c] text-white" : "bg-white text-[#111827]"}`}>
              <button
                type="button"
                disabled={deletingMessage || selectionDeleting}
                onClick={() => {
                  setDeleteMessageTarget(null);
                  setDeleteSelectionTarget(null);
                }}
                className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full transition ${darkMode ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-black/45 hover:bg-black/5 hover:text-black"} disabled:opacity-40`}
                aria-label="Close delete dialog"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 pr-9">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-black dark:text-white">Delete {deleteSelectionTarget ? "messages" : "message"}?</h3>
                  <p className={`mt-1 text-xs leading-5 ${muted}`}>
                    {deleteSelectionTarget ? `${deleteSelectionTarget.messages.length} selected messages can be removed for you or everyone.` : "Choose how this message should be removed."}
                  </p>
                </div>
              </div>
              {/* <div className={`mt-4 max-h-24 overflow-hidden rounded-2xl px-3 py-2 text-sm ${darkMode ? "bg-white/[0.05] text-white/70" : "bg-[#f7f8fb] text-black/60"}`}>
                <p className="line-clamp-3 whitespace-pre-wrap break-words">{deleteMessageTarget.text || "Link preview message"}</p>
              </div> */}
              <div className="mt-5 flex items-center gap-2">
                {(deleteSelectionTarget || deleteMessageTarget?.senderId === currentUser?.id) && (
                  <button type="button" disabled={deletingMessage || selectionDeleting} onClick={() => deleteSelectionTarget ? deleteSelectedMessages("everyone") : deleteSingleMessage("everyone")} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60">
                    {(deletingMessage || selectionDeleting) ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    <span className="truncate">Delete for everyone</span>
                  </button>
                )}
                <button type="button" disabled={deletingMessage || selectionDeleting} onClick={() => deleteSelectionTarget ? deleteSelectedMessages("me") : deleteSingleMessage("me")} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60">
                  {(deletingMessage || selectionDeleting) ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span className="truncate">Delete for me</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
