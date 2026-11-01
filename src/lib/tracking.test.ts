import { describe, expect, it } from "vitest";
import {
  bestRepsAtWeight,
  buildNutritionDays,
  calendarState,
  calorieDaysOnTarget,
  dueReminders,
  goalCurrentValue,
  goalProgress,
  isGoalReached,
  monthGrid,
  planFromTemplates,
  sessionDay,
  weekDates,
  type GoalData,
} from "./fitness";

const set = (weight_kg: number, reps: number, extra: Partial<{ set_type: string; completed: boolean }> = {}) => ({
  weight_kg,
  reps,
  set_type: "normal",
  completed: true,
  ...extra,
});

const baseData = (over: Partial<GoalData> = {}): GoalData => ({
  sessions: [],
  measurements: [],
  nutritionDays: [],
  calorieGoal: 2000,
  now: new Date(2026, 9, 29, 12), // Thu 29 Oct 2026
  ...over,
});

const goal = (metric: string, over: Record<string, unknown> = {}) => ({
  metric,
  exercise_id: null as string | null,
  reference_weight_kg: null as number | null,
  current_value: null as number | null,
  ...over,
});

describe("goal progress and reached state", () => {
  it("bench 80 → 100 kg, now 90 kg = 50 %", () => {
    expect(goalProgress(80, 90, 100)).toBe(50);
    expect(isGoalReached(80, 90, 100)).toBe(false);
    expect(isGoalReached(80, 100, 100)).toBe(true);
  });
  it("weight 72 → 65 kg (going down), now 65.5 kg is not reached, 65 kg is", () => {
    expect(goalProgress(72, 68.5, 65)).toBe(50);
    expect(isGoalReached(72, 65.5, 65)).toBe(false);
    expect(isGoalReached(72, 64.8, 65)).toBe(true);
  });
  it("no current value means not reached", () => {
    expect(isGoalReached(0, null, 10)).toBe(false);
  });
});

describe("strength goals", () => {
  const sessions = [
    {
      started_at: "2026-10-20T18:00:00Z",
      total_volume_kg: 0,
      workout_exercises: [
        { exercise_id: "pullup", workout_sets: [set(20, 6), set(20, 8), set(25, 4), set(0, 15), set(20, 12, { set_type: "warmup" })] },
        { exercise_id: "bench", workout_sets: [set(90, 5), set(95, 1), set(100, 1, { completed: false })] },
      ],
    },
  ];
  it("10 pull-ups with 20 kg: best is 8 reps (warm-ups and lighter sets ignored)", () => {
    expect(bestRepsAtWeight(sessions[0]!.workout_exercises[0]!.workout_sets, 20)).toBe(8);
    expect(goalCurrentValue(goal("reps_at_weight", { exercise_id: "pullup", reference_weight_kg: 20 }), baseData({ sessions }))).toBe(8);
  });
  it("max weight ignores unvalidated sets: 95 kg, not 100 kg", () => {
    expect(goalCurrentValue(goal("max_weight", { exercise_id: "bench" }), baseData({ sessions }))).toBe(95);
  });
  it("estimated 1RM uses Epley: 90 kg × 5 = 105 kg", () => {
    expect(goalCurrentValue(goal("est_1rm", { exercise_id: "bench" }), baseData({ sessions }))).toBe(105);
  });
  it("no data on the exercise gives null", () => {
    expect(goalCurrentValue(goal("max_weight", { exercise_id: "squat" }), baseData({ sessions }))).toBeNull();
  });
});

describe("training goals count only the current week (from Monday)", () => {
  const s = (iso: string, vol: number) => ({ started_at: iso, total_volume_kg: vol, workout_exercises: [] });
  const sessions = [s("2026-10-25T10:00:00", 5000), s("2026-10-26T10:00:00", 4000), s("2026-10-28T10:00:00", 3500.5)];
  it("2 sessions since Monday 26 Oct (Sunday 25 excluded)", () => {
    expect(goalCurrentValue(goal("weekly_sessions"), baseData({ sessions }))).toBe(2);
  });
  it("weekly volume 7500.5 kg", () => {
    expect(goalCurrentValue(goal("weekly_volume"), baseData({ sessions }))).toBe(7500.5);
  });
});

describe("body goals use the latest measurement that has the value", () => {
  const measurements = [
    { measured_on: "2026-10-01", weight_kg: 74, body_fat_pct: 18 },
    { measured_on: "2026-10-20", weight_kg: 72.4, body_fat_pct: null },
  ];
  it("weight = 72.4 kg, body fat = 18 %", () => {
    expect(goalCurrentValue(goal("weight_kg"), baseData({ measurements }))).toBe(72.4);
    expect(goalCurrentValue(goal("body_fat_pct"), baseData({ measurements }))).toBe(18);
    expect(goalCurrentValue(goal("waist_cm"), baseData({ measurements }))).toBeNull();
  });
});

describe("nutrition goals", () => {
  const item = (calories: number, protein_g: number) => ({ calories, protein_g, carbs_g: 0, fat_g: 0 });
  const days = buildNutritionDays(
    ["2026-10-27", "2026-10-28", "2026-10-29"],
    [
      { eaten_on: "2026-10-27", meal_items: [item(1900, 140)] },
      { eaten_on: "2026-10-28", meal_items: [item(1500, 160)] },
    ],
    [{ drank_on: "2026-10-28", amount_ml: 2000 }],
  );
  it("protein average counts only logged days: (140 + 160) / 2 = 150 g", () => {
    expect(goalCurrentValue(goal("avg_protein"), baseData({ nutritionDays: days }))).toBe(150);
  });
  it("water average ignores days without water: 2000 ml", () => {
    expect(goalCurrentValue(goal("avg_water"), baseData({ nutritionDays: days }))).toBe(2000);
  });
  it("days within ±10 % of 2000 kcal: 1900 counts, 1500 and empty days don't", () => {
    expect(calorieDaysOnTarget(days, 2000)).toBe(1);
  });
  it("manual goals return the value typed by the user", () => {
    expect(goalCurrentValue(goal("manual", { current_value: 12 }), baseData())).toBe(12);
  });
});

describe("calendar", () => {
  it("October 2026 grid starts Monday 28 Sept and ends Sunday 1 Nov", () => {
    const g = monthGrid("2026-10-15");
    expect(g[0]).toBe("2026-09-28");
    expect(g[g.length - 1]).toBe("2026-11-01");
    expect(g.length % 7).toBe(0);
  });
  it("week of Thu 29 Oct runs Mon 26 → Sun 1 Nov", () => {
    expect(weekDates("2026-10-29")).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });
  it("a planned session before today that wasn't done is missed", () => {
    expect(calendarState({ status: "scheduled", scheduled_date: "2026-10-28" }, "2026-10-29")).toBe("missed");
    expect(calendarState({ status: "scheduled", scheduled_date: "2026-10-29" }, "2026-10-29")).toBe("scheduled");
    expect(calendarState({ status: "completed", scheduled_date: "2026-10-20" }, "2026-10-29")).toBe("completed");
  });
  it("a done session shows on the day it was done, not the planned day", () => {
    expect(sessionDay({ status: "completed", started_at: "2026-10-28T09:00:00", scheduled_date: "2026-10-27" })).toBe("2026-10-28");
    expect(sessionDay({ status: "scheduled", started_at: null, scheduled_date: "2026-10-30" })).toBe("2026-10-30");
  });
  it("planning a Mon/Wed/Fri program for 1 week from Thu 29 Oct skips days already planned", () => {
    const plan = planFromTemplates(
      [{ id: "a", name: "Push", weekdays: [1, 5] }, { id: "b", name: "Pull", weekdays: [3] }],
      "2026-10-29",
      1,
      [{ template_id: "a", day: "2026-10-30" }],
    );
    expect(plan).toEqual([
      { template_id: "a", name: "Push", scheduled_date: "2026-11-02" },
      { template_id: "b", name: "Pull", scheduled_date: "2026-11-04" },
    ]);
  });
});

describe("reminders", () => {
  const r = (id: string, time: string, weekdays = [1, 2, 3, 4, 5, 6, 7], enabled = true) => ({ id, time_of_day: time, weekdays, enabled });
  const thu1830 = new Date(2026, 9, 29, 18, 30);
  it("fires once the time has passed, on a planned weekday", () => {
    expect(dueReminders([r("a", "18:00:00")], thu1830, new Set()).map((x) => x.id)).toEqual(["a"]);
  });
  it("not before the time, not on another weekday, not when disabled", () => {
    expect(dueReminders([r("a", "19:00"), r("b", "18:00", [1]), r("c", "18:00", undefined, false)], thu1830, new Set())).toEqual([]);
  });
  it("not twice the same day", () => {
    expect(dueReminders([r("a", "18:00")], thu1830, new Set(["a|2026-10-29"]))).toEqual([]);
  });
  it("not when more than 2 hours late", () => {
    expect(dueReminders([r("a", "16:00")], thu1830, new Set())).toEqual([]);
  });
});
