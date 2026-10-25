import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, Dumbbell, History, Play, Plus, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { WeekdayChips } from "@/components/app/workout/WeekdayChips";
import { Button } from "@/components/ui/button";
import { formatClock, formatDuration } from "@/lib/fitness";
import { activeSessionQuery, programsQuery, sessionsHistoryQuery } from "@/lib/queries";
import { invalidateTraining, startSession } from "@/lib/workouts";

export const Route = createFileRoute("/_authenticated/_shell/entrainements/")({
  head: () => ({ meta: [{ title: "Mes entraînements — FitTracker" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(activeSessionQuery(context.user.id)),
      context.queryClient.ensureQueryData(programsQuery(context.user.id)),
      context.queryClient.ensureQueryData(sessionsHistoryQuery(context.user.id)),
    ]),
  component: EntrainementsPage,
});

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function EntrainementsPage() {
  const { user } = Route.useRouteContext();
  const { data: active } = useSuspenseQuery(activeSessionQuery(user.id));
  const { data: programs } = useSuspenseQuery(programsQuery(user.id));
  const { data: history } = useSuspenseQuery(sessionsHistoryQuery(user.id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = ((new Date().getDay() + 6) % 7) + 1;

  const start = useMutation({
    mutationFn: (templateId: string | null) => startSession({ userId: user.id, templateId }),
    onSuccess: (r) => {
      invalidateTraining(qc);
      if (r.resumed) toast.info("Une séance est déjà en cours : on la reprend.");
      navigate({ to: "/entrainements/$sessionId", params: { sessionId: r.id } });
    },
    onError: () => toast.error("Impossible de démarrer la séance."),
  });

  const templates = programs.flatMap((p) =>
    p.workout_templates.map((t) => ({ ...t, programName: p.name })),
  );
  const todays = templates.filter((t) => t.weekdays.includes(today));

  return (
    <>
      <PageHeader
        eyebrow="Musculation"
        title="Mes entraînements"
        description="Lance une séance, suis tes séries en direct, retrouve ton historique."
        actions={
          !active && (
            <Button onClick={() => start.mutate(null)} disabled={start.isPending}>
              <Plus /> Séance libre
            </Button>
          )
        }
      />

      {active && <ActiveBanner id={active.id} name={active.name} startedAt={active.started_at} />}

      {!active && (
        <Panel title="Démarrer une séance" icon={Play} className="mb-4">
          {templates.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Aucune séance modèle"
              text="Crée un programme pour lancer tes séances en un geste, ou démarre une séance libre."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild><Link to="/programmes">Créer un programme</Link></Button>
                  <Button variant="outline" onClick={() => start.mutate(null)} disabled={start.isPending}>Séance libre</Button>
                </div>
              }
            />
          ) : (
            <>
              {todays.length > 0 && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Prévu aujourd'hui : <span className="text-foreground">{todays.map((t) => t.name).join(", ")}</span>
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...todays, ...templates.filter((t) => !todays.includes(t))].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={start.isPending || t.workout_template_exercises.length === 0}
                    onClick={() => start.mutate(t.id)}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3 text-left transition-all hover:border-foreground/40 hover:shadow-glow disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-bold uppercase">{t.name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{t.programName} · {t.workout_template_exercises.length} exercices</span>
                        <WeekdayChips days={t.weekdays} />
                      </span>
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Play className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      <Panel title="Historique" icon={History}>
        {history.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Aucune séance terminée" text="Tes séances apparaîtront ici dès que tu en auras terminé une." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((s) => {
              const sets = s.workout_exercises.reduce((n, we) => n + we.workout_sets.filter((x) => x.completed).length, 0);
              return (
                <li key={s.id}>
                  <Link
                    to="/entrainements/$sessionId"
                    params={{ sessionId: s.id }}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-foreground"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.started_at && new Date(s.started_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{s.workout_exercises.length} exercices · {sets} séries
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4 text-sm">
                      <span className="hidden text-right sm:block">
                        <span className="block font-display text-lg font-bold">{nf.format(Number(s.total_volume_kg))} kg</span>
                        <span className="block text-xs text-muted-foreground">{formatDuration(s.duration_seconds ?? 0)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ActiveBanner({ id, name, startedAt }: { id: string; name: string; startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0;
  return (
    <Link
      to="/entrainements/$sessionId"
      params={{ sessionId: id }}
      className="panel mb-4 flex items-center justify-between gap-4 border-foreground/40 p-5 shadow-glow transition-all hover:shadow-glow-strong"
    >
      <div>
        <p className="eyebrow flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-foreground" /> Séance en cours
        </p>
        <p className="mt-1 font-display text-3xl font-bold uppercase">{name}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2 font-display text-3xl font-bold tabular-nums">
          <Timer className="h-5 w-5 text-muted-foreground" />
          {formatClock(elapsed)}
        </span>
        <span className="hidden rounded-lg bg-primary px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-primary-foreground sm:block">
          Reprendre
        </span>
      </div>
    </Link>
  );
}
