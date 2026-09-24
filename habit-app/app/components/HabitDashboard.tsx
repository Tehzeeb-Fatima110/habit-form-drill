"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FREQUENCY_LABELS, type Habit } from "../lib/habits";
import { CreateHabitForm } from "./CreateHabitForm";

const STORAGE_KEY = "habit-form-flyrank:habits";
const EMPTY_HABITS: Habit[] = [];
const listeners = new Set<() => void>();
let habitsCache: Habit[] | undefined;

function readHabits(): Habit[] {
  if (typeof window === "undefined") return EMPTY_HABITS;
  if (habitsCache) return habitsCache;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    habitsCache = stored ? (JSON.parse(stored) as Habit[]) : EMPTY_HABITS;
  } catch {
    habitsCache = EMPTY_HABITS;
  }

  return habitsCache;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function getServerSnapshot() {
  return EMPTY_HABITS;
}

export function HabitDashboard() {
  const habits = useSyncExternalStore(subscribe, readHabits, getServerSnapshot);

  const handleCreate = useCallback((habit: Habit) => {
    const next = [habit, ...readHabits()];
    habitsCache = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
  }, []);

  return (
    <div className="flex w-full max-w-xl flex-col gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Habit tracker
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Build a habit you can keep
        </h1>
      </header>

      <CreateHabitForm onCreate={handleCreate} />

      <section aria-live="polite" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500">
          Your habits ({habits.length})
        </h2>
        {habits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700">
            No habits yet. Use the form above to create your first one.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {habits.map((habit) => (
              <li
                key={habit.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{habit.name}</p>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {FREQUENCY_LABELS[habit.frequency]}
                  </span>
                </div>
                {habit.description ? (
                  <p className="mt-1 text-sm text-zinc-500">{habit.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
