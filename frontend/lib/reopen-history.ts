import { ReopenableHistoryRecord } from "@/lib/types";

const REOPEN_HISTORY_KEY = "reopen_history_record";

export function saveReopenHistoryRecord(record: ReopenableHistoryRecord): void {
  localStorage.setItem(REOPEN_HISTORY_KEY, JSON.stringify(record));
}

export function consumeReopenHistoryRecord(): ReopenableHistoryRecord | null {
  const raw = localStorage.getItem(REOPEN_HISTORY_KEY);
  if (!raw) {
    return null;
  }

  localStorage.removeItem(REOPEN_HISTORY_KEY);

  try {
    return JSON.parse(raw) as ReopenableHistoryRecord;
  } catch {
    return null;
  }
}
