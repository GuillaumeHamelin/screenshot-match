// Write actions for advanced tracking: goals, calendar planning, progress photos, reminders.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planFromTemplates } from "@/lib/fitness";
import { invalidateTraining } from "@/lib/workouts";

export function invalidateTracking(qc: QueryClient) {
  for (const key of ["goals", "calendar", "photos", "reminders", "dashboard", "profile"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

// ───────── Goals ─────────

export type GoalInput = {
  category: string;
  title: string;
  metric: string;
  exercise_id: string | null;
  reference_weight_kg: number | null;
  start_value: number;
  current_value: number | null;
  target_value: number;
  unit: string | null;
  target_date: string | null;
};

export async function saveGoal(input: GoalInput, id?: string) {
  const { error } = id
    ? await supabase.from("goals").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("goals").insert(input);
  if (error) throw error;
}

export async function setGoalStatus(id: string, status: "active" | "completed" | "abandoned") {
  const { error } = await supabase.from("goals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function updateManualGoal(id: string, current: number) {
  const { error } = await supabase
    .from("goals")
    .update({ current_value: current, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// ───────── Calendar ─────────

export async function scheduleSession(input: {
  date: string;
  templateId: string | null;
  name: string;
  notes: string | null;
}) {
  let programId: string | null = null;
  if (input.templateId) {
    const { data, error } = await supabase.from("workout_templates").select("program_id").eq("id", input.templateId).single();
    if (error) throw error;
    programId = data.program_id;
  }
  const { error } = await supabase.from("workout_sessions").insert({
    name: input.name,
    status: "scheduled",
    scheduled_date: input.date,
    template_id: input.templateId,
    program_id: programId,
    notes: input.notes,
  });
  if (error) throw error;
}

/** Edit or move a planned session. Done sessions cannot be moved. */
export async function updatePlannedSession(
  id: string,
  patch: { name?: string; scheduled_date?: string; notes?: string | null; template_id?: string | null; status?: "scheduled" | "skipped" },
) {
  const row: Record<string, unknown> = { ...patch };
  if (patch.template_id !== undefined) {
    if (patch.template_id) {
      const { data, error } = await supabase.from("workout_templates").select("program_id").eq("id", patch.template_id).single();
      if (error) throw error;
      row.program_id = data.program_id;
    } else {
      row.program_id = null;
    }
  }
  const { error } = await supabase
    .from("workout_sessions")
    .update(row)
    .eq("id", id)
    .in("status", ["scheduled", "skipped"]);
  if (error) throw error;
}

/** Plans the program's sessions on their weekdays for the next weeks. Returns how many were added. */
export async function planProgram(programId: string, fromISO: string, weeks: number, userId: string) {
  const { data: templates, error } = await supabase
    .from("workout_templates")
    .select("id, name, weekdays")
    .eq("program_id", programId);
  if (error) throw error;
  const { data: existing, error: ee } = await supabase
    .from("workout_sessions")
    .select("template_id, scheduled_date")
    .eq("user_id", userId)
    .gte("scheduled_date", fromISO);
  if (ee) throw ee;
  const rows = planFromTemplates(
    templates,
    fromISO,
    weeks,
    existing.map((e) => ({ template_id: e.template_id, day: e.scheduled_date })),
  );
  if (rows.length) {
    const { error: ie } = await supabase
      .from("workout_sessions")
      .insert(rows.map((r) => ({ ...r, status: "scheduled", program_id: programId })));
    if (ie) throw ie;
  }
  return rows.length;
}

export { invalidateTraining };

// ───────── Progress photos ─────────

export const PHOTO_POSES = [
  { key: "front", label: "Face" },
  { key: "side", label: "Profil" },
  { key: "back", label: "Dos" },
  { key: "other", label: "Autre" },
] as const;

export function poseLabel(key: string | null | undefined) {
  return PHOTO_POSES.find((p) => p.key === key)?.label ?? "Autre";
}

/**
 * Re-encodes the image as JPEG (max 1600 px). This also drops embedded metadata
 * such as GPS position, which matters for private body photos.
 */
async function prepareImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Format d'image non pris en charge. Utilise une photo JPEG, PNG ou WebP.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer la photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Impossible de préparer la photo.");
  return blob;
}

export async function uploadProgressPhoto(input: {
  userId: string;
  file: File;
  takenOn: string;
  pose: string;
  notes: string | null;
}) {
  if (!input.file.type.startsWith("image/")) throw new Error("Choisis un fichier image.");
  if (input.file.size > 25 * 1024 * 1024) throw new Error("Photo trop lourde (25 Mo maximum).");
  const blob = await prepareImage(input.file);
  const path = `${input.userId}/${crypto.randomUUID()}.jpg`;
  const { error: ue } = await supabase.storage
    .from("progress-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (ue) throw new Error("Envoi de la photo impossible.");
  const { error } = await supabase
    .from("progress_photos")
    .insert({ storage_path: path, taken_on: input.takenOn, pose: input.pose, notes: input.notes });
  if (error) {
    await supabase.storage.from("progress-photos").remove([path]);
    throw new Error("Enregistrement de la photo impossible.");
  }
}

export async function deleteProgressPhoto(photo: { id: string; storage_path: string }) {
  const { error: se } = await supabase.storage.from("progress-photos").remove([photo.storage_path]);
  if (se) throw se;
  const { error } = await supabase.from("progress_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

// ───────── Reminders ─────────

export const REMINDER_KINDS = [
  { key: "workout", label: "Séance", defaultLabel: "C'est l'heure de ta séance", defaultTime: "18:00" },
  { key: "weigh_in", label: "Pesée", defaultLabel: "Pense à te peser", defaultTime: "07:30" },
  { key: "water", label: "Hydratation", defaultLabel: "Bois un verre d'eau", defaultTime: "15:00" },
  { key: "meals", label: "Repas", defaultLabel: "Note tes repas de la journée", defaultTime: "21:00" },
  { key: "photo", label: "Photo", defaultLabel: "Prends ta photo de progression", defaultTime: "08:00" },
  { key: "custom", label: "Personnalisé", defaultLabel: "", defaultTime: "12:00" },
] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number]["key"];

export async function saveReminder(
  input: { kind: string; label: string; time_of_day: string; weekdays: number[]; enabled: boolean },
  id?: string,
) {
  const { error } = id
    ? await supabase.from("reminders").update(input).eq("id", id)
    : await supabase.from("reminders").insert(input);
  if (error) throw error;
}

export async function toggleReminder(id: string, enabled: boolean) {
  const { error } = await supabase.from("reminders").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

export async function setNotificationsEnabled(userId: string, enabled: boolean) {
  const { error } = await supabase.from("profiles").update({ notifications_enabled: enabled }).eq("id", userId);
  if (error) throw error;
}
