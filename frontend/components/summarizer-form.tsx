"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileAudio,
  Globe,
  LoaderCircle,
  Sparkles,
  Youtube,
} from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { ExportButtons } from "@/components/export-buttons";
import { useAuth } from "@/lib/auth-context";
import { consumeReopenHistoryRecord } from "@/lib/reopen-history";
import type { ProcessResponse, SSEEvent, SummaryLanguage, SummaryType } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const summaryOptions: { value: SummaryType; label: string }[] = [
  { value: "all", label: "Tum ciktilar" },
  { value: "short", label: "Kisa ozet" },
  { value: "long", label: "Uzun ozet" },
  { value: "bullet_points", label: "Bullet point" },
  { value: "main_idea", label: "Ana fikir" },
];

const languageOptions: { value: SummaryLanguage; label: string }[] = [
  { value: "tr", label: "Turkce" },
  { value: "en", label: "English" },
];

const MAX_UPLOAD_SIZE_MB = 12;

function extractYoutubeVideoId(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    if (host === "youtu.be") return parsed.pathname.slice(1);
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) return parts[1];
    }
  } catch { /* not a valid URL */ }
  return "";
}

export function SummarizerForm() {
  const { token, anonymousSessionId } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>("all");
  const [summaryLanguage, setSummaryLanguage] = useState<SummaryLanguage>("tr");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);

  // SSE progress
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");

  // YouTube preview
  const videoId = useMemo(() => extractYoutubeVideoId(youtubeUrl.trim()), [youtubeUrl]);

  useEffect(() => {
    const reopened = consumeReopenHistoryRecord();
    if (!reopened) return;
    setResult({
      id: reopened.id,
      source_kind: reopened.source_kind as "youtube" | "upload",
      transcript_source: reopened.transcript_source,
      language_hint: reopened.language_hint,
      transcript: reopened.transcript,
      timestamped_transcript: reopened.timestamped_transcript,
      summaries: reopened.summaries,
      summary_language: "tr",
    });
    setShowTimestamps(false);
    setError(null);
    setYoutubeUrl("");
    setSelectedFile(null);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = youtubeUrl.trim();

    if (!trimmedUrl && !selectedFile) {
      setError("Bir YouTube linki gir veya bir dosya yukle.");
      return;
    }
    if (trimmedUrl && selectedFile) {
      setError("Ayni anda tek bir kaynak kullanabilirsin: link veya dosya.");
      return;
    }
    if (selectedFile && selectedFile.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      setError(`Dosya cok buyuk. En fazla ${MAX_UPLOAD_SIZE_MB} MB yukleyebilirsin.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgressStep("");
    setProgressMessage("");

    const formData = new FormData();
    formData.append("summary_type", summaryType);
    formData.append("summary_language", summaryLanguage);
    if (trimmedUrl) formData.append("youtube_url", trimmedUrl);
    if (selectedFile) formData.append("file", selectedFile);

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (anonymousSessionId) headers["X-Anonymous-Session"] = anonymousSessionId;

    try {
      const response = await fetch(`${API_URL}/api/v1/process/stream`, {
        method: "POST",
        body: formData,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const parsed = safeJsonParse(errorBody);
        throw new Error(parsed?.detail ?? "Islem sirasinda bir hata olustu.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming desteklenmiyor.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const eventData = safeJsonParse(line.slice(6)) as SSEEvent | null;
          if (!eventData) continue;

          setProgressStep(eventData.step);
          setProgressMessage(eventData.message);

          if (eventData.step === "error") {
            throw new Error(eventData.message);
          }

          if (eventData.step === "done" && eventData.payload) {
            const p = eventData.payload;
            setResult({
              id: (p.id as number) ?? null,
              source_kind: p.source_kind as "youtube" | "upload",
              transcript_source: (p.transcript_source as string) ?? "",
              language_hint: (p.language_hint as string | null) ?? null,
              transcript: (p.transcript as string) ?? "",
              timestamped_transcript: (p.timestamped_transcript as string | null) ?? null,
              summaries: p.summaries as ProcessResponse["summaries"],
              summary_language: (p.summary_language as string) ?? summaryLanguage,
            });
          }
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Backend'e baglanilamadi. Backend calisiyor mu kontrol et."
          : requestError instanceof Error
            ? requestError.message
            : "Beklenmeyen bir hata olustu.",
      );
    } finally {
      setLoading(false);
      setProgressStep("");
      setProgressMessage("");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-gray-700 dark:bg-gray-800/80">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-coral/10 p-3 text-coral">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold dark:text-white">Video to Summary</h2>
            <p className="text-sm text-ink/70 dark:text-gray-400">
              YouTube linki ver veya ses/video kaydini dosya olarak yukle.
            </p>
            <p className="mt-1 text-xs text-ink/55 dark:text-gray-500">
              Yukleme limiti: en fazla {MAX_UPLOAD_SIZE_MB} MB.
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* YouTube URL */}
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium dark:text-gray-200">
              <Youtube className="h-4 w-4 text-coral" />
              YouTube URL
            </span>
            <input
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                if (e.target.value.trim()) setSelectedFile(null);
              }}
            />
          </label>

          {/* YouTube Preview */}
          {videoId && (
            <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/5 p-3 dark:border-gray-600 dark:bg-gray-700">
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                className="h-16 w-28 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium dark:text-white">Video Onizleme</p>
                <p className="truncate text-xs text-ink/50 dark:text-gray-400">ID: {videoId}</p>
              </div>
            </div>
          )}

          {/* File upload */}
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium dark:text-gray-200">
              <FileAudio className="h-4 w-4 text-ocean" />
              Ses veya video dosyasi
            </span>
            <input
              className="block w-full rounded-2xl border border-dashed border-ink/20 bg-white px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSelectedFile(f);
                if (f) setYoutubeUrl("");
              }}
            />
          </label>

          {/* Summary type & language */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium dark:text-gray-200">Ozet tipi</span>
              <select
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={summaryType}
                onChange={(e) => setSummaryType(e.target.value as SummaryType)}
              >
                {summaryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium dark:text-gray-200">
                <Globe className="h-4 w-4 text-ocean" />
                Ozet dili
              </span>
              <select
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={summaryLanguage}
                onChange={(e) => setSummaryLanguage(e.target.value as SummaryLanguage)}
              >
                {languageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {progressMessage || "Islem hazirlaniyor..."}
              </>
            ) : (
              "Islemi baslat"
            )}
          </button>

          {/* SSE Progress Steps */}
          {loading && progressStep && (
            <div className="rounded-2xl border border-ocean/20 bg-ocean/5 px-4 py-3 dark:border-ocean/30 dark:bg-ocean/10">
              <div className="flex items-center gap-2 text-sm text-ocean">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {progressMessage}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      </section>


      {/* Results */}
      {result && (
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ExportButtons result={result} />
            {result.timestamped_transcript && (
              <button
                type="button"
                onClick={() => setShowTimestamps(!showTimestamps)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${showTimestamps
                  ? "border-ocean/30 bg-ocean/10 text-ocean dark:border-ocean/40 dark:bg-ocean/20"
                  : "border-ink/10 bg-white text-ink/60 hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
              >
                <Clock className="h-4 w-4" />
                {showTimestamps ? "Normal Transcript" : "Zamanli Transcript"}
              </button>
            )}
          </div>

          <TranscriptViewer
            title={showTimestamps ? "Zamanli Transcript" : "Transcript"}
            content={
              showTimestamps && result.timestamped_transcript
                ? result.timestamped_transcript
                : result.transcript
            }
            accent="ocean"
          />

          <div className="grid gap-6 md:grid-cols-2">
            {result.summaries.short && <ResultCard title="Kisa Ozet" content={result.summaries.short} />}
            {result.summaries.main_idea && <ResultCard title="Ana Fikir" content={result.summaries.main_idea} accent="ocean" />}
            {result.summaries.long && <ResultCard title="Uzun Ozet" content={result.summaries.long} />}
            {result.summaries.bullet_points && <ResultCard title="Bullet Point Summary" content={result.summaries.bullet_points} accent="ocean" />}
          </div>
        </div>
      )}
    </div>
  );
}

function safeJsonParse(rawBody: string) {
  try { return JSON.parse(rawBody); } catch { return null; }
}
