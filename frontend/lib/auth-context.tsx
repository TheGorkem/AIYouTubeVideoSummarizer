"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthResponse, UserInfo } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "auth_token";
const ANONYMOUS_SESSION_KEY = "anonymous_session_id";

type AuthState = {
  user: UserInfo | null;
  token: string | null;
  anonymousSessionId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [anonymousSessionId, setAnonymousSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const anonymousId = getOrCreateAnonymousSessionId();
    setAnonymousSessionId(anonymousId);

    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data: UserInfo = await res.json();
          setUser(data);
          setToken(stored);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback(async (endpoint: string, body: object) => {
    const currentAnonymousSessionId = getOrCreateAnonymousSessionId();
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Anonymous-Session": currentAnonymousSessionId,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail ?? "Bir hata olustu.");
    }
    const auth = data as AuthResponse;
    localStorage.setItem(TOKEN_KEY, auth.token);
    setToken(auth.token);
    setUser(auth.user);

    const nextAnonymousId = createAnonymousSessionId();
    localStorage.setItem(ANONYMOUS_SESSION_KEY, nextAnonymousId);
    setAnonymousSessionId(nextAnonymousId);
  }, []);

  const login = useCallback(
    (email: string, password: string) =>
      handleAuth("/api/v1/auth/login", { email, password }),
    [handleAuth],
  );

  const register = useCallback(
    (email: string, password: string, displayName: string) =>
      handleAuth("/api/v1/auth/register", {
        email,
        password,
        display_name: displayName,
      }),
    [handleAuth],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      anonymousSessionId,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, anonymousSessionId, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function createAnonymousSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateAnonymousSessionId(): string {
  const existing = localStorage.getItem(ANONYMOUS_SESSION_KEY);
  if (existing) {
    return existing;
  }
  const next = createAnonymousSessionId();
  localStorage.setItem(ANONYMOUS_SESSION_KEY, next);
  return next;
}
