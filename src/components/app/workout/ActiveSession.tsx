import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Flag, History, MoreVertical, Plus, SlidersHorizontal, Timer, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatClock, parseNum, SET_TYPE_LABELS, totalVolume, type SetType } from "@/lib/fitness";
import {
  previousPerformanceQuery,
  sessionQuery,
  type SessionDetail,
  type SessionExercise,
  type WorkoutSet,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { deleteSession, finishSession, invalidateTraining, moveItem, reorderRows } from "@/lib/workouts";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExercisePicker } from "./ExercisePicker";
import { RestTimerBar, useRestTimer } from "./RestTimer";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

// Field saves in flight; finishing waits for them so no typed value is lost.
const pendingSaves = new Set<Promise<unknown>>();
function track<T>(p: Promise<T>) {
  pendingSaves.add(p);
  p.finally(() => pendingSaves.delete(p));
  return p;
}

const SET_TYPES: SetType[] = ["normal", "warmup", "dropset", "failure"];
const SET_BADGE: Record<SetType, string> = { normal: "", warmup: "É", dropset: "D", failure: "F" };

function patchSetInCache(qc: QueryClient, sessionId: string, setId: string, patch: Partial<WorkoutSet>) {
  qc.setQueryData(sessionQuery(sessionId).queryKey, (old) =>
    old
      ? {
          ...old,
          workout_exercises: old.workout_exercises.map((we) => ({
            ...we,
            workout_sets: we.workout_sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
          })),
        }
      : old,
  );
}

export function ActiveSession({ session }: { session: SessionDetail }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const timer = useRestTimer(session.id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const exercises = session.workout_exercises;
  const exerciseIds = exercises.map((e) => e.exercise_id);
  const { data: previous = {} } = useQuery(previousPerformanceQuery(user.id, session.id, exerciseIds));
  const refetch = () => qc.invalidateQueries({ queryKey: ["session", session.id] });

  const allSets = exercises.flatMap((e) => e.workout_sets);
  const doneCount = allSets.filter((s) => s.completed).length;
  const liveVolume = totalVolume(allSets);
  const elapsed = session.started_at ? (now - new Date(session.started_at).getTime()) / 1000 : 0;

  const addExercises = useMutation({
    mutationFn: async (ids: string[]) => {
      const start = exercises.length ? Math.max(...exercises.map((e) => e.position)) + 1 : 0;
      const { data, error } = await supabase
        .from("workout_exercises")
        .insert(ids.map((exercise_id, i) => ({ session_id: session.id, exercise_id, position: start + i, rest_seconds: 90 })))
        .select("id");
      if (error) throw error;
      const { error: se } = await supabase
        .from("workout_sets")
        .insert(data.map((we) => ({ workout_exercise_id: we.id, set_number: 1 })));
      if (se) throw se;
    },
    onSuccess: refetch,
    onError: () => toast.error("Ajout impossible."),
  });

  const move = useMutation({
    mutationFn: (args: { index: number; delta: -1 | 1 }) =>
      reorderRows("workout_exercises", moveItem(exercises, args.index, args.delta).map((e) => e.id)),
    onSuccess: refetch,
  });

  const finish = useMutation({
    mutationFn: async () => {
      await Promise.all([...pendingSaves]);
      return finishSession(session.id, user.id);
    },
    onSuccess: (r) => {
      timer.stop();
      invalidateTraining(qc);
      toast.success(
        r.records > 0 ? `Séance terminée ! ${r.records} record${r.records > 1 ? "s" : ""} battu${r.records > 1 ? "s" : ""}.` : "Séance terminée, bien joué !",
      );
      window.scrollTo({ top: 0 });
    },
    onError: () => toast.error("Impossible de terminer la séance. Réessaie."),
  });

  const abandon = useMutation({
    mutationFn: () => deleteSession(session.id),
    onSuccess: () => {
      timer.stop();
      invalidateTraining(qc);
      toast.success("Séance abandonnée.");
      navigate({ to: "/entrainements" });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  return (
    <div className="pb-24">
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
              <Link to="/entrainements" aria-label="Retour"><ArrowLeft /></Link>
            </Button>
            <div className="min-w-0">
              <SessionName session={session} />
              <p className="text-xs text-muted-foreground">
                {doneCount} série{doneCount > 1 ? "s" : ""} validée{doneCount > 1 ? "s" : ""} · {nf.format(liveVolume)} kg
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums md:text-3xl" aria-label="Durée de la séance">
              <Timer className="h-4 w-4 text-muted-foreground" />
              {formatClock(elapsed)}
            </span>
            {doneCount > 0 ? (
              <ConfirmDialog
                destructive={false}
                title="Terminer la séance ?"
                description={`${doneCount} série${doneCount > 1 ? "s" : ""} validée${doneCount > 1 ? "s" : ""}. Les séries non validées seront retirées. Tes records seront calculés automatiquement.`}
                confirmLabel="Terminer"
                onConfirm={() => finish.mutate()}
                trigger={
                  <Button disabled={finish.isPending}>
                    <Flag /> <span className="hidden sm:inline">Terminer</span>
                  </Button>
                }
              />
            ) : (
              <Button disabled title="Valide au moins une série pour terminer">
                <Flag /> <span className="hidden sm:inline">Terminer</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Options de la séance"><MoreVertical /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    if (window.confirm("Abandonner cette séance ? Elle sera supprimée.")) abandon.mutate();
                  }}
                >
                  <X /> Abandonner la séance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {exercises.length === 0 && (
        <div className="panel mb-4 p-8 text-center">
          <p className="font-display text-xl font-semibold uppercase">Séance vide</p>
          <p className="mt-1 text-sm text-muted-foreground">Ajoute tes exercices pour commencer à enregistrer tes séries.</p>
        </div>
      )}

      <div className="space-y-4">
        {exercises.map((we, i) => (
          <ExerciseCard
            key={we.id}
            sessionId={session.id}
            we={we}
            previous={previous[we.exercise_id]}
            canUp={i > 0}
            canDown={i < exercises.length - 1}
            onMove={(delta) => move.mutate({ index: i, delta })}
            onSetDone={() => timer.start(we.rest_seconds, `Après ${we.exercises?.name ?? "la série"}`)}
          />
        ))}
      </div>

      <ExercisePicker
        pending={addExercises.isPending}
        onPick={(ids) => addExercises.mutateAsync(ids)}
        trigger={
          <Button variant="outline" size="lg" className="mt-4 w-full">
            <Plus /> Ajouter des exercices
          </Button>
        }
      />

      <SessionNotes session={session} />
      <RestTimerBar timer={timer} />
    </div>
  );
}

function SessionName({ session }: { session: SessionDetail }) {
  const qc = useQueryClient();
  const [name, setName] = useState(session.name);
  return (
    <input
      aria-label="Nom de la séance"
      className="w-full truncate bg-transparent font-display text-xl font-bold uppercase outline-none focus:underline md:text-2xl"
      value={name}
      maxLength={60}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        const v = name.trim();
        if (!v) return setName(session.name);
        if (v === session.name) return;
        track(
          (async () => {
            const { error } = await supabase.from("workout_sessions").update({ name: v }).eq("id", session.id);
            if (error) toast.error("Renommage impossible.");
            else qc.invalidateQueries({ queryKey: ["session", session.id] });
          })(),
        );
      }}
    />
  );
}

function SessionNotes({ session }: { session: SessionDetail }) {
  const [notes, setNotes] = useState(session.notes ?? "");
  return (
    <div className="panel mt-4 p-4">
      <label htmlFor="session-notes" className="eyebrow">Notes de séance</label>
      <Textarea
        id="session-notes"
        className="mt-2"
        rows={3}
        maxLength={1000}
        placeholder="Sensations, douleurs, réglages machine…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes === (session.notes ?? "")) return;
          track(
            (async () => {
              const { error } = await supabase.from("workout_sessions").update({ notes: notes.trim() || null }).eq("id", session.id);
              if (error) toast.error("Notes non enregistrées.");
            })(),
          );
        }}
      />
    </div>
  );
}

function ExerciseCard({
  sessionId,
  we,
  previous,
  canUp,
  canDown,
  onMove,
  onSetDone,
}: {
  sessionId: string;
  we: SessionExercise;
  previous: { date: string | null; sets: WorkoutSet[] } | undefined;
  canUp: boolean;
  canDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onSetDone: () => void;
}) {
  const qc = useQueryClient();
  const [details, setDetails] = useState(false);
  const [rest, setRest] = useState(String(we.rest_seconds));
  const refetch = () => qc.invalidateQueries({ queryKey: ["session", sessionId] });
  const sets = we.workout_sets;

  const addSet = useMutation({
    mutationFn: async () => {
      await Promise.all([...pendingSaves]);
      const last = qc.getQueryData(sessionQuery(sessionId).queryKey)?.workout_exercises.find((x) => x.id === we.id)?.workout_sets.at(-1);
      const { error } = await supabase.from("workout_sets").insert({
        workout_exercise_id: we.id,
        set_number: (last?.set_number ?? 0) + 1,
        weight_kg: last?.weight_kg ?? null,
        reps: last?.reps ?? null,
        set_type: last?.set_type === "warmup" ? "normal" : (last?.set_type ?? "normal"),
      });
      if (error) throw error;
    },
    onSuccess: refetch,
    onError: () => toast.error("Ajout impossible."),
  });

  const removeExercise = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workout_exercises").delete().eq("id", we.id);
      if (error) throw error;
    },
    onSuccess: refetch,
  });

  const prevText = previous?.sets
    .filter((s) => s.set_type !== "warmup")
    .map((s) => `${s.weight_kg != null ? nf.format(Number(s.weight_kg)) : "0"}×${s.reps ?? 0}`)
    .join(" · ");

  return (
    <section className="panel p-3 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase leading-tight md:text-2xl">{we.exercises?.name}</h2>
          <p className="text-xs text-muted-foreground">{we.exercises?.muscle_group}{we.exercises?.equipment ? ` · ${we.exercises.equipment}` : ""}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Options de l'exercice"><MoreVertical /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDetails((d) => !d)}>
              <SlidersHorizontal /> {details ? "Masquer RPE / RIR" : "Afficher RPE / RIR"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canUp} onSelect={() => onMove(-1)}><ArrowUp /> Monter</DropdownMenuItem>
            <DropdownMenuItem disabled={!canDown} onSelect={() => onMove(1)}><ArrowDown /> Descendre</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => removeExercise.mutate()}>
              <Trash2 /> Retirer l'exercice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          {previous ? (
            <>
              Dernière fois
              {previous.date && ` (${new Date(previous.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})`} :{" "}
              <span className="text-foreground">{prevText || "—"}</span>
            </>
          ) : (
            "Première fois sur cet exercice"
          )}
        </span>
        <label className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" /> Repos
          <input
            aria-label="Temps de repos en secondes"
            inputMode="numeric"
            className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            onBlur={() => {
              const n = Math.round(Number(rest));
              if (!Number.isFinite(n) || n < 0 || n > 900) {
                toast.error("Repos entre 0 et 900 secondes.");
                return setRest(String(we.rest_seconds));
              }
              if (n === we.rest_seconds) return;
              track(
                (async () => {
                  const { error } = await supabase.from("workout_exercises").update({ rest_seconds: n }).eq("id", we.id);
                  if (!error) refetch();
                })(),
              );
            }}
          />
          s
        </label>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_4rem_2.75rem] items-center gap-1.5 px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_5rem_3rem] sm:gap-2">
          <span className="text-center">Série</span>
          <span>Précédent</span>
          <span className="text-center">kg</span>
          <span className="text-center">Reps</span>
          <span className="text-center">OK</span>
        </div>
        <div className="space-y-1.5">
          {sets.map((s, i) => (
            <SetRow
              key={s.id}
              sessionId={sessionId}
              set={s}
              index={i}
              prev={previous?.sets[i]}
              details={details}
              onDone={onSetDone}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => addSet.mutate()} disabled={addSet.isPending}>
          <Plus /> Ajouter une série
        </Button>
      </div>
    </section>
  );
}

function SetRow({
  sessionId,
  set,
  index,
  prev,
  details,
  onDone,
}: {
  sessionId: string;
  set: WorkoutSet;
  index: number;
  prev: WorkoutSet | undefined;
  details: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [weight, setWeight] = useState(set.weight_kg != null ? String(set.weight_kg) : "");
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : "");
  const [rir, setRir] = useState(set.rir != null ? String(set.rir) : "");
  const type = set.set_type as SetType;

  const save = (patch: Partial<WorkoutSet>) => {
    patchSetInCache(qc, sessionId, set.id, patch);
    return track(
      (async () => {
        const { error } = await supabase.from("workout_sets").update(patch).eq("id", set.id);
        if (error) {
          toast.error("Série non enregistrée. Vérifie ta connexion.");
          qc.invalidateQueries({ queryKey: ["session", sessionId] });
        }
      })(),
    );
  };

  const parseWeight = (v: string) => {
    const n = parseNum(v);
    if (n === null) return { ok: true, value: null };
    return Number.isNaN(n) || n < 0 || n > 1000 ? { ok: false, value: null } : { ok: true, value: Math.round(n * 100) / 100 };
  };
  const parseReps = (v: string) => {
    const n = parseNum(v);
    if (n === null) return { ok: true, value: null };
    return Number.isNaN(n) || n < 0 || n > 200 || !Number.isInteger(n) ? { ok: false, value: null } : { ok: true, value: n };
  };

  const commitWeight = () => {
    const r = parseWeight(weight);
    if (!r.ok) {
      toast.error("Charge invalide (0 à 1000 kg).");
      return setWeight(set.weight_kg != null ? String(set.weight_kg) : "");
    }
    if (r.value !== (set.weight_kg != null ? Number(set.weight_kg) : null)) save({ weight_kg: r.value });
  };
  const commitReps = () => {
    const r = parseReps(reps);
    if (!r.ok) {
      toast.error("Répétitions invalides (nombre entier).");
      return setReps(set.reps != null ? String(set.reps) : "");
    }
    if (r.value !== set.reps) save({ reps: r.value });
  };

  const toggleDone = () => {
    if (set.completed) {
      save({ completed: false });
      return;
    }
    const w = parseWeight(weight);
    const r = parseReps(reps);
    if (!w.ok || !r.ok) {
      toast.error("Vérifie la charge et les répétitions.");
      return;
    }
    if (!r.value) {
      toast.error("Indique le nombre de répétitions.");
      return;
    }
    save({ weight_kg: w.value, reps: r.value, completed: true });
    navigator.vibrate?.(30);
    onDone();
  };

  const fillFromPrev = () => {
    if (!prev || set.completed) return;
    const w = prev.weight_kg != null ? String(prev.weight_kg) : "";
    const r = prev.reps != null ? String(prev.reps) : "";
    setWeight(w);
    setReps(r);
    save({ weight_kg: prev.weight_kg, reps: prev.reps });
  };

  const cycleType = () => {
    const next = SET_TYPES[(SET_TYPES.indexOf(type) + 1) % SET_TYPES.length]!;
    save({ set_type: next });
    toast(`Série ${index + 1} : ${SET_TYPE_LABELS[next]}`, { duration: 1200 });
  };

  const removeSet = async () => {
    const { error } = await supabase.from("workout_sets").delete().eq("id", set.id);
    if (error) toast.error("Suppression impossible.");
    else qc.invalidateQueries({ queryKey: ["session", sessionId] });
  };

  return (
    <div className={cn("rounded-lg border transition-colors", set.completed ? "border-foreground/40 bg-accent/70" : "border-border bg-background/40")}>
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_4rem_2.75rem] items-center gap-1.5 p-1 sm:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_5rem_3rem] sm:gap-2">
        <button
          type="button"
          onClick={cycleType}
          title={`Type : ${SET_TYPE_LABELS[type]} (toucher pour changer)`}
          aria-label={`Série ${index + 1}, type ${SET_TYPE_LABELS[type]}. Changer le type`}
          className={cn(
            "flex h-10 items-center justify-center rounded-md font-display text-base font-bold",
            type === "normal" ? "text-foreground" : "border border-border text-muted-foreground",
          )}
        >
          {SET_BADGE[type] || index + 1}
        </button>
        <button
          type="button"
          onClick={fillFromPrev}
          disabled={!prev || set.completed}
          className="truncate text-left text-sm text-muted-foreground enabled:hover:text-foreground"
          title={prev ? "Reprendre ces valeurs" : undefined}
        >
          {prev ? `${prev.weight_kg != null ? nf.format(Number(prev.weight_kg)) : "0"} kg × ${prev.reps ?? 0}` : "—"}
        </button>
        <Input
          aria-label={`Charge série ${index + 1}`}
          inputMode="decimal"
          className="h-10 px-1 text-center text-base font-semibold"
          placeholder={prev?.weight_kg != null ? String(prev.weight_kg) : "kg"}
          value={weight}
          disabled={set.completed}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={commitWeight}
        />
        <Input
          aria-label={`Répétitions série ${index + 1}`}
          inputMode="numeric"
          className="h-10 px-1 text-center text-base font-semibold"
          placeholder={prev?.reps != null ? String(prev.reps) : "reps"}
          value={reps}
          disabled={set.completed}
          onChange={(e) => setReps(e.target.value)}
          onBlur={commitReps}
        />
        <button
          type="button"
          onClick={toggleDone}
          aria-pressed={set.completed}
          aria-label={set.completed ? `Annuler la validation de la série ${index + 1}` : `Valider la série ${index + 1}`}
          className={cn(
            "flex h-10 items-center justify-center rounded-md border transition-all",
            set.completed ? "border-foreground bg-primary text-primary-foreground shadow-glow" : "border-border hover:border-foreground/50",
          )}
        >
          <Check className="h-5 w-5" />
        </button>
      </div>
      {details && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-2 py-2 text-xs">
          <span className="text-muted-foreground">{SET_TYPE_LABELS[type]}</span>
          <label className="flex items-center gap-1">
            RPE
            <input
              inputMode="decimal"
              className="w-12 rounded border border-border bg-background px-1.5 py-1 text-center"
              value={rpe}
              placeholder="—"
              onChange={(e) => setRpe(e.target.value)}
              onBlur={() => {
                const n = parseNum(rpe);
                if (n !== null && (Number.isNaN(n) || n < 1 || n > 10)) {
                  toast.error("RPE entre 1 et 10.");
                  return setRpe(set.rpe != null ? String(set.rpe) : "");
                }
                const v = n === null ? null : Math.round(n * 2) / 2;
                if (v !== (set.rpe != null ? Number(set.rpe) : null)) save({ rpe: v });
              }}
            />
          </label>
          <label className="flex items-center gap-1">
            RIR
            <input
              inputMode="numeric"
              className="w-12 rounded border border-border bg-background px-1.5 py-1 text-center"
              value={rir}
              placeholder="—"
              onChange={(e) => setRir(e.target.value)}
              onBlur={() => {
                const n = parseNum(rir);
                if (n !== null && (Number.isNaN(n) || n < 0 || n > 10 || !Number.isInteger(n))) {
                  toast.error("RIR entre 0 et 10.");
                  return setRir(set.rir != null ? String(set.rir) : "");
                }
                if (n !== set.rir) save({ rir: n });
              }}
            />
          </label>
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={removeSet}>
            <Trash2 /> Supprimer
          </Button>
        </div>
      )}
    </div>
  );
}
