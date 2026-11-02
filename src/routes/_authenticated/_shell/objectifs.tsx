import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleCheck, Plus, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { GoalCard } from "@/components/app/goals/GoalCard";
import { GoalFormDialog } from "@/components/app/goals/GoalFormDialog";
import { ensureGoalData, useGoalData } from "@/components/app/goals/useGoalData";
import { EmptyState, PageHeader, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GOAL_CATEGORIES, goalCurrentValue, goalProgress, isGoalReached } from "@/lib/fitness";
import { exercisesQuery, goalsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/objectifs")({
  head: () => ({
    meta: [
      { title: "Mes objectifs — FitTracker" },
      { name: "description", content: "Fixe tes objectifs de force, physiques et alimentaires et suis ta progression." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(goalsQuery(context.user.id)),
      context.queryClient.ensureQueryData(exercisesQuery(context.user.id)),
      ensureGoalData(context.queryClient, context.user.id),
    ]),
  component: ObjectifsPage,
});

type StatusFilter = "active" | "done" | "all";

function ObjectifsPage() {
  const { user } = Route.useRouteContext();
  const { data: goals } = useSuspenseQuery(goalsQuery(user.id));
  const { data: exercises } = useSuspenseQuery(exercisesQuery(user.id));
  const data = useGoalData(user.id);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<string>("all");

  const active = goals.filter((g) => g.status === "active");
  const values = active.map((g) => {
    const cur = goalCurrentValue(g, data);
    const start = g.start_value != null ? Number(g.start_value) : null;
    return { pct: goalProgress(start, cur, Number(g.target_value)), reached: isGoalReached(start, cur, Number(g.target_value)) };
  });
  const avg = values.length ? Math.round(values.reduce((s, v) => s + v.pct, 0) / values.length) : 0;
  const validated = goals.filter((g) => g.status === "completed").length;

  const shown = goals.filter(
    (g) =>
      (status === "all" || (status === "active" ? g.status === "active" : g.status !== "active")) &&
      (category === "all" || g.category === category),
  );

  const newButton = (label = "Nouvel objectif") => (
    <GoalFormDialog data={data} exercises={exercises} trigger={<Button><Plus /> {label}</Button>} />
  );

  return (
    <>
      <PageHeader
        eyebrow="Cibles"
        title="Mes objectifs"
        description="Force, physique, alimentation : la valeur actuelle se calcule toute seule à partir de tes données."
        actions={newButton()}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={Target} label="En cours" value={active.length} />
        <StatCard icon={CircleCheck} label="Atteints, à valider" value={values.filter((v) => v.reached).length} />
        <StatCard icon={CircleCheck} label="Validés" value={validated} />
        <StatCard icon={TrendingUp} label="Progression moyenne" value={active.length ? avg : "—"} unit={active.length ? "%" : undefined} progress={active.length ? avg : undefined} />
      </div>

      <div className="mb-4 mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">En cours</TabsTrigger>
            <TabsTrigger value="done">Validés et archivés</TabsTrigger>
            <TabsTrigger value="all">Tous</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={category === "all" ? "default" : "outline"} onClick={() => setCategory("all")}>Tout</Button>
          {GOAL_CATEGORIES.map((c) => (
            <Button key={c.key} size="sm" variant={category === c.key ? "default" : "outline"} onClick={() => setCategory(c.key)}>
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Target}
          title={goals.length === 0 ? "Aucun objectif" : "Rien ici"}
          text={
            goals.length === 0
              ? "Ex. : 100 kg au développé couché, 4 séances par semaine, atteindre 65 kg ou 150 g de protéines par jour."
              : "Aucun objectif ne correspond à ce filtre."
          }
          action={goals.length === 0 ? newButton("Créer mon premier objectif") : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((g) => <GoalCard key={g.id} goal={g} data={data} exercises={exercises} />)}
        </div>
      )}
    </>
  );
}
