import { describe, expect, it } from "vitest";
import {
  kcalFromMacros,
  lastDates,
  macrosForQuantity,
  nutritionAverages,
  per100FromOff,
  per100FromTotals,
  shiftISODate,
  validatePer100,
  type DayNutrition,
} from "./fitness";

describe("per100FromOff (Open Food Facts)", () => {
  it("reads kcal and macros per 100 g", () => {
    expect(
      per100FromOff({ "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }),
    ).toEqual({ calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 });
  });
  it("converts kJ to kcal when kcal is missing (418.4 kJ = 100 kcal)", () => {
    expect(per100FromOff({ "energy-kj_100g": 418.4, proteins_100g: 10, carbohydrates_100g: 5, fat_100g: 2 })?.calories).toBe(100);
  });
  it("returns null when a macro is missing — never guesses", () => {
    expect(per100FromOff({ "energy-kcal_100g": 71, proteins_100g: 9, carbohydrates_100g: 3.8 })).toBeNull();
    expect(per100FromOff({ proteins_100g: 9, carbohydrates_100g: 3.8, fat_100g: 2 })).toBeNull();
    expect(per100FromOff(undefined)).toBeNull();
  });
  it("rejects impossible values", () => {
    expect(per100FromOff({ "energy-kcal_100g": 1500, proteins_100g: 9, carbohydrates_100g: 3, fat_100g: 2 })).toBeNull();
  });
});

describe("validatePer100", () => {
  it("accepts realistic values", () => {
    expect(validatePer100({ calories: 120, protein: 23, carbs: 0, fat: 3 })).toBeNull();
  });
  it("rejects macros summing above 100 g", () => {
    expect(validatePer100({ calories: 500, protein: 60, carbs: 30, fat: 20 })).not.toBeNull();
  });
  it("rejects more than 900 kcal per 100 g", () => {
    expect(validatePer100({ calories: 901, protein: 0, carbs: 0, fat: 100 })).not.toBeNull();
  });
});

describe("quantities", () => {
  it("150 g of a 120 kcal / 23 g protein food gives 180 kcal and 34.5 g protein", () => {
    expect(macrosForQuantity({ calories: 120, protein: 23, carbs: 0, fat: 3 }, 150)).toEqual({
      calories: 180,
      protein: 34.5,
      carbs: 0,
      fat: 4.5,
    });
  });
  it("backs out per-100 g values from a logged 200 g item", () => {
    expect(per100FromTotals({ calories: 300, protein_g: 20, carbs_g: 40, fat_g: 6 }, 200)).toEqual({
      calories: 150,
      protein: 10,
      carbs: 20,
      fat: 3,
    });
  });
  it("computes energy from macros (4/4/9)", () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(165);
  });
});

describe("nutritionAverages", () => {
  const day = (date: string, items: number, calories: number, waterMl: number): DayNutrition => ({
    date,
    items,
    calories,
    protein: calories / 10,
    carbs: 0,
    fat: 0,
    waterMl,
  });
  it("averages food only over days with food, water only over days with water", () => {
    const a = nutritionAverages([
      day("2026-10-20", 3, 2000, 0),
      day("2026-10-21", 0, 0, 1500),
      day("2026-10-22", 2, 2400, 2500),
    ]);
    expect(a.foodDays).toBe(2);
    expect(a.calories).toBe(2200);
    expect(a.protein).toBe(220);
    expect(a.waterDays).toBe(2);
    expect(a.waterMl).toBe(2000);
  });
  it("returns zeros with no logged day", () => {
    expect(nutritionAverages([day("2026-10-20", 0, 0, 0)]).calories).toBe(0);
  });
});

describe("dates", () => {
  it("lists the last 7 days ending today, oldest first", () => {
    const d = lastDates(7, new Date(2026, 9, 27));
    expect(d[0]).toBe("2026-10-21");
    expect(d[6]).toBe("2026-10-27");
  });
  it("shifts across month ends", () => {
    expect(shiftISODate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftISODate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
