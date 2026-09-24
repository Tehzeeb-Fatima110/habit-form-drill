"use client";

import { FormEvent, useState } from "react";
import {
  HABIT_FREQUENCIES,
  FREQUENCY_LABELS,
  type Habit,
  type HabitFrequency,
  createHabit,
} from "../lib/habits";

type CreateHabitFormProps = {
  onCreate: (habit: Habit) => void;
};

export function CreateHabitForm({ onCreate }: CreateHabitFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give this habit a name.");
      return;
    }

    onCreate(
      createHabit({
        name: trimmedName,
        description,
        frequency,
      }),
    );

    setName("");
    setDescription("");
    setFrequency("daily");
    setError("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      noValidate
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create a habit</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Name it, add a note if you want, and pick how often you want to do it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="habit-name" className="text-sm font-medium">
          Habit name
        </label>
        <input
          id="habit-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError("");
          }}
          placeholder="Drink water"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "habit-name-error" : undefined}
          className="h-11 rounded-xl border border-zinc-200 bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-200"
        />
        {error ? (
          <p id="habit-name-error" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="habit-description" className="text-sm font-medium">
          Description{" "}
          <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="habit-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A glass of water after breakfast"
          rows={3}
          className="rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-200"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Frequency</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {HABIT_FREQUENCIES.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm transition-colors ${
                frequency === option
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={option}
                checked={frequency === option}
                onChange={() => setFrequency(option)}
                className="sr-only"
              />
              {FREQUENCY_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Add habit
      </button>
    </form>
  );
}
