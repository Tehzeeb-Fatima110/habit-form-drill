export const HABIT_FREQUENCIES = ["daily", "weekdays", "weekly"] as const;

export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export type Habit = {
  id: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  createdAt: string;
};

export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Once a week",
};

export function createHabit(input: {
  name: string;
  description: string;
  frequency: HabitFrequency;
}): Habit {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    frequency: input.frequency,
    createdAt: new Date().toISOString(),
  };
}
