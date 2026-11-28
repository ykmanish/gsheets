"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BellRing, CalendarCheck, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import BrandMark from "./BrandMark";
import toast, { Toaster } from "react-hot-toast";
import { API_URL, getStoredAuth } from "./AuthProvider";

// Official Google reCAPTCHA Test Key (always passes for local testing)
const RECAPTCHA_SITE_KEY = "6LdcwSctAAAAAAG-UP3Bt6SorvofMJWxqMxDDmnA";

const MODULES = ["Site reports", "MRN", "PRN", "Attendance", "Daily reports", "Stock"];
const MANPOWER_BARS = [52, 70, 61, 84, 76, 90, 84];

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The current time, only on the client (null during the server render), refreshed every 30 s. */
function useNow() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

/** A frosted card on the dark panel: rises in once, then floats gently. */
function Glass({ className = "", delay = 0, float = 0, children }) {
  return (
    <div className={`auth-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div
        className="auth-float h-full rounded-[22px] border border-white/10 bg-white/[0.07] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md"
        style={{ animationDelay: `${float}ms` }}
      >
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const now = useNow();

  useEffect(() => {
    const { token } = getStoredAuth();
    if (token) window.location.href = "/";
  }, []);

  useEffect(() => {
    // Load reCAPTCHA v3
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setRecaptchaLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const scriptElement = document.querySelector(`script[src*="recaptcha/api.js"]`);
      if (scriptElement) {
        document.body.removeChild(scriptElement);
      }
    };
  }, []);

  async function getRecaptchaToken() {
    if (!window.grecaptcha || !recaptchaLoaded) {
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
        action: 'login'
      });
      return token;
    } catch (error) {
      console.error("reCAPTCHA error:", error);
      return null;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const recaptchaToken = await getRecaptchaToken();
    if (!recaptchaToken) {
      toast.error("Please wait for reCAPTCHA to load or try again");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, recaptchaToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      window.localStorage.setItem("vectordocs_auth_token", data.token);
      window.localStorage.setItem("vectordocs_auth_user", JSON.stringify(data.user));
      window.localStorage.setItem("vectordocs_auth_menus", JSON.stringify(data.menus || []));
      window.localStorage.setItem("vectordocs_disabled_modules", JSON.stringify(data.disabledModules || []));
      window.localStorage.setItem("vectordocs_maintenance", JSON.stringify(data.maintenance || { enabled: false }));
      window.location.href = "/";
    } catch (error) {
      toast.error(error.message || "Could not login");
    } finally {
      setLoading(false);
    }
  }

  const field = "flex h-12 items-center gap-2.5 rounded-full border border-transparent bg-[#f4f4f2] px-4 transition focus-within:border-[#e2e2df] focus-within:bg-white focus-within:ring-[3px] focus-within:ring-black/[0.05]";

  return (
    // The page is exactly one screen tall: nothing scrolls unless the window is tiny.
    <main className="newq relative flex h-dvh overflow-hidden bg-[#f1f1ef] text-[#141414] lg:p-3">
      <Toaster position="top-center" />

      {/* Sign-in side */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-white px-6 py-5 sm:px-10 lg:rounded-[28px] lg:px-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(72,229,194,0.22),transparent_65%)] lg:hidden" />
        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={38} />
            <span className="force-bold small text-[18px] tracking-[-0.02em]">UIPL Docs</span>
          </div>
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-[#ececea] px-3.5 text-[12.5px] text-[#6b6b6b]" suppressHydrationWarning>
            <span className="h-1.5 w-1.5 rounded-full bg-[#2eb67d]" />
            {now
              ? `${now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
              : "Workspace online"}
          </span>
        </header>

        <div className={`relative flex flex-1 items-center justify-center py-8 [@media(max-height:720px)]:py-4`}>
          <form onSubmit={handleSubmit} className="auth-rise w-full max-w-[400px]">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#eef8cc] px-3 text-[12px] text-[#4d6b12]">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure team access
            </span>
            <h1 className={`mt-5 text-[38px] leading-[1.02] sm:text-[44px] tracking-[-0.035em] [@media(max-height:720px)]:mt-4 [@media(max-height:720px)]:text-[38px]`}>
              {now ? greetingFor(now) : "Welcome back"}.
              <span className="block text-[#9a9a98]">Sign in to continue.</span>
            </h1>
            <p className="mt-3 text-[14.5px] leading-6 text-[#6b6b6b]">
              Projects, people, reports and approvals for UIPL, in one place.
            </p>

            <div className={`mt-8 space-y-3.5 [@media(max-height:720px)]:mt-5`}>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-[#8a8a8a]">Username</span>
                <span className={field}>
                  <UserRound className="h-4 w-4 shrink-0 text-[#9a9a98]" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a8a8a5]"
                    autoComplete="username"
                    placeholder="Enter username"
                    required
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-[#8a8a8a]">Password</span>
                <span className={`${field} pr-1.5`}>
                  <KeyRound className="h-4 w-4 shrink-0 text-[#9a9a98]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a8a8a5]"
                    autoComplete="current-password"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="grid h-9 w-9 place-items-center rounded-full text-[#8a8a8a] hover:bg-black/[0.05]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
            </div>

            {/* reCAPTCHA v3 badge (invisible) */}
            <div className="g-recaptcha" data-sitekey={RECAPTCHA_SITE_KEY} data-size="invisible"></div>

            <button
              type="submit"
              disabled={loading || !recaptchaLoaded}
              className={`group mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#141414] text-[14.5px] text-white transition hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 [@media(max-height:720px)]:mt-5`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {!recaptchaLoaded ? "Loading..." : "Sign in"}
              {recaptchaLoaded && !loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
            {/* Google allows hiding the reCAPTCHA badge when this notice is shown (see .grecaptcha-badge in globals.css). */}
            <p className="mt-4 text-[11.5px] leading-5 text-[#a8a8a5]">
              Protected by reCAPTCHA; Google&apos;s{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline decoration-[#d6d6d3] underline-offset-2 hover:text-[#6b6b6b]">Privacy Policy</a> and{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline decoration-[#d6d6d3] underline-offset-2 hover:text-[#6b6b6b]">Terms</a> apply.
            </p>
          </form>
        </div>

        <footer className="relative flex items-center justify-between text-[12px] text-[#a8a8a5]">
          <span>Can&apos;t sign in? Ask HR.</span>
          <span>dashboard.nexarrow.eu</span>
        </footer>
      </section>

      {/* Picture side: what the workspace looks like on a normal day */}
      <aside className="relative ml-3 hidden w-[52%] max-w-[780px] overflow-hidden rounded-[28px] bg-[#0d0f12] text-white lg:flex" aria-hidden="true">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_12%_8%,rgba(72,229,194,0.30),transparent_62%),radial-gradient(50%_45%_at_92%_88%,rgba(124,92,255,0.36),transparent_62%),radial-gradient(38%_32%_at_90%_8%,rgba(255,138,76,0.20),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(70%_60%_at_50%_50%,black,transparent)]" />

        <div className="relative flex w-full flex-col p-10 [@media(max-height:760px)]:p-8">
          <span className="auth-rise inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/75">
            <span className="auth-pulse h-2 w-2 rounded-full bg-[#48e5c2]" /> Live across every site
          </span>
          <h2 className="auth-rise mt-5 max-w-[480px] text-[42px] leading-[1.02] tracking-[-0.035em] [@media(max-height:760px)]:text-[34px]" style={{ animationDelay: "80ms" }}>
            Every site, every report.
            <span className="block text-white/45">One calm workspace.</span>
          </h2>

          <div className="flex flex-1 items-center justify-center py-6">
            <div className="grid w-full max-w-[470px] grid-cols-2 gap-3">
              <Glass delay={160} float={0}>
                <div className="flex items-center justify-between text-[12px] text-white/60">
                  <span>Clocked in</span>
                  <CalendarCheck className="h-4 w-4 text-[#48e5c2]" />
                </div>
                <p className="mt-4 text-[30px] leading-none tracking-[-0.03em]">09:42</p>
                <p className="mt-1.5 text-[12px] text-white/50">Office · inside 120 m</p>
              </Glass>

              <Glass delay={240} float={1200}>
                <div className="flex items-center justify-between text-[12px] text-white/60">
                  <span>Manpower today</span>
                  <UsersRound className="h-4 w-4 text-[#b9a8ff]" />
                </div>
                <p className="mt-4 text-[30px] leading-none tracking-[-0.03em]">84<span className="text-white/40">/90</span></p>
                <div className="mt-3 flex h-7 items-end gap-1">
                  {MANPOWER_BARS.map((value, index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-[3px] ${index === MANPOWER_BARS.length - 1 ? "bg-[#b9a8ff]" : "bg-white/20"}`}
                      style={{ height: `${Math.round((value / 90) * 100)}%` }}
                    />
                  ))}
                </div>
              </Glass>

              <Glass className="col-span-2" delay={320} float={2400}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-white/60">Site reports (DMR)</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">12:00 cut-off</span>
                </div>
                <p className="mt-3 text-[26px] leading-none tracking-[-0.03em]">5 of 6 sites filled</p>
                <div className="mt-3.5 grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <span key={index} className={`h-2 rounded-full ${index < 5 ? "bg-[#48e5c2]" : "bg-[#ecb22e]"}`} />
                  ))}
                </div>
              </Glass>

              <Glass className="[@media(max-height:760px)]:hidden" delay={400} float={600}>
                <CheckCircle2 className="h-5 w-5 text-[#2eb67d]" />
                <p className="mt-3 text-[15px] leading-5">Payment request approved</p>
                <p className="mt-1 text-[12px] text-white/50">PRN · 2 min ago</p>
              </Glass>

              <Glass className="[@media(max-height:760px)]:hidden" delay={480} float={1800}>
                <BellRing className="h-5 w-5 text-[#ff9f6b]" />
                <p className="mt-3 text-[15px] leading-5">Daily report due 6:50 PM</p>
                <p className="mt-1 text-[12px] text-white/50">Reminder on Slack</p>
              </Glass>
            </div>
          </div>

          <div className="auth-rise flex flex-wrap gap-2 [@media(max-height:820px)]:hidden" style={{ animationDelay: "560ms" }}>
            {MODULES.map((name) => (
              <span key={name} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/65">{name}</span>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
