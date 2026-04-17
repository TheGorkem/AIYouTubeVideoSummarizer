"use client";

import { Download } from "lucide-react";
import type { ProcessResponse } from "@/lib/types";

/** Transliterate Turkish special characters for jsPDF's default font. */
function transliterateTurkish(text: string): string {
  const map: Record<string, string> = {
    "ş": "s", "Ş": "S", "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G",
    "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ü": "u", "Ü": "U",
  };
  return text.replace(/[şŞçÇğĞıİöÖüÜ]/g, (ch) => map[ch] || ch);
}

function buildTextContent(result: ProcessResponse): string {
  const lines: string[] = [
    "=== AI Video Summarizer ===",
    `Kaynak: ${result.source_kind}`,
    `Tarih: ${new Date().toLocaleString("tr-TR")}`,
    "",
    "--- TRANSCRIPT ---",
    result.transcript,
  ];

  if (result.timestamped_transcript) {
    lines.push("", "--- ZAMANLI TRANSCRIPT ---", result.timestamped_transcript);
  }

  const s = result.summaries;
  if (s.short) lines.push("", "--- KISA OZET ---", s.short);
  if (s.long) lines.push("", "--- UZUN OZET ---", s.long);
  if (s.bullet_points) lines.push("", "--- BULLET POINTS ---", s.bullet_points);
  if (s.main_idea) lines.push("", "--- ANA FIKIR ---", s.main_idea);

  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function handleTxtExport(result: ProcessResponse) {
  downloadFile(
    buildTextContent(result),
    `transcript_${Date.now()}.txt`,
    "text/plain;charset=utf-8",
  );
}

async function handlePdfExport(result: ProcessResponse) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  function addSection(title: string, text: string) {
    if (y > 270) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(transliterateTurkish(title), margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(transliterateTurkish(text), maxWidth);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 6;
  }

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("AI Video Summarizer", margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    transliterateTurkish(`Kaynak: ${result.source_kind} | ${new Date().toLocaleString("tr-TR")}`),
    margin, y,
  );
  y += 12;

  addSection("Transcript", result.transcript);

  if (result.timestamped_transcript) {
    addSection("Zamanli Transcript", result.timestamped_transcript);
  }

  const s = result.summaries;
  if (s.short) addSection("Kisa Ozet", s.short);
  if (s.long) addSection("Uzun Ozet", s.long);
  if (s.bullet_points) addSection("Bullet Points", s.bullet_points);
  if (s.main_idea) addSection("Ana Fikir", s.main_idea);

  doc.save(`transcript_${Date.now()}.pdf`);
}

type ExportButtonsProps = {
  result: ProcessResponse;
};

export function ExportButtons({ result }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => handleTxtExport(result)}
        className="inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <Download className="h-4 w-4" />
        TXT Indir
      </button>
      <button
        type="button"
        onClick={() => handlePdfExport(result)}
        className="inline-flex items-center gap-2 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-2.5 text-sm font-medium text-coral transition hover:bg-coral/20 dark:border-coral/30 dark:bg-coral/20"
      >
        <Download className="h-4 w-4" />
        PDF Indir
      </button>
    </div>
  );
}
