import { describe, expect, it } from "vitest";
import {
  buildFallbackAnalysis,
  buildFallbackSystem,
  calculateDashboardStats,
} from "@/lib/coachFallback";
import { createDemoHabits, getLastNDays } from "@/lib/demoData";

describe("coachFallback & dashboard calculations", () => {
  it("computes category and overall stats accurately", () => {
    const base = new Date("2026-01-10T12:00:00Z");
    const habits = createDemoHabits(base);
    const dayKeys = getLastNDays(7, base).map((d) => d.key);

    const stats = calculateDashboardStats(habits, dayKeys);
    expect(stats.totalLogged).toBe(18);
    expect(stats.totalDone).toBe(10);
    expect(stats.overallRate).toBe(56);
    expect(stats.byCategory.Health.done).toBe(4);
  });

  it("recommends shrinking habits skipped 2+ times due to No time", () => {
    const base = new Date("2026-01-10T12:00:00Z");
    const habits = createDemoHabits(base);
    const dayKeys = getLastNDays(7, base).map((d) => d.key);

    const analysis = buildFallbackAnalysis(habits, dayKeys);
    expect(analysis.source).toBe("fallback");
    expect(analysis.recommendations.length).toBeGreaterThan(0);
    expect(analysis.recommendations.some((r) => r.action === "shrink")).toBe(
      true
    );
  });

  it("creates a smaller system when user mentions being busy", () => {
    const sys = buildFallbackSystem("Study TypeScript", "Academic", "Very busy");
    expect(sys.targetMinutes).toBe(15);
    expect(sys.category).toBe("Academic");
  });
});
