import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Minus,
  Moon,
  Pencil,
  Play,
  Target,
  Trash2,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { PlanProgramDialog, PlanSessionDialog, type TemplateOption } from "@/components/app/calendar/PlanDialogs";
import { PageHeader, Panel } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calendarState,
  formatDuration,
  monthGrid,
  parseISODate,
  sessionDay,
  shiftISODate,
  shiftMonth,
  toISODate,
  weekDates,
  type CalendarState,
} from "@/lib/fitness";
import { calendarQuery, programsQuery, type CalendarSession } from "@/lib/queries";
import { updatePlannedSession } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { deleteSession, invalidateTraining, startSession } from "@/lib/workouts";

type View = "mois" | "semaine";
type Search = { vue?: View | undefined; date?: string | undefined };

function rangeFor(view: View, date: string) {
  const days = view === "mois" ? monthGrid(date) : weekDates(date);
  return { days, from: days[0]!, to: days[days.length - 1]! };
}

export const Route = createFileRoute("/_authenticated/_shell/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier — FitTracker" },
      { name: "description", content: "Planifie, déplace et retrouve tes séances au mois ou à la semaine." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    vue: s["vue"] === "semaine" ? "semaine" : s["vue"] === "mois" ? "mois" : undefined,
    date: typeof s["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["date"]) ? s["date"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ vue: search.vue ?? "mois", date: search.date ?? toISODate() }),
  loader: ({ context, deps }) => {
    const r = rangeFor(deps.vue, deps.date);
    return Promise.all([
      context.queryClient.ensureQueryData(calendarQuery(context.user.id, r.from, r.to)),
      context.queryClient.ensureQueryData(programsQuery(context.user.id)),
    ]);
  },
  component: CalendrierPage,
});

const STATE: Record<CalendarState, { label: string; icon: LucideIcon; chip: string }> = {
  completed: { label: "Terminée", icon: Check, chip: "bg-primary text-primary-foreground border-primary" },
  in_progress: { label: "En cours", icon: Play, chip: "bg-primary/80 text-primary-foreground border-primary animate-pulse" },
  scheduled: { label: "Prévue", icon: CircleDashed, chip: "border-foreground/50 text-foreground bg-background/40" },
  missed: { label: "Manquée", icon: TriangleAlert, chip: "border-dashed border-foreground/40 text-muted-foreground" },
  skipped: { label: "Passée", icon: Minus, chip: "border-border text-muted-foreground line-through" },
};

const WEEK_HEAD = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function CalendrierPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const today = toISODate();
  const view: View = search.vue ?? "mois";
  const anchor = search.date ?? today;
  const range = rangeFor(view, anchor);
  const { data } = useSuspenseQuery(calendarQuery(user.id, range.from, range.to));
  const { data: programs } = useSuspenseQuery(programsQuery(user.id));
  const [selected, setSelected] = useState<string>(anchor);
  const [planOpen, setPlanOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarSession | null>(null);
  const [planDate, setPlanDate] = useState(today);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const templates: TemplateOption[] = programs.flatMap((p) =>
    p.workout_templates.map((t) => ({ id: t.id, name: t.name, programName: p.name, weekdays: t.weekdays })),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    for (const s of data.sessions) {
      const d = sessionDay(s);
      if (!d) continue;
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.started_at ?? a.scheduled_date ?? "").localeCompare(b.started_at ?? b.scheduled_date ?? ""));
    return map;
  }, [data.sessions]);
  const goalsByDay = useMemo(() => {
    const map = new Map<string, typeof data.goals>();
    for (const g of data.goals) if (g.target_date) map.set(g.target_date, [...(map.get(g.target_date) ?? []), g]);
    return map;
  }, [data.goals]);

  const go = (patch: Search) => navigate({ search: (s) => ({ ...s, ...patch }) });
  const shift = (dir: -1 | 1) => {
    const next = view === "mois" ? shiftMonth(anchor, dir) : shiftISODate(anchor, dir * 7);
    setSelected(next);
    go({ date: next });
  };
  const goToday = () => { setSelected(today); go({ date: undefined }); };

  const move = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => updatePlannedSession(id, { scheduled_date: date }),
    onSuccess: (_, v) => { invalidateTraining(qc); toast.success(`Séance déplacée au ${shortFmt.format(parseISODate(v.date))}`); },
    onError: () => toast.error("Déplacement impossible."),
  });

  const counts = useMemo(() => {
    const c = { completed: 0, scheduled: 0, missed: 0 };
    for (const s of data.sessions) {
      const d = sessionDay(s);
      if (!d || (view === "mois" && d.slice(0, 7) !== anchor.slice(0, 7))) continue;
      const st = calendarState(s, today);
      if (st === "completed") c.completed++;
      else if (st === "scheduled") c.scheduled++;
      else if (st === "missed") c.missed++;
    }
    return c;
  }, [data.sessions, view, anchor, today]);

  const onDrop = (e: DragEvent, day: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/session-id");
    const from = e.dataTransfer.getData("text/session-day");
    if (id && from !== day) move.mutate({ id, date: day });
  };
  const dropProps = (day: string) => ({
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes("text/session-id")) { e.preventDefault(); setDragOver(day); }
    },
    onDragLeave: () => setDragOver((d) => (d === day ? null : d)),
    onDrop: (e: DragEvent) => onDrop(e, day),
  });

  const title =
    view === "mois"
      ? cap(monthFmt.format(parseISODate(anchor)))
      : `Semaine du ${shortFmt.format(parseISODate(range.from))} au ${shortFmt.format(parseISODate(range.to))}`;

  const openPlan = (day: string) => { setEditing(null); setPlanDate(day < today ? today : day); setPlanOpen(true); };

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Calendrier"
        description="Tes séances prévues, terminées et manquées. Glisse une séance prévue sur un autre jour pour la déplacer."
        actions={
          <>
            <Button variant="outline" onClick={() => setProgramOpen(true)}><ClipboardList /> Depuis un programme</Button>
            <Button onClick={() => openPlan(selected)}><CalendarPlus /> Planifier une séance</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <Button size="icon" variant="ghost" aria-label={view === "mois" ? "Mois précédent" : "Semaine précédente"} onClick={() => shift(-1)}><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" aria-label={view === "mois" ? "Mois suivant" : "Semaine suivante"} onClick={() => shift(1)}><ChevronRight /></Button>
          </div>
          <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
          <Button size="sm" variant="ghost" onClick={goToday}>Aujourd'hui</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{counts.completed}</span> terminée{counts.completed > 1 ? "s" : ""} ·{" "}
            <span className="text-foreground">{counts.scheduled}</span> prévue{counts.scheduled > 1 ? "s" : ""} ·{" "}
            <span className="text-foreground">{counts.missed}</span> manquée{counts.missed > 1 ? "s" : ""}
          </p>
          <Tabs value={view} onValueChange={(v) => go({ vue: v as View, date: selected })}>
            <TabsList>
              <TabsTrigger value="mois">Mois</TabsTrigger>
              <TabsTrigger value="semaine">Semaine</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Legend />

      <div className={cn("mt-4 grid gap-4", view === "mois" && "xl:grid-cols-[1fr_340px]")}>
        {view === "mois" ? (
          <div className="panel overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-border">
              {WEEK_HEAD.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {range.days.map((day) => {
                const sessions = byDay.get(day) ?? [];
                const goals = goalsByDay.get(day) ?? [];
                const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
                const rest = day < today && !sessions.some((s) => s.status === "completed" || s.status === "in_progress");
                return (
                  <div
                    key={day}
                    role="button"
                    tabIndex={0}
                    aria-label={cap(dayFmt.format(parseISODate(day)))}
                    aria-pressed={selected === day}
                    onClick={() => setSelected(day)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(day); } }}
                    {...dropProps(day)}
                    className={cn(
                      "relative min-h-[64px] cursor-pointer border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/40 md:min-h-[110px] md:p-2 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-background/40 text-muted-foreground/60",
                      selected === day && "bg-accent/60 ring-1 ring-inset ring-foreground/40",
                      dragOver === day && "bg-accent ring-2 ring-inset ring-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", day === today && "bg-primary text-primary-foreground shadow-glow")}>
                        {Number(day.slice(8))}
                      </span>
                      {goals.length > 0 && <Target className="h-3.5 w-3.5" aria-label="Objectif" />}
                    </div>
                    {/* Mobile: dots */}
                    <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                      {sessions.map((s) => {
                        const st = calendarState(s, today);
                        return <span key={s.id} className={cn("h-2 w-2 rounded-full border", st === "completed" || st === "in_progress" ? "border-primary bg-primary" : st === "scheduled" ? "border-foreground" : "border-dashed border-muted-foreground")} />;
                      })}
                    </div>
                    {/* Desktop: chips */}
                    <div className="mt-1 hidden space-y-1 md:block">
                      {sessions.slice(0, 3).map((s) => <SessionChip key={s.id} session={s} today={today} day={day} />)}
                      {sessions.length > 3 && <p className="text-[11px] text-muted-foreground">+{sessions.length - 3}</p>}
                      {sessions.length === 0 && rest && inMonth && <p className="text-[11px] text-muted-foreground/60">Repos</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-7">
            {range.days.map((day, i) => {
              const sessions = byDay.get(day) ?? [];
              const goals = goalsByDay.get(day) ?? [];
              const rest = day < today && !sessions.some((s) => s.status === "completed" || s.status === "in_progress");
              return (
                <div
                  key={day}
                  {...dropProps(day)}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "panel flex min-h-[120px] min-w-0 cursor-pointer flex-col p-3 transition-colors md:min-h-[260px]",
                    selected === day && "border-foreground/50",
                    dragOver === day && "bg-accent ring-2 ring-foreground",
                  )}
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{WEEK_HEAD[i]}</span>
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full font-display text-lg font-bold", day === today && "bg-primary text-primary-foreground shadow-glow")}>
                      {Number(day.slice(8))}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {sessions.map((s) => <SessionChip key={s.id} session={s} today={today} day={day} large />)}
                    {goals.map((g) => (
                      <p key={g.id} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"><Target className="h-3 w-3 shrink-0" /> <span className="truncate">{g.title}</span></p>
                    ))}
                    {sessions.length === 0 && rest && <p className="flex items-center gap-1 text-xs text-muted-foreground/70"><Moon className="h-3 w-3" /> Repos</p>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openPlan(day); }}
                    className="mt-auto pt-2 text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Planifier
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <DayPanel
          day={selected}
          today={today}
          sessions={byDay.get(selected) ?? []}
          goals={goalsByDay.get(selected) ?? []}
          inRange={selected >= range.from && selected <= range.to}
          userId={user.id}
          onPlan={() => openPlan(selected)}
          onEdit={(s) => { setEditing(s); setPlanOpen(true); }}
        />
      </div>

      <PlanSessionDialog open={planOpen} onOpenChange={setPlanOpen} session={editing} defaultDate={planDate} templates={templates} />
      <PlanProgramDialog
        open={programOpen}
        onOpenChange={setProgramOpen}
        userId={user.id}
        programs={programs.map((p) => ({ id: p.id, name: p.name, templates: p.workout_templates.length }))}
      />
    </>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(["completed", "scheduled", "missed", "skipped"] as const).map((k) => {
        const S = STATE[k];
        return (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", S.chip)}><S.icon className="h-2.5 w-2.5" /></span>
            {S.label}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" /> Repos</span>
      <span className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Date d'objectif</span>
    </div>
  );
}

function SessionChip({ session, today, day, large }: { session: CalendarSession; today: string; day: string; large?: boolean }) {
  const st = calendarState(session, today);
  const S = STATE[st];
  const movable = session.status === "scheduled" || session.status === "skipped";
  return (
    <div
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/session-id", session.id);
        e.dataTransfer.setData("text/session-day", day);
        e.dataTransfer.effectAllowed = "move";
      }}
      title={`${session.name} — ${S.label}`}
      className={cn(
        "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium",
        large && "px-2 py-1.5 text-xs",
        movable && "cursor-grab active:cursor-grabbing",
        S.chip,
      )}
    >
      <S.icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{session.name}</span>
    </div>
  );
}

function DayPanel({
  day,
  today,
  sessions,
  goals,
  inRange,
  userId,
  onPlan,
  onEdit,
}: {
  day: string;
  today: string;
  sessions: CalendarSession[];
  goals: { id: string; title: string; status: string }[];
  inRange: boolean;
  userId: string;
  onPlan: () => void;
  onEdit: (s: CalendarSession) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const done = () => invalidateTraining(qc);

  const start = useMutation({
    mutationFn: (s: CalendarSession) => startSession({ userId, templateId: s.template_id, scheduledId: s.id, name: s.name }),
    onSuccess: (r) => {
      done();
      if (r.resumed) toast.info("Une séance est déjà en cours : on la reprend.");
      navigate({ to: "/entrainements/$sessionId", params: { sessionId: r.id } });
    },
    onError: () => toast.error("Impossible de démarrer la séance."),
  });
  const skip = useMutation({
    mutationFn: ({ id, skipped }: { id: string; skipped: boolean }) => updatePlannedSession(id, { status: skipped ? "skipped" : "scheduled" }),
    onSuccess: (_, v) => { done(); toast.success(v.skipped ? "Séance marquée comme passée." : "Séance remise au planning."); },
    onError: () => toast.error("Modification impossible."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => { done(); toast.success("Séance supprimée."); },
    onError: () => toast.error("Suppression impossible."),
  });

  const rest = day < today && !sessions.some((s) => s.status === "completed" || s.status === "in_progress");

  return (
    <Panel title={cap(dayFmt.format(parseISODate(day)))} className="h-fit">
      {!inRange ? (
        <p className="text-sm text-muted-foreground">Choisis un jour dans le calendrier.</p>
      ) : (
        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {rest ? <><Moon className="h-4 w-4" /> Jour de repos.</> : day === today ? "Rien de prévu aujourd'hui." : "Rien de prévu ce jour-là."}
            </p>
          )}
          {sessions.map((s) => {
            const st = calendarState(s, today);
            const S = STATE[st];
            const planned = s.status === "scheduled" || s.status === "skipped";
            return (
              <div key={s.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold uppercase">{s.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <S.icon className="h-3 w-3" /> {S.label}
                      {st === "completed" && ` · ${formatDuration(s.duration_seconds ?? 0)} · ${nf.format(Number(s.total_volume_kg ?? 0))} kg`}
                    </p>
                    {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(st === "completed" || st === "in_progress") && (
                    <Button size="sm" variant={st === "in_progress" ? "default" : "outline"} asChild>
                      <Link to="/entrainements/$sessionId" params={{ sessionId: s.id }}>
                        {st === "in_progress" ? <><Play /> Reprendre</> : "Voir le détail"}
                      </Link>
                    </Button>
                  )}
                  {planned && (
                    <>
                      {s.status === "scheduled" && (
                        <Button size="sm" onClick={() => start.mutate(s)} disabled={start.isPending}><Play /> Démarrer</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => onEdit(s)}><Pencil /> Modifier</Button>
                      <Button size="sm" variant="ghost" onClick={() => skip.mutate({ id: s.id, skipped: s.status !== "skipped" })} disabled={skip.isPending}>
                        {s.status === "skipped" ? <><Undo2 /> Remettre</> : <><Minus /> Passer</>}
                      </Button>
                      <ConfirmDialog
                        title="Supprimer la séance prévue ?"
                        confirmLabel="Supprimer"
                        onConfirm={() => remove.mutate(s.id)}
                        trigger={<Button size="icon" variant="ghost" aria-label="Supprimer la séance"><Trash2 /></Button>}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {goals.map((g) => (
            <Link key={g.id} to="/objectifs" className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm hover:border-foreground/40">
              <Target className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{g.title}</span>
                <span className="text-xs text-muted-foreground">Date visée de ton objectif</span>
              </span>
            </Link>
          ))}
          <Button variant="outline" className="w-full" onClick={onPlan}><CalendarPlus /> Planifier ce jour</Button>
        </div>
      )}
    </Panel>
  );
}
