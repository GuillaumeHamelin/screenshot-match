import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GOAL_CATEGORIES,
  GOAL_METRICS,
  goalCurrentValue,
  goalMetricInfo,
  parseNum,
  type GoalCategory,
  type GoalData,
  type GoalMetric,
} from "@/lib/fitness";
import type { Exercise, GoalRow } from "@/lib/queries";
import { invalidateTracking, saveGoal } from "@/lib/tracking";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function suggestGoalTitle(metric: GoalMetric, target: number | null, exerciseName?: string | null, refWeight?: number | null) {
  const t = target != null ? nf.format(target) : "…";
  const info = goalMetricInfo(metric);
  switch (metric) {
    case "max_weight":
      return `${exerciseName ?? "Exercice"} : ${t} kg`;
    case "est_1rm":
      return `${exerciseName ?? "Exercice"} : 1RM de ${t} kg`;
    case "reps_at_weight":
      return `${t} reps à ${exerciseName ?? "l'exercice"}${refWeight ? ` avec ${nf.format(refWeight)} kg` : ""}`;
    case "weekly_sessions":
      return `${t} séances par semaine`;
    case "weekly_volume":
      return `${t} kg de volume par semaine`;
    case "avg_protein":
      return `${t} g de protéines par jour`;
    case "avg_calories":
      return `${t} kcal par jour`;
    case "calorie_days":
      return `${t} jours sur 7 dans mon objectif calorique`;
    case "avg_water":
      return `${t} ml d'eau par jour`;
    case "manual":
      return "";
    default:
      return `${info.label} : ${t} ${info.unit}`;
  }
}

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

export function GoalFormDialog({
  trigger,
  goal,
  data,
  exercises,
}: {
  trigger: ReactNode;
  goal?: GoalRow;
  data: GoalData;
  exercises: Exercise[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<GoalCategory>((goal?.category as GoalCategory) ?? "strength");
  const [metric, setMetric] = useState<GoalMetric>((goal?.metric as GoalMetric) ?? "max_weight");
  const [exerciseId, setExerciseId] = useState(goal?.exercise_id ?? "");
  const [refWeight, setRefWeight] = useState(str(goal?.reference_weight_kg));
  const [title, setTitle] = useState(goal?.title ?? "");
  const [start, setStart] = useState(str(goal?.start_value));
  const [target, setTarget] = useState(str(goal?.target_value));
  const [manualCurrent, setManualCurrent] = useState(str(goal?.current_value));
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [date, setDate] = useState(goal?.target_date ?? "");
  const [startTouched, setStartTouched] = useState(Boolean(goal));

  const info = goalMetricInfo(metric);
  const metrics = GOAL_METRICS.filter((m) => m.category === category || m.category === "any");
  const exercise = exercises.find((e) => e.id === exerciseId);

  const current = useMemo(
    () =>
      info.key === "manual"
        ? parseNum(manualCurrent)
        : goalCurrentValue(
            { metric, exercise_id: exerciseId || null, reference_weight_kg: parseNum(refWeight), current_value: null },
            data,
          ),
    [info.key, manualCurrent, metric, exerciseId, refWeight, data],
  );

  // New goals start from the current value when one exists.
  useEffect(() => {
    if (startTouched) return;
    if (info.key === "manual") return;
    setStart(current != null ? String(current) : info.key === "weekly_sessions" || info.key === "calorie_days" ? "0" : "");
  }, [current, info.key, startTouched]);

  const suggested = suggestGoalTitle(metric, parseNum(target), exercise?.name, parseNum(refWeight));

  function changeCategory(c: GoalCategory) {
    setCategory(c);
    const first = GOAL_METRICS.find((m) => m.category === c);
    if (first) setMetric(first.key);
  }

  function validate(): string | null {
    if (info.needsExercise && !exerciseId) return "Choisis un exercice.";
    if (info.needsWeight) {
      const w = parseNum(refWeight);
      if (w == null || w < 0 || w > 500) return "Indique la charge (0 si poids du corps).";
    }
    const s = parseNum(start);
    const t = parseNum(target);
    if (s == null) return "Indique ta valeur de départ.";
    if (t == null) return "Indique ta valeur cible.";
    if (s < 0 || t < 0) return "Les valeurs ne peuvent pas être négatives.";
    if (s === t) return "La cible doit être différente de la valeur de départ.";
    if (info.key === "calorie_days" && t > 7) return "7 jours maximum sur une semaine.";
    if (info.key === "manual" && !title.trim()) return "Donne un nom à ton objectif.";
    if ((title.trim() || suggested).length > 120) return "Nom trop long (120 caractères maximum).";
    return null;
  }

  const save = useMutation({
    mutationFn: () =>
      saveGoal(
        {
          category,
          metric,
          title: title.trim() || suggested,
          exercise_id: info.needsExercise ? exerciseId : null,
          reference_weight_kg: info.needsWeight ? parseNum(refWeight) : null,
          start_value: parseNum(start)!,
          target_value: parseNum(target)!,
          current_value: info.key === "manual" ? (parseNum(manualCurrent) ?? parseNum(start)) : null,
          unit: info.key === "manual" ? unit.trim() || null : info.unit,
          target_date: date || null,
        },
        goal?.id,
      ),
    onSuccess: () => {
      invalidateTracking(qc);
      toast.success(goal ? "Objectif modifié." : "Objectif créé.");
      setOpen(false);
    },
    onError: () => toast.error("Enregistrement impossible."),
  });

  const unitLabel = info.key === "manual" ? unit : info.unit;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{goal ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
          <DialogDescription>{info.hint}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validate();
            if (err) { toast.error(err); return; }
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={category} onValueChange={(v) => v && changeCategory(v as GoalCategory)}>
                <SelectTrigger aria-label="Type d'objectif"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mesure</Label>
              <Select value={metric} onValueChange={(v) => v && setMetric(v as GoalMetric)}>
                <SelectTrigger aria-label="Mesure suivie"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metrics.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {info.needsExercise && (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label>Exercice</Label>
                <Select value={exerciseId} onValueChange={(v) => v && setExerciseId(v)}>
                  <SelectTrigger aria-label="Exercice"><SelectValue placeholder="Choisir un exercice" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {exercises.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {info.needsWeight && (
                <div className="space-y-1.5">
                  <Label htmlFor="g-ref">Avec une charge de (kg)</Label>
                  <Input id="g-ref" inputMode="decimal" value={refWeight} onChange={(e) => setRefWeight(e.target.value)} className="sm:w-36" placeholder="20" />
                </div>
              )}
            </div>
          )}

          {info.key === "manual" && (
            <div className="space-y-1.5">
              <Label htmlFor="g-unit">Unité</Label>
              <Input id="g-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={16} placeholder="km, min, pas…" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-start">Départ</Label>
              <Input id="g-start" inputMode="decimal" value={start} onChange={(e) => { setStart(e.target.value); setStartTouched(true); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-current">Actuel</Label>
              {info.key === "manual" ? (
                <Input id="g-current" inputMode="decimal" value={manualCurrent} onChange={(e) => setManualCurrent(e.target.value)} placeholder="= départ" />
              ) : (
                <div id="g-current" className="flex h-10 items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
                  {current != null ? nf.format(current) : "Aucune donnée"}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-target">Cible</Label>
              <Input id="g-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>
          {unitLabel && <p className="-mt-2 text-xs text-muted-foreground">Valeurs en {unitLabel}. La valeur actuelle se calcule à partir de ce que tu enregistres.</p>}

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="g-title">Nom</Label>
              <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggested || "Ex. : courir 10 km"} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-date">Date visée (facultatif)</Label>
              <Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{goal ? "Enregistrer" : "Créer l'objectif"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
