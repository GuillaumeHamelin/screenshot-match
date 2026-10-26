import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { per100FromOff, type Per100 } from "@/lib/fitness";

export type OffFood = {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  per100: Per100;
  servingG: number | null;
};

export type OffSearchResult = { results: OffFood[]; hidden: number };

const UA = "FitTracker/1.0 (contact@fittracker.app)";
const FIELDS =
  "code,product_name,product_name_fr,brands,nutriments,serving_quantity,serving_quantity_unit,image_small_url";

function normalize(p: Record<string, unknown>): OffFood | "incomplete" | null {
  const name = String(p["product_name_fr"] || p["product_name"] || "").trim();
  const code = String(p["code"] ?? "").trim();
  if (!name || !code) return null;
  const per100 = per100FromOff(p["nutriments"] as Record<string, unknown> | undefined);
  if (!per100) return "incomplete";
  const rawBrand = p["brands"];
  const brand = (Array.isArray(rawBrand) ? rawBrand[0] : typeof rawBrand === "string" ? rawBrand.split(",")[0] : null) as
    | string
    | null
    | undefined;
  const sq = Number(p["serving_quantity"]);
  const unit = p["serving_quantity_unit"];
  const servingG = Number.isFinite(sq) && sq > 0 && sq <= 2000 && (unit == null || unit === "g") ? Math.round(sq) : null;
  const img = p["image_small_url"];
  return {
    code,
    name,
    brand: brand?.trim() || null,
    imageUrl: typeof img === "string" && img.startsWith("https://") ? img : null,
    per100,
    servingG,
  };
}

/** Search Open Food Facts by name, or look up a barcode. Products without full nutrition values are left out. */
export const searchOpenFoodFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data }): Promise<OffSearchResult> => {
    const q = data.query;
    const headers = { "User-Agent": UA, Accept: "application/json" };
    let products: Record<string, unknown>[] = [];
    try {
      if (/^\d{8,14}$/.test(q)) {
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=${FIELDS}`, {
          headers,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
          if (json.status === 1 && json.product) products = [{ code: q, ...json.product }];
        } else if (res.status !== 404) {
          throw new Error(`OFF ${res.status}`);
        }
      } else {
        const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=40&langs=fr&fields=${FIELDS}`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`OFF ${res.status}`);
        const json = (await res.json()) as { hits?: Record<string, unknown>[] };
        products = json.hits ?? [];
      }
    } catch (e) {
      console.error("Open Food Facts search failed", e);
      throw new Error("La base Open Food Facts ne répond pas. Réessaie dans un instant.");
    }

    const seen = new Set<string>();
    const results: OffFood[] = [];
    let hidden = 0;
    for (const p of products) {
      const f = normalize(p);
      if (f === "incomplete") {
        hidden++;
        continue;
      }
      if (!f || seen.has(f.code)) continue;
      seen.add(f.code);
      results.push(f);
    }
    return { results: results.slice(0, 25), hidden };
  });
