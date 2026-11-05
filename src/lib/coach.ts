// Client-safe types and helpers for the AI coach (tool outputs rendered as cards in the chat).
import { macrosForQuantity, sumMacros, type MacroTotals, type MealType, type Per100 } from "@/lib/fitness";

export const COACH_DEFAULT_TITLE = "Nouvelle discussion";

export type PlanFoodItem = {
  ref: string;
  name: string;
  brand: string | null;
  grams: number;
  per100: Per100;
  source: "custom" | "openfoodfacts";
  foodId: string | null;
  externalId: string | null;
  totals: MacroTotals;
};

export type PlanMeal = { mealType: MealType; items: PlanFoodItem[]; totals: MacroTotals };

export type MealPlanOutput = {
  date: string;
  meals: PlanMeal[];
  totals: MacroTotals;
  /** References the coach used that could not be matched to a real product (left out, never invented). */
  skipped: string[];
};

export type ProgramPlanExercise = { exerciseId: string; name: string; sets: number; reps: string; restSeconds: number };
export type ProgramPlanDay = { name: string; weekdays: number[]; exercises: ProgramPlanExercise[] };
export type ProgramPlanOutput = { name: string; description: string | null; days: ProgramPlanDay[]; skipped: string[] };

/** Builds a plan item from real per-100 g values; totals are always computed, never taken from the model. */
export function planItem(base: Omit<PlanFoodItem, "totals" | "grams">, grams: number): PlanFoodItem {
  const g = Math.round(grams);
  return { ...base, grams: g, totals: macrosForQuantity(base.per100, g) };
}

export function planMeal(mealType: MealType, items: PlanFoodItem[]): PlanMeal {
  return { mealType, items, totals: sumMacros(items.map((i) => ({ calories: i.totals.calories, protein_g: i.totals.protein, carbs_g: i.totals.carbs, fat_g: i.totals.fat }))) };
}

export function planTotals(meals: PlanMeal[]): MacroTotals {
  return sumMacros(meals.map((m) => ({ calories: m.totals.calories, protein_g: m.totals.protein, carbs_g: m.totals.carbs, fat_g: m.totals.fat })));
}

/** What is left to eat today to reach the goals (never negative). */
export function remainingMacros(goals: MacroTotals, eaten: MacroTotals): MacroTotals {
  const left = (g: number, e: number) => Math.max(0, Math.round((g - e) * 10) / 10);
  return {
    calories: left(goals.calories, eaten.calories),
    protein: left(goals.protein, eaten.protein),
    carbs: left(goals.carbs, eaten.carbs),
    fat: left(goals.fat, eaten.fat),
  };
}

/** Thread title from the first user message: first line, at most 60 characters. */
export function threadTitleFrom(text: string): string {
  const line = text.trim().split("\n")[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (!line) return COACH_DEFAULT_TITLE;
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}
