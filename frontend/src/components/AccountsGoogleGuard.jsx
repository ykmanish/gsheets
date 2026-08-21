"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Lock, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "./AuthProvider";

// Everything under Finance is gated on Google rather than on a role: the Google account
// must be the email on the raga profile, and Google itself must grant it access to the
// CRBR sheets. Asked once per login — the grant lives on the session, so signing out of
// raga clears it. Shared by the Accounts and Forms sub-modules.

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function muteFor(darkMode) {
  return darkMode ? "text-white/50" : "text-black/50";
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1 16.1 0 19.9 0 23.5s1 7.4 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 47c6.2 0 11.5-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.4-13.6-10.3l-7.8 6.1C6.5 41.6 14.6 47 24 47z" />
    </svg>
  );
}

function StatusPill({ children, tone = "slate", darkMode }) {
  const tones = {
    amber: darkMode ? "bg-amber-300/10 text-amber-200" : "bg-amber-100 text-amber-700",
    blue: darkMode ? "bg-blue-300/10 text-blue-200" : "bg-blue-100 text-blue-700",
    slate: darkMode ? "bg-white/10 text-white/65" : "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function GateScreen({ status, darkMode, onVerify, busy, notice, title }) {
  const muted = muteFor(darkMode);
  const panel = darkMode ? "border-transparent bg-[#15171c]" : "border-black/[0.06] bg-white";
  const unconfigured = status && status.configured === false;
  const hasEmail = Boolean(status?.profileEmail);
  const problem = unconfigured
    ? { tone: "error", title: "Google sign-in is not set up on the server yet", detail: "An OAuth client ID and secret need adding to the backend environment." }
    : !hasEmail
      ? { tone: "error", title: "Your raga profile has no email address", detail: "There is nothing to match a Google account against. Ask an admin to add it." }
      : notice;

  return (
    <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
      <section className={`overflow-hidden rounded-[30px] border p-6 sm:p-8 ${panel}`}>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="blue" darkMode={darkMode}><FileSpreadsheet className="mr-2 h-4 w-4" /> Finance</StatusPill>
              <StatusPill tone="amber" darkMode={darkMode}><Lock className="mr-1.5 h-3.5 w-3.5" /> Locked</StatusPill>
            </div>
            <h1 className="small mt-5 text-4xl font-black leading-none sm:text-5xl">{title} is locked</h1>
            <p className={`mt-4 max-w-xl text-sm leading-6 ${muted}`}>
              Sign in with the Google account that has access to the CRBR sheets. It has to be the same address as your
              raga profile.
            </p>

            {hasEmail && (
              <div className={`mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3 ${darkMode ? "bg-white/[0.05]" : "bg-[#f8f9fc]"}`}>
                <span className={`text-[11px] font-black uppercase tracking-wide ${muted}`}>Your profile email</span>
                <span className="break-all text-sm font-black">{status.profileEmail}</span>
              </div>
            )}

            {problem && (
              <div className={`mt-4 flex max-w-xl items-start gap-3 rounded-2xl p-4 ${problem.tone === "error" ? darkMode ? "bg-rose-300/10" : "bg-rose-50" : darkMode ? "bg-amber-300/10" : "bg-amber-50"}`}>
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${problem.tone === "error" ? "text-rose-500" : "text-amber-600"}`} />
                <div>
                  <p className={`text-sm font-black ${problem.tone === "error" ? "text-rose-500" : "text-amber-600"}`}>{problem.title}</p>
                  {problem.detail ? <p className={`mt-1 text-sm ${muted}`}>{problem.detail}</p> : null}
                </div>
              </div>
            )}
          </div>

          {!unconfigured && (
            <div className="grid w-full gap-2 xl:w-auto xl:justify-end">
              <button
                type="button"
                onClick={onVerify}
                disabled={busy || !hasEmail}
                className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#6ee72f] px-7 text-[15px] font-black text-[#10210c] transition hover:bg-[#5edb22] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
                Continue with Google
              </button>
              <p className={`text-center text-xs xl:text-right ${muted}`}>Asked once per login</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * Wraps a Finance sub-module. Renders the gate until Google has verified this session,
 * then calls children with the grant so the page can respect view-only access.
 */
export default function AccountsGoogleGuard({ darkMode, title = "This module", children }) {
  const [gate, setGate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const checkGate = useCallback(async () => {
    try {
      const status = await api("/accounts/google/status");
      setGate(status);
      return status;
    } catch (error) {
      setGate({ configured: true, verified: false });
      toast.error(error.message || "Could not check Google verification");
      return null;
    }
  }, []);

  // The Google callback bounces back with the outcome in the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result) return;
    const reason = params.get("reason") || "";
    if (result === "ok") toast.success("Google verified");
    else if (result === "mismatch") setNotice({ tone: "error", title: "That is not the account on your profile", detail: reason });
    else if (result === "denied") setNotice({ tone: "error", title: "No access to the CRBR sheets", detail: reason || "Ask whoever owns the sheets to share them with this Google account." });
    else setNotice({ tone: "error", title: "Google verification failed", detail: reason });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => { void checkGate(); }, [checkGate]);

  async function startGoogle() {
    try {
      setBusy(true);
      const { url } = await api("/accounts/google/start", { method: "POST" });
      window.location.href = url;
    } catch (error) {
      setBusy(false);
      toast.error(error.message || "Could not start Google sign-in");
    }
  }

  async function signOutGoogle() {
    try {
      await api("/accounts/google/revoke", { method: "POST" });
      setNotice(null);
      await checkGate();
      toast.success("Signed out of Finance");
    } catch (error) {
      toast.error(error.message || "Could not sign out");
    }
  }

  if (!gate) {
    return (
      <main className={`grid flex-1 place-items-center ${darkMode ? "bg-[#0d0f13] text-white" : "bg-[#f4f5f8] text-[#171714]"}`}>
        <div className={`flex items-center gap-3 text-sm font-semibold ${muteFor(darkMode)}`}><Loader2 className="h-5 w-5 animate-spin" /> Checking access...</div>
      </main>
    );
  }

  if (!gate.verified) {
    return <GateScreen status={gate} darkMode={darkMode} onVerify={startGoogle} busy={busy} notice={notice} title={title} />;
  }

  return children({ gate, signOutGoogle });
}

// The "signed in as x — click to sign out" button each sub-module puts in its header.
export function GoogleSessionButton({ gate, onSignOut, darkMode }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      title={`Signed in as ${gate.email}${gate.canManage ? "" : " · view only"}`}
      className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${darkMode ? "border-white/10 bg-white/10" : "border-black/10 bg-white"}`}
    >
      <LogOut className="h-4 w-4" /> <span className="max-w-[160px] truncate">{gate.email}</span>
    </button>
  );
}
