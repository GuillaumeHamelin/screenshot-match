import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in user's data, files and account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    for (const bucket of ["avatars", "progress-photos"]) {
      const { data: files } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
      if (files && files.length > 0) {
        await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    }

    const { error } = await supabase.rpc("delete_my_data");
    if (error) throw new Error("Impossible de supprimer les données.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delError) throw new Error("Impossible de supprimer le compte.");

    return { ok: true };
  });
