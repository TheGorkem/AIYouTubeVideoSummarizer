"use client";

import { FormEvent, useState } from "react";
import { FileAudio, LoaderCircle, Sparkles, Youtube } from "lucide-react";

import { ResultCard } from "@/components/result-card";
import { ProcessResponse, SummaryType } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const summaryOptions: { value: SummaryType; label: string }[] = [
  { value: "all", label: "Tum ciktilar" },
  { value: "short", label: "Kisa ozet" },
  { value: "long", label: "Uzun ozet" },
  { value: "bullet_points", label: "Bullet point" },
  { value: "main_idea", label: "Ana fikir" },
];
const MAX_UPLOAD_SIZE_MB = 12;

export function SummarizerForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);

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
      setError(
        `Dosya cok buyuk. En fazla ${MAX_UPLOAD_SIZE_MB} MB yukleyebilirsin.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("summary_type", summaryType);

    if (trimmedUrl) {
      formData.append("youtube_url", trimmedUrl);
    }

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/process`, {
        method: "POST",
        body: formData,
      });

      const rawBody = await response.text();
      const payload = rawBody ? safeJsonParse(rawBody) : null;
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Islem sirasinda bir hata olustu.");
      }
      if (!payload) {
        throw new Error("Sunucu bos veya gecersiz bir yanit dondurdu.");
      }

      setResult(payload as ProcessResponse);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Backend'e baglanilamadi. Backend calisiyor mu ve NEXT_PUBLIC_API_URL dogru mu kontrol et."
          : requestError instanceof Error
            ? requestError.message
            : "Beklenmeyen bir hata olustu.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-coral/10 p-3 text-coral">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Video to Summary</h2>
            <p className="text-sm text-ink/70">
              YouTube linki ver veya ses/video kaydini dosya olarak yukle.
            </p>
            <p className="mt-1 text-xs text-ink/55">
              Yukleme limiti: en fazla {MAX_UPLOAD_SIZE_MB} MB.
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Youtube className="h-4 w-4 text-coral" />
              YouTube URL
            </span>
            <input
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(event) => {
                setYoutubeUrl(event.target.value);
                if (event.target.value.trim()) {
                  setSelectedFile(null);
                }
              }}
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileAudio className="h-4 w-4 text-ocean" />
              Ses veya video dosyasi
            </span>
            <input
              className="block w-full rounded-2xl border border-dashed border-ink/20 bg-white px-4 py-3 text-sm"
              type="file"
              accept="audio/*,video/*"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setSelectedFile(nextFile);
                if (nextFile) {
                  setYoutubeUrl("");
                }
              }}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Ozet tipi</span>
            <select
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-coral"
              value={summaryType}
              onChange={(event) => setSummaryType(event.target.value as SummaryType)}
            >
              {summaryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Transcript ve ozet hazirlaniyor
              </>
            ) : (
              "Islemi baslat"
            )}
          </button>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-white shadow-soft">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-wheat">
          Neden bu kapsam?
        </p>
        <h3 className="mb-4 text-3xl font-semibold leading-tight">
          En mantikli MVP: YouTube + dosya yukleme
        </h3>
        <div className="space-y-3 text-sm leading-7 text-white/75">
          <p>
            Herkese acik YouTube videolari icin hazir transcript varsa hizli sekilde cekilir.
          </p>
          <p>
            Zoom ve Google Meet kayitlari link yerine dosya yukleme ile desteklenir;
            bu akista erisim problemi ve kimlik dogrulama riski azalir.
          </p>
          <p>
            Transcript olustuktan sonra kisa ozet, uzun ozet, bullet point ve ana fikir
            tek endpoint uzerinden uretilir.
          </p>
        </div>
      </section>

      {result ? (
        <div className="lg:col-span-2 space-y-6">
          <ResultCard
            title="Transcript"
            content={result.transcript}
            accent="ocean"
          />

          <div className="grid gap-6 md:grid-cols-2">
            {result.summaries.short ? (
              <ResultCard title="Kisa Ozet" content={result.summaries.short} />
            ) : null}
            {result.summaries.main_idea ? (
              <ResultCard
                title="Ana Fikir"
                content={result.summaries.main_idea}
                accent="ocean"
              />
            ) : null}
            {result.summaries.long ? (
              <ResultCard title="Uzun Ozet" content={result.summaries.long} />
            ) : null}
            {result.summaries.bullet_points ? (
              <ResultCard
                title="Bullet Point Summary"
                content={result.summaries.bullet_points}
                accent="ocean"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function safeJsonParse(rawBody: string) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
