"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      onClose();
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-8 shadow-soft dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-1.5 text-ink/40 transition hover:bg-ink/5 hover:text-ink dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex gap-1 rounded-2xl bg-ink/5 p-1 dark:bg-gray-700">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "login"
                ? "bg-white text-ink shadow-sm dark:bg-gray-600 dark:text-white"
                : "text-ink/50 hover:text-ink dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Giris Yap
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "register"
                ? "bg-white text-ink shadow-sm dark:bg-gray-600 dark:text-white"
                : "text-ink/50 hover:text-ink dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Kayit Ol
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium dark:text-gray-200">Isim</span>
              <input
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                placeholder="Ad Soyad"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium dark:text-gray-200">Email</span>
            <input
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              type="email"
              required
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium dark:text-gray-200">Sifre</span>
            <input
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              type="password"
              required
              minLength={6}
              placeholder="En az 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {tab === "login" ? "Giris yapiliyor..." : "Kayit olunuyor..."}
              </>
            ) : tab === "login" ? "Giris Yap" : "Kayit Ol"}
          </button>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
