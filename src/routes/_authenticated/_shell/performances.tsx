import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Activity, ArrowLeftRight, Clock, Dumbbell, LineChart as LineIcon, ListChecks, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  estimate1RM,
  formatDuration,
  PERIOD_OPTIONS,
  periodStart,
  RECORD_LABELS,
  RECORD_UNITS,
  startOfWeek,
  totalVolume,
  workingSets,
  type PeriodKey,
  type RecordType,
} from "@/lib/fitness";
import { performanceQuery, recordsQuery, type PerformanceSession } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/performances")({
  head: () => ({ meta: [{ title: "Performances — FitTracker" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(performanceQuery(context.user.id)),
      context.queryClient.ensureQueryData(recordsQuery(context.user.id)),
    ]),
  component: PerformancesPage,
});

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

type Metric = "max_weight" | "est_1rm" | "volume" | "max_reps";
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "max_weight", label: "Charge max", unit: "kg" },
  { key: "est_1rm", label: "1RM estimé", unit: "kg" },
  { key: "volume", label: "Volume", unit: "kg" },
  { key: "max_reps", label: "Reps max", unit: "reps" },
];

function PerformancesPage() {
  const { user } = Route.useRouteContext();
  const { data: sessions } = useSuspenseQuery(performanceQuery(user.id));
  const { data: records } = useSuspenseQuery(recordsQuery(user.id));
  const [period, setPeriod] = useState<PeriodKey>("90");

  const filtered = useMemo(() => {
    const start = periodStart(period);
    return sessions.filter((s) => s.started_at && (!start || new Date(s.started_at) >= start));
  }, [sessions, period]);

  const stats = useMemo(() => {
    const volume = filtered.reduce((t, s) => t + Number(s.total_volume_kg), 0);
    const duration = filtered.reduce((t, s) => t + (s.duration_seconds ?? 0), 0);
    const sets = filtered.reduce(
      (t, s) => t + s.workout_exercises.reduce((n, we) => n + workingSets(we.workout_sets).length, 0),
      0,
    );
    return { count: filtered.length, volume, avgDuration: filtered.length ? duration / filtered.length : 0, sets };
  }, [filtered]);

  const weekly = useMemo(() => {
    const map = new Map<string, { label: string; volume: number; seances: number; t: number }>();
    for (const s of filtered) {
      const w = startOfWeek(new Date(s.started_at!));
      const k = w.toISOString();
      const b = map.get(k) ?? { label: w.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), volume: 0, seances: 0, t: w.getTime() };
      b.volume += Number(s.total_volume_kg);
      b.seances += 1;
      map.set(k, b);
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [filtered]);

  const muscleSplit = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filtered)
      for (const we of s.workout_exercises) {
        const n = workingSets(we.workout_sets).length;
        if (n && we.exercises) m.set(we.exercises.muscle_group, (m.get(we.exercises.muscle_group) ?? 0) + n);
      }
    return [...m.entries()].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets);
  }, [filtered]);

  // Best current record per exercise and type.
  const bestRecords = useMemo(() => {
    const m = new Map<string, { name: string; values: Partial<Record<RecordType, { value: number; date: string; weight: number | null; reps: number | null }>> }>();
    for (const r of records) {
      if (!r.exercises) continue;
      const e = m.get(r.exercise_id) ?? { name: r.exercises.name, values: {} };
      const t = r.record_type as RecordType;
      const cur = e.values[t];
      if (!cur || Number(r.value) > cur.value) e.values[t] = { value: Number(r.value), date: r.achieved_at, weight: r.weight_kg != null ? Number(r.weight_kg) : null, reps: r.reps };
      m.set(r.exercise_id, e);
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  if (sessions.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Analyse" title="Performances" />
        <EmptyState
          icon={LineIcon}
          title="Pas encore de données"
          text="Termine ta première séance : tes charges, ton volume et tes records apparaîtront ici."
          action={<Button asChild><Link to="/entrainements">Démarrer une séance</Link></Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Performances"
        description="Ta progression, calculée à partir de tes séances terminées."
        actions={
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <TabsList>
              {PERIOD_OPTIONS.map((p) => <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={Activity} label="Séances" value={stats.count} />
        <StatCard icon={Dumbbell} label="Volume total" value={nf.format(stats.volume)} unit="kg" />
        <StatCard icon={ListChecks} label="Séries effectives" value={stats.sets} />
        <StatCard icon={Clock} label="Durée moyenne" value={formatDuration(stats.avgDuration)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Volume par semaine" icon={Dumbbell} className="lg:col-span-2">
          {weekly.length ? (
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} formatter={(v: number, n) => (n === "volume" ? `${nf.format(v)} kg` : v)} />
                  <Bar dataKey="volume" name="volume" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune séance sur cette période.</p>
          )}
        </Panel>
        <Panel title="Séries par muscle" icon={ListChecks}>
          {muscleSplit.length ? (
            <ul className="space-y-2">
              {muscleSplit.map((m) => (
                <li key={m.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">{m.name}</span>
                    <span className="font-semibold">{m.sets}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${(m.sets / muscleSplit[0]!.sets) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune série sur cette période.</p>
          )}
        </Panel>
      </div>

      <ExerciseProgress sessions={filtered} allSessions={sessions} />

      <Panel title="Records personnels" icon={Trophy} className="mt-4">
        {bestRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tes records apparaîtront après ta première séance terminée.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Exercice</th>
                  {(["max_weight", "est_1rm", "max_reps", "max_volume"] as RecordType[]).map((t) => (
                    <th key={t} className="px-2 py-2 font-medium">{RECORD_LABELS[t]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestRecords.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-2.5 font-medium">{e.name}</td>
                    {(["max_weight", "est_1rm", "max_reps", "max_volume"] as RecordType[]).map((t) => {
                      const v = e.values[t];
                      return (
                        <td key={t} className="px-2 py-2.5">
                          {v ? (
                            <>
                              <span className="font-semibold">{nf.format(v.value)} {RECORD_UNITS[t]}</span>
                              <span className="block text-xs text-muted-foreground">
                                {t === "max_reps" && v.weight ? `à ${nf.format(v.weight)} kg · ` : ""}
                                {t === "max_weight" && v.reps ? `× ${v.reps} · ` : ""}
                                {shortDate(v.date)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CompareSessions sessions={sessions} />
    </>
  );
}

function exerciseStatsInSession(s: PerformanceSession, exerciseId: string) {
  const sets = s.workout_exercises.filter((we) => we.exercise_id === exerciseId).flatMap((we) => we.workout_sets);
  const ws = workingSets(sets);
  if (!ws.length) return null;
  const best = ws.reduce((a, b) => {
    const ea = estimate1RM(Number(a.weight_kg ?? 0), a.reps ?? 0);
    const eb = estimate1RM(Number(b.weight_kg ?? 0), b.reps ?? 0);
    return eb > ea ? b : a;
  });
  return {
    max_weight: Math.max(...ws.map((x) => Number(x.weight_kg ?? 0))),
    est_1rm: Math.max(...ws.map((x) => estimate1RM(Number(x.weight_kg ?? 0), x.reps ?? 0))),
    volume: totalVolume(sets),
    max_reps: Math.max(...ws.map((x) => x.reps ?? 0)),
    sets: ws.length,
    bestSet: `${nf.format(Number(best.weight_kg ?? 0))} kg × ${best.reps}`,
  };
}

function ExerciseProgress({ sessions, allSessions }: { sessions: PerformanceSession[]; allSessions: PerformanceSession[] }) {
  const exercises = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const s of allSessions)
      for (const we of s.workout_exercises) {
        if (!we.exercises || !workingSets(we.workout_sets).length) continue;
        const e = m.get(we.exercise_id) ?? { id: we.exercise_id, name: we.exercises.name, count: 0 };
        e.count += 1;
        m.set(we.exercise_id, e);
      }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [allSessions]);
  const [exerciseId, setExerciseId] = useState<string>(exercises[0]?.id ?? "");
  const [metric, setMetric] = useState<Metric>("est_1rm");
  const info = METRICS.find((m) => m.key === metric)!;

  const points = useMemo(
    () =>
      sessions
        .map((s) => {
          const st = exerciseStatsInSession(s, exerciseId);
          return st ? { date: shortDate(s.started_at!), value: st[metric], ...st } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [sessions, exerciseId, metric],
  );
  const best = points.length ? Math.max(...points.map((p) => p.max_weight)) : null;
  const best1rm = points.length ? Math.max(...points.map((p) => p.est_1rm)) : null;
  const bestSet = points.length ? points.reduce((a, b) => (b.est_1rm > a.est_1rm ? b : a)).bestSet : null;

  if (!exercises.length) return null;

  return (
    <Panel title="Progression par exercice" icon={LineIcon} className="mt-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Select value={exerciseId} onValueChange={setExerciseId}>
          <SelectTrigger className="w-full lg:w-72"><SelectValue placeholder="Choisir un exercice" /></SelectTrigger>
          <SelectContent>
            {exercises.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <Button key={m.key} size="sm" variant={metric === m.key ? "default" : "outline"} onClick={() => setMetric(m.key)}>{m.label}</Button>
          ))}
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <MiniStat label="Charge max" value={best != null ? `${nf.format(best)} kg` : "—"} />
        <MiniStat label="Meilleure série" value={bestSet ?? "—"} />
        <MiniStat label="1RM estimé" value={best1rm != null ? `${nf.format(best1rm)} kg` : "—"} />
      </div>
      {points.length >= 2 ? (
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={["auto", "auto"]} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${nf.format(v)} ${info.unit}`} />
              <Line type="monotone" dataKey="value" name={info.label} stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-1)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState icon={LineIcon} title="Pas assez de séances" text="Il faut au moins deux séances avec cet exercice sur la période pour tracer une courbe." />
      )}
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-lg font-bold md:text-xl">{value}</p>
    </div>
  );
}

function CompareSessions({ sessions }: { sessions: PerformanceSession[] }) {
  const recent = useMemo(() => [...sessions].reverse(), [sessions]);
  const [a, setA] = useState<string>(recent[1]?.id ?? "");
  const [b, setB] = useState<string>(recent[0]?.id ?? "");
  const sa = recent.find((s) => s.id === a);
  const sb = recent.find((s) => s.id === b);

  if (recent.length < 2) return null;

  const label = (s: PerformanceSession) => `${s.name} · ${new Date(s.started_at!).toLocaleDateString("fr-FR")}`;
  const exIds = [...new Set([...(sa?.workout_exercises ?? []), ...(sb?.workout_exercises ?? [])].map((we) => we.exercise_id))];
  const nameOf = (id: string) =>
    [...(sa?.workout_exercises ?? []), ...(sb?.workout_exercises ?? [])].find((we) => we.exercise_id === id)?.exercises?.name ?? "Exercice";

  const delta = (x: number | null | undefined, y: number | null | undefined, unit = "") => {
    if (x == null || y == null) return null;
    const d = y - x;
    if (Math.abs(d) < 0.05) return <span className="text-muted-foreground">=</span>;
    return <span className={d > 0 ? "text-success" : "text-destructive"}>{d > 0 ? "+" : ""}{nf.format(d)}{unit}</span>;
  };

  return (
    <Panel title="Comparer deux séances" icon={ArrowLeftRight} className="mt-4">
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {[{ v: a, set: setA, l: "Séance A" }, { v: b, set: setB, l: "Séance B" }].map((x) => (
          <div key={x.l} className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{x.l}</p>
            <Select value={x.v} onValueChange={x.set}>
              <SelectTrigger><SelectValue placeholder="Choisir une séance" /></SelectTrigger>
              <SelectContent>
                {recent.map((s) => <SelectItem key={s.id} value={s.id}>{label(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {sa && sb && (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 font-medium" />
                <th className="px-2 py-2 font-medium">A</th>
                <th className="px-2 py-2 font-medium">B</th>
                <th className="px-2 py-2 font-medium">Écart</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="px-2 py-2.5 text-muted-foreground">Volume</td>
                <td className="px-2 py-2.5">{nf.format(Number(sa.total_volume_kg))} kg</td>
                <td className="px-2 py-2.5">{nf.format(Number(sb.total_volume_kg))} kg</td>
                <td className="px-2 py-2.5">{delta(Number(sa.total_volume_kg), Number(sb.total_volume_kg), " kg")}</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="px-2 py-2.5 text-muted-foreground">Durée</td>
                <td className="px-2 py-2.5">{formatDuration(sa.duration_seconds ?? 0)}</td>
                <td className="px-2 py-2.5">{formatDuration(sb.duration_seconds ?? 0)}</td>
                <td className="px-2 py-2.5">{delta(Math.round((sa.duration_seconds ?? 0) / 60), Math.round((sb.duration_seconds ?? 0) / 60), " min")}</td>
              </tr>
              {exIds.map((id) => {
                const xa = exerciseStatsInSession(sa, id);
                const xb = exerciseStatsInSession(sb, id);
                return (
                  <tr key={id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-2.5 font-medium">{nameOf(id)}</td>
                    <td className="px-2 py-2.5">{xa ? <>{xa.bestSet}<span className="block text-xs text-muted-foreground">{xa.sets} séries · 1RM {nf.format(xa.est_1rm)}</span></> : "—"}</td>
                    <td className="px-2 py-2.5">{xb ? <>{xb.bestSet}<span className="block text-xs text-muted-foreground">{xb.sets} séries · 1RM {nf.format(xb.est_1rm)}</span></> : "—"}</td>
                    <td className="px-2 py-2.5">{delta(xa?.est_1rm, xb?.est_1rm, " kg 1RM")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
