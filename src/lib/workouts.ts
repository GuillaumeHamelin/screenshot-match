// Workout write actions (sessions, programs) shared by the training pages.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectRecords, exerciseBests, totalVolume, type RecordType } from "@/lib/fitness";

export const MUSCLE_GROUPS = [
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Quadriceps",
  "Ischio-jambiers",
  "Fessiers",
  "Mollets",
  "Abdominaux",
] as const;

export const EQUIPMENT = ["Barre", "Haltères", "Machine", "Poulie", "Poids du corps", "Kettlebell", "Élastique", "Autre"] as const;

export const WEEKDAYS = [
  { n: 1, short: "Lun" },
  { n: 2, short: "Mar" },
  { n: 3, short: "Mer" },
  { n: 4, short: "Jeu" },
  { n: 5, short: "Ven" },
  { n: 6, short: "Sam" },
  { n: 7, short: "Dim" },
] as const;

type PresetTemplate = { name: string; weekdays: number[]; exercises: string[] };
export const PROGRAM_PRESETS: { key: string; label: string; description: string; templates: PresetTemplate[] }[] = [
  {
    key: "ppl",
    label: "Push / Pull / Legs",
    description: "3 séances : poussée, tirage, jambes.",
    templates: [
      { name: "Push", weekdays: [1], exercises: ["Développé couché", "Développé militaire", "Développé incliné haltères", "Élévations latérales", "Extension triceps poulie"] },
      { name: "Pull", weekdays: [3], exercises: ["Tractions", "Rowing barre", "Tirage horizontal", "Face pull", "Curl barre"] },
      { name: "Legs", weekdays: [5], exercises: ["Squat", "Soulevé de terre jambes tendues", "Presse à cuisses", "Leg curl assis", "Mollets debout"] },
    ],
  },
  {
    key: "upper_lower",
    label: "Upper / Lower",
    description: "4 séances : haut et bas du corps, deux fois par semaine.",
    templates: [
      { name: "Haut du corps A", weekdays: [1], exercises: ["Développé couché", "Rowing barre", "Développé militaire", "Tirage vertical", "Curl haltères alterné"] },
      { name: "Bas du corps A", weekdays: [2], exercises: ["Squat", "Leg curl allongé", "Fentes", "Mollets debout", "Gainage"] },
      { name: "Haut du corps B", weekdays: [4], exercises: ["Développé incliné haltères", "Tractions", "Développé haltères assis", "Rowing haltère unilatéral", "Barre au front"] },
      { name: "Bas du corps B", weekdays: [5], exercises: ["Soulevé de terre", "Presse à cuisses", "Hip thrust", "Leg extension", "Mollets assis"] },
    ],
  },
  {
    key: "full_body",
    label: "Full Body",
    description: "3 séances corps complet par semaine.",
    templates: [
      { name: "Full Body A", weekdays: [1], exercises: ["Squat", "Développé couché", "Rowing barre", "Élévations latérales", "Crunch"] },
      { name: "Full Body B", weekdays: [3], exercises: ["Soulevé de terre", "Développé militaire", "Tirage vertical", "Fentes", "Gainage"] },
      { name: "Full Body C", weekdays: [5], exercises: ["Presse à cuisses", "Développé incliné haltères", "Tractions", "Hip thrust", "Curl marteau"] },
    ],
  },
  { key: "custom", label: "Personnalisé", description: "Programme vide, tu ajoutes tes séances.", templates: [] },
];

export function invalidateTraining(qc: QueryClient) {
  for (const key of ["dashboard", "sessions", "session", "active-session", "records", "performance", "previous-perf", "programs", "program"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/** Create a program, optionally from a preset (templates + library exercises). */
export async function createProgram(input: { name: string; description: string | null; presetKey: string }) {
  const { data: program, error } = await supabase
    .from("workout_programs")
    .insert({ name: input.name, description: input.description })
    .select("id")
    .single();
  if (error) throw error;
  const preset = PROGRAM_PRESETS.find((p) => p.key === input.presetKey);
  if (preset && preset.templates.length > 0) {
    const { data: library, error: le } = await supabase.from("exercises").select("id, name").is("user_id", null);
    if (le) throw le;
    const idByName = new Map(library.map((e) => [e.name, e.id]));
    const { data: templates, error: te } = await supabase
      .from("workout_templates")
      .insert(preset.templates.map((t, i) => ({ program_id: program.id, name: t.name, weekdays: t.weekdays, position: i })))
      .select("id, position");
    if (te) throw te;
    const rows = templates.flatMap((t) => {
      const names = preset.templates[t.position]?.exercises ?? [];
      return names
        .map((n) => idByName.get(n))
        .filter((id): id is string => !!id)
        .map((exercise_id, i) => ({ template_id: t.id, exercise_id, position: i, target_sets: 3, target_reps: "8-12", rest_seconds: 90 }));
    });
    if (rows.length) {
      const { error: ee } = await supabase.from("workout_template_exercises").insert(rows);
      if (ee) throw ee;
    }
  }
  return program.id;
}

export async function duplicateProgram(programId: string) {
  const { data: src, error } = await supabase
    .from("workout_programs")
    .select("*, workout_templates(*, workout_template_exercises(*))")
    .eq("id", programId)
    .single();
  if (error) throw error;
  const { data: copy, error: ce } = await supabase
    .from("workout_programs")
    .insert({ name: `${src.name} (copie)`, description: src.description, notes: src.notes })
    .select("id")
    .single();
  if (ce) throw ce;
  for (const t of src.workout_templates) {
    const { data: nt, error: te } = await supabase
      .from("workout_templates")
      .insert({ program_id: copy.id, name: t.name, weekdays: t.weekdays, position: t.position, notes: t.notes })
      .select("id")
      .single();
    if (te) throw te;
    if (t.workout_template_exercises.length) {
      const { error: ee } = await supabase.from("workout_template_exercises").insert(
        t.workout_template_exercises.map((e) => ({
          template_id: nt.id,
          exercise_id: e.exercise_id,
          position: e.position,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          target_weight_kg: e.target_weight_kg,
          rest_seconds: e.rest_seconds,
          notes: e.notes,
        })),
      );
      if (ee) throw ee;
    }
  }
  return copy.id;
}

/** Starts a session (from a template or empty). Returns the existing one if a session is already running. */
export async function startSession(input: {
  userId: string;
  templateId?: string | null;
  name?: string;
}): Promise<{ id: string; resumed: boolean }> {
  const { data: running, error: re } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", input.userId)
    .eq("status", "in_progress")
    .limit(1);
  if (re) throw re;
  if (running[0]) return { id: running[0].id, resumed: true };

  let template: {
    id: string;
    name: string;
    program_id: string;
    workout_template_exercises: { exercise_id: string; position: number; target_sets: number; target_weight_kg: number | null; rest_seconds: number; notes: string | null }[];
  } | null = null;
  if (input.templateId) {
    const { data, error } = await supabase
      .from("workout_templates")
      .select("id, name, program_id, workout_template_exercises(exercise_id, position, target_sets, target_weight_kg, rest_seconds, notes)")
      .eq("id", input.templateId)
      .single();
    if (error) throw error;
    template = data;
  }

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({
      name: template?.name ?? input.name ?? "Séance libre",
      status: "in_progress",
      started_at: new Date().toISOString(),
      program_id: template?.program_id ?? null,
      template_id: template?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const tex = [...(template?.workout_template_exercises ?? [])].sort((a, b) => a.position - b.position);
  if (tex.length) {
    const { data: wes, error: we } = await supabase
      .from("workout_exercises")
      .insert(tex.map((e, i) => ({ session_id: session.id, exercise_id: e.exercise_id, position: i, rest_seconds: e.rest_seconds, notes: e.notes })))
      .select("id, position");
    if (we) throw we;
    const sets = wes.flatMap((w) => {
      const t = tex[w.position]!;
      return Array.from({ length: Math.max(1, t.target_sets) }, (_, i) => ({
        workout_exercise_id: w.id,
        set_number: i + 1,
        weight_kg: t.target_weight_kg,
      }));
    });
    if (sets.length) {
      const { error: se } = await supabase.from("workout_sets").insert(sets);
      if (se) throw se;
    }
  }
  return { id: session.id, resumed: false };
}

export type FinishResult = { volume: number; duration: number; records: number };

/**
 * Ends a session: drops unvalidated sets (and exercises left empty), stores duration and
 * volume, then saves every new personal record.
 */
export async function finishSession(sessionId: string, userId: string): Promise<FinishResult> {
  const { data: s, error } = await supabase
    .from("workout_sessions")
    .select("id, started_at, workout_exercises(id, exercise_id, workout_sets(id, weight_kg, reps, set_type, completed))")
    .eq("id", sessionId)
    .single();
  if (error) throw error;

  const allSets = s.workout_exercises.flatMap((we) => we.workout_sets);
  const pending = allSets.filter((x) => !x.completed).map((x) => x.id);
  if (pending.length) {
    const { error: de } = await supabase.from("workout_sets").delete().in("id", pending);
    if (de) throw de;
  }
  const empty = s.workout_exercises.filter((we) => !we.workout_sets.some((x) => x.completed)).map((we) => we.id);
  if (empty.length) {
    const { error: de } = await supabase.from("workout_exercises").delete().in("id", empty);
    if (de) throw de;
  }

  const endedAt = new Date();
  const startedAt = s.started_at ? new Date(s.started_at) : endedAt;
  const duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const volume = totalVolume(allSets);

  const { error: ue } = await supabase
    .from("workout_sessions")
    .update({ status: "completed", ended_at: endedAt.toISOString(), duration_seconds: duration, total_volume_kg: volume })
    .eq("id", sessionId);
  if (ue) throw ue;

  // Records: compare each exercise's bests with the stored all-time bests.
  const exerciseIds = [...new Set(s.workout_exercises.map((we) => we.exercise_id))];
  let recordCount = 0;
  if (exerciseIds.length) {
    const { data: prev, error: pe } = await supabase
      .from("personal_records")
      .select("exercise_id, record_type, value")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds);
    if (pe) throw pe;
    const rows: {
      exercise_id: string;
      record_type: RecordType;
      value: number;
      weight_kg: number | null;
      reps: number | null;
      set_id: string | null;
      session_id: string;
      achieved_at: string;
    }[] = [];
    for (const exId of exerciseIds) {
      const sets = s.workout_exercises.filter((we) => we.exercise_id === exId).flatMap((we) => we.workout_sets);
      const previous: Partial<Record<RecordType, number>> = {};
      for (const p of prev.filter((r) => r.exercise_id === exId)) {
        const t = p.record_type as RecordType;
        previous[t] = Math.max(previous[t] ?? 0, Number(p.value));
      }
      for (const r of detectRecords(exerciseBests(sets), previous)) {
        rows.push({
          exercise_id: exId,
          record_type: r.type,
          value: r.value,
          weight_kg: r.weight_kg,
          reps: r.reps,
          set_id: r.set_id,
          session_id: sessionId,
          achieved_at: endedAt.toISOString(),
        });
      }
    }
    if (rows.length) {
      const { error: ie } = await supabase.from("personal_records").insert(rows);
      if (ie) throw ie;
      recordCount = rows.length;
    }
  }
  return { volume, duration, records: recordCount };
}

/** Deletes a session and the records it produced. */
export async function deleteSession(sessionId: string) {
  const { error: re } = await supabase.from("personal_records").delete().eq("session_id", sessionId);
  if (re) throw re;
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

/** Swap positions of two rows in a positioned table. */
export async function swapPositions(
  table: "workout_template_exercises" | "workout_exercises" | "workout_templates",
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  const r1 = await supabase.from(table).update({ position: b.position }).eq("id", a.id);
  if (r1.error) throw r1.error;
  const r2 = await supabase.from(table).update({ position: a.position }).eq("id", b.id);
  if (r2.error) throw r2.error;
}
