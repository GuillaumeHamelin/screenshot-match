import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Check, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { exercisesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUPS } from "@/lib/workouts";
import { ExerciseFormDialog } from "./ExerciseFormDialog";

/** Multi-select dialog over the exercise library (shared + the user's own). */
export function ExercisePicker({
  trigger,
  onPick,
  pending,
}: {
  trigger: ReactNode;
  onPick: (exerciseIds: string[]) => Promise<void> | void;
  pending?: boolean;
}) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data: exercises = [] } = useQuery(exercisesQuery(user.id));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exercises.filter(
      (e) => (!muscle || e.muscle_group === muscle) && (!needle || e.name.toLowerCase().includes(needle)),
    );
  }, [exercises, q, muscle]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSelected([]);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Ajouter des exercices</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un exercice" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Button size="sm" variant={muscle === null ? "default" : "outline"} onClick={() => setMuscle(null)}>Tous</Button>
          {MUSCLE_GROUPS.map((m) => (
            <Button key={m} size="sm" variant={muscle === m ? "default" : "outline"} onClick={() => setMuscle(m)} className="shrink-0">
              {m}
            </Button>
          ))}
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun exercice trouvé.</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map((e) => {
                const on = selected.includes(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => toggle(e.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        on ? "border-foreground/50 bg-accent" : "border-border hover:bg-accent/60",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {e.muscle_group}
                          {e.equipment ? ` · ${e.equipment}` : ""}
                          {e.user_id ? " · Perso" : ""}
                        </span>
                      </span>
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", on ? "border-foreground bg-primary text-primary-foreground" : "border-border")}>
                        {on && <Check className="h-4 w-4" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <ExerciseFormDialog
            trigger={<Button variant="ghost" size="sm"><Plus /> Exercice perso</Button>}
            onSaved={(id) => setSelected((s) => [...s, id])}
          />
          <Button
            disabled={selected.length === 0 || pending}
            onClick={async () => {
              await onPick(selected);
              setSelected([]);
              setOpen(false);
            }}
          >
            Ajouter {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
