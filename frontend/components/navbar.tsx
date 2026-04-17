"use client";

import { useState } from "react";
import Link from "next/link";
import { History, LogOut, Menu, Moon, Sparkles, Sun, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

type NavbarProps = {
  onLoginClick: () => void;
};

export function Navbar({ onLoginClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-sand/80 backdrop-blur-lg dark:border-gray-700 dark:bg-gray-900/80">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-white">
          <Sparkles className="h-5 w-5 text-coral" />
          AI Video Summarizer
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-ink/50 transition hover:bg-ink/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Dark mode toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <>
              <Link
                href="/history"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <History className="h-4 w-4" />
                Gecmis
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-ocean/10 px-3 py-2 text-sm font-medium text-ocean dark:bg-ocean/20">
                <User className="h-4 w-4" />
                {user.display_name || user.email.split("@")[0]}
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/50 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Cikis
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              <User className="h-4 w-4" />
              Giris Yap
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-ink/50 transition hover:bg-ink/5 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl p-2 text-ink/60 transition hover:bg-ink/5 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-ink/5 bg-white px-5 py-4 md:hidden dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-ocean/10 px-3 py-2 text-sm font-medium text-ocean dark:bg-ocean/20">
                  <User className="h-4 w-4" />
                  {user.display_name || user.email.split("@")[0]}
                </div>
                <Link
                  href="/history"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <History className="h-4 w-4" />
                  Gecmis
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  Cikis
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { onLoginClick(); setMobileOpen(false); }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink/90 dark:bg-white dark:text-gray-900"
              >
                <User className="h-4 w-4" />
                Giris Yap
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
