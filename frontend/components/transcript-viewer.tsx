"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Search, X } from "lucide-react";
import { clsx } from "clsx";

type TranscriptViewerProps = {
  title: string;
  content: string;
  accent?: "coral" | "ocean";
};

export function TranscriptViewer({
  title,
  content,
  accent = "ocean",
}: TranscriptViewerProps) {
  const [copied, setCopied] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);

  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const regex = new RegExp(escapeRegex(searchQuery), "gi");
    const matches = content.match(regex);
    return matches ? matches.length : 0;
  }, [content, searchQuery]);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function navigateMatch(direction: "next" | "prev") {
    if (matchCount === 0) return;
    if (direction === "next") {
      setCurrentMatch((prev) => (prev + 1) % matchCount);
    } else {
      setCurrentMatch((prev) => (prev - 1 + matchCount) % matchCount);
    }
  }

  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) return content;
    const regex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");
    return content.replace(regex, `<mark class="bg-yellow-300 dark:bg-yellow-500/50 rounded px-0.5">$1</mark>`);
  }, [content, searchQuery]);

  return (
    <section
      className={clsx(
        "rounded-3xl border bg-white/90 p-6 shadow-soft backdrop-blur dark:bg-gray-800/90 dark:border-gray-700",
        accent === "coral" ? "border-coral/20" : "border-ocean/20",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); setCurrentMatch(0); }}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
              searchOpen
                ? "bg-ocean/10 text-ocean dark:bg-ocean/20"
                : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Ara
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
              copied
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-ink/5 text-ink/60 hover:bg-ink/10 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
            )}
          >
            {copied ? <><Check className="h-3.5 w-3.5" />Kopyalandi</> : <><Copy className="h-3.5 w-3.5" />Kopyala</>}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
          <Search className="h-4 w-4 text-ink/40 dark:text-gray-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none dark:text-gray-200"
            placeholder="Transcript icinde ara..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatch(0); }}
            autoFocus
          />
          {matchCount > 0 && (
            <span className="text-xs text-ink/50 dark:text-gray-400">
              {currentMatch + 1}/{matchCount}
            </span>
          )}
          {matchCount > 1 && (
            <div className="flex gap-0.5">
              <button type="button" onClick={() => navigateMatch("prev")} className="rounded p-1 hover:bg-ink/5 dark:hover:bg-gray-600">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => navigateMatch("next")} className="rounded p-1 hover:bg-ink/5 dark:hover:bg-gray-600">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="rounded p-1 hover:bg-ink/5 dark:hover:bg-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-ink/80 dark:text-gray-300"
        dangerouslySetInnerHTML={
          searchQuery.trim()
            ? { __html: highlightedContent }
            : undefined
        }
      >
        {!searchQuery.trim() ? content : undefined}
      </div>
    </section>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
