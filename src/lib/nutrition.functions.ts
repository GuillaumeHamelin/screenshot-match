import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { offSearch, type OffFood } from "@/lib/off";

export type { OffFood };
export type OffSearchResult = { results: OffFood[]; hidden: number };

/** Search Open Food Facts by name, or look up a barcode. Products without full nutrition values are left out. */
export const searchOpenFoodFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data }): Promise<OffSearchResult> => {
    try {
      return await offSearch(data.query);
    } catch (e) {
      console.error("Open Food Facts search failed", e);
      throw new Error("La base Open Food Facts ne répond pas. Réessaie dans un instant.");
    }
  });
