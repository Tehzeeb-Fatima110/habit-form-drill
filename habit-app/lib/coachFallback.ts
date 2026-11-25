import {
  Category,
  CoachAnalysis,
  GeneratedHabitSystem,
  Habit,
  PlanRecommendation,
  SkipReason,
} from "./types";

export interface DashboardStats {
  overallRate: number;
  totalDone: number;
  totalLogged: number;
  byCategory: Record<Category, { rate: number; done: number; logged: number }>;
}

export function calculateDashboardStats(
  habits: Habit[],
  dayKeys: string[]
): DashboardStats {
  const byCategory: Record<Category, { rate: number; done: number; logged: number }> = {
    Health: { rate: 0, done: 0, logged: 0 },
    Finance: { rate: 0, done: 0, logged: 0 },
    Academic: { rate: 0, done: 0, logged: 0 },
  };

  let totalDone = 0;
  let totalLogged = 0;

  for (const habit of habits) {
    for (const key of dayKeys) {
      const entry = habit.logs[key];
      if (!entry || entry.status === "pending") continue;
      totalLogged++;
      byCategory[habit.category].logged++;
      if (entry.status === "done") {
        totalDone++;
        byCategory[habit.category].done++;
      }
    }
  }

  for (const cat of ["Health", "Finance", "Academic"] as Category[]) {
    const c = byCategory[cat];
    c.rate = c.logged > 0 ? Math.round((c.done / c.logged) * 100) : 0;
  }

  return {
    overallRate: totalLogged > 0 ? Math.round((totalDone / totalLogged) * 100) : 0,
    totalDone,
    totalLogged,
    byCategory,
  };
}

export function buildFallbackSystem(
  goal: string,
  category: Category,
  constraint?: string
): GeneratedHabitSystem {
  const cleanGoal = goal.trim();
  const isBusy =
    constraint && /busy|time|tired|work|evening/i.test(constraint);

  const defaultCues: Record<Category, string> = {
    Health: "Right after brushing teeth in the morning",
    Finance: "Right after lunch while checking messages",
    Academic: "At 8:00 AM before checking social media",
  };

  return {
    title: cleanGoal.slice(0, 60),
    category,
    cue: isBusy
      ? "First thing in the morning before daily tasks pile up"
      : defaultCues[category],
    targetMinutes: isBusy ? 15 : 25,
    tinyVersion: `Do just 2 minutes of "${cleanGoal.slice(0, 32)}" so the streak never breaks`,
    source: "fallback",
  };
}

export function buildFallbackAnalysis(
  habits: Habit[],
  dayKeys: string[]
): CoachAnalysis {
  const stats = calculateDashboardStats(habits, dayKeys);
  const reasonCounts: Record<string, number> = {};
  const recommendations: PlanRecommendation[] = [];

  for (const habit of habits) {
    const habitSkips: SkipReason[] = [];
    for (const key of dayKeys) {
      const entry = habit.logs[key];
      if (entry?.status === "skipped") {
        const r = entry.reason ?? "No time";
        habitSkips.push(r);
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }

    if (habitSkips.length >= 2) {
      const topHabitReason = habitSkips.sort(
        (a, b) =>
          habitSkips.filter((x) => x === b).length -
          habitSkips.filter((x) => x === a).length
      )[0];

      if (topHabitReason === "No time" || topHabitReason === "Too hard") {
        const reduced = Math.max(5, Math.round(habit.targetMinutes * 0.5));
        recommendations.push({
          habitId: habit.id,
          habitTitle: habit.title,
          action: "shrink",
          newTargetMinutes: reduced,
          reason: `Skipped ${habitSkips.length}x mainly due to "${topHabitReason}". Shrinking from ${habit.targetMinutes}m to ${reduced}m lowers friction.`,
        });
      } else if (topHabitReason === "Forgot") {
        recommendations.push({
          habitId: habit.id,
          habitTitle: habit.title,
          action: "change_cue",
          newCue: `Immediately after an existing daily anchor (e.g., morning tea or dinner)`,
          reason: `Skipped ${habitSkips.length}x because it was forgotten. Anchor it to a fixed daily routine.`,
        });
      } else {
        recommendations.push({
          habitId: habit.id,
          habitTitle: habit.title,
          action: "reschedule",
          newCue: "Move to morning energy peak (8:00 AM)",
          reason: `Skipped ${habitSkips.length}x due to low energy. Shifting earlier protects willpower.`,
        });
      }
    }
  }

  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  const topBlocker = sortedReasons[0]?.[0] ?? "None logged yet";

  return {
    summary: `You completed ${stats.totalDone} of ${stats.totalLogged} logged check-ins (${stats.overallRate}% consistency across Health, Finance, and Academic).`,
    skipPattern:
      sortedReasons.length > 0
        ? `Your most frequent skip reason is "${topBlocker}" (${sortedReasons[0][1]} times in the last 7 days).`
        : "No skips logged yet—keep checking in daily so the coach can detect patterns.",
    topBlocker,
    recommendations,
    source: "fallback",
  };
}