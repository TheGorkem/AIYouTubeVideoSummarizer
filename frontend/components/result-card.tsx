import { clsx } from "clsx";

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
  return (
    <section
      className={clsx(
        "rounded-3xl border bg-white/90 p-6 shadow-soft backdrop-blur",
        accent === "coral" ? "border-coral/20" : "border-ocean/20",
      )}
    >
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{content}</p>
    </section>
  );
}
