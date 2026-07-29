"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { API_URL, getStoredAuth } from "./AuthProvider";

// Official Google reCAPTCHA Test Key (always passes for local testing)
const RECAPTCHA_SITE_KEY = "6LdcwSctAAAAAAG-UP3Bt6SorvofMJWxqMxDDmnA";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

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
      window.location.href = "/";
    } catch (error) {
      toast.error(error.message || "Could not login");
    } finally {
      setLoading(false);
    }
  }
  
  const backgroundImage = {
    backgroundImage: "url('/tbgss.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  return (
    <main
      style={backgroundImage}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#111] px-4 py-6 sm:px-5"
    >
      <Toaster position="top-center" />
      <div className="absolute inset-0 bg-black/58" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05),rgba(0,0,0,0.42))]" />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[430px] rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:p-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.32em] text-black/35">Secure Access</p>
        <h1 className="small text-2xl font-semibold leading-tight text-black sm:text-3xl">Login to your account</h1>
        <p className="mt-3 text-sm leading-6 text-black/55">Enter your username and password to access UIPL Docs.</p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-black/40">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-14 w-full rounded-2xl border border-black/5 bg-[#f8f3f3] px-5 text-black outline-none transition focus:border-black/15 focus:bg-white focus:ring-4 focus:ring-black/[0.04]"
              autoComplete="username"
              placeholder="Enter username"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-black/40">Password</span>
            <div className="mt-2 flex h-14 items-center rounded-2xl border border-black/5 bg-[#f8f3f3] pr-2 transition focus-within:border-black/15 focus-within:bg-white focus-within:ring-4 focus-within:ring-black/[0.04]">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl bg-transparent px-5 text-black outline-none"
                autoComplete="current-password"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black/45 hover:bg-black/[0.04]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        </div>

        {/* reCAPTCHA v3 badge (invisible) */}
        <div className="g-recaptcha" data-sitekey={RECAPTCHA_SITE_KEY} data-size="invisible"></div>

        <button
          type="submit"
          disabled={loading || !recaptchaLoaded}
          className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-black font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:bg-black/85 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!recaptchaLoaded ? "Loading..." : "Login"}
        </button>
      </form>
    </main>
  );
}
