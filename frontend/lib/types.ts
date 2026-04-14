export type SummaryType = "all" | "short" | "long" | "bullet_points" | "main_idea";

export type ProcessResponse = {
  source_kind: "youtube" | "upload";
  transcript_source: string;
  language_hint: string | null;
  transcript: string;
  summaries: {
    short: string | null;
    long: string | null;
    bullet_points: string | null;
    main_idea: string | null;
  };
};
