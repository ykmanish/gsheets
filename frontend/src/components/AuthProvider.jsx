"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === "development"
    ? "http://localhost:5000/api"
    : "https://dashboard.nexarrow.eu/api"
);
const AUTH_TOKEN_KEY = "vectordocs_auth_token";
const AUTH_USER_KEY = "vectordocs_auth_user";
const AUTH_MENUS_KEY = "vectordocs_auth_menus";
const AUTH_DISABLED_MODULES_KEY = "vectordocs_disabled_modules";

if (typeof window !== "undefined" && !window.__vectordocsFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url;
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const shouldAttachAuth = token && url && (url.startsWith(API_URL) || url.startsWith("/api/"));

    if (!shouldAttachAuth) return originalFetch(input, init);

    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
  };
  window.__vectordocsFetchPatched = true;
}

const AuthContext = createContext(null);

export function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, user: null, menus: [], disabledModules: [] };
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const user = JSON.parse(window.localStorage.getItem(AUTH_USER_KEY) || "null");
  const menus = JSON.parse(window.localStorage.getItem(AUTH_MENUS_KEY) || "[]");
  const disabledModules = JSON.parse(window.localStorage.getItem(AUTH_DISABLED_MODULES_KEY) || "[]");
  return { token, user, menus, disabledModules };
}

function saveAuth(token, user, menus, disabledModules = []) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_MENUS_KEY, JSON.stringify(menus || []));
  window.localStorage.setItem(AUTH_DISABLED_MODULES_KEY, JSON.stringify(disabledModules || []));
}

function clearAuth() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(AUTH_MENUS_KEY);
  window.localStorage.removeItem(AUTH_DISABLED_MODULES_KEY);
}

export function AuthProvider({ children }) {
  const stored = getStoredAuth();
  const [token, setToken] = useState(stored.token);
  const [user, setUser] = useState(stored.user);
  const [menus, setMenus] = useState(stored.menus);
  const [disabledModules, setDisabledModules] = useState(stored.disabledModules);
  const [loading, setLoading] = useState(Boolean(stored.token));

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`);
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        if (ignore) return;
        saveAuth(token, data.user, data.menus, data.disabledModules);
        setUser(data.user);
        setMenus(data.menus || []);
        setDisabledModules(data.disabledModules || []);
      } catch {
        if (ignore) return;
        clearAuth();
        setToken(null);
        setUser(null);
        setMenus([]);
        setDisabledModules([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadSession();
    const refreshInterval = window.setInterval(loadSession, 60000);
    window.addEventListener("focus", loadSession);
    return () => {
      ignore = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", loadSession);
    };
  }, [token]);

  async function login(username, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");
    saveAuth(data.token, data.user, data.menus, data.disabledModules);
    setToken(data.token);
    setUser(data.user);
    setMenus(data.menus || []);
    setDisabledModules(data.disabledModules || []);
    return data;
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: "POST" });
    } catch {
      // Local cleanup still logs out even if the server is unreachable.
    }
    clearAuth();
    setToken(null);
    setUser(null);
    setMenus([]);
    setDisabledModules([]);
    window.location.href = "/login";
  }

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${API_URL}/auth/me`);
    if (!response.ok) throw new Error("Could not refresh session");
    const data = await response.json();
    saveAuth(token, data.user, data.menus, data.disabledModules);
    setUser(data.user);
    setMenus(data.menus || []);
    setDisabledModules(data.disabledModules || []);
  }, [token]);

  const value = useMemo(
    () => ({ token, user, menus, disabledModules, loading, login, logout, refreshUser }),
    [token, user, menus, disabledModules, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
