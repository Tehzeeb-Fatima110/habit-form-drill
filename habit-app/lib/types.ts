export type Category = "Health" | "Finance" | "Academic";

export type SkipReason = "No time" | "Low energy" | "Forgot" | "Too hard";

export type DayStatus = "done" | "skipped" | "pending";

export interface HabitLogEntry {
  status: DayStatus;
  reason?: SkipReason;
  note?: string;
}

export interface Habit {
  id: string;
  title: string;
  category: Category;
  cue: string;
  targetMinutes: number;
  tinyVersion: string;
  logs: Record<string, HabitLogEntry>; // key: YYYY-MM-DD
}

export interface PlanRecommendation {
  habitId: string;
  habitTitle: string;
  action: "shrink" | "reschedule" | "change_cue";
  reason: string;
  newTargetMinutes?: number;
  newCue?: string;
  newTinyVersion?: string;
}

export interface CoachAnalysis {
  summary: string;
  skipPattern: string;
  topBlocker: string;
  recommendations: PlanRecommendation[];
  source: "claude" | "fallback";
}

export interface GeneratedHabitSystem {
  title: string;
  category: Category;
  cue: string;
  targetMinutes: number;
  tinyVersion: string;
  source: "claude" | "fallback";
}
