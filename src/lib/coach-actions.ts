// AI coach thread writes (browser, owner-scoped by RLS).
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function invalidateCoach(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["coach-threads"] });
}

export async function createCoachThread(): Promise<string> {
  const { data, error } = await supabase.from("coach_threads").insert({}).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteCoachThread(id: string) {
  const { error } = await supabase.from("coach_threads").delete().eq("id", id);
  if (error) throw error;
}
