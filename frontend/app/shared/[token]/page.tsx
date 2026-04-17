"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Share2, Sparkles } from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { TranscriptViewer } from "@/components/transcript-viewer";
import type { HistoryItem } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [item, setItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shared/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? "Paylasim bulunamadi.");
        }
        return res.json();
      })
      .then((data) => setItem(data as HistoryItem))
      .catch((err) => setError(err instanceof Error ? err.message : "Bir hata olustu."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-ink/30 dark:text-gray-600" />
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-5 py-20 text-center">
        <Share2 className="mb-4 h-12 w-12 text-ink/20 dark:text-gray-600" />
        <h1 className="mb-2 text-2xl font-semibold dark:text-white">Paylasim Bulunamadi</h1>
        <p className="mb-6 text-ink/60 dark:text-gray-400">{error ?? "Bu paylasim linki gecersiz veya kaldirilmis."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90 dark:bg-white dark:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Ana Sayfaya Don
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-coral/10 p-3 text-coral">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold dark:text-white">Paylasilan Ozet</h1>
            <p className="text-sm text-ink/60 dark:text-gray-400">
              {item.youtube_url ?? item.filename ?? item.source_kind} ·{" "}
              {new Date(item.created_at + "Z").toLocaleString("tr-TR")}
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <Sparkles className="h-4 w-4 text-coral" />
          Kendi ozetini olustur
        </Link>
      </div>

      <div className="space-y-6">
        <TranscriptViewer title="Transcript" content={item.transcript} accent="ocean" />

        {item.timestamped_transcript && (
          <TranscriptViewer title="Zamanli Transcript" content={item.timestamped_transcript} accent="ocean" />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {item.summaries.short && <ResultCard title="Kisa Ozet" content={item.summaries.short} />}
          {item.summaries.main_idea && <ResultCard title="Ana Fikir" content={item.summaries.main_idea} accent="ocean" />}
          {item.summaries.long && <ResultCard title="Uzun Ozet" content={item.summaries.long} />}
          {item.summaries.bullet_points && <ResultCard title="Bullet Points" content={item.summaries.bullet_points} accent="ocean" />}
        </div>
      </div>
    </main>
  );
}
