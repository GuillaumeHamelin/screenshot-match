import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, Plus, Utensils } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExerciseVideoButton } from "@/components/app/workout/ExerciseVideo";
import { Button } from "@/components/ui/button";
import type { MealPlanOutput, PlanMeal, ProgramPlanOutput } from "@/lib/coach";
import { MEAL_TYPES, toISODate } from "@/lib/fitness";
import { addFoodToMeal, displayName, invalidateNutrition } from "@/lib/nutrition";
import { WEEKDAYS, createProgramFromPlan, invalidateTraining } from "@/lib/workouts";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function Macros({ t }: { t: { calories: number; protein: number; carbs: number; fat: number } }) {
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{nf.format(t.calories)} kcal</span> · P {nf.format(t.protein)} g · G {nf.format(t.carbs)} g · L {nf.format(t.fat)} g
    </span>
  );
}

export function MealPlanCard({ plan }: { plan: MealPlanOutput }) {
  const qc = useQueryClient();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  async function add(indexes: number[]) {
    const todo = indexes.filter((i) => !added.has(i));
    if (todo.length === 0) return;
    setBusy(true);
    const today = toISODate();
    try {
      for (const i of todo) {
        const meal = plan.meals[i] as PlanMeal;
        for (const it of meal.items) {
          await addFoodToMeal({
            date: today,
            mealType: meal.mealType,
            grams: it.grams,
            food: { foodId: it.foodId, name: it.name, brand: it.brand, per100: it.per100, source: it.source, externalId: it.externalId, servingG: null },
          });
        }
      }
      setAdded((s) => new Set([...s, ...todo]));
      invalidateNutrition(qc);
      toast.success(todo.length > 1 ? "Repas ajoutés au journal d'aujourd'hui." : "Repas ajouté au journal d'aujourd'hui.");
    } catch {
      toast.error("Ajout impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  if (plan.meals.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun aliment avec des valeurs complètes n'a pu être proposé.</p>;
  }

  return (
    <div className="panel w-full max-w-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold uppercase">
          <Utensils className="h-4 w-4" /> Proposition de repas
        </p>
        <Macros t={plan.totals} />
      </div>
      <div className="space-y-3">
        {plan.meals.map((m, i) => (
          <div key={i} className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{MEAL_TYPES.find((x) => x.key === m.mealType)?.label}</p>
              <Button size="sm" variant={added.has(i) ? "ghost" : "outline"} disabled={busy || added.has(i)} onClick={() => add([i])}>
                {added.has(i) ? <><Check /> Ajouté</> : <><Plus /> Ajouter</>}
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {m.items.map((it, j) => (
                <li key={j} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{displayName(it.name, it.brand)} <span className="text-muted-foreground">· {it.grams} g</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{nf.format(it.totals.calories)} kcal</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-border pt-2"><Macros t={m.totals} /></div>
          </div>
        ))}
      </div>
      {plan.meals.length > 1 && (
        <Button className="mt-3 w-full" disabled={busy || added.size === plan.meals.length} onClick={() => add(plan.meals.map((_, i) => i))}>
          {added.size === plan.meals.length ? <><Check /> Tout est dans ton journal</> : <><Plus /> Tout ajouter au journal d'aujourd'hui</>}
        </Button>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Valeurs issues de tes aliments et d'Open Food Facts, calculées pour chaque quantité.</p>
    </div>
  );
}

export function ProgramPlanCard({ plan }: { plan: ProgramPlanOutput }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const id = await createProgramFromPlan(plan);
      setSavedId(id);
      invalidateTraining(qc);
      toast.success("Programme enregistré dans « Programmes ».");
    } catch {
      toast.error("Enregistrement impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  if (plan.days.length === 0) return <p className="text-sm text-muted-foreground">Programme vide : aucun exercice reconnu.</p>;

  return (
    <div className="panel w-full max-w-xl p-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold uppercase">
        <ClipboardList className="h-4 w-4" /> {plan.name}
      </p>
      {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
      <div className="mt-3 space-y-3">
        {plan.days.map((d, i) => (
          <div key={i} className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.weekdays.map((n) => WEEKDAYS.find((w) => w.n === n)?.short).join(" · ")}</p>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {d.exercises.map((e, j) => (
                <li key={j} className="flex items-baseline justify-between gap-3">
                  <ExerciseVideoButton name={e.name} className="min-w-0" />
                  <span className="shrink-0 text-xs text-muted-foreground">{e.sets} × {e.reps} · {e.restSeconds} s</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {savedId ? (
        <Button className="mt-3 w-full" variant="outline" onClick={() => navigate({ to: "/programmes/$programId", params: { programId: savedId } })}>
          <Check /> Voir le programme
        </Button>
      ) : (
        <Button className="mt-3 w-full" disabled={busy} onClick={save}>
          <Plus /> {busy ? "Enregistrement…" : "Enregistrer dans mes programmes"}
        </Button>
      )}
    </div>
  );
}
