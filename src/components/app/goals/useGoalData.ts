import type { QueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { buildNutritionDays, lastDates, type GoalData } from "@/lib/fitness";
import { measurementsQuery, nutritionHistoryQuery, performanceQuery, profileQuery } from "@/lib/queries";

const goalDates = () => lastDates(7);

/** Preload everything goal values are computed from. */
export function ensureGoalData(qc: QueryClient, userId: string) {
  const d = goalDates();
  return Promise.all([
    qc.ensureQueryData(performanceQuery(userId)),
    qc.ensureQueryData(measurementsQuery(userId)),
    qc.ensureQueryData(profileQuery(userId)),
    qc.ensureQueryData(nutritionHistoryQuery(userId, d[0]!, d[6]!)),
  ]);
}

export function useGoalData(userId: string): GoalData {
  const dates = useMemo(goalDates, []);
  const { data: sessions } = useSuspenseQuery(performanceQuery(userId));
  const { data: measurements } = useSuspenseQuery(measurementsQuery(userId));
  const { data: profile } = useSuspenseQuery(profileQuery(userId));
  const { data: nutrition } = useSuspenseQuery(nutritionHistoryQuery(userId, dates[0]!, dates[6]!));
  return useMemo(
    () => ({
      sessions,
      measurements,
      nutritionDays: buildNutritionDays(dates, nutrition.meals, nutrition.water),
      calorieGoal: profile?.calorie_goal ?? 0,
    }),
    [sessions, measurements, nutrition, profile, dates],
  );
}
