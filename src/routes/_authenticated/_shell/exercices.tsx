import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { ExerciseFormDialog } from "@/components/app/workout/ExerciseFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { exercisesQuery } from "@/lib/queries";
import { MUSCLE_GROUPS } from "@/lib/workouts";

export const Route = createFileRoute("/_authenticated/_shell/exercices")({
  head: () => ({ meta: [{ title: "Bibliothèque d'exercices — FitTracker" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(exercisesQuery(context.user.id)),
  component: ExercicesPage,
});

function ExercicesPage() {
  const { user } = Route.useRouteContext();
  const { data: exercises } = useSuspenseQuery(exercisesQuery(user.id));
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!muscle || e.muscle_group === muscle) &&
        (!mineOnly || e.user_id) &&
        (!n || e.name.toLowerCase().includes(n) || (e.equipment ?? "").toLowerCase().includes(n)),
    );
  }, [exercises, q, muscle, mineOnly]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["exercises", "program", "programs", "sessions", "performance", "records", "dashboard"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success("Exercice supprimé.");
    },
    onError: () => toast.error("Suppression impossible."),
  });

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" asChild>
        <Link to="/programmes"><ArrowLeft /> Programmes</Link>
      </Button>
      <PageHeader
        eyebrow="Musculation"
        title="Bibliothèque"
        description={`${exercises.length} exercices, dont ${exercises.filter((e) => e.user_id).length} perso.`}
        actions={<ExerciseFormDialog trigger={<Button><Plus /> Exercice perso</Button>} />}
      />

      <div className="mb-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher par nom ou matériel" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={muscle === null ? "default" : "outline"} onClick={() => setMuscle(null)}>Tous</Button>
          {MUSCLE_GROUPS.map((m) => (
            <Button key={m} size="sm" variant={muscle === m ? "default" : "outline"} onClick={() => setMuscle(m)}>{m}</Button>
          ))}
          <Button size="sm" variant={mineOnly ? "default" : "outline"} onClick={() => setMineOnly((v) => !v)}>Mes exercices</Button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucun exercice" text="Change les filtres ou crée ton propre exercice." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <article key={e.id} className="panel flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase leading-tight">{e.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.muscle_group}
                    {e.secondary_muscles.length > 0 && ` · ${e.secondary_muscles.join(", ")}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {e.equipment && <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{e.equipment}</span>}
                  {e.user_id && <span className="rounded border border-foreground/40 px-1.5 py-0.5 text-[11px]">Perso</span>}
                </div>
              </div>
              {e.description && <p className="mt-3 text-sm text-muted-foreground">{e.description}</p>}
              {e.tips && (
                <p className="mt-2 border-l-2 border-foreground/30 pl-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Conseil : </span>{e.tips}
                </p>
              )}
              {e.user_id && (
                <div className="mt-auto flex justify-end gap-1 pt-3">
                  <ExerciseFormDialog exercise={e} trigger={<Button size="sm" variant="ghost"><Pencil /> Modifier</Button>} />
                  <ConfirmDialog
                    title="Supprimer cet exercice ?"
                    description="Il sera retiré de tes programmes, et son historique de séances et de records sera supprimé."
                    confirmLabel="Supprimer"
                    onConfirm={() => del.mutate(e.id)}
                    trigger={<Button size="sm" variant="ghost" aria-label="Supprimer l'exercice"><Trash2 /></Button>}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
