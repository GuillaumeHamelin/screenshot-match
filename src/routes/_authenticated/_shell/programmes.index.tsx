import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardList, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { programsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { createProgram, duplicateProgram, invalidateTraining, PROGRAM_PRESETS, WEEKDAYS } from "@/lib/workouts";

export const Route = createFileRoute("/_authenticated/_shell/programmes/")({
  head: () => ({ meta: [{ title: "Programmes — FitTracker" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(programsQuery(context.user.id)),
  component: ProgrammesPage,
});

function ProgrammesPage() {
  const { user } = Route.useRouteContext();
  const { data: programs } = useSuspenseQuery(programsQuery(user.id));
  const qc = useQueryClient();
  const navigate = useNavigate();

  const dup = useMutation({
    mutationFn: duplicateProgram,
    onSuccess: () => {
      invalidateTraining(qc);
      toast.success("Programme dupliqué.");
    },
    onError: () => toast.error("Duplication impossible."),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTraining(qc);
      toast.success("Programme supprimé.");
    },
    onError: () => toast.error("Suppression impossible."),
  });

  return (
    <>
      <PageHeader
        eyebrow="Musculation"
        title="Programmes"
        description="Organise tes séances modèles et lance-les en un geste."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/exercices"><BookOpen /> Bibliothèque</Link>
            </Button>
            <NewProgramDialog onCreated={(id) => navigate({ to: "/programmes/$programId", params: { programId: id } })} />
          </>
        }
      />

      {programs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun programme"
          text="Pars d'un modèle Push / Pull / Legs, Upper / Lower, Full Body ou crée le tien."
          action={<NewProgramDialog onCreated={(id) => navigate({ to: "/programmes/$programId", params: { programId: id } })} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <article key={p.id} className="panel flex flex-col p-5 transition-all hover:border-foreground/25 hover:shadow-glow">
              <Link to="/programmes/$programId" params={{ programId: p.id }} className="block">
                <h2 className="font-display text-2xl font-bold uppercase">{p.name}</h2>
                {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
              </Link>
              <ul className="mt-4 flex-1 space-y-2">
                {p.workout_templates.length === 0 && (
                  <li className="text-sm text-muted-foreground">Aucune séance pour l'instant.</li>
                )}
                {p.workout_templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {t.workout_template_exercises.length} exo.
                      <WeekdayChips days={t.weekdays} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to="/programmes/$programId" params={{ programId: p.id }}>Ouvrir</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => dup.mutate(p.id)} disabled={dup.isPending}>
                  <Copy /> Dupliquer
                </Button>
                <ConfirmDialog
                  title="Supprimer ce programme ?"
                  description="Ses séances modèles seront supprimées. Ton historique d'entraînement est conservé."
                  confirmLabel="Supprimer"
                  onConfirm={() => del.mutate(p.id)}
                  trigger={<Button size="sm" variant="ghost" aria-label="Supprimer le programme"><Trash2 /></Button>}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function WeekdayChips({ days }: { days: number[] }) {
  if (!days.length) return null;
  return (
    <span className="flex gap-0.5">
      {WEEKDAYS.filter((d) => days.includes(d.n)).map((d) => (
        <span key={d.n} className="rounded border border-border px-1 py-px text-[10px] uppercase">{d.short}</span>
      ))}
    </span>
  );
}

function NewProgramDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("ppl");
  const [name, setName] = useState("Push / Pull / Legs");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () => createProgram({ name: name.trim(), description: description.trim() || null, presetKey: preset }),
    onSuccess: (id) => {
      invalidateTraining(qc);
      toast.success("Programme créé.");
      setOpen(false);
      onCreated(id);
    },
    onError: () => toast.error("Création impossible."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Nouveau programme</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Nouveau programme</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {PROGRAM_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPreset(p.key);
                  setName(p.key === "custom" ? "" : p.label);
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  preset === p.key ? "border-foreground/60 bg-accent shadow-glow" : "border-border hover:bg-accent/50",
                )}
              >
                <span className="block font-display text-sm font-bold uppercase">{p.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{p.description}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prog-name">Nom</Label>
            <Input id="prog-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prog-desc">Description (optionnel)</Label>
            <Textarea id="prog-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
