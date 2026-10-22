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
