// Pure fitness / nutrition calculations. Keep free of I/O so they stay testable.

export type Per100 = { calories: number; protein: number; carbs: number; fat: number };
export type MacroTotals = { calories: number; protein: number; carbs: number; fat: number };

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Estimated one-rep max (Epley formula). */
export function estimate1RM(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return round1(weightKg);
  return round1(weightKg * (1 + reps / 30));
}

/** Volume of one set = load × reps. */
export function setVolume(weightKg?: number | null, reps?: number | null): number {
  if (!weightKg || !reps || weightKg < 0 || reps < 0) return 0;
  return round1(weightKg * reps);
}

/** Nutrition values for a given quantity, from values per 100 g. */
export function macrosForQuantity(per100: Per100, grams: number): MacroTotals {
  const f = grams > 0 ? grams / 100 : 0;
  return {
    calories: Math.round(per100.calories * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  };
}

export function sumMacros(
  items: { calories: number; protein_g: number; carbs_g: number; fat_g: number }[],
): MacroTotals {
  const t = items.reduce(
    (acc, i) => ({
      calories: acc.calories + Number(i.calories || 0),
      protein: acc.protein + Number(i.protein_g || 0),
      carbs: acc.carbs + Number(i.carbs_g || 0),
      fat: acc.fat + Number(i.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: Math.round(t.calories),
    protein: round1(t.protein),
    carbs: round1(t.carbs),
    fat: round1(t.fat),
  };
}

/** Latest weight and the change since the previous weigh-in. */
export function weightTrend(entries: { measured_on: string; weight_kg: number | null }[]) {
  const withWeight = entries
    .filter((e) => e.weight_kg != null)
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on));
  const current = withWeight[0]?.weight_kg != null ? Number(withWeight[0].weight_kg) : null;
  const previous = withWeight[1]?.weight_kg != null ? Number(withWeight[1].weight_kg) : null;
  const delta = current != null && previous != null ? round1(current - previous) : null;
  return { current, previous, delta };
}

/** Progress (0–100) from a start value towards a target, in either direction. */
export function goalProgress(
  start: number | null | undefined,
  current: number | null | undefined,
  target: number,
): number {
  if (start == null || current == null) return 0;
  if (target === start) return current === target ? 100 : 0;
  const p = ((current - start) / (target - start)) * 100;
  return Math.round(Math.min(100, Math.max(0, p)));
}

export function percentOf(value: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / goal) * 100)));
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday 00:00 of the week containing the date. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${m} min`;
}

export function ageFromBirthDate(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type MainGoal = "lose_fat" | "gain_muscle" | "recomposition" | "strength" | "maintain";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUST: Record<MainGoal, number> = {
  lose_fat: -0.15,
  gain_muscle: 0.1,
  recomposition: 0,
  strength: 0.05,
  maintain: 0,
};

/**
 * Suggested daily targets (Mifflin-St Jeor × activity, adjusted for the goal).
 * Protein 2 g/kg, fat 0.9 g/kg, carbs fill the rest. Water 35 ml/kg.
 */
export function suggestNutritionGoals(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: MainGoal;
}) {
  const sexOffset = input.sex === "male" ? 5 : input.sex === "female" ? -161 : -78;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexOffset;
  const tdee = bmr * ACTIVITY_FACTOR[input.activity];
  const calories = Math.round((tdee * (1 + GOAL_ADJUST[input.goal])) / 10) * 10;
  const protein = Math.round(input.weightKg * 2);
  const fat = Math.round(input.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const water = Math.round((input.weightKg * 35) / 100) * 100;
  return { calories, protein, carbs, fat, water };
}

export const MAIN_GOAL_LABELS: Record<MainGoal, string> = {
  lose_fat: "Perte de gras",
  gain_muscle: "Prise de masse",
  recomposition: "Recomposition",
  strength: "Force",
  maintain: "Entretien",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sédentaire",
  light: "Légèrement actif",
  moderate: "Modérément actif",
  active: "Très actif",
  very_active: "Extrêmement actif",
};

export const SEX_LABELS: Record<Sex, string> = {
  male: "Homme",
  female: "Femme",
  other: "Autre / non précisé",
};

export function parseNum(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
