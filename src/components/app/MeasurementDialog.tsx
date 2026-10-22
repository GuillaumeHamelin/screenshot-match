import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseNum, toISODate } from "@/lib/fitness";

type FieldKey =
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "height_cm"
  | "waist_cm"
  | "chest_cm"
  | "arm_cm"
  | "thigh_cm"
  | "calf_cm";

const FIELDS: { key: FieldKey; label: string; unit: string; min: number; max: number }[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", min: 25, max: 350 },
  { key: "body_fat_pct", label: "Masse grasse", unit: "%", min: 2, max: 70 },
  { key: "muscle_mass_kg", label: "Masse musculaire", unit: "kg", min: 10, max: 150 },
  { key: "height_cm", label: "Taille", unit: "cm", min: 100, max: 250 },
  { key: "waist_cm", label: "Tour de taille", unit: "cm", min: 30, max: 250 },
  { key: "chest_cm", label: "Tour de poitrine", unit: "cm", min: 40, max: 250 },
  { key: "arm_cm", label: "Tour de bras", unit: "cm", min: 10, max: 80 },
  { key: "thigh_cm", label: "Tour de cuisse", unit: "cm", min: 20, max: 120 },
  { key: "calf_cm", label: "Tour de mollet", unit: "cm", min: 15, max: 80 },
];

export function MeasurementDialog({ mode, trigger }: { mode: "weight" | "full"; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toISODate());
  const [values, setValues] = useState<Record<FieldKey, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<FieldKey, string>,
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fields = mode === "weight" ? FIELDS.slice(0, 1) : FIELDS;

  const save = useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = await supabase.from("body_measurements").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(mode === "weight" ? "Poids enregistré." : "Mesures enregistrées.");
      setOpen(false);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<FieldKey, string>);
      setNotes("");
    },
    onError: () => toast.error("Enregistrement impossible. Réessaie."),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const row: Record<string, unknown> = { measured_on: date, notes: notes.trim() || null };
    let filled = 0;
    for (const f of fields) {
      const n = parseNum(values[f.key]);
      if (n === null) continue;
      if (Number.isNaN(n) || n < f.min || n > f.max) {
        setError(`${f.label} : valeur attendue entre ${f.min} et ${f.max} ${f.unit}.`);
        return;
      }
      row[f.key] = n;
      filled++;
    }
    if (filled === 0) {
      setError(mode === "weight" ? "Indique ton poids." : "Renseigne au moins une mesure.");
      return;
    }
    if (date > toISODate()) {
      setError("La date ne peut pas être dans le futur.");
      return;
    }
    setError(null);
    save.mutate(row);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {mode === "weight" ? "Enregistrer mon poids" : "Nouvelles mesures"}
          </DialogTitle>
          <DialogDescription>
            {mode === "weight" ? "Ta pesée du jour." : "Remplis uniquement les mesures prises aujourd'hui."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-date">Date</Label>
            <Input id="m-date" type="date" value={date} max={toISODate()} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className={mode === "weight" ? "" : "grid grid-cols-2 gap-3"}>
            {fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`m-${f.key}`}>
                  {f.label} <span className="text-muted-foreground">({f.unit})</span>
                </Label>
                <Input
                  id={`m-${f.key}`}
                  inputMode="decimal"
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={mode === "weight" ? "h-14 text-2xl font-semibold" : "h-11"}
                  autoFocus={f.key === "weight_kg"}
                  placeholder={mode === "weight" ? "ex. 78,4" : undefined}
                />
              </div>
            ))}
          </div>
          {mode === "full" && (
            <div className="space-y-2">
              <Label htmlFor="m-notes">Notes</Label>
              <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
