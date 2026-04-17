export type SummaryType = "all" | "short" | "long" | "bullet_points" | "main_idea";

export type SummaryLanguage = "tr" | "en";

export type ProcessResponse = {
  id: number | null;
  source_kind: "youtube" | "upload";
  transcript_source: string;
  language_hint: string | null;
  transcript: string;
  timestamped_transcript: string | null;
  summaries: {
    short: string | null;
    long: string | null;
    bullet_points: string | null;
    main_idea: string | null;
  };
  summary_language: string;
};

export type UserInfo = {
  id: number;
  email: string;
  display_name: string;
};

export type AuthResponse = {
  token: string;
  user: UserInfo;
};

export type HistoryItem = {
  id: number;
  source_kind: string;
  youtube_url: string | null;
  filename: string | null;
  transcript: string;
  timestamped_transcript: string | null;
  summaries: {
    short: string | null;
    long: string | null;
    bullet_points: string | null;
    main_idea: string | null;
  };
  summary_language: string;
  share_token: string | null;
  created_at: string;
};

export type HistoryListResponse = {
  items: HistoryItem[];
  total: number;
};

export type ReopenableHistoryRecord = {
  id: number;
  source_kind: string;
  transcript_source: string;
  language_hint: string | null;
  transcript: string;
  timestamped_transcript: string | null;
  summaries: {
    short: string | null;
    long: string | null;
    bullet_points: string | null;
    main_idea: string | null;
  };
};

export type SSEEvent = {
  step: string;
  message: string;
  payload?: Record<string, unknown>;
};
