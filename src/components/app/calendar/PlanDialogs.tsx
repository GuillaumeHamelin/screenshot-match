import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toISODate } from "@/lib/fitness";
import type { CalendarSession } from "@/lib/queries";
import { planProgram, scheduleSession, updatePlannedSession } from "@/lib/tracking";
import { invalidateTraining } from "@/lib/workouts";

export type TemplateOption = { id: string; name: string; programName: string; weekdays: number[] };
export type ProgramOption = { id: string; name: string; templates: number };

const FREE = "__free__";

/** Plan a new session, or edit / move a planned one. */
export function PlanSessionDialog({
  open,
  onOpenChange,
  session,
  defaultDate,
  templates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session?: CalendarSession | null;
  defaultDate: string;
  templates: TemplateOption[];
}) {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState(FREE);
  const [name, setName] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemplateId(session?.template_id ?? FREE);
    setName(session?.name ?? "");
    setDate(session?.scheduled_date ?? defaultDate);
    setNotes(session?.notes ?? "");
  }, [open, session, defaultDate]);

  const save = useMutation({
    mutationFn: async () => {
      const tpl = templateId === FREE ? null : templateId;
      const finalName = name.trim() || templates.find((t) => t.id === tpl)?.name || "Séance libre";
      if (session) {
        await updatePlannedSession(session.id, { name: finalName, scheduled_date: date, notes: notes.trim() || null, template_id: tpl });
      } else {
        await scheduleSession({ date, templateId: tpl, name: finalName, notes: notes.trim() || null });
      }
    },
    onSuccess: () => {
      invalidateTraining(qc);
      toast.success(session ? "Séance modifiée." : "Séance planifiée.");
      onOpenChange(false);
    },
    onError: () => toast.error("Enregistrement impossible."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{session ? "Modifier la séance" : "Planifier une séance"}</DialogTitle>
          <DialogDescription>
            {session ? "Change la date pour déplacer la séance." : "Choisis une séance de tes programmes ou une séance libre."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error("Choisis une date."); return; }
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Séance</Label>
            <Select
              value={templateId}
              onValueChange={(v) => {
                if (!v) return;
                setTemplateId(v);
                const t = templates.find((x) => x.id === v);
                if (t) setName(t.name);
              }}
            >
              <SelectTrigger aria-label="Séance modèle"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={FREE}>Séance libre</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} · {t.programName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Nom</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Séance libre" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-date">Date</Label>
              <Input id="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">Notes</Label>
            <Textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{session ? "Enregistrer" : "Planifier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Plans a program's sessions on their weekdays, for 1 to 8 weeks. */
export function PlanProgramDialog({
  open,
  onOpenChange,
  programs,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programs: ProgramOption[];
  userId: string;
}) {
  const qc = useQueryClient();
  const usable = programs.filter((p) => p.templates > 0);
  const [programId, setProgramId] = useState("");
  const [weeks, setWeeks] = useState("4");
  const [from, setFrom] = useState(toISODate());

  useEffect(() => {
    if (open) {
      setProgramId(usable[0]?.id ?? "");
      setFrom(toISODate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const plan = useMutation({
    mutationFn: () => planProgram(programId, from, Number(weeks), userId),
    onSuccess: (n) => {
      invalidateTraining(qc);
      toast.success(n === 0 ? "Tout est déjà planifié sur cette période." : `${n} séance${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} au calendrier.`);
      onOpenChange(false);
    },
    onError: () => toast.error("Planification impossible."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Planifier un programme</DialogTitle>
          <DialogDescription>Chaque séance du programme est placée sur ses jours habituels. Les jours déjà planifiés ne sont pas doublés.</DialogDescription>
        </DialogHeader>
        {usable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crée d'abord un programme avec des séances et leurs jours dans « Programmes ».</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!programId) return;
              plan.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Programme</Label>
              <Select value={programId} onValueChange={(v) => v && setProgramId(v)}>
                <SelectTrigger aria-label="Programme"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {usable.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pp-from">À partir du</Label>
                <Input id="pp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Durée</Label>
                <Select value={weeks} onValueChange={(v) => v && setWeeks(v)}>
                  <SelectTrigger aria-label="Durée"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 4, 6, 8].map((w) => <SelectItem key={w} value={String(w)}>{w} semaine{w > 1 ? "s" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!programId || plan.isPending}>Planifier</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
