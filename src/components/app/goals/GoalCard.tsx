import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, CircleCheck, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { toast } from "sonner";
import { Meter } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bestRepsAtWeight,
  exerciseBests,
  GOAL_CATEGORIES,
  goalCurrentValue,
  goalMetricInfo,
  goalProgress,
  isGoalReached,
  parseISODate,
  parseNum,
  toISODate,
  type GoalData,
} from "@/lib/fitness";
import type { Exercise, GoalRow } from "@/lib/queries";
import { deleteGoal, invalidateTracking, setGoalStatus, updateManualGoal } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { GoalFormDialog } from "./GoalFormDialog";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};

/** Values over time for goals that have a history (body measurements, exercise bests). */
function goalHistory(goal: GoalRow, data: GoalData): { label: string; value: number }[] {
  const info = goalMetricInfo(goal.metric);
  const fmt = (d: string) =>
    (d.length === 10 ? parseISODate(d) : new Date(d)).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  if (info.category === "body") {
    return [...data.measurements]
      .filter((m) => m[info.key] != null)
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
      .map((m) => ({ label: fmt(m.measured_on), value: Number(m[info.key]) }));
  }
  if (info.needsExercise) {
    const out: { label: string; value: number }[] = [];
    for (const s of [...data.sessions].sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""))) {
      const sets = s.workout_exercises.filter((we) => we.exercise_id === goal.exercise_id).flatMap((we) => we.workout_sets);
      if (!sets.length || !s.started_at) continue;
      const v =
        info.key === "reps_at_weight"
          ? bestRepsAtWeight(sets, Number(goal.reference_weight_kg ?? 0))
          : (exerciseBests(sets).find((b) => b.type === info.key)?.value ?? null);
      if (v != null) out.push({ label: fmt(s.started_at), value: v });
    }
    return out;
  }
  return [];
}

export function GoalCard({ goal, data, exercises }: { goal: GoalRow; data: GoalData; exercises: Exercise[] }) {
  const qc = useQueryClient();
  const info = goalMetricInfo(goal.metric);
  const start = goal.start_value != null ? Number(goal.start_value) : null;
  const target = Number(goal.target_value);
  const current = goalCurrentValue(goal, data);
  const pct = goalProgress(start, current, target);
  const reached = isGoalReached(start, current, target);
  const unit = goal.unit ?? info.unit;
  const history = useMemo(() => goalHistory(goal, data), [goal, data]);
  const [manual, setManual] = useState("");
  const today = toISODate();
  const daysLeft = goal.target_date
    ? Math.round((parseISODate(goal.target_date).getTime() - parseISODate(today).getTime()) / 86400000)
    : null;
  const category = GOAL_CATEGORIES.find((c) => c.key === goal.category)?.label ?? "Objectif";
  const active = goal.status === "active";

  const done = () => invalidateTracking(qc);
  const status = useMutation({
    mutationFn: (s: "active" | "completed" | "abandoned") => setGoalStatus(goal.id, s),
    onSuccess: (_, s) => {
      done();
      toast.success(s === "completed" ? "Bravo, objectif validé !" : s === "abandoned" ? "Objectif archivé." : "Objectif réactivé.");
    },
    onError: () => toast.error("Modification impossible."),
  });
  const remove = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: () => { done(); toast.success("Objectif supprimé."); },
    onError: () => toast.error("Suppression impossible."),
  });
  const update = useMutation({
    mutationFn: (v: number) => updateManualGoal(goal.id, v),
    onSuccess: () => { done(); setManual(""); toast.success("Valeur mise à jour."); },
    onError: () => toast.error("Mise à jour impossible."),
  });

  const fmtVal = (v: number | null) => (v != null ? nf.format(v) : "—");

  return (
    <article className={cn("panel flex flex-col p-5", reached && active && "border-foreground/40 shadow-glow", !active && "opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-[0.68rem]">{category}</p>
        {goal.status === "completed" ? (
          <span className="flex items-center gap-1 rounded border border-foreground/40 px-2 py-0.5 text-[11px] uppercase tracking-wider"><CircleCheck className="h-3 w-3" /> Validé</span>
        ) : goal.status === "abandoned" ? (
          <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">Archivé</span>
        ) : reached ? (
          <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">Atteint</span>
        ) : daysLeft != null && daysLeft < 0 ? (
          <span className="rounded border border-destructive/60 px-2 py-0.5 text-[11px] uppercase tracking-wider text-destructive">Échéance passée</span>
        ) : null}
      </div>
      <h3 className="mt-2 font-display text-xl font-bold uppercase leading-tight">{goal.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {info.needsExercise && goal.exercises?.name ? `${goal.exercises.name} · ` : ""}
        {info.label}
        {info.needsWeight ? ` (≥ ${nf.format(Number(goal.reference_weight_kg ?? 0))} kg)` : ""}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Départ", start],
          ["Actuel", current],
          ["Cible", target],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-lg border border-border bg-background/40 px-2 py-2">
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
            <dd className={cn("font-display text-xl font-bold", label === "Actuel" && "text-foreground")}>
              {fmtVal(v as number | null)}
              {unit && v != null && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Progression</span>
          <span className="font-display text-2xl font-bold">{pct}%</span>
        </div>
        <Meter value={pct} />
        {current == null && info.key !== "manual" && (
          <p className="mt-2 text-xs text-muted-foreground">Aucune donnée pour l'instant : la valeur s'affichera dès ton prochain enregistrement.</p>
        )}
      </div>

      {history.length >= 2 && (
        <div className="mt-4 h-20" aria-label="Évolution">
          <ResponsiveContainer>
            <LineChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <YAxis hide domain={[(min: number) => Math.min(min, target), (max: number) => Math.max(max, target)]} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} formatter={(v: number) => [`${nf.format(v)} ${unit}`, info.label]} />
              <ReferenceLine y={target} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 2, fill: "var(--color-chart-1)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {goal.target_date && (
        <p className="mt-3 text-xs text-muted-foreground">
          Date visée : <span className="text-foreground">{parseISODate(goal.target_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
          {active && daysLeft != null && daysLeft >= 0 && ` · ${daysLeft === 0 ? "aujourd'hui" : `J-${daysLeft}`}`}
        </p>
      )}

      {active && info.key === "manual" && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = parseNum(manual);
            if (v == null || v < 0) { toast.error("Valeur invalide."); return; }
            update.mutate(v);
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="decimal" placeholder="Nouvelle valeur" aria-label="Nouvelle valeur actuelle" className="h-9" />
          <Button type="submit" size="sm" variant="outline" disabled={!manual || update.isPending}>Mettre à jour</Button>
        </form>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        {active && reached && (
          <Button size="sm" onClick={() => status.mutate("completed")} disabled={status.isPending}><Check /> Valider</Button>
        )}
        <GoalFormDialog goal={goal} data={data} exercises={exercises} trigger={<Button size="sm" variant="outline"><Pencil /> Modifier</Button>} />
        {active ? (
          <Button size="sm" variant="ghost" onClick={() => status.mutate("abandoned")} disabled={status.isPending}><Archive /> Archiver</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => status.mutate("active")} disabled={status.isPending}><RotateCcw /> Réactiver</Button>
        )}
        <ConfirmDialog
          title="Supprimer l'objectif ?"
          description="Il sera définitivement effacé."
          confirmLabel="Supprimer"
          onConfirm={() => remove.mutate()}
          trigger={<Button size="icon" variant="ghost" className="ml-auto" aria-label="Supprimer l'objectif"><Trash2 /></Button>}
        />
      </div>
    </article>
  );
}
