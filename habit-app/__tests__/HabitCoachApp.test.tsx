import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HabitCoachApp from "@/components/HabitCoachApp";

const STORAGE_KEY = "systema_habits_v1";

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HabitCoachApp", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("renders the dashboard and filters habits by category", async () => {
    const user = userEvent.setup();
    render(<HabitCoachApp />);

    expect(
      screen.getByRole("heading", { name: "7-Day Consistency Dashboard" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Finance" }));

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Log Daily Expenses & Savings Check")).toBeInTheDocument();
    expect(screen.queryByText("Morning Walk & Mobility")).not.toBeInTheDocument();
  });

  it("persists done and skipped check-ins and supports removing a habit", async () => {
    const user = userEvent.setup();
    render(<HabitCoachApp />);

    const healthRow = screen.getByRole("row", {
      name: /Morning Walk & Mobility/,
    });
    await user.click(within(healthRow).getByRole("button", { name: "Done" }));
    expect(
      screen.getByText("Marked habit as done for today.")
    ).toBeInTheDocument();

    await user.click(within(healthRow).getByRole("button", { name: "Skip" }));
    await user.selectOptions(
      screen.getByLabelText(/Why did you skip/),
      "Low energy"
    );
    await user.click(
      screen.getByRole("button", { name: "Save Skip Reason" })
    );
    expect(
      screen.getByText("Logged skip reason: Low energy.")
    ).toBeInTheDocument();

    const saved = window.localStorage.getItem(STORAGE_KEY);
    expect(saved).not.toBeNull();
    const habits = JSON.parse(saved ?? "[]") as Array<{
      id: string;
      logs: Record<string, { status: string; reason?: string }>;
    }>;
    const healthHabit = habits.find((habit) => habit.id === "h-health-1");
    expect(healthHabit).toBeDefined();
    expect(
      Object.values(healthHabit?.logs ?? {}).some(
        (log) => log.status === "skipped" && log.reason === "Low energy"
      )
    ).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Delete Morning Walk & Mobility" })
    );
    expect(screen.queryByText("Morning Walk & Mobility")).not.toBeInTheDocument();
    expect(screen.getByText("Removed habit from your system.")).toBeInTheDocument();
  });

  it("adds a generated habit from the system builder", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        title: "Read a little",
        category: "Finance",
        cue: "After lunch",
        targetMinutes: 10,
        tinyVersion: "Read one sentence",
        source: "fallback",
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<HabitCoachApp />);

    await user.type(
      screen.getByRole("textbox", { name: "What habit do you want to build?" }),
      "Read every day"
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Life Pillar" }), "Finance");
    await user.type(
      screen.getByRole("textbox", { name: "Biggest obstacle (optional)" }),
      "Busy evenings"
    );
    await user.click(
      screen.getByRole("button", { name: "Generate & Add Habit System" })
    );

    expect(await screen.findByText("Read a little")).toBeInTheDocument();
    expect(
      screen.getByText('Added habit "Read a little" using local system builder.')
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/coach",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"mode":"generate_system"'),
      })
    );
  });

  it("shows analysis and applies a plan recommendation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          summary: "Good progress.",
          skipPattern: "Several skips were due to time.",
          topBlocker: "No time",
          recommendations: [
            {
              habitId: "h-health-1",
              habitTitle: "Morning Walk & Mobility",
              action: "shrink",
              reason: "A shorter walk is easier to maintain.",
              newTargetMinutes: 15,
            },
          ],
          source: "fallback",
        })
      )
    );
    render(<HabitCoachApp />);

    await user.click(
      screen.getByRole("button", { name: "Analyze Skips & Improve Plan" })
    );
    expect(await screen.findByText("Weekly Progress Report")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply Update" }));

    expect(screen.getByText("Updated plan for Morning Walk & Mobility.")).toBeInTheDocument();
    expect(screen.getByText("(15m)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "✓ Applied to Plan" })
    ).toBeDisabled();
  });

  it("validates a short goal without calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<HabitCoachApp />);

    await user.type(
      screen.getByRole("textbox", { name: "What habit do you want to build?" }),
      "ok"
    );
    await user.click(
      screen.getByRole("button", { name: "Generate & Add Habit System" })
    );

    expect(
      screen.getByText("Please enter a goal of at least 3 characters.")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
