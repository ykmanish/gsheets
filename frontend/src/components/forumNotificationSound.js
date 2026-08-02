"use client";

const FORUM_NOTIFICATION_SOUND = "/chatnotifi.mp3";

export function playForumNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(FORUM_NOTIFICATION_SOUND);
    audio.preload = "auto";
    audio.volume = 0.75;
    void audio.play().catch(() => {});
  } catch {}
}
