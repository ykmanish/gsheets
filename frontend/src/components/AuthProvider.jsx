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
const AUTH_MAINTENANCE_KEY = "vectordocs_maintenance";

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

// Every page mounts its own ProtectedModule, so the session check, notification
// badge, Loop unread badge and sidebar indicators all refetch on each navigation,
// often several at once. Background reads go through here instead: one request in
// flight per URL, and a recent successful answer is reused for `maxAgeMs`.
// Entries are keyed by the session token so a different login never sees them.
const sharedJsonRequests = new Map();

export function fetchJsonShared(url, { maxAgeMs = 0, force = false } = {}) {
  const token = typeof window === "undefined" ? "" : window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
  const key = `${token}\n${url}`;
  const entry = sharedJsonRequests.get(key);
  if (entry?.promise && !force) return entry.promise;
  if (entry?.result && !force && Date.now() - entry.at < maxAgeMs) return Promise.resolve(entry.result);
  const promise = fetch(url)
    .then(async (response) => ({ ok: response.ok, status: response.status, data: await response.json().catch(() => null) }))
    .then(
      (result) => {
        if (result.ok) sharedJsonRequests.set(key, { result, at: Date.now() });
        else sharedJsonRequests.delete(key);
        return result;
      },
      (error) => {
        sharedJsonRequests.delete(key);
        throw error;
      },
    );
  sharedJsonRequests.set(key, { ...entry, promise });
  return promise;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// State updater that keeps the current object when the server's answer is
// unchanged, so a routine session refresh doesn't hand every consumer a new
// user/menus identity and make their effects refetch.
const keepIfSame = (next) => (current) => (sameJson(current, next) ? current : next);

const AuthContext = createContext(null);

export function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, user: null, menus: [], disabledModules: [], maintenance: { enabled: false } };
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const user = JSON.parse(window.localStorage.getItem(AUTH_USER_KEY) || "null");
  const menus = JSON.parse(window.localStorage.getItem(AUTH_MENUS_KEY) || "[]");
  const disabledModules = JSON.parse(window.localStorage.getItem(AUTH_DISABLED_MODULES_KEY) || "[]");
  const maintenance = JSON.parse(window.localStorage.getItem(AUTH_MAINTENANCE_KEY) || "{\"enabled\":false}");
  return { token, user, menus, disabledModules, maintenance };
}

function saveAuth(token, user, menus, disabledModules = [], maintenance = { enabled: false }) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_MENUS_KEY, JSON.stringify(menus || []));
  window.localStorage.setItem(AUTH_DISABLED_MODULES_KEY, JSON.stringify(disabledModules || []));
  window.localStorage.setItem(AUTH_MAINTENANCE_KEY, JSON.stringify(maintenance || { enabled: false }));
}

function clearAuth() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(AUTH_MENUS_KEY);
  window.localStorage.removeItem(AUTH_DISABLED_MODULES_KEY);
  window.localStorage.removeItem(AUTH_MAINTENANCE_KEY);
}

function isAuthFailure(status) {
  return status === 401 || status === 403;
}

export function AuthProvider({ children }) {
  const stored = getStoredAuth();
  const [token, setToken] = useState(stored.token);
  const [user, setUser] = useState(stored.user);
  const [menus, setMenus] = useState(stored.menus);
  const [disabledModules, setDisabledModules] = useState(stored.disabledModules);
  const [maintenance, setMaintenance] = useState(stored.maintenance || { enabled: false });
  const [loading, setLoading] = useState(Boolean(stored.token));

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { ok, status, data } = await fetchJsonShared(`${API_URL}/auth/me`, { maxAgeMs: 30000 });
        if (!ok) {
          if (isAuthFailure(status)) throw new Error("Session expired");
          return;
        }
        if (ignore || !data) return;
        saveAuth(token, data.user, data.menus, data.disabledModules, data.maintenance);
        setUser(keepIfSame(data.user));
        setMenus(keepIfSame(data.menus || []));
        setDisabledModules(keepIfSame(data.disabledModules || []));
        setMaintenance(keepIfSame(data.maintenance || { enabled: false }));
      } catch (error) {
        if (ignore) return;
        if (!(error instanceof TypeError) && error.message !== "Session expired") return;
        clearAuth();
        setToken(null);
        setUser(null);
        setMenus([]);
        setDisabledModules([]);
        setMaintenance({ enabled: false });
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadSession();
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSession();
    }, 60000);
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
    saveAuth(data.token, data.user, data.menus, data.disabledModules, data.maintenance);
    setToken(data.token);
    setUser(data.user);
    setMenus(data.menus || []);
    setDisabledModules(data.disabledModules || []);
    setMaintenance(data.maintenance || { enabled: false });
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
    setMaintenance({ enabled: false });
    window.location.href = "/login";
  }

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const { ok, data } = await fetchJsonShared(`${API_URL}/auth/me`, { force: true });
    if (!ok || !data) throw new Error("Could not refresh session");
    saveAuth(token, data.user, data.menus, data.disabledModules, data.maintenance);
    setUser(keepIfSame(data.user));
    setMenus(keepIfSame(data.menus || []));
    setDisabledModules(keepIfSame(data.disabledModules || []));
    setMaintenance(keepIfSame(data.maintenance || { enabled: false }));
  }, [token]);

  const value = useMemo(
    () => ({ token, user, menus, disabledModules, maintenance, loading, login, logout, refreshUser }),
    [token, user, menus, disabledModules, maintenance, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
