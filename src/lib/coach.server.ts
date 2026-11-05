// AI coach: streaming chat through Lovable AI Gateway (Responses API), with tools that only use real data.
import { createOpenAI } from "@ai-sdk/openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  COACH_DEFAULT_TITLE,
  planItem,
  planMeal,
  planTotals,
  remainingMacros,
  threadTitleFrom,
  type MealPlanOutput,
  type PlanFoodItem,
  type ProgramPlanOutput,
} from "@/lib/coach";
import {
  ACTIVITY_LABELS,
  ageFromBirthDate,
  MAIN_GOAL_LABELS,
  MEAL_TYPES,
  SEX_LABELS,
  sumMacros,
  type ActivityLevel,
  type MainGoal,
  type MealType,
  type Sex,
} from "@/lib/fitness";
import { offSearch } from "@/lib/off";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai/run-id";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

type Db = SupabaseClient<Database>;

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

function userClient(token: string): Db {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const bodySchema = z.object({
  threadId: z.string().uuid(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  messages: z.array(z.any()).min(1).max(200),
});

async function buildContext(db: Db, userId: string, today: string) {
  const [profileR, weightR, mealsR, sessionsR, programsR, exercisesR] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db.from("body_measurements").select("measured_on, weight_kg, body_fat_pct").not("weight_kg", "is", null).order("measured_on", { ascending: false }).limit(1),
    db.from("meals").select("meal_type, meal_items(food_name, quantity_g, calories, protein_g, carbs_g, fat_g)").eq("eaten_on", today),
    db.from("workout_sessions").select("name, status, started_at, scheduled_date, duration_seconds").eq("status", "completed").order("started_at", { ascending: false }).limit(10),
    db.from("workout_programs").select("name").order("created_at", { ascending: false }).limit(10),
    db.from("exercises").select("id, name, muscle_group, equipment").or(`user_id.is.null,user_id.eq.${userId}`).order("muscle_group"),
  ]);
  const p = profileR.data;
  const items = (mealsR.data ?? []).flatMap((m) => m.meal_items.map((i) => ({ ...i, meal_type: m.meal_type })));
  const eaten = sumMacros(items);
  const goals = { calories: p?.calorie_goal ?? 0, protein: p?.protein_goal ?? 0, carbs: p?.carbs_goal ?? 0, fat: p?.fat_goal ?? 0 };
  const left = remainingMacros(goals, eaten);
  const w = weightR.data?.[0];
  const age = ageFromBirthDate(p?.birth_date);
  const lines = [
    `Date du jour : ${today}.`,
    `Profil : ${p?.username ?? "?"}${p?.sex ? `, ${SEX_LABELS[p.sex as Sex]}` : ""}${age != null ? `, ${age} ans` : ""}${p?.height_cm ? `, ${p.height_cm} cm` : ""}${w ? `, ${w.weight_kg} kg (pesée du ${w.measured_on})` : ", poids non renseigné"}${w?.body_fat_pct ? `, ${w.body_fat_pct} % de masse grasse` : ""}.`,
    `Objectif principal : ${p?.main_goal ? MAIN_GOAL_LABELS[p.main_goal as MainGoal] : "non renseigné"}. Niveau d'activité : ${p?.activity_level ? ACTIVITY_LABELS[p.activity_level as ActivityLevel] : "non renseigné"}. Objectif : ${p?.weekly_sessions_goal ?? "?"} séances de muscu / semaine.`,
    `Autres sports pratiqués : ${p?.other_sports?.trim() || "non renseigné (demande-lui)"}.`,
    `Objectifs nutrition / jour : ${goals.calories} kcal, ${goals.protein} g protéines, ${goals.carbs} g glucides, ${goals.fat} g lipides, ${p?.water_goal_ml ?? "?"} ml d'eau.`,
    `Déjà mangé aujourd'hui : ${eaten.calories} kcal, ${eaten.protein} g P, ${eaten.carbs} g G, ${eaten.fat} g L.` +
      (items.length ? ` Détail : ${items.map((i) => `${MEAL_TYPES.find((m) => m.key === i.meal_type)?.label}: ${i.food_name} ${i.quantity_g} g`).join(" ; ")}.` : " Rien de noté."),
    `Reste à manger aujourd'hui : ${left.calories} kcal, ${left.protein} g P, ${left.carbs} g G, ${left.fat} g L.`,
    `Dernières séances terminées : ${(sessionsR.data ?? []).map((s) => `${s.name} (${s.started_at?.slice(0, 10)})`).join(", ") || "aucune"}.`,
    `Programmes existants : ${(programsR.data ?? []).map((x) => x.name).join(", ") || "aucun"}.`,
    `Bibliothèque d'exercices (id | nom | muscle | matériel) :`,
    ...(exercisesR.data ?? []).map((e) => `${e.id} | ${e.name} | ${e.muscle_group} | ${e.equipment ?? "-"}`),
  ];
  return { text: lines.join("\n"), exercises: exercisesR.data ?? [] };
}

const INSTRUCTIONS = `Tu es « Coach », le coach sportif et nutrition de l'appli FitTracker. Tu parles français, tu tutoies, ton ton est direct, motivant et concret. Réponses courtes et structurées en markdown (titres courts, listes), pas de pavés.

Ton rôle :
- Construire le meilleur plan d'entraînement et d'alimentation pour CETTE personne : son objectif, son niveau, son âge, son poids, ses séances par semaine, et ses autres sports (course, foot, vélo, combat…). Adapte le volume et place les séances pour ne pas gêner ses autres sports (ex. pas de grosse séance jambes la veille d'un match).
- Si une info importante manque (autres sports, jours dispo, matériel, blessures, aliments aimés ou pas), pose 1 à 3 questions courtes avant de proposer un plan.
- Quand la personne te dit quels autres sports elle pratique, enregistre-les avec save_other_sports.

Programmes :
- Pour proposer un programme, appelle propose_program avec UNIQUEMENT des exercices de la bibliothèque (leurs id exacts). L'appli affiche une carte avec un bouton pour l'enregistrer dans « Programmes ». Ensuite, résume le plan en quelques lignes, sans recopier toute la carte.

Nutrition :
- Ne donne JAMAIS de valeurs nutritionnelles de mémoire. Pour proposer des repas, cherche de vrais aliments avec search_foods (requêtes simples en français : « riz basmati », « blanc de poulet », « skyr », « flocons d'avoine »), puis appelle propose_meal_plan avec les ref obtenues et des quantités en grammes. Les totaux sont calculés par l'appli.
- Vise ce qui reste à manger aujourd'hui (ou la journée complète si la personne le demande), à ±10 % sur les calories et en priorité les protéines. Respecte ses goûts ; pour quelqu'un qui n'a pas faim ou n'aime pas manger, propose des options simples, liquides ou denses (smoothie, skyr, oléagineux…) et des petites portions plus fréquentes.
- L'appli affiche une carte avec un bouton « Ajouter au journal ». Après la carte, donne 1 ou 2 conseils pratiques.

Sécurité : tu n'es pas médecin. En cas de douleur, blessure, trouble alimentaire, grossesse ou maladie, conseille de consulter un professionnel. Pas de régime en dessous de 1200 kcal, pas de perte de plus de 1 % du poids par semaine.`;

export async function handleCoachChat(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token.split(".").length !== 3) return json(401, "Connecte-toi pour parler au coach.");
  const db = userClient(token);
  const { data: claims, error: authError } = await db.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authError || !userId) return json(401, "Session expirée, reconnecte-toi.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return json(400, "Requête invalide.");
  }
  const { data: thread, error: threadError } = await db.from("coach_threads").select("id, title").eq("id", body.threadId).maybeSingle();
  if (threadError) return json(500, "Impossible de charger la discussion.");
  if (!thread) return json(404, "Discussion introuvable.");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "Le coach n'est pas configuré.");

  const messages = body.messages as UIMessage[];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "Requête invalide.");

  // Save the user's message right away so it survives a failed answer.
  const saveError = await saveMessages(db, thread.id, [last]);
  if (saveError) return json(500, "Impossible d'enregistrer ton message.");
  if (thread.title === COACH_DEFAULT_TITLE) {
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
    await db.from("coach_threads").update({ title: threadTitleFrom(text) }).eq("id", thread.id);
  }

  const ctx = await buildContext(db, userId, body.today);
  const foodCache = new Map<string, Omit<PlanFoodItem, "totals" | "grams">>();

  const tools = {
    search_foods: tool({
      description: "Cherche de vrais aliments (aliments perso de l'utilisateur + base Open Food Facts) avec leurs valeurs pour 100 g.",
      inputSchema: z.object({ query: z.string().describe("Nom simple de l'aliment, en français") }),
      execute: async ({ query }) => {
        const q = query.trim().slice(0, 80);
        const [mine, off] = await Promise.all([
          db.from("foods").select("id, name, brand, source, external_id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g").ilike("name", `%${q.replace(/[%_]/g, "")}%`).limit(5),
          offSearch(q, 8).catch(() => ({ results: [], hidden: 0 })),
        ]);
        const out: { ref: string; name: string; brand: string | null; per100g: { kcal: number; protein: number; carbs: number; fat: number } }[] = [];
        for (const f of mine.data ?? []) {
          if (f.calories_per_100g == null) continue;
          const per100 = { calories: Number(f.calories_per_100g), protein: Number(f.protein_per_100g), carbs: Number(f.carbs_per_100g), fat: Number(f.fat_per_100g) };
          const ref = `food:${f.id}`;
          foodCache.set(ref, { ref, name: f.name, brand: f.brand, per100, source: f.source === "openfoodfacts" ? "openfoodfacts" : "custom", foodId: f.id, externalId: f.external_id });
          out.push({ ref, name: f.name, brand: f.brand, per100g: { kcal: per100.calories, protein: per100.protein, carbs: per100.carbs, fat: per100.fat } });
        }
        for (const f of off.results) {
          const ref = `off:${f.code}`;
          foodCache.set(ref, { ref, name: f.name, brand: f.brand, per100: f.per100, source: "openfoodfacts", foodId: null, externalId: f.code });
          out.push({ ref, name: f.name, brand: f.brand, per100g: { kcal: f.per100.calories, protein: f.per100.protein, carbs: f.per100.carbs, fat: f.per100.fat } });
        }
        return { results: out, note: out.length ? null : "Aucun aliment trouvé avec des valeurs complètes. Essaie un autre mot." };
      },
    }),
    propose_meal_plan: tool({
      description: "Affiche une proposition de repas avec un bouton pour l'ajouter au journal. Utilise uniquement des ref renvoyées par search_foods.",
      inputSchema: z.object({
        meals: z.array(
          z.object({
            meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
            items: z.array(z.object({ ref: z.string(), grams: z.number() })),
          }),
        ),
      }),
      execute: async ({ meals }): Promise<MealPlanOutput> => {
        const skipped: string[] = [];
        const resolved = [];
        for (const m of meals) {
          const items: PlanFoodItem[] = [];
          for (const it of m.items) {
            const base = await resolveFood(db, foodCache, it.ref);
            const grams = Math.round(it.grams);
            if (!base || !(grams > 0 && grams <= 2000)) {
              skipped.push(it.ref);
              continue;
            }
            items.push(planItem(base, grams));
          }
          if (items.length) resolved.push(planMeal(m.meal_type as MealType, items));
        }
        return { date: body.today, meals: resolved, totals: planTotals(resolved), skipped };
      },
    }),
    propose_program: tool({
      description: "Affiche un programme de musculation avec un bouton pour l'enregistrer. Uniquement des exercise_id de la bibliothèque.",
      inputSchema: z.object({
        name: z.string(),
        description: z.string().nullable(),
        days: z.array(
          z.object({
            name: z.string(),
            weekdays: z.array(z.number().int()).describe("1 = lundi … 7 = dimanche"),
            exercises: z.array(z.object({ exercise_id: z.string(), sets: z.number().int(), reps: z.string(), rest_seconds: z.number().int() })),
          }),
        ),
      }),
      execute: async (input): Promise<ProgramPlanOutput> => {
        const byId = new Map(ctx.exercises.map((e) => [e.id, e.name]));
        const skipped: string[] = [];
        const days = input.days.slice(0, 7).map((d) => ({
          name: d.name.slice(0, 60),
          weekdays: [...new Set(d.weekdays.filter((n) => n >= 1 && n <= 7))].sort(),
          exercises: d.exercises.flatMap((e) => {
            const name = byId.get(e.exercise_id);
            if (!name) {
              skipped.push(e.exercise_id);
              return [];
            }
            return [{ exerciseId: e.exercise_id, name, sets: Math.min(10, Math.max(1, e.sets)), reps: e.reps.slice(0, 20), restSeconds: Math.min(600, Math.max(15, e.rest_seconds)) }];
          }),
        }));
        return { name: input.name.slice(0, 80), description: input.description?.slice(0, 300) ?? null, days: days.filter((d) => d.exercises.length), skipped };
      },
    }),
    save_other_sports: tool({
      description: "Enregistre dans le profil les sports pratiqués en dehors de la musculation (ex. « Course à pied 2×/sem, foot le dimanche »).",
      inputSchema: z.object({ sports: z.string() }),
      execute: async ({ sports }) => {
        const { error } = await db.from("profiles").update({ other_sports: sports.trim().slice(0, 300) || null }).eq("id", userId);
        return error ? { saved: false } : { saved: true, sports: sports.trim().slice(0, 300) };
      },
    }),
  };

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const recent = messages.slice(-40);
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: `${INSTRUCTIONS}\n\n--- Données de l'utilisateur ---\n${ctx.text}`,
    messages: await convertToModelMessages(recent),
    tools,
    stopWhen: stepCountIs(12),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: (error) => {
        console.error("coach stream error", error);
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 402) return "Les crédits IA de l'appli sont épuisés. Réessaie plus tard.";
        if (status === 429) return "Le coach reçoit trop de demandes. Réessaie dans une minute.";
        if (status === 403) return "Le coach n'est pas disponible pour le moment.";
        return "Le coach n'a pas pu répondre. Réessaie.";
      },
      onFinish: async ({ messages: all }) => {
        const assistant = all.filter((m) => m.role === "assistant" && !messages.some((o) => o.id === m.id));
        const err = await saveMessages(db, thread.id, assistant);
        if (err) console.error("coach: saving assistant message failed", err);
        await db.from("coach_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
      },
    }),
    runIdFetch,
  );
}

async function resolveFood(db: Db, cache: Map<string, Omit<PlanFoodItem, "totals" | "grams">>, ref: string) {
  const hit = cache.get(ref);
  if (hit) return hit;
  if (ref.startsWith("food:")) {
    const { data: f } = await db.from("foods").select("id, name, brand, source, external_id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g").eq("id", ref.slice(5)).maybeSingle();
    if (!f || f.calories_per_100g == null) return null;
    return { ref, name: f.name, brand: f.brand, per100: { calories: Number(f.calories_per_100g), protein: Number(f.protein_per_100g), carbs: Number(f.carbs_per_100g), fat: Number(f.fat_per_100g) }, source: f.source === "openfoodfacts" ? ("openfoodfacts" as const) : ("custom" as const), foodId: f.id, externalId: f.external_id };
  }
  if (ref.startsWith("off:") && /^\d{8,14}$/.test(ref.slice(4))) {
    const r = await offSearch(ref.slice(4), 1).catch(() => null);
    const f = r?.results[0];
    if (!f) return null;
    return { ref, name: f.name, brand: f.brand, per100: f.per100, source: "openfoodfacts" as const, foodId: null, externalId: f.code };
  }
  return null;
}

async function saveMessages(db: Db, threadId: string, msgs: UIMessage[]) {
  if (msgs.length === 0) return null;
  const { error } = await db.from("coach_messages").upsert(
    msgs.map((m) => ({ thread_id: threadId, message_id: m.id, role: m.role, parts: JSON.parse(JSON.stringify(m.parts)) })),
    { onConflict: "thread_id,message_id" },
  );
  return error;
}
