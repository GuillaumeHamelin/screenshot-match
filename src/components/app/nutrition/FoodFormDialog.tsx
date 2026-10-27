import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kcalFromMacros, parseNum, validatePer100 } from "@/lib/fitness";
import { invalidateNutrition, saveCustomFood } from "@/lib/nutrition";
import type { Food } from "@/lib/queries";

const FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protéines", unit: "g" },
  { key: "carbs", label: "Glucides", unit: "g" },
  { key: "fat", label: "Lipides", unit: "g" },
] as const;
type Key = (typeof FIELDS)[number]["key"];

export function FoodFormDialog({
  open,
  onOpenChange,
  food,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  food?: Food | null;
  onSaved?: (foodId: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [vals, setVals] = useState<Record<Key, string>>({ calories: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    if (!open) return;
    setName(food?.name ?? "");
    setBrand(food?.brand ?? "");
    setVals({
      calories: food ? String(food.calories_per_100g) : "",
      protein: food ? String(food.protein_per_100g) : "",
      carbs: food ? String(food.carbs_per_100g) : "",
      fat: food ? String(food.fat_per_100g) : "",
    });
  }, [open, food]);

  const n = (k: Key) => parseNum(vals[k]);
  const fromMacros =
    [n("protein"), n("carbs"), n("fat")].every((x) => x != null && !Number.isNaN(x))
      ? kcalFromMacros(n("protein")!, n("carbs")!, n("fat")!)
      : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Donne un nom à l'aliment.");
      const missing = FIELDS.find((f) => n(f.key) == null || Number.isNaN(n(f.key)));
      if (missing) throw new Error(`${missing.label} : indique une valeur pour 100 g (0 si aucune).`);
      const per100 = { calories: n("calories")!, protein: n("protein")!, carbs: n("carbs")!, fat: n("fat")! };
      const err = validatePer100(per100);
      if (err) throw new Error(err);
      return saveCustomFood({ id: food?.id ?? null, name: name.trim().slice(0, 120), brand: brand.trim().slice(0, 80) || null, per100 });
    },
    onSuccess: (id) => {
      invalidateNutrition(qc);
      toast.success(food ? "Aliment modifié." : "Aliment créé.");
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{food ? "Modifier l'aliment" : "Nouvel aliment"}</DialogTitle>
          <DialogDescription>Valeurs pour 100 g, telles qu'indiquées sur l'étiquette.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="food-name">Nom</Label>
              <Input id="food-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-11" placeholder="Ex. Flocons d'avoine" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="food-brand">
                Marque <span className="text-muted-foreground">(facultatif)</span>
              </Label>
              <Input id="food-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`food-${f.key}`}>
                  {f.label} <span className="text-muted-foreground">({f.unit})</span>
                </Label>
                <Input
                  id={`food-${f.key}`}
                  inputMode="decimal"
                  value={vals[f.key]}
                  onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.replace(/[^\d.,]/g, "") })}
                  className="h-11"
                />
              </div>
            ))}
          </div>
          {fromMacros != null && (
            <p className="text-xs text-muted-foreground">D'après les macros : environ {fromMacros} kcal pour 100 g.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MacroLine({ calories, protein, carbs, fat, suffix }: { calories: number; protein: number; carbs: number; fat: number; suffix?: ReactNode }) {
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  return (
    <span className="text-xs text-muted-foreground">
      {nf.format(calories)} kcal · P {nf.format(protein)} g · G {nf.format(carbs)} g · L {nf.format(fat)} g{suffix}
    </span>
  );
}
