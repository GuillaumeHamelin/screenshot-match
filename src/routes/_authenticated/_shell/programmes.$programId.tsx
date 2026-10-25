import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { ExercisePicker } from "@/components/app/workout/ExercisePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { programQuery, type ProgramDetail } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { invalidateTraining, moveItem, reorderRows, startSession, WEEKDAYS } from "@/lib/workouts";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/programmes/$programId")({
  head: () => ({ meta: [{ title: "Programme — FitTracker" }] }),
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(programQuery(params.programId));
    if (!p) throw notFound();
  },
  notFoundComponent: () => (
    <EmptyState
      icon={ClipboardList}
      title="Programme introuvable"
      text="Il a peut-être été supprimé."
      action={<Button asChild><Link to="/programmes">Mes programmes</Link></Button>}
    />
  ),
  component: ProgramPage,
});

type Template = ProgramDetail["workout_templates"][number];
type TemplateExercise = Template["workout_template_exercises"][number];

function ProgramPage() {
  const { programId } = Route.useParams();
  const { data } = useSuspenseQuery(programQuery(programId));
  const program = data!;
  const qc = useQueryClient();
  const refresh = () => invalidateTraining(qc);

  const moveTemplate = useMutation({
    mutationFn: (args: { index: number; delta: -1 | 1 }) =>
      reorderRows("workout_templates", moveItem(program.workout_templates, args.index, args.delta).map((t) => t.id)),
    onSuccess: refresh,
    onError: () => toast.error("Réorganisation impossible."),
  });

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" asChild>
        <Link to="/programmes"><ArrowLeft /> Programmes</Link>
      </Button>
      <PageHeader
        eyebrow="Programme"
        title={program.name}
        description={program.description ?? undefined}
        actions={
          <>
            <ProgramEditDialog program={program} />
            <TemplateDialog programId={program.id} position={program.workout_templates.length} />
          </>
        }
      />

      {program.workout_templates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune séance"
          text="Ajoute une première séance modèle, puis ses exercices."
          action={<TemplateDialog programId={program.id} position={0} />}
        />
      ) : (
        <div className="space-y-4">
          {program.workout_templates.map((t, i) => (
            <TemplateCard
              key={t.id}
              template={t}
              programId={program.id}
              canUp={i > 0}
              canDown={i < program.workout_templates.length - 1}
              onMove={(delta) => moveTemplate.mutate({ index: i, delta })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TemplateCard({
  template,
  programId,
  canUp,
  canDown,
  onMove,
}: {
  template: Template;
  programId: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => invalidateTraining(qc);
  const items = template.workout_template_exercises;

  const add = useMutation({
    mutationFn: async (ids: string[]) => {
      const start = items.length ? Math.max(...items.map((x) => x.position)) + 1 : 0;
      const { error } = await supabase.from("workout_template_exercises").insert(
        ids.map((exercise_id, i) => ({ template_id: template.id, exercise_id, position: start + i, target_sets: 3, target_reps: "8-12", rest_seconds: 90 })),
      );
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Ajout impossible."),
  });
  const move = useMutation({
    mutationFn: (args: { index: number; delta: -1 | 1 }) =>
      reorderRows("workout_template_exercises", moveItem(items, args.index, args.delta).map((x) => x.id)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_template_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const delTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workout_templates").delete().eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Séance supprimée.");
    },
  });
  const start = useMutation({
    mutationFn: () => startSession({ userId: user.id, templateId: template.id }),
    onSuccess: (r) => {
      refresh();
      if (r.resumed) toast.info("Une séance est déjà en cours : on la reprend.");
      navigate({ to: "/entrainements/$sessionId", params: { sessionId: r.id } });
    },
    onError: () => toast.error("Impossible de démarrer la séance."),
  });

  return (
    <section className="panel p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">{template.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <span
                key={d.n}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[11px] uppercase",
                  template.weekdays.includes(d.n) ? "border-foreground/50 text-foreground" : "border-border text-muted-foreground/50",
                )}
              >
                {d.short}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending || items.length === 0}>
            <Play /> Démarrer
          </Button>
          <TemplateDialog programId={programId} template={template} />
          <Button size="icon" variant="ghost" disabled={!canUp} onClick={() => onMove(-1)} aria-label="Monter la séance"><ArrowUp /></Button>
          <Button size="icon" variant="ghost" disabled={!canDown} onClick={() => onMove(1)} aria-label="Descendre la séance"><ArrowDown /></Button>
          <ConfirmDialog
            title="Supprimer cette séance ?"
            description="Les exercices prévus seront retirés. Tes séances déjà faites restent dans l'historique."
            confirmLabel="Supprimer"
            onConfirm={() => delTemplate.mutate()}
            trigger={<Button size="icon" variant="ghost" aria-label="Supprimer la séance"><Trash2 /></Button>}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Aucun exercice. Ajoute-en pour pouvoir démarrer.</p>}
        {items.length > 0 && (
          <div className="hidden grid-cols-[1fr_repeat(4,5.5rem)_6.5rem] gap-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
            <span>Exercice</span><span>Séries</span><span>Reps</span><span>Charge kg</span><span>Repos s</span><span />
          </div>
        )}
        {items.map((it, i) => (
          <TemplateExerciseRow
            key={it.id}
            item={it}
            canUp={i > 0}
            canDown={i < items.length - 1}
            onMove={(delta) => move.mutate({ index: i, delta })}
            onRemove={() => remove.mutate(it.id)}
          />
        ))}
      </div>
      <ExercisePicker
        pending={add.isPending}
        onPick={(ids) => add.mutateAsync(ids)}
        trigger={<Button variant="outline" size="sm" className="mt-3"><Plus /> Ajouter des exercices</Button>}
      />
    </section>
  );
}

function TemplateExerciseRow({
  item,
  canUp,
  canDown,
  onMove,
  onRemove,
}: {
  item: TemplateExercise;
  canUp: boolean;
  canDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const save = async (patch: Partial<Pick<TemplateExercise, "target_sets" | "target_reps" | "target_weight_kg" | "rest_seconds">>) => {
    const { error } = await supabase.from("workout_template_exercises").update(patch).eq("id", item.id);
    if (error) toast.error("Enregistrement impossible.");
    else qc.invalidateQueries({ queryKey: ["program"] });
  };

  return (
    <div className="grid grid-cols-2 items-center gap-2 rounded-lg border border-border bg-background/40 p-3 md:grid-cols-[1fr_repeat(4,5.5rem)_6.5rem]">
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="truncate text-sm font-medium">{item.exercises?.name}</p>
        <p className="text-xs text-muted-foreground">{item.exercises?.muscle_group}</p>
      </div>
      <CellInput label="Séries" initial={String(item.target_sets)} inputMode="numeric"
        onCommit={(v) => {
          const n = Math.round(Number(v));
          if (!Number.isFinite(n) || n < 1 || n > 20) return false;
          save({ target_sets: n });
          return true;
        }}
      />
      <CellInput label="Reps" initial={item.target_reps ?? ""} placeholder="8-12"
        onCommit={(v) => {
          if (v.length > 12) return false;
          save({ target_reps: v.trim() || null });
          return true;
        }}
      />
      <CellInput label="Charge kg" initial={item.target_weight_kg != null ? String(item.target_weight_kg) : ""} inputMode="decimal" placeholder="—"
        onCommit={(v) => {
          if (v.trim() === "") { save({ target_weight_kg: null }); return true; }
          const n = Number(v.replace(",", "."));
          if (!Number.isFinite(n) || n < 0 || n > 1000) return false;
          save({ target_weight_kg: n });
          return true;
        }}
      />
      <CellInput label="Repos s" initial={String(item.rest_seconds)} inputMode="numeric"
        onCommit={(v) => {
          const n = Math.round(Number(v));
          if (!Number.isFinite(n) || n < 0 || n > 900) return false;
          save({ rest_seconds: n });
          return true;
        }}
      />
      <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
        <Button size="icon" variant="ghost" disabled={!canUp} onClick={() => onMove(-1)} aria-label="Monter l'exercice"><ArrowUp /></Button>
        <Button size="icon" variant="ghost" disabled={!canDown} onClick={() => onMove(1)} aria-label="Descendre l'exercice"><ArrowDown /></Button>
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Retirer l'exercice"><Trash2 /></Button>
      </div>
    </div>
  );
}

function CellInput({
  label,
  initial,
  onCommit,
  inputMode,
  placeholder,
}: {
  label: string;
  initial: string;
  onCommit: (value: string) => boolean;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground md:hidden">{label}</span>
      <Input
        aria-label={label}
        className="h-9"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value === initial) return;
          if (!onCommit(value)) {
            toast.error(`Valeur invalide pour « ${label} ».`);
            setValue(initial);
          }
        }}
      />
    </label>
  );
}

function TemplateDialog({ programId, template, position = 0 }: { programId: string; template?: Template; position?: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [days, setDays] = useState<number[]>(template?.weekdays ?? []);
  const save = useMutation({
    mutationFn: async () => {
      const row = { name: name.trim(), weekdays: [...days].sort() };
      const { error } = template
        ? await supabase.from("workout_templates").update(row).eq("id", template.id)
        : await supabase.from("workout_templates").insert({ ...row, program_id: programId, position });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTraining(qc);
      setOpen(false);
      if (!template) { setName(""); setDays([]); }
    },
    onError: () => toast.error("Enregistrement impossible."),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {template ? (
          <Button size="icon" variant="ghost" aria-label="Modifier la séance"><Pencil /></Button>
        ) : (
          <Button><Plus /> Ajouter une séance</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{template ? "Modifier la séance" : "Nouvelle séance"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nom</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Push, Jambes, Full Body A" maxLength={60} required />
          </div>
          <div className="space-y-1.5">
            <Label>Jours d'entraînement</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <Button
                  key={d.n}
                  type="button"
                  size="sm"
                  variant={days.includes(d.n) ? "default" : "outline"}
                  onClick={() => setDays((x) => (x.includes(d.n) ? x.filter((y) => y !== d.n) : [...x, d.n]))}
                >
                  {d.short}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProgramEditDialog({ program }: { program: ProgramDetail }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("workout_programs")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", program.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateTraining(qc); setOpen(false); },
    onError: () => toast.error("Enregistrement impossible."),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil /> Modifier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Modifier le programme</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nom</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
