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
