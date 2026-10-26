import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Measurement = Database["public"]["Tables"]["body_measurements"]["Row"];

export const sessionUserQuery = () =>
  queryOptions({
    queryKey: ["session-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
    staleTime: 60_000,
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const measurementsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["measurements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(730);
      if (error) throw error;
      return data;
    },
  });

export const dashboardQuery = (userId: string, today: string) =>
  queryOptions({
    queryKey: ["dashboard", userId, today],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 8);
      const [meals, water, sessions, next, records] = await Promise.all([
        supabase
          .from("meals")
          .select("meal_type, meal_items(calories, protein_g, carbs_g, fat_g)")
          .eq("user_id", userId)
          .eq("eaten_on", today),
        supabase
          .from("water_intake")
          .select("amount_ml")
          .eq("user_id", userId)
          .eq("drank_on", today),
        supabase
          .from("workout_sessions")
          .select("id, name, started_at, duration_seconds, total_volume_kg")
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("started_at", since.toISOString())
          .order("started_at", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select("id, name, scheduled_date")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(1),
        supabase
          .from("personal_records")
          .select("id, record_type, value, weight_kg, reps, achieved_at, exercises(name)")
          .eq("user_id", userId)
          .order("achieved_at", { ascending: false })
          .limit(5),
      ]);
      for (const r of [meals, water, sessions, next, records]) if (r.error) throw r.error;
      return {
        mealItems: (meals.data ?? []).flatMap((m) => m.meal_items ?? []),
        waterMl: (water.data ?? []).reduce((s, w) => s + w.amount_ml, 0),
        sessions: sessions.data ?? [],
        nextSession: next.data?.[0] ?? null,
        records: records.data ?? [],
      };
    },
  });

export const avatarUrlQuery = (path: string | null | undefined) =>
  queryOptions({
    queryKey: ["avatar-url", path ?? null],
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (error) return null;
      return data.signedUrl;
    },
    staleTime: 50 * 60_000,
  });

// ───────────────────────── Workouts ─────────────────────────

export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type WorkoutSet = Database["public"]["Tables"]["workout_sets"]["Row"];

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export const exercisesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["exercises", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order("muscle_group")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });

export const programsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["programs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_programs")
        .select("id, name, description, created_at, workout_templates(id, name, weekdays, position, workout_template_exercises(id))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((p) => ({ ...p, workout_templates: [...p.workout_templates].sort(byPosition) }));
    },
  });

async function fetchProgram(programId: string) {
      const { data, error } = await supabase
        .from("workout_programs")
        .select(
          "*, workout_templates(*, workout_template_exercises(*, exercises(id, name, muscle_group, equipment)))",
        )
        .eq("id", programId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        workout_templates: [...data.workout_templates].sort(byPosition).map((t) => ({
          ...t,
          workout_template_exercises: [...t.workout_template_exercises].sort(byPosition),
        })),
      };
}

export const programQuery = (programId: string) =>
  queryOptions({ queryKey: ["program", programId], queryFn: () => fetchProgram(programId) });

export type ProgramDetail = NonNullable<Awaited<ReturnType<typeof fetchProgram>>>;

export const activeSessionQuery = (userId: string) =>
  queryOptions({
    queryKey: ["active-session", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, name, started_at")
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });

export const sessionsHistoryQuery = (userId: string) =>
  queryOptions({
    queryKey: ["sessions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, name, started_at, ended_at, duration_seconds, total_volume_kg, workout_exercises(id, workout_sets(id, completed))")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

async function fetchSession(sessionId: string) {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*, workout_exercises(*, exercises(id, name, muscle_group, equipment), workout_sets(*))")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        workout_exercises: [...data.workout_exercises].sort(byPosition).map((we) => ({
          ...we,
          workout_sets: [...we.workout_sets].sort((a, b) => a.set_number - b.set_number),
        })),
      };
}

export const sessionQuery = (sessionId: string) =>
  queryOptions({ queryKey: ["session", sessionId], queryFn: () => fetchSession(sessionId) });

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof fetchSession>>>;
export type SessionExercise = SessionDetail["workout_exercises"][number];

/** Sets from the most recent completed session for each exercise (excluding the current session). */
export const previousPerformanceQuery = (userId: string, sessionId: string, exerciseIds: string[]) =>
  queryOptions({
    queryKey: ["previous-perf", sessionId, [...exerciseIds].sort().join(",")],
    queryFn: async () => {
      const result: Record<string, { date: string | null; sets: WorkoutSet[] }> = {};
      if (exerciseIds.length === 0) return result;
      const { data: sessions, error } = await supabase
        .from("workout_sessions")
        .select("id, started_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .neq("id", sessionId)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!sessions.length) return result;
      const { data: wes, error: e2 } = await supabase
        .from("workout_exercises")
        .select("session_id, exercise_id, workout_sets(*)")
        .in("session_id", sessions.map((s) => s.id))
        .in("exercise_id", exerciseIds);
      if (e2) throw e2;
      for (const s of sessions) {
        for (const we of wes.filter((w) => w.session_id === s.id)) {
          if (result[we.exercise_id]) continue;
          const done = we.workout_sets.filter((x) => x.completed).sort((a, b) => a.set_number - b.set_number);
          if (done.length) result[we.exercise_id] = { date: s.started_at, sets: done };
        }
      }
      return result;
    },
  });

export const recordsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["records", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("*, exercises(id, name, muscle_group)")
        .eq("user_id", userId)
        .order("achieved_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

export const sessionRecordsQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["records", "session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("*, exercises(id, name)")
        .eq("session_id", sessionId);
      if (error) throw error;
      return data;
    },
  });

/** Every completed session with its validated sets, for analytics. */
async function fetchPerformance(userId: string) {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          "id, name, started_at, duration_seconds, total_volume_kg, workout_exercises(id, exercise_id, position, exercises(id, name, muscle_group), workout_sets(id, set_number, weight_kg, reps, set_type, completed))",
        )
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("started_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
}

export const performanceQuery = (userId: string) =>
  queryOptions({ queryKey: ["performance", userId], queryFn: () => fetchPerformance(userId) });

export type PerformanceSession = Awaited<ReturnType<typeof fetchPerformance>>[number];

// ───────────────────────── Nutrition ─────────────────────────

export type Food = Database["public"]["Tables"]["foods"]["Row"];

async function fetchNutritionDay(userId: string, date: string) {
  const [meals, water] = await Promise.all([
    supabase
      .from("meals")
      .select(
        "id, meal_type, meal_items(*, foods(id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g))",
      )
      .eq("user_id", userId)
      .eq("eaten_on", date),
    supabase
      .from("water_intake")
      .select("id, amount_ml, created_at")
      .eq("user_id", userId)
      .eq("drank_on", date)
      .order("created_at", { ascending: true }),
  ]);
  if (meals.error) throw meals.error;
  if (water.error) throw water.error;
  const items = meals.data
    .flatMap((m) => m.meal_items.map((i) => ({ ...i, meal_type: m.meal_type })))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { items, water: water.data };
}

export const nutritionDayQuery = (userId: string, date: string) =>
  queryOptions({ queryKey: ["nutrition-day", userId, date], queryFn: () => fetchNutritionDay(userId, date) });

export type NutritionDay = Awaited<ReturnType<typeof fetchNutritionDay>>;
export type LoggedItem = NutritionDay["items"][number];

export const foodsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["foods", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

async function fetchRecipes(userId: string) {
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("*, saved_recipe_items(*)")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export const recipesQuery = (userId: string) =>
  queryOptions({ queryKey: ["recipes", userId], queryFn: () => fetchRecipes(userId) });

export type Recipe = Awaited<ReturnType<typeof fetchRecipes>>[number];

export const nutritionHistoryQuery = (userId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["nutrition-history", userId, from, to],
    queryFn: async () => {
      const [meals, water] = await Promise.all([
        supabase
          .from("meals")
          .select("eaten_on, meal_items(calories, protein_g, carbs_g, fat_g)")
          .eq("user_id", userId)
          .gte("eaten_on", from)
          .lte("eaten_on", to),
        supabase
          .from("water_intake")
          .select("drank_on, amount_ml")
          .eq("user_id", userId)
          .gte("drank_on", from)
          .lte("drank_on", to),
      ]);
      if (meals.error) throw meals.error;
      if (water.error) throw water.error;
      return { meals: meals.data, water: water.data };
    },
  });
