import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/app/ui";
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
import { sumMacros, type MealType } from "@/lib/fitness";
import { deleteMealItem, invalidateNutrition, saveItemsAsRecipe, updateItemQuantity } from "@/lib/nutrition";
import type { LoggedItem } from "@/lib/queries";
import { MacroLine } from "./FoodFormDialog";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function MealSection({
  label,
  items,
  onAdd,
}: {
  mealType: MealType;
  label: string;
  items: LoggedItem[];
  onAdd: () => void;
}) {
  const qc = useQueryClient();
  const totals = sumMacros(items);
  const [editing, setEditing] = useState<{ id: string; grams: string } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [recipeName, setRecipeName] = useState("");

  const update = useMutation({
    mutationFn: ({ item, grams }: { item: LoggedItem; grams: number }) => updateItemQuantity(item, grams),
    onSuccess: () => {
      invalidateNutrition(qc);
      setEditing(null);
    },
    onError: () => toast.error("Impossible de modifier la quantité."),
  });
  const remove = useMutation({
    mutationFn: deleteMealItem,
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success("Aliment retiré.");
    },
    onError: () => toast.error("Impossible de supprimer."),
  });
  const saveRecipe = useMutation({
    mutationFn: () => saveItemsAsRecipe(recipeName.trim().slice(0, 80), items),
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success("Repas enregistré. Retrouve-le dans « Mes repas ».");
      setSaveOpen(false);
    },
    onError: () => toast.error("Impossible d'enregistrer ce repas."),
  });

  return (
    <Panel
      title={label}
      action={
        <span className="font-display text-lg font-bold">
          {nf.format(totals.calories)} <span className="text-xs font-semibold text-muted-foreground">kcal</span>
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien d'enregistré pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => {
            const isEditing = editing?.id === i.id;
            return (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.food_name}</p>
                  <MacroLine calories={Number(i.calories)} protein={Number(i.protein_g)} carbs={Number(i.carbs_g)} fat={Number(i.fat_g)} />
                </div>
                {isEditing ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const g = Number(editing.grams);
                      if (!(g > 0 && g <= 5000)) return toast.error("Quantité : entre 1 et 5000 g.");
                      update.mutate({ item: i, grams: g });
                    }}
                  >
                    <Input
                      autoFocus
                      inputMode="decimal"
                      value={editing.grams}
                      onChange={(e) => setEditing({ id: i.id, grams: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })}
                      className="h-9 w-20"
                      aria-label="Quantité en grammes"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                    <Button type="submit" size="icon" variant="ghost" className="h-9 w-9" aria-label="Valider" disabled={update.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Annuler" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing({ id: i.id, grams: String(Number(i.quantity_g)) })}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-sm hover:border-foreground/30"
                      aria-label={`Modifier la quantité de ${i.food_name}`}
                    >
                      {nf.format(Number(i.quantity_g))} g <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0"
                      aria-label={`Retirer ${i.food_name}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(i.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Protéines {nf.format(totals.protein)} g · Glucides {nf.format(totals.carbs)} g · Lipides {nf.format(totals.fat)} g
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAdd}>
          <Plus /> Ajouter un aliment
        </Button>
        {items.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRecipeName(label);
              setSaveOpen(true);
            }}
          >
            <Save /> Enregistrer comme repas
          </Button>
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="border-border bg-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">Enregistrer le repas</DialogTitle>
            <DialogDescription>
              {items.length} aliment{items.length > 1 ? "s" : ""}, {nf.format(totals.calories)} kcal. Tu pourras l'ajouter en un clic.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!recipeName.trim()) return toast.error("Donne un nom au repas.");
              saveRecipe.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="recipe-name">Nom du repas</Label>
              <Input id="recipe-name" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} maxLength={80} className="h-11" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveRecipe.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
