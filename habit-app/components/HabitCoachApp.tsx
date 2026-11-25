"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { calculateDashboardStats } from "@/lib/coachFallback";
import { createDemoHabits, getLastNDays } from "@/lib/demoData";
import {
  Category,
  CoachAnalysis,
  GeneratedHabitSystem,
  Habit,
  PlanRecommendation,
  SkipReason,
} from "@/lib/types";

const STORAGE_KEY = "systema_habits_v1";
const CATEGORIES: Category[] = ["Health", "Finance", "Academic"];
const SKIP_REASONS: SkipReason[] = [
  "No time",
  "Low energy",
  "Forgot",
  "Too hard",
];

const SERVER_DEFAULT_HABITS: Habit[] = createDemoHabits(
  new Date("2026-01-07T12:00:00Z")
);

// External localStorage store (avoids setState inside useEffect for React 19 ESLint)
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined = undefined;
let lastSnapshot: Habit[] = SERVER_DEFAULT_HABITS;
let initializedClientHabits: Habit[] | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): Habit[] {
  return SERVER_DEFAULT_HABITS;
}

function getClientSnapshot(): Habit[] {
  if (typeof window === "undefined") return SERVER_DEFAULT_HABITS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    if (!initializedClientHabits) {
      initializedClientHabits = createDemoHabits();
    }
    return initializedClientHabits;
  }
  if (raw !== lastRaw) {
    try {
      const parsed = JSON.parse(raw) as Habit[];
      if (Array.isArray(parsed)) {
        lastRaw = raw;
        lastSnapshot = parsed;
      }
    } catch {
      lastRaw = raw;
      lastSnapshot = createDemoHabits();
    }
  }
  return lastSnapshot;
}

function persistHabits(next: Habit[]) {
  const serialized = JSON.stringify(next);
  lastRaw = serialized;
  lastSnapshot = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  }
  listeners.forEach((l) => l());
}

export default function HabitCoachApp() {
  const habits = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const days = useMemo(() => getLastNDays(7), []);
  const dayKeys = useMemo(() => days.map((d) => d.key), [days]);
  const todayKey = days[days.length - 1].key;

  const stats = useMemo(
    () => calculateDashboardStats(habits, dayKeys),
    [habits, dayKeys]
  );

  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [goalInput, setGoalInput] = useState("");
  const [goalCategory, setGoalCategory] = useState<Category>("Health");
  const [constraintInput, setConstraintInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const [skippingHabitId, setSkippingHabitId] = useState<string | null>(null);
  const [selectedSkipReason, setSelectedSkipReason] =
    useState<SkipReason>("No time");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const visibleHabits = useMemo(
    () =>
      categoryFilter === "All"
        ? habits
        : habits.filter((h) => h.category === categoryFilter),
    [habits, categoryFilter]
  );

  function announce(msg: string) {
    setAnnouncement(msg);
  }

  function handleMarkDone(habitId: string) {
    const next = habits.map((h) =>
      h.id === habitId
        ? {
            ...h,
            logs: { ...h.logs, [todayKey]: { status: "done" as const } },
          }
        : h
    );
    persistHabits(next);
    setSkippingHabitId(null);
    announce("Marked habit as done for today.");
  }

  function handleSaveSkip(habitId: string) {
    const next = habits.map((h) =>
      h.id === habitId
        ? {
            ...h,
            logs: {
              ...h.logs,
              [todayKey]: {
                status: "skipped" as const,
                reason: selectedSkipReason,
              },
            },
          }
        : h
    );
    persistHabits(next);
    setSkippingHabitId(null);
    announce(`Logged skip reason: ${selectedSkipReason}.`);
  }

  function handleDeleteHabit(habitId: string) {
    const next = habits.filter((h) => h.id !== habitId);
    persistHabits(next);
    announce("Removed habit from your system.");
  }

  function handleResetDemo() {
    const fresh = createDemoHabits();
    persistHabits(fresh);
    setAnalysis(null);
    setAppliedIds([]);
    setCoachError(null);
    announce("Reset to 7-day demo dataset.");
  }

  async function handleBuildSystem(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmed = goalInput.trim();
    if (trimmed.length < 3) {
      setFormError("Please enter a goal of at least 3 characters.");
      return;
    }

    setIsBuilding(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_system",
          goal: trimmed,
          category: goalCategory,
          constraint: constraintInput.trim(),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error || "Could not build habit system.");
      }

      const generated = (await res.json()) as GeneratedHabitSystem;
      const newHabit: Habit = {
        id: `h-${Date.now()}`,
        title: generated.title,
        category: generated.category,
        cue: generated.cue,
        targetMinutes: generated.targetMinutes,
        tinyVersion: generated.tinyVersion,
        logs: {},
      };

      persistHabits([...habits, newHabit]);
      setGoalInput("");
      setConstraintInput("");
      announce(
        `Added habit "${newHabit.title}" using ${
          generated.source === "claude" ? "Claude AI" : "local system builder"
        }.`
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to generate habit system."
      );
    } finally {
      setIsBuilding(false);
    }
  }

  async function handleAnalyzeSkips() {
    setCoachError(null);
    if (habits.length === 0) {
      setCoachError("Add at least one habit before running coaching analysis.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "analyze_skips",
          habits,
          dayKeys,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error || "Coach analysis failed.");
      }

      const data = (await res.json()) as CoachAnalysis;
      setAnalysis(data);
      setAppliedIds([]);
      announce("AI coaching report is ready.");
    } catch (err) {
      setCoachError(
        err instanceof Error
          ? err.message
          : "Network error while contacting AI Coach. Please retry."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleApplyRecommendation(rec: PlanRecommendation) {
    const next = habits.map((h) => {
      if (h.id !== rec.habitId) return h;
      return {
        ...h,
        targetMinutes: rec.newTargetMinutes ?? h.targetMinutes,
        cue: rec.newCue ?? h.cue,
        tinyVersion: rec.newTinyVersion ?? h.tinyVersion,
      };
    });
    persistHabits(next);
    setAppliedIds((prev) => [...prev, rec.habitId]);
    announce(`Updated plan for ${rec.habitTitle}.`);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-indigo-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Systema — AI Habit Coach
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              Build small systems, diagnose why you skip, and adapt your plan.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          >
            Reset Demo Data
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* Excel-style Category KPI Summary */}
        <section aria-labelledby="dashboard-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="dashboard-heading" className="text-lg font-semibold text-slate-900">
              7-Day Consistency Dashboard
            </h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by life area">
              {(["All", ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  aria-pressed={categoryFilter === cat}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    categoryFilter === cat
                      ? "bg-indigo-700 text-white"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Overall Score
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {stats.overallRate}%
              </p>
              <p className="mt-1 text-xs text-slate-700">
                {stats.totalDone} of {stats.totalLogged} check-ins completed
              </p>
            </div>

            {CATEGORIES.map((cat) => {
              const c = stats.byCategory[cat];
              return (
                <div
                  key={cat}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {cat}
                    </p>
                    <span className="text-sm font-bold text-slate-900">
                      {c.rate}%
                    </span>
                  </div>
                  <div
                    className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuenow={c.rate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${cat} completion rate`}
                  >
                    <div
                      className="h-full rounded-full bg-indigo-700 transition-all"
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    {c.done}/{c.logged} completed
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Excel-style 7-Day Habit Tracker Grid */}
        <section aria-labelledby="tracker-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="tracker-heading" className="text-lg font-semibold text-slate-900">
                Weekly Habit Matrix
              </h2>
              <p className="text-sm text-slate-700">
                Check off today or log why a habit was skipped so the AI Coach can adapt your plan.
              </p>
            </div>
          </div>

          {visibleHabits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-700">
              No habits in this category yet. Use the AI System Builder below to add one!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  7-day habit completion matrix across categories
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                    <th scope="col" className="px-3 py-3">
                      Habit System
                    </th>
                    {days.map((d) => (
                      <th key={d.key} scope="col" className="px-2 py-3 text-center">
                        {d.label}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right">
                      Today&apos;s Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleHabits.map((habit) => {
                    const isSkipping = skippingHabitId === habit.id;
                    return (
                      <React.Fragment key={habit.id}>
                        <tr className="hover:bg-slate-50/70">
                          <th scope="row" className="px-3 py-3 font-normal">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                                {habit.category}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {habit.title}
                              </span>
                              <span className="text-xs text-slate-700">
                                ({habit.targetMinutes}m)
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-700">
                              <strong>Cue:</strong> {habit.cue} ·{" "}
                              <strong>2-min fallback:</strong> {habit.tinyVersion}
                            </p>
                          </th>

                          {days.map((d) => {
                            const entry = habit.logs[d.key];
                            const status = entry?.status ?? "pending";
                            return (
                              <td key={d.key} className="px-2 py-3 text-center">
                                {status === "done" && (
                                  <span
                                    title="Done"
                                    aria-label={`${habit.title} on ${d.label}: Done`}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 font-bold text-emerald-900"
                                  >
                                    ✓
                                  </span>
                                )}
                                {status === "skipped" && (
                                  <span
                                    title={`Skipped: ${entry?.reason ?? "No reason"}`}
                                    aria-label={`${habit.title} on ${d.label}: Skipped (${entry?.reason ?? "No reason"})`}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 font-bold text-rose-900"
                                  >
                                    ✕
                                  </span>
                                )}
                                {status === "pending" && (
                                  <span
                                    aria-label={`${habit.title} on ${d.label}: Not logged`}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600"
                                  >
                                    ·
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-3 py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleMarkDone(habit.id)}
                                className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                              >
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSkippingHabitId(isSkipping ? null : habit.id)
                                }
                                aria-expanded={isSkipping}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                              >
                                Skip
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHabit(habit.id)}
                                aria-label={`Delete ${habit.title}`}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isSkipping && (
                          <tr className="bg-rose-50/60">
                            <td colSpan={days.length + 2} className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <label
                                  htmlFor={`skip-reason-${habit.id}`}
                                  className="text-xs font-semibold text-slate-900"
                                >
                                  Why did you skip &ldquo;{habit.title}&rdquo; today?
                                </label>
                                <select
                                  id={`skip-reason-${habit.id}`}
                                  value={selectedSkipReason}
                                  onChange={(e) =>
                                    setSelectedSkipReason(e.target.value as SkipReason)
                                  }
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                >
                                  {SKIP_REASONS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSkip(habit.id)}
                                  className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                                >
                                  Save Skip Reason
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSkippingHabitId(null)}
                                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bottom 2-Column AI Tools */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* AI #1: System Builder */}
          <section
            aria-labelledby="builder-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 id="builder-heading" className="text-lg font-semibold text-slate-900">
              1. AI System Builder
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Turn a vague goal into a cue + 2-minute fallback habit system.
            </p>

            <form onSubmit={handleBuildSystem} className="mt-4 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="goal-input"
                  className="block text-sm font-medium text-slate-900"
                >
                  What habit do you want to build?
                </label>
                <input
                  id="goal-input"
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="e.g., Read 15 pages of finance book"
                  aria-describedby={formError ? "goal-error" : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700/20"
                />
                {formError && (
                  <p id="goal-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-700">
                    {formError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="category-select"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Life Pillar
                  </label>
                  <select
                    id="category-select"
                    value={goalCategory}
                    onChange={(e) => setGoalCategory(e.target.value as Category)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="constraint-input"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Biggest obstacle (optional)
                  </label>
                  <input
                    id="constraint-input"
                    type="text"
                    value={constraintInput}
                    onChange={(e) => setConstraintInput(e.target.value)}
                    placeholder="e.g., Busy evenings"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBuilding}
                aria-busy={isBuilding}
                className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
              >
                {isBuilding ? "Designing System..." : "Generate & Add Habit System"}
              </button>
            </form>
          </section>

          {/* AI #2: Skip Coach & Plan Updater */}
          <section
            aria-labelledby="coach-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="coach-heading" className="text-lg font-semibold text-slate-900">
                  2. AI Skip Coach & Plan Updater
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  Diagnose why you skip and apply concrete updates to your plan.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeSkips}
                disabled={isAnalyzing}
                aria-busy={isAnalyzing}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {isAnalyzing ? "Analyzing Logs..." : "Analyze Skips & Improve Plan"}
              </button>
            </div>

            {coachError && (
              <div
                role="alert"
                className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"
              >
                <span>{coachError}</span>
                <button
                  type="button"
                  onClick={handleAnalyzeSkips}
                  className="rounded bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {!analysis && !coachError && (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
                Click <strong>Analyze Skips &amp; Improve Plan</strong> to review your
                7-day patterns and receive one-click plan adjustments.
              </div>
            )}

            {analysis && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-indigo-950">
                      Weekly Progress Report
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-indigo-900">
                      {analysis.source === "claude"
                        ? "Powered by Claude AI"
                        : "Smart Rule Fallback"}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-900">{analysis.summary}</p>
                  <p className="mt-2 text-slate-800">
                    <strong>Skip Pattern:</strong> {analysis.skipPattern}
                  </p>
                </div>

                {analysis.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Suggested System Updates
                    </h3>
                    {analysis.recommendations.map((rec) => {
                      const alreadyApplied = appliedIds.includes(rec.habitId);
                      return (
                        <div
                          key={rec.habitId}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {rec.habitTitle}
                            </span>
                            <button
                              type="button"
                              disabled={alreadyApplied}
                              onClick={() => handleApplyRecommendation(rec)}
                              className="rounded-md bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800 disabled:bg-emerald-700"
                            >
                              {alreadyApplied ? "✓ Applied to Plan" : "Apply Update"}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-slate-700">{rec.reason}</p>
                          {rec.newTargetMinutes && (
                            <p className="mt-1 text-xs font-medium text-indigo-900">
                              New target: {rec.newTargetMinutes} mins/day
                            </p>
                          )}
                          {rec.newCue && (
                            <p className="mt-1 text-xs font-medium text-indigo-900">
                              New cue: {rec.newCue}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">
                    No urgent plan changes needed—your consistency is solid!
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}