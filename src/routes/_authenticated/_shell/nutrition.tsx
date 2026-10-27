import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Beef, ChevronLeft, ChevronRight, Droplet, Flame, Wheat } from "lucide-react";
import { Suspense, useState } from "react";
import { AddFoodDialog } from "@/components/app/nutrition/AddFoodDialog";
import { MealSection } from "@/components/app/nutrition/MealSection";
import { MyFoods } from "@/components/app/nutrition/MyFoods";
import { NutritionHistory } from "@/components/app/nutrition/NutritionHistory";
import { WaterPanel } from "@/components/app/nutrition/WaterPanel";
import { Meter, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MEAL_TYPES, percentOf, shiftISODate, sumMacros, toISODate, type MealType } from "@/lib/fitness";
import { foodsQuery, nutritionDayQuery, profileQuery, recipesQuery } from "@/lib/queries";

type Search = { jour?: string | undefined };

export const Route = createFileRoute("/_authenticated/_shell/nutrition")({
  head: () => ({ meta: [{ title: "Nutrition — FitTracker" }] }),
  validateSearch: (s: Record<string, unknown>): Search => {
    const jour = s["jour"];
    return { jour: typeof jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : undefined };
  },
  loaderDeps: ({ search }) => ({ jour: search.jour }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(nutritionDayQuery(context.user.id, deps.jour ?? toISODate())),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(foodsQuery(context.user.id)),
      context.queryClient.ensureQueryData(recipesQuery(context.user.id)),
    ]),
  component: NutritionPage,
});

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function formatDay(iso: string, today: string) {
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftISODate(today, -1)) return "Hier";
  const [y, m, d] = iso.split("-").map(Number);
  const s = longDate.format(new Date(y!, m! - 1, d!));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function NutritionPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const today = toISODate();
  const date = search.jour && search.jour <= today ? search.jour : today;
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: day } = useSuspenseQuery(nutritionDayQuery(user.id, date));
  const [adding, setAdding] = useState<MealType | null>(null);
  const [tab, setTab] = useState("journal");

  const totals = sumMacros(day.items);
  const goals = {
    calories: profile?.calorie_goal ?? 0,
    protein: profile?.protein_goal ?? 0,
    carbs: profile?.carbs_goal ?? 0,
    fat: profile?.fat_goal ?? 0,
    water: profile?.water_goal_ml ?? 0,
  };
  const remaining = goals.calories - totals.calories;
  const goTo = (d: string) => navigate({ search: { jour: d === today ? undefined : d } });

  return (
    <>
      <PageHeader
        eyebrow="Alimentation"
        title="Nutrition"
        description="Note ce que tu manges et ce que tu bois, repas par repas."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <Button size="icon" variant="ghost" aria-label="Jour précédent" onClick={() => goTo(shiftISODate(date, -1))}>
              <ChevronLeft />
            </Button>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && goTo(e.target.value > today ? today : e.target.value)}
              className="sr-only"
              id="nutrition-date"
              aria-label="Choisir une date"
            />
            <label htmlFor="nutrition-date" className="min-w-36 cursor-pointer px-2 text-center font-display text-lg font-semibold uppercase">
              {formatDay(date, today)}
            </label>
            <Button size="icon" variant="ghost" aria-label="Jour suivant" disabled={date >= today} onClick={() => goTo(shiftISODate(date, 1))}>
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="aliments">Mes aliments</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Panel title="Bilan du jour" icon={Flame}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-display text-5xl font-bold leading-none">
                      {nf.format(totals.calories)}
                      <span className="ml-1 text-lg font-semibold text-muted-foreground">/ {nf.format(goals.calories)} kcal</span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {remaining >= 0
                        ? `Il te reste ${nf.format(remaining)} kcal.`
                        : `Objectif dépassé de ${nf.format(-remaining)} kcal.`}
                    </p>
                  </div>
                </div>
                <Meter value={percentOf(totals.calories, goals.calories)} className="mt-4 h-2" />
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <MacroBar icon={Beef} label="Protéines" value={totals.protein} goal={goals.protein} />
                  <MacroBar icon={Wheat} label="Glucides" value={totals.carbs} goal={goals.carbs} />
                  <MacroBar icon={Droplet} label="Lipides" value={totals.fat} goal={goals.fat} />
                </div>
              </Panel>

              {MEAL_TYPES.map((m) => (
                <MealSection
                  key={m.key}
                  mealType={m.key}
                  label={m.label}
                  items={day.items.filter((i) => i.meal_type === m.key)}
                  onAdd={() => setAdding(m.key)}
                />
              ))}
            </div>
            <div className="space-y-6">
              <WaterPanel date={date} entries={day.water} goalMl={goals.water} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historique" className="mt-0">
          {profile && (
            <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
              <NutritionHistory userId={user.id} profile={profile} />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="aliments" className="mt-0">
          <MyFoods userId={user.id} />
        </TabsContent>
      </Tabs>

      <AddFoodDialog
        open={adding != null}
        onOpenChange={(o) => !o && setAdding(null)}
        userId={user.id}
        date={date}
        mealType={adding ?? "breakfast"}
      />
    </>
  );
}

function MacroBar({ icon: Icon, label, value, goal }: { icon: typeof Beef; label: string; value: number; goal: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span>
          <span className="font-semibold">{nf.format(value)}</span>
          <span className="text-muted-foreground"> / {nf.format(goal)} g</span>
        </span>
      </div>
      <Meter value={percentOf(value, goal)} className="mt-2" />
    </div>
  );
}
