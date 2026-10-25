import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft, Clock, Dumbbell, Layers, ListChecks, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  estimate1RM,
  formatDuration,
  RECORD_LABELS,
  RECORD_UNITS,
  SET_TYPE_LABELS,
  totalVolume,
  workingSets,
  type RecordType,
  type SetType,
} from "@/lib/fitness";
import { recordsQuery, sessionRecordsQuery, type SessionDetail } from "@/lib/queries";
import { deleteSession, invalidateTraining } from "@/lib/workouts";
import { ConfirmDialog } from "./ConfirmDialog";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function SessionSummary({ session }: { session: SessionDetail }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: sessionRecords = [] } = useQuery(sessionRecordsQuery(session.id));
  const { data: allRecords = [] } = useQuery(recordsQuery(user.id));

  const allSets = session.workout_exercises.flatMap((e) => e.workout_sets);
  const done = allSets.filter((s) => s.completed);

  const del = useMutation({
    mutationFn: () => deleteSession(session.id),
    onSuccess: () => {
      invalidateTraining(qc);
      toast.success("Séance supprimée.");
      navigate({ to: "/entrainements" });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  const previousOf = (r: (typeof sessionRecords)[number]) => {
    const older = allRecords.filter(
      (x) => x.exercise_id === r.exercise_id && x.record_type === r.record_type && x.id !== r.id && x.achieved_at < r.achieved_at,
    );
    return older.length ? Math.max(...older.map((x) => Number(x.value))) : null;
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" asChild>
        <Link to="/entrainements"><ArrowLeft /> Mes entraînements</Link>
      </Button>
      <PageHeader
        eyebrow={
          session.started_at
            ? new Date(session.started_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            : "Séance"
        }
        title={session.name}
        description="Récapitulatif de la séance."
        actions={
          <ConfirmDialog
            title="Supprimer cette séance ?"
            description="La séance, ses séries et les records obtenus pendant cette séance seront supprimés."
            confirmLabel="Supprimer"
            onConfirm={() => del.mutate()}
            trigger={<Button variant="outline"><Trash2 /> Supprimer</Button>}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Durée" value={formatDuration(session.duration_seconds ?? 0)} />
        <StatCard icon={Dumbbell} label="Volume" value={nf.format(Number(session.total_volume_kg))} unit="kg" sub="Hors échauffement" />
        <StatCard icon={ListChecks} label="Séries" value={done.length} />
        <StatCard icon={Layers} label="Exercices" value={session.workout_exercises.length} />
      </div>

      <Panel title="Records battus" icon={Trophy} className="mt-4">
        {sessionRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas de nouveau record sur cette séance. La régularité finit toujours par payer.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessionRecords.map((r) => {
              const type = r.record_type as RecordType;
              const prev = previousOf(r);
              return (
                <li key={r.id} className="rounded-lg border border-foreground/30 bg-accent/50 p-3 shadow-glow">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{RECORD_LABELS[type]}</p>
                  <p className="truncate font-medium">{r.exercises?.name}</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {nf.format(Number(r.value))} <span className="text-sm text-muted-foreground">{RECORD_UNITS[type]}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {type !== "max_volume" && r.reps != null && r.weight_kg != null && `${nf.format(Number(r.weight_kg))} kg × ${r.reps} · `}
                    {prev != null ? `avant : ${nf.format(prev)} ${RECORD_UNITS[type]}` : "Premier record"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {session.workout_exercises.map((we) => {
          const ws = workingSets(we.workout_sets);
          const best1rm = ws.reduce((m, s) => Math.max(m, estimate1RM(Number(s.weight_kg ?? 0), s.reps ?? 0)), 0);
          return (
            <Panel key={we.id} title={we.exercises?.name ?? "Exercice"}>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Volume : <span className="text-foreground">{nf.format(totalVolume(we.workout_sets))} kg</span></span>
                {best1rm > 0 && <span>1RM estimé : <span className="text-foreground">{nf.format(best1rm)} kg</span></span>}
              </div>
              <ul className="space-y-1">
                {we.workout_sets.filter((s) => s.completed).map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-5 font-display font-bold text-muted-foreground">{i + 1}</span>
                      {s.weight_kg != null ? `${nf.format(Number(s.weight_kg))} kg` : "Poids du corps"} × {s.reps}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.set_type !== "normal" && SET_TYPE_LABELS[s.set_type as SetType]}
                      {s.rpe != null && ` · RPE ${nf.format(Number(s.rpe))}`}
                      {s.rir != null && ` · RIR ${s.rir}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      {session.notes && (
        <Panel title="Notes" className="mt-4">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{session.notes}</p>
        </Panel>
      )}
    </>
  );
}
