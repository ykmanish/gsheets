"use client";

import { useEffect, useRef, useState } from "react";
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
      window.location.href = "/";
    } catch (error) {
      toast.error(error.message || "Could not login");
    } finally {
      setLoading(false);
    }
  }
  
  const backgroundImage= {
    backgroundImage: "url('https://assets.lummi.ai/assets/QmWyKXxWZdtwBj9REXhGRG17Py5pvn34iuCnSjbiVX1Rz1?auto=format&w=1500')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",

  }

  return (
    <main 
    style={backgroundImage}
    className="min-h-dvh bg-[#f6f6f4] flex items-center justify-center px-4 py-6 sm:px-5">
      <Toaster position="top-center" />
      <form onSubmit={handleSubmit} className="w-full max-w-[430px] bg-white border border-black/5 rounded-[24px] p-5 -sm sm:rounded-[28px] sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-black/35 mb-2">Secure Access</p>
        <h1 className="text-2xl font-semibold text-black small leading-tight sm:text-3xl">Login to UIPL Docs</h1>
        <p className="text-sm text-black/45 mt-3">
          Log in to access your UIPL Docs dashboard.
        </p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-black/40">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border-black/10 bg-black/[0.02] px-4 py-3 text-black outline-none focus:border-black"
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-black/40">Password</span>
            <div className="mt-2 flex items-center rounded-2xl bg-black/[0.02] pr-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-black outline-none"
                autoComplete="current-password"
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
          className="mt-7 w-full rounded-2xl bg-[#000000] text-white py-3.5 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {!recaptchaLoaded ? "Loading..." : "Login"}
        </button>
      </form>
    </main>
  );
}