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

// ───────────────────────── Workouts ─────────────────────────

export type SetType = "normal" | "warmup" | "dropset" | "failure";
export type RecordType = "max_weight" | "est_1rm" | "max_reps" | "max_volume";

export type LoggedSet = {
  id?: string | null;
  weight_kg: number | string | null;
  reps: number | null;
  set_type: string;
  completed: boolean;
};

/** Sets that count for volume and records: validated, not a warm-up, at least one rep. */
export function workingSets<T extends LoggedSet>(sets: T[]): T[] {
  return sets.filter((s) => s.completed && s.set_type !== "warmup" && (s.reps ?? 0) > 0);
}

/** Total volume (load × reps) of the working sets. Warm-ups and unvalidated sets don't count. */
export function totalVolume(sets: LoggedSet[]): number {
  return round1(
    workingSets(sets).reduce((t, s) => t + setVolume(Number(s.weight_kg ?? 0), s.reps), 0),
  );
}

export type ExerciseBest = {
  type: RecordType;
  value: number;
  weight_kg: number | null;
  reps: number | null;
  set_id: string | null;
};

/** Best values reached on one exercise during one session. */
export function exerciseBests(sets: LoggedSet[]): ExerciseBest[] {
  const ws = workingSets(sets).map((s) => ({ ...s, w: Number(s.weight_kg ?? 0), r: s.reps ?? 0 }));
  if (ws.length === 0) return [];
  const out: ExerciseBest[] = [];

  const loaded = ws.filter((s) => s.w > 0);
  if (loaded.length > 0) {
    const heaviest = loaded.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
    out.push({ type: "max_weight", value: heaviest.w, weight_kg: heaviest.w, reps: heaviest.r, set_id: heaviest.id ?? null });

    const best1rm = loaded.reduce((a, b) => (estimate1RM(b.w, b.r) > estimate1RM(a.w, a.r) ? b : a));
    out.push({ type: "est_1rm", value: estimate1RM(best1rm.w, best1rm.r), weight_kg: best1rm.w, reps: best1rm.r, set_id: best1rm.id ?? null });
  }

  const mostReps = ws.reduce((a, b) => (b.r > a.r || (b.r === a.r && b.w > a.w) ? b : a));
  out.push({ type: "max_reps", value: mostReps.r, weight_kg: mostReps.w || null, reps: mostReps.r, set_id: mostReps.id ?? null });

  const volume = totalVolume(sets);
  if (volume > 0) out.push({ type: "max_volume", value: volume, weight_kg: null, reps: null, set_id: null });

  return out;
}

/** Bests that strictly beat the previous best of the same type (no previous best = new record). */
export function detectRecords(
  bests: ExerciseBest[],
  previous: Partial<Record<RecordType, number>>,
): (ExerciseBest & { previous: number | null })[] {
  return bests
    .filter((b) => b.value > (previous[b.type] ?? 0))
    .map((b) => ({ ...b, previous: previous[b.type] ?? null }));
}

/** Stopwatch format: 05:07 or 1:02:05. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const PERIOD_OPTIONS = [
  { key: "7", label: "7 j", days: 7 },
  { key: "30", label: "30 j", days: 30 },
  { key: "90", label: "3 mois", days: 90 },
  { key: "180", label: "6 mois", days: 180 },
  { key: "365", label: "1 an", days: 365 },
  { key: "all", label: "Tout", days: null },
] as const;
export type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"];

/** Start of the period (local midnight, N days ago), or null for "all". */
export function periodStart(key: PeriodKey, now: Date = new Date()): Date | null {
  const days = PERIOD_OPTIONS.find((p) => p.key === key)?.days ?? null;
  if (days == null) return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: "Charge max",
  est_1rm: "1RM estimé",
  max_reps: "Répétitions max",
  max_volume: "Volume max (séance)",
};

export const RECORD_UNITS: Record<RecordType, string> = {
  max_weight: "kg",
  est_1rm: "kg",
  max_reps: "reps",
  max_volume: "kg",
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: "Normale",
  warmup: "Échauffement",
  dropset: "Dégressive",
  failure: "Échec",
};

// ───────────────────────── Nutrition ─────────────────────────

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: { key: MealType; label: string; short: string }[] = [
  { key: "breakfast", label: "Petit-déjeuner", short: "au petit-déjeuner" },
  { key: "lunch", label: "Déjeuner", short: "au déjeuner" },
  { key: "dinner", label: "Dîner", short: "au dîner" },
  { key: "snack", label: "Collations", short: "aux collations" },
];

/** kJ → kcal (1 kcal = 4.184 kJ). */
export const KJ_PER_KCAL = 4.184;

/**
 * Values per 100 g from Open Food Facts `nutriments`.
 * Returns null when energy, protein, carbs or fat is missing or impossible — values are never guessed.
 * Energy in kcal falls back to the kJ value converted.
 */
export function per100FromOff(n: Record<string, unknown> | null | undefined): Per100 | null {
  if (!n) return null;
  const num = (k: string): number | null => {
    const raw = n[k];
    const v = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  };
  let kcal = num("energy-kcal_100g");
  if (kcal == null) {
    const kj = num("energy-kj_100g") ?? num("energy_100g");
    if (kj != null) kcal = kj / KJ_PER_KCAL;
  }
  const protein = num("proteins_100g");
  const carbs = num("carbohydrates_100g");
  const fat = num("fat_100g");
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  const values = { calories: Math.round(kcal), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) };
  return validatePer100(values) ? null : values;
}

/** Error message for impossible values per 100 g, or null when they are valid. */
export function validatePer100(v: Per100): string | null {
  const ok = (x: number) => Number.isFinite(x) && x >= 0;
  if (!ok(v.calories) || v.calories > 900) return "Calories : entre 0 et 900 kcal pour 100 g.";
  if (!ok(v.protein) || v.protein > 100) return "Protéines : entre 0 et 100 g pour 100 g.";
  if (!ok(v.carbs) || v.carbs > 100) return "Glucides : entre 0 et 100 g pour 100 g.";
  if (!ok(v.fat) || v.fat > 100) return "Lipides : entre 0 et 100 g pour 100 g.";
  if (v.protein + v.carbs + v.fat > 100.5) return "Protéines + glucides + lipides ne peuvent pas dépasser 100 g pour 100 g.";
  return null;
}

/** Energy from macros: 4 kcal/g protein and carbs, 9 kcal/g fat. */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

/** Back out values per 100 g from a logged item (used when the original food was deleted). */
export function per100FromTotals(
  item: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  grams: number,
): Per100 {
  if (!(grams > 0)) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const f = 100 / grams;
  return {
    calories: Number(item.calories) * f,
    protein: Number(item.protein_g) * f,
    carbs: Number(item.carbs_g) * f,
    fat: Number(item.fat_g) * f,
  };
}

export type DayNutrition = { date: string; items: number } & MacroTotals & { waterMl: number };

/**
 * Daily averages over the days that were actually logged:
 * food averages count only days with at least one food, water averages only days with water.
 */
export function nutritionAverages(days: DayNutrition[]) {
  const food = days.filter((d) => d.items > 0);
  const water = days.filter((d) => d.waterMl > 0);
  const avg = (rows: DayNutrition[], k: "calories" | "protein" | "carbs" | "fat" | "waterMl") =>
    rows.length ? rows.reduce((s, d) => s + d[k], 0) / rows.length : 0;
  return {
    foodDays: food.length,
    waterDays: water.length,
    calories: Math.round(avg(food, "calories")),
    protein: round1(avg(food, "protein")),
    carbs: round1(avg(food, "carbs")),
    fat: round1(avg(food, "fat")),
    waterMl: Math.round(avg(water, "waterMl")),
  };
}

/** Last `count` local dates ending at `end` (oldest first). */
export function lastDates(count: number, end: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (count - 1 - i));
    return toISODate(d);
  });
}

/** Add days to a YYYY-MM-DD date, in local time. */
export function shiftISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

// ───────────────────────── Suivi avancé : objectifs ─────────────────────────

export type GoalCategory = "strength" | "training" | "body" | "nutrition";
export type GoalMetric =
  | "max_weight"
  | "est_1rm"
  | "reps_at_weight"
  | "weekly_sessions"
  | "weekly_volume"
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "waist_cm"
  | "chest_cm"
  | "arm_cm"
  | "thigh_cm"
  | "calf_cm"
  | "avg_protein"
  | "avg_calories"
  | "calorie_days"
  | "avg_water"
  | "manual";

export const GOAL_CATEGORIES: { key: GoalCategory; label: string }[] = [
  { key: "strength", label: "Musculation" },
  { key: "training", label: "Entraînement" },
  { key: "body", label: "Physique" },
  { key: "nutrition", label: "Alimentation" },
];

export type GoalMetricInfo = {
  key: GoalMetric;
  category: GoalCategory | "any";
  label: string;
  unit: string;
  hint: string;
  needsExercise?: boolean;
  needsWeight?: boolean;
};

export const GOAL_METRICS: GoalMetricInfo[] = [
  { key: "max_weight", category: "strength", label: "Charge max sur un exercice", unit: "kg", hint: "Ta meilleure charge sur une série validée.", needsExercise: true },
  { key: "est_1rm", category: "strength", label: "1RM estimé", unit: "kg", hint: "Calculé avec la formule d'Epley sur tes séries validées.", needsExercise: true },
  { key: "reps_at_weight", category: "strength", label: "Répétitions avec une charge", unit: "reps", hint: "Ex. : 10 tractions avec 20 kg de lest.", needsExercise: true, needsWeight: true },
  { key: "weekly_sessions", category: "training", label: "Séances par semaine", unit: "séances", hint: "Séances terminées depuis lundi." },
  { key: "weekly_volume", category: "training", label: "Volume par semaine", unit: "kg", hint: "Charge × répétitions depuis lundi (échauffements exclus)." },
  { key: "weight_kg", category: "body", label: "Poids", unit: "kg", hint: "Ta dernière pesée." },
  { key: "body_fat_pct", category: "body", label: "Masse grasse", unit: "%", hint: "Ta dernière mesure." },
  { key: "muscle_mass_kg", category: "body", label: "Masse musculaire", unit: "kg", hint: "Ta dernière mesure." },
  { key: "waist_cm", category: "body", label: "Tour de taille", unit: "cm", hint: "Ta dernière mesure." },
  { key: "chest_cm", category: "body", label: "Tour de poitrine", unit: "cm", hint: "Ta dernière mesure." },
  { key: "arm_cm", category: "body", label: "Tour de bras", unit: "cm", hint: "Ta dernière mesure." },
  { key: "thigh_cm", category: "body", label: "Tour de cuisse", unit: "cm", hint: "Ta dernière mesure." },
  { key: "calf_cm", category: "body", label: "Tour de mollet", unit: "cm", hint: "Ta dernière mesure." },
  { key: "avg_protein", category: "nutrition", label: "Protéines par jour", unit: "g", hint: "Moyenne des 7 derniers jours où tu as noté tes repas." },
  { key: "avg_calories", category: "nutrition", label: "Calories par jour", unit: "kcal", hint: "Moyenne des 7 derniers jours où tu as noté tes repas." },
  { key: "calorie_days", category: "nutrition", label: "Jours dans l'objectif calorique", unit: "jours", hint: "Jours à ±10 % de ton objectif calorique sur les 7 derniers jours." },
  { key: "avg_water", category: "nutrition", label: "Hydratation par jour", unit: "ml", hint: "Moyenne des 7 derniers jours où tu as noté ton eau." },
  { key: "manual", category: "any", label: "Suivi manuel", unit: "", hint: "Tu mets à jour la valeur actuelle toi-même." },
];

export function goalMetricInfo(key: string | null | undefined): GoalMetricInfo {
  return GOAL_METRICS.find((m) => m.key === key) ?? GOAL_METRICS[GOAL_METRICS.length - 1]!;
}

/** True when the current value has reached the target, in the goal's direction (up or down). */
export function isGoalReached(start: number | null | undefined, current: number | null | undefined, target: number): boolean {
  if (current == null) return false;
  const s = start ?? 0;
  return target >= s ? current >= target : current <= target;
}

/** Most reps on one working set done with at least `minWeightKg`. */
export function bestRepsAtWeight(sets: LoggedSet[], minWeightKg: number): number | null {
  const ok = workingSets(sets).filter((s) => Number(s.weight_kg ?? 0) >= minWeightKg);
  if (ok.length === 0) return null;
  return Math.max(...ok.map((s) => s.reps ?? 0));
}

export type GoalSession = {
  started_at: string | null;
  total_volume_kg: number | string | null;
  workout_exercises: { exercise_id: string; workout_sets: LoggedSet[] }[];
};

export type GoalData = {
  sessions: GoalSession[];
  measurements: ({ measured_on: string } & Partial<Record<string, unknown>>)[];
  /** Nutrition of the last 7 days (any order). */
  nutritionDays: DayNutrition[];
  calorieGoal: number;
  now?: Date;
};

/** Days within ±tolerance of the calorie goal, counting only days with logged food. */
export function calorieDaysOnTarget(days: DayNutrition[], goal: number, tolerance = 0.1): number {
  if (!(goal > 0)) return 0;
  return days.filter((d) => d.items > 0 && Math.abs(d.calories - goal) <= goal * tolerance).length;
}

/** Current value of a goal, computed from logged data. Null when there is nothing to measure yet. */
export function goalCurrentValue(
  goal: { metric: string | null; exercise_id: string | null; reference_weight_kg: number | string | null; current_value: number | string | null },
  data: GoalData,
): number | null {
  const metric = goalMetricInfo(goal.metric).key;
  const now = data.now ?? new Date();
  switch (metric) {
    case "manual":
      return goal.current_value != null ? Number(goal.current_value) : null;
    case "max_weight":
    case "est_1rm":
    case "reps_at_weight": {
      const sets = data.sessions.flatMap((s) =>
        s.workout_exercises.filter((we) => we.exercise_id === goal.exercise_id).flatMap((we) => we.workout_sets),
      );
      if (metric === "reps_at_weight") return bestRepsAtWeight(sets, Number(goal.reference_weight_kg ?? 0));
      const best = exerciseBests(sets).find((b) => b.type === metric);
      return best ? best.value : null;
    }
    case "weekly_sessions":
    case "weekly_volume": {
      const start = startOfWeek(now).getTime();
      const week = data.sessions.filter((s) => s.started_at && new Date(s.started_at).getTime() >= start);
      if (metric === "weekly_sessions") return week.length;
      return round1(week.reduce((t, s) => t + Number(s.total_volume_kg ?? 0), 0));
    }
    case "avg_protein":
    case "avg_calories":
    case "avg_water": {
      const avg = nutritionAverages(data.nutritionDays);
      if (metric === "avg_water") return avg.waterDays > 0 ? avg.waterMl : null;
      if (avg.loggedDays === 0) return null;
      return metric === "avg_protein" ? avg.protein : avg.calories;
    }
    case "calorie_days":
      return calorieDaysOnTarget(data.nutritionDays, data.calorieGoal);
    default: {
      const m = [...data.measurements]
        .sort((a, b) => b.measured_on.localeCompare(a.measured_on))
        .find((x) => x[metric] != null);
      return m ? Number(m[metric]) : null;
    }
  }
}

// ───────────────────────── Suivi avancé : calendrier ─────────────────────────

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** The 7 dates (Mon→Sun) of the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = startOfWeek(parseISODate(iso));
  return Array.from({ length: 7 }, (_, i) => shiftISODate(toISODate(monday), i));
}

/** Full weeks (Mon→Sun) covering the month of `iso`: 4 to 6 rows of 7 dates. */
export function monthGrid(iso: string): string[] {
  const d = parseISODate(iso);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const start = toISODate(startOfWeek(first));
  const end = weekDates(toISODate(last))[6]!;
  const out: string[] = [];
  for (let cur = start; cur <= end; cur = shiftISODate(cur, 1)) out.push(cur);
  return out;
}

export function shiftMonth(iso: string, delta: number): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

export type CalendarState = "completed" | "in_progress" | "scheduled" | "missed" | "skipped";

export function calendarState(s: { status: string; scheduled_date: string | null }, today: string): CalendarState {
  if (s.status === "completed") return "completed";
  if (s.status === "in_progress") return "in_progress";
  if (s.status === "skipped") return "skipped";
  return s.scheduled_date && s.scheduled_date < today ? "missed" : "scheduled";
}

/** Calendar day of a session: the day it was done, otherwise the planned day. */
export function sessionDay(s: { status: string; started_at: string | null; scheduled_date: string | null }): string | null {
  if ((s.status === "completed" || s.status === "in_progress") && s.started_at) return toISODate(new Date(s.started_at));
  return s.scheduled_date;
}

/**
 * Sessions to schedule from a program's weekdays, from `fromISO` for `weeks` weeks.
 * Skips days where the same template is already planned or done.
 */
export function planFromTemplates(
  templates: { id: string; name: string; weekdays: number[] }[],
  fromISO: string,
  weeks: number,
  existing: { template_id: string | null; day: string | null }[],
): { template_id: string; name: string; scheduled_date: string }[] {
  const taken = new Set(existing.filter((e) => e.template_id && e.day).map((e) => `${e.template_id}|${e.day}`));
  const out: { template_id: string; name: string; scheduled_date: string }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = shiftISODate(fromISO, i);
    const wd = isoWeekday(parseISODate(day));
    for (const t of templates) {
      if (!t.weekdays.includes(wd) || taken.has(`${t.id}|${day}`)) continue;
      out.push({ template_id: t.id, name: t.name, scheduled_date: day });
    }
  }
  return out;
}

// ───────────────────────── Suivi avancé : rappels ─────────────────────────

export type ReminderLike = { id: string; enabled: boolean; weekdays: number[]; time_of_day: string };

/** Minutes since midnight for "HH:MM" or "HH:MM:SS". */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Reminders that should fire now: enabled, planned for today, time passed less than
 * `graceMinutes` ago, and not already shown today (`fired` holds "id|YYYY-MM-DD").
 */
export function dueReminders<T extends ReminderLike>(reminders: T[], now: Date, fired: Set<string>, graceMinutes = 120): T[] {
  const today = toISODate(now);
  const wd = isoWeekday(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return reminders.filter((r) => {
    if (!r.enabled || !r.weekdays.includes(wd)) return false;
    const diff = nowMin - timeToMinutes(r.time_of_day);
    return diff >= 0 && diff <= graceMinutes && !fired.has(`${r.id}|${today}`);
  });
}
