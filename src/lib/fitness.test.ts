import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  goalProgress,
  macrosForQuantity,
  setVolume,
  suggestNutritionGoals,
  sumMacros,
  weightTrend,
} from "./fitness";

describe("estimate1RM (Epley)", () => {
  it("estimates 100 kg × 5 at 116.7 kg", () => {
    expect(estimate1RM(100, 5)).toBe(116.7);
  });
  it("returns the load itself for a single rep", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it("returns 0 for invalid input", () => {
    expect(estimate1RM(0, 5)).toBe(0);
  });
});

describe("setVolume", () => {
  it("multiplies load by reps", () => {
    expect(setVolume(60, 10)).toBe(600);
  });
});

describe("macrosForQuantity", () => {
  it("scales values given per 100 g to the eaten quantity", () => {
    expect(macrosForQuantity({ calories: 130, protein: 2.7, carbs: 28, fat: 0.4 }, 150)).toEqual({
      calories: 195,
      protein: 4.1,
      carbs: 42,
      fat: 0.6,
    });
  });
});

describe("sumMacros", () => {
  it("adds meal items together", () => {
    expect(
      sumMacros([
        { calories: 195, protein_g: 4.1, carbs_g: 42, fat_g: 0.6 },
        { calories: 264, protein_g: 49.6, carbs_g: 0, fat_g: 5.8 },
      ]),
    ).toEqual({ calories: 459, protein: 53.7, carbs: 42, fat: 6.4 });
  });
});

describe("weightTrend", () => {
  it("compares the latest weigh-in with the previous one", () => {
    expect(
      weightTrend([
        { measured_on: "2026-10-01", weight_kg: 80 },
        { measured_on: "2026-10-15", weight_kg: 78.6 },
        { measured_on: "2026-10-08", weight_kg: 79.2 },
      ]),
    ).toEqual({ current: 78.6, previous: 79.2, delta: -0.6 });
  });
});

describe("goalProgress", () => {
  it("works for decreasing goals (80 → 70 kg, now 75 kg = 50%)", () => {
    expect(goalProgress(80, 75, 70)).toBe(50);
  });
  it("caps at 100%", () => {
    expect(goalProgress(60, 110, 100)).toBe(100);
  });
});

describe("suggestNutritionGoals", () => {
  it("suggests targets for an 80 kg, 180 cm, 30-year-old moderately active man maintaining", () => {
    expect(
      suggestNutritionGoals({
        sex: "male",
        weightKg: 80,
        heightCm: 180,
        age: 30,
        activity: "moderate",
        goal: "maintain",
      }),
    ).toEqual({ calories: 2760, protein: 160, carbs: 368, fat: 72, water: 2800 });
  });
});

import { detectRecords, exerciseBests, formatClock, periodStart, totalVolume } from "./fitness";

describe("totalVolume", () => {
  it("counts only validated, non warm-up sets", () => {
    expect(
      totalVolume([
        { weight_kg: 40, reps: 10, set_type: "warmup", completed: true },
        { weight_kg: 80, reps: 8, set_type: "normal", completed: true },
        { weight_kg: 80, reps: 8, set_type: "normal", completed: false },
        { weight_kg: "60", reps: 10, set_type: "dropset", completed: true },
      ]),
    ).toBe(1240);
  });
});

describe("exerciseBests", () => {
  const sets = [
    { id: "a", weight_kg: 100, reps: 5, set_type: "normal", completed: true },
    { id: "b", weight_kg: 90, reps: 8, set_type: "normal", completed: true },
    { id: "c", weight_kg: 120, reps: 1, set_type: "warmup", completed: true },
  ];
  it("takes the heaviest working set as max weight, ignoring warm-ups", () => {
    expect(exerciseBests(sets).find((b) => b.type === "max_weight")).toMatchObject({ value: 100, set_id: "a" });
  });
  it("keeps the best estimated 1RM across sets (100 × 5 = 116.7 beats 90 × 8 = 114)", () => {
    expect(exerciseBests(sets).find((b) => b.type === "est_1rm")).toMatchObject({ value: 116.7, set_id: "a" });
  });
  it("returns nothing when no set was validated", () => {
    expect(exerciseBests([{ weight_kg: 100, reps: 5, set_type: "normal", completed: false }])).toEqual([]);
  });
});

describe("detectRecords", () => {
  const bests = [
    { type: "max_weight" as const, value: 100, weight_kg: 100, reps: 5, set_id: "a" },
    { type: "max_reps" as const, value: 8, weight_kg: 90, reps: 8, set_id: "b" },
  ];
  it("flags only values strictly above the previous best", () => {
    expect(detectRecords(bests, { max_weight: 100, max_reps: 7 }).map((r) => r.type)).toEqual(["max_reps"]);
  });
  it("treats a first performance as a new record", () => {
    expect(detectRecords(bests, {})).toHaveLength(2);
  });
});

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(307)).toBe("05:07");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("periodStart", () => {
  it("includes today in a 7-day period", () => {
    const start = periodStart("7", new Date(2026, 9, 24, 15, 0));
    expect(start?.getDate()).toBe(18);
  });
  it("has no start for 'Tout'", () => {
    expect(periodStart("all")).toBeNull();
  });
});
