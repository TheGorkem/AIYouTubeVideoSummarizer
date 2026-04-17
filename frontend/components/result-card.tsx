"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ResultCardProps = {
  title: string;
  content: string;
  accent?: "coral" | "ocean";
};

export function ResultCard({
  title,
  content,
  accent = "coral",
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section
      className={clsx(
        "rounded-3xl border bg-white/90 p-6 shadow-soft backdrop-blur transition-colors dark:bg-gray-800/90",
        accent === "coral"
          ? "border-coral/20 dark:border-coral/30"
          : "border-ocean/20 dark:border-ocean/30",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
            copied
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-ink/5 text-ink/60 hover:bg-ink/10 hover:text-ink dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
          )}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" />Kopyalandi</>
          ) : (
            <><Copy className="h-3.5 w-3.5" />Kopyala</>
          )}
        </button>
      </div>
      <div className="prose prose-sm max-w-none leading-7 text-ink/80 dark:text-gray-300 dark:prose-invert prose-headings:text-ink dark:prose-headings:text-white prose-strong:text-ink dark:prose-strong:text-white prose-code:rounded prose-code:bg-ink/5 prose-code:px-1.5 prose-code:py-0.5 dark:prose-code:bg-gray-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  );
}
