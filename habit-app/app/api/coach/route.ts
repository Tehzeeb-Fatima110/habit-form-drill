import { NextRequest, NextResponse } from "next/server";
import {
  buildFallbackAnalysis,
  buildFallbackSystem,
} from "@/lib/coachFallback";
import {
  Category,
  CoachAnalysis,
  GeneratedHabitSystem,
  Habit,
  PlanRecommendation,
} from "@/lib/types";

const ALLOWED_CATEGORIES: Category[] = ["Health", "Finance", "Academic"];

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        temperature: 0.3,
        system:
          "You are a pragmatic behavioral habit coach. Respond ONLY with valid JSON matching the requested schema. No extra prose.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Empty Claude response");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode;

  if (mode === "generate_system") {
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const category = ALLOWED_CATEGORIES.includes(body.category as Category)
      ? (body.category as Category)
      : "Health";
    const constraint =
      typeof body.constraint === "string" ? body.constraint.trim() : "";

    if (goal.length < 3 || goal.length > 120) {
      return NextResponse.json(
        { error: "Goal must be between 3 and 120 characters." },
        { status: 400 }
      );
    }

    const prompt = `Create a tiny, sustainable daily habit system for:
Goal: "${goal}"
Category: "${category}"
User constraint: "${constraint || "None provided"}"

Return ONLY JSON:
{
  "title": "concise habit name under 55 chars",
  "category": "${category}",
  "cue": "specific time + existing daily anchor",
  "targetMinutes": 15,
  "tinyVersion": "2-minute minimum version for hard days"
}`;

    try {
      const text = await callClaude(prompt);
      const parsed = extractJsonObject(text);
      if (
        parsed &&
        typeof parsed.title === "string" &&
        typeof parsed.cue === "string" &&
        typeof parsed.tinyVersion === "string" &&
        typeof parsed.targetMinutes === "number"
      ) {
        const result: GeneratedHabitSystem = {
          title: parsed.title.slice(0, 60),
          category,
          cue: parsed.cue.slice(0, 120),
          targetMinutes: Math.min(120, Math.max(2, Math.round(parsed.targetMinutes))),
          tinyVersion: parsed.tinyVersion.slice(0, 120),
          source: "claude",
        };
        return NextResponse.json(result);
      }
      throw new Error("Schema mismatch");
    } catch {
      return NextResponse.json(buildFallbackSystem(goal, category, constraint));
    }
  }

  if (mode === "analyze_skips") {
    const habits = Array.isArray(body.habits) ? (body.habits as Habit[]) : [];
    const dayKeys = Array.isArray(body.dayKeys)
      ? (body.dayKeys.filter((d) => typeof d === "string") as string[])
      : [];

    if (habits.length === 0 || dayKeys.length === 0) {
      return NextResponse.json(
        { error: "Add at least one habit before running coaching analysis." },
        { status: 400 }
      );
    }

    const compactLogs = habits.map((h) => ({
      id: h.id,
      title: h.title,
      category: h.category,
      cue: h.cue,
      targetMinutes: h.targetMinutes,
      logs: dayKeys.map((day) => ({
        day,
        status: h.logs?.[day]?.status ?? "pending",
        reason: h.logs?.[day]?.reason ?? null,
      })),
    }));

    const prompt = `Analyze these 7-day habit logs and skip reasons. Identify why skips happen and propose concrete plan adjustments.
Data: ${JSON.stringify(compactLogs)}

Return ONLY JSON:
{
  "summary": "2-sentence progress summary across categories",
  "skipPattern": "specific insight on which days/reasons cause skips",
  "topBlocker": "most common blocker",
  "recommendations": [
    {
      "habitId": "exact habit id from input",
      "habitTitle": "habit title",
      "action": "shrink" | "reschedule" | "change_cue",
      "reason": "why this adjustment fixes the skip pattern",
      "newTargetMinutes": 15,
      "newCue": "optional improved cue"
    }
  ]
}`;

    try {
      const text = await callClaude(prompt);
      const parsed = extractJsonObject(text);
      const validIds = new Set(habits.map((h) => h.id));

      if (
        parsed &&
        typeof parsed.summary === "string" &&
        typeof parsed.skipPattern === "string" &&
        Array.isArray(parsed.recommendations)
      ) {
        const recs: PlanRecommendation[] = parsed.recommendations
          .filter(
            (r): r is PlanRecommendation =>
              typeof r === "object" &&
              r !== null &&
              typeof (r as PlanRecommendation).habitId === "string" &&
              validIds.has((r as PlanRecommendation).habitId) &&
              typeof (r as PlanRecommendation).reason === "string"
          )
          .slice(0, 4);

        const analysis: CoachAnalysis = {
          summary: parsed.summary,
          skipPattern: parsed.skipPattern,
          topBlocker:
            typeof parsed.topBlocker === "string" ? parsed.topBlocker : "Time",
          recommendations: recs,
          source: "claude",
        };
        return NextResponse.json(analysis);
      }
      throw new Error("Invalid analysis schema");
    } catch {
      return NextResponse.json(buildFallbackAnalysis(habits, dayKeys));
    }
  }

  return NextResponse.json({ error: "Unsupported coach mode" }, { status: 400 });
}
