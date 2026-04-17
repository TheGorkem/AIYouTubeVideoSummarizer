"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Filter,
  FileText,
  Link2,
  Link2Off,
  RefreshCcw,
  Trash2,
  Youtube,
  Upload,
  LoaderCircle,
  ChevronDown,
  Search,
  RotateCcw,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ResultCard } from "@/components/result-card";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { HistoryItem, SummaryType } from "@/lib/types";
import { saveReopenHistoryRecord } from "@/lib/reopen-history";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FRONTEND_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export default function HistoryPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "youtube" | "upload">("all");
  const [resummaryTypeById, setResummaryTypeById] = useState<Record<number, SummaryType>>({});
  const [resummarizingId, setResummarizingId] = useState<number | null>(null);
  const [shareCopiedId, setShareCopiedId] = useState<number | null>(null);
  const limit = 20;

  const fetchHistory = useCallback(
    async (currentOffset: number) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(limit), offset: String(currentOffset) });
        if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
        if (sourceFilter !== "all") params.set("source_kind", sourceFilter);
        const res = await fetch(
          `${API_URL}/api/v1/history?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? "Gecmis yuklenemedi.");
        }
        const data = await res.json();
        setItems((prev) => currentOffset === 0 ? data.items : [...prev, ...data.items]);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata olustu.");
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch, sourceFilter, token],
  );

  useEffect(() => {
    if (authLoading) return;
    setOffset(0);
    setExpandedId(null);
    if (token) { setItems([]); fetchHistory(0); } else setLoading(false);
  }, [token, authLoading, fetchHistory, appliedSearch, sourceFilter]);

  async function handleDelete(id: number) {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/history/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error("Silinemedi.");
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi.");
    }
  }

  async function handleShare(id: number) {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/history/${id}/share`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Paylasim olusturulamadi.");
      const data = await res.json();
      const shareUrl = `${FRONTEND_URL}/shared/${data.share_token}`;
      await navigator.clipboard.writeText(shareUrl);

      setItems((prev) => prev.map((item) =>
        item.id === id ? { ...item, share_token: data.share_token } : item,
      ));
      setShareCopiedId(id);
      setTimeout(() => setShareCopiedId(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paylasim hatasi.");
    }
  }

  async function handleUnshare(id: number) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/v1/history/${id}/share`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.map((item) =>
        item.id === id ? { ...item, share_token: null } : item,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaldirma hatasi.");
    }
  }

  async function handleResummarize(id: number) {
    if (!token) return;
    const summaryType = resummaryTypeById[id] ?? "all";
    setResummarizingId(id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/history/${id}/resummarize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary_type: summaryType }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "Yeniden ozet olusturulamadi.");
      setAppliedSearch(""); setSearchInput(""); setSourceFilter("all");
      setExpandedId(data?.id ?? null);
      setOffset(0);
      await fetchHistory(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata olustu.");
    } finally {
      setResummarizingId(null);
    }
  }

  function handleOpenOnHome(item: HistoryItem) {
    saveReopenHistoryRecord({
      id: item.id, source_kind: item.source_kind, transcript_source: "history",
      language_hint: null, transcript: item.transcript,
      timestamped_transcript: item.timestamped_transcript, summaries: item.summaries,
    });
  }

  function handleLoadMore() { const n = offset + limit; setOffset(n); fetchHistory(n); }

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setAppliedSearch(searchInput); }

  function clearFilters() {
    const alreadyClear = !searchInput && !appliedSearch && sourceFilter === "all";
    setSearchInput(""); setAppliedSearch(""); setSourceFilter("all");
    if (alreadyClear && token) { setOffset(0); setExpandedId(null); setItems([]); fetchHistory(0); }
  }

  if (!authLoading && !user) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8 lg:px-10">
        <FileText className="mb-4 h-12 w-12 text-ink/20 dark:text-gray-600" />
        <h1 className="mb-2 text-2xl font-semibold dark:text-white">Gecmis</h1>
        <p className="mb-6 text-ink/60 dark:text-gray-400">Gecmisi goruntulemek icin giris yapmaniz gerekiyor.</p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90 dark:bg-white dark:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Ana Sayfaya Don
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold dark:text-white">Gecmis</h1>
          <p className="mt-1 text-sm text-ink/60 dark:text-gray-400">{total} kayit bulundu</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <ArrowLeft className="h-4 w-4" />Geri Don
        </Link>
      </div>

      {error && <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      {/* Search & Filter */}
      <form onSubmit={handleFilterSubmit} className="mb-6 rounded-[1.5rem] border border-ink/10 bg-white/90 p-4 shadow-soft backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35 dark:text-gray-500" />
            <input className="w-full rounded-2xl border border-ink/10 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500" placeholder="Ara..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </label>
          <label className="relative sm:w-44">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35 dark:text-gray-500" />
            <select className="w-full appearance-none rounded-2xl border border-ink/10 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as "all" | "youtube" | "upload")}>
              <option value="all">Tumu</option>
              <option value="youtube">YouTube</option>
              <option value="upload">Dosya</option>
            </select>
          </label>
          <button type="submit" className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink/90 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">Filtrele</button>
          <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
            <RotateCcw className="h-4 w-4" />Temizle
          </button>
        </div>
      </form>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20"><LoaderCircle className="h-8 w-8 animate-spin text-ink/30 dark:text-gray-600" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="mb-4 h-12 w-12 text-ink/20 dark:text-gray-600" />
          <p className="text-ink/60 dark:text-gray-400">Henuz gecmis kaydiniz yok.</p>
          <p className="mt-1 text-sm text-ink/40 dark:text-gray-500">Bir video islediginizde burada gorunecek.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="rounded-[1.5rem] border border-ink/10 bg-white/90 shadow-soft backdrop-blur transition dark:border-gray-700 dark:bg-gray-800/90">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4 sm:px-6">
                  <div className="rounded-xl bg-ink/5 p-2 sm:p-2.5 dark:bg-gray-700">
                    {item.source_kind === "youtube" ? <Youtube className="h-4 w-4 sm:h-5 sm:w-5 text-coral" /> : <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-ocean" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium dark:text-white">{item.youtube_url ?? item.filename ?? "Yuklenen dosya"}</p>
                    <p className="mt-0.5 text-xs text-ink/50 dark:text-gray-500">{new Date(item.created_at + "Z").toLocaleString("tr-TR")} · {item.transcript.length.toLocaleString("tr-TR")} karakter</p>
                  </div>
                  {item.share_token && <Link2 className="h-4 w-4 text-ocean" />}
                  <ChevronDown className={`h-5 w-5 text-ink/30 transition dark:text-gray-500 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-ink/5 px-4 py-5 sm:px-6 dark:border-gray-700">
                    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                      <select className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200" value={resummaryTypeById[item.id] ?? "all"} onChange={(e) => setResummaryTypeById((p) => ({ ...p, [item.id]: e.target.value as SummaryType }))}>
                        <option value="all">Tum ozetler</option>
                        <option value="short">Kisa</option>
                        <option value="long">Uzun</option>
                        <option value="bullet_points">Bullet</option>
                        <option value="main_idea">Ana fikir</option>
                      </select>
                      <Link href="/" onClick={() => handleOpenOnHome(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                        <ArrowLeft className="h-3.5 w-3.5" />Ana Sayfa
                      </Link>
                      <button type="button" onClick={() => handleResummarize(item.id)} disabled={resummarizingId === item.id} className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                        {resummarizingId === item.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}Yeniden
                      </button>

                      {/* Share */}
                      {item.share_token ? (
                        <>
                          <button type="button" onClick={async () => { await navigator.clipboard.writeText(`${FRONTEND_URL}/shared/${item.share_token}`); setShareCopiedId(item.id); setTimeout(() => setShareCopiedId(null), 3000); }} className="inline-flex items-center gap-1.5 rounded-xl bg-ocean/10 px-3 py-2 text-xs font-medium text-ocean transition hover:bg-ocean/20 dark:bg-ocean/20">
                            {shareCopiedId === item.id ? <><Check className="h-3.5 w-3.5" />Kopyalandi</> : <><Copy className="h-3.5 w-3.5" />Link</>}
                          </button>
                          <button type="button" onClick={() => handleUnshare(item.id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-ink/50 transition hover:bg-ink/5 dark:text-gray-400 dark:hover:bg-gray-700">
                            <Link2Off className="h-3.5 w-3.5" />Kaldir
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => handleShare(item.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                          {shareCopiedId === item.id ? <><Check className="h-3.5 w-3.5 text-emerald-600" />Kopyalandi</> : <><Link2 className="h-3.5 w-3.5" />Paylas</>}
                        </button>
                      )}

                      <button type="button" onClick={() => handleDelete(item.id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="h-3.5 w-3.5" />Sil
                      </button>
                    </div>

                    <div className="space-y-4">
                      <TranscriptViewer title="Transcript" content={item.transcript} accent="ocean" />
                      {item.timestamped_transcript && <TranscriptViewer title="Zamanli Transcript" content={item.timestamped_transcript} accent="ocean" />}
                      <div className="grid gap-4 md:grid-cols-2">
                        {item.summaries.short && <ResultCard title="Kisa Ozet" content={item.summaries.short} />}
                        {item.summaries.main_idea && <ResultCard title="Ana Fikir" content={item.summaries.main_idea} accent="ocean" />}
                        {item.summaries.long && <ResultCard title="Uzun Ozet" content={item.summaries.long} />}
                        {item.summaries.bullet_points && <ResultCard title="Bullet Points" content={item.summaries.bullet_points} accent="ocean" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {items.length < total && (
            <div className="flex justify-center pt-4">
              <button type="button" onClick={handleLoadMore} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-ink/5 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}Daha Fazla
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
