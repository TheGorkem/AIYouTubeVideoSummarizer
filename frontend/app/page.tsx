import { SummarizerForm } from "@/components/summarizer-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-10 sm:px-8 lg:px-10">
      <section className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-ocean">
          AI YouTube Video Summarizer
        </p>
        <h1 className="text-4xl font-semibold leading-tight dark:text-white sm:text-6xl">
          Link veya kayıt dosyasını ver, transcripti ve özeti dakikalar içinde al.
        </h1>
      </section>

      <SummarizerForm />
    </main>
  );
}
