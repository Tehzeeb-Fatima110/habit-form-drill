import { Habit } from "./types";

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLastNDays(n = 7, baseDate = new Date()): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    const key = formatDateKey(d);
    const label =
      i === 0
        ? "Today"
        : d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ key, label });
  }
  return days;
}

export function createDemoHabits(baseDate = new Date()): Habit[] {
  const days = getLastNDays(7, baseDate);
  const k = (idx: number) => days[idx].key;

  return [
    {
      id: "h-health-1",
      title: "Morning Walk & Mobility",
      category: "Health",
      cue: "Right after morning coffee at 7:30 AM",
      targetMinutes: 30,
      tinyVersion: "5-minute stretch by the window",
      logs: {
        [k(0)]: { status: "done" },
        [k(1)]: { status: "skipped", reason: "Low energy" },
        [k(2)]: { status: "done" },
        [k(3)]: { status: "skipped", reason: "No time" },
        [k(4)]: { status: "done" },
        [k(5)]: { status: "done" },
      },
    },
    {
      id: "h-finance-1",
      title: "Log Daily Expenses & Savings Check",
      category: "Finance",
      cue: "After dinner at 8:30 PM",
      targetMinutes: 10,
      tinyVersion: "Check bank app & note top 1 spend",
      logs: {
        [k(0)]: { status: "done" },
        [k(1)]: { status: "done" },
        [k(2)]: { status: "skipped", reason: "Forgot" },
        [k(3)]: { status: "done" },
        [k(4)]: { status: "skipped", reason: "Forgot" },
        [k(5)]: { status: "done" },
      },
    },
    {
      id: "h-academic-1",
      title: "Focused Study / Coding Practice",
      category: "Academic",
      cue: "At desk at 6:00 PM after work",
      targetMinutes: 45,
      tinyVersion: "Solve 1 small problem or read 2 pages",
      logs: {
        [k(0)]: { status: "done" },
        [k(1)]: { status: "skipped", reason: "No time" },
        [k(2)]: { status: "skipped", reason: "Too hard" },
        [k(3)]: { status: "skipped", reason: "No time" },
        [k(4)]: { status: "done" },
        [k(5)]: { status: "skipped", reason: "Low energy" },
      },
    },
  ];
}
