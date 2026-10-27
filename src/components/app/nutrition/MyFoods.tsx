import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Pencil, Plus, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, Panel } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { macrosForQuantity, sumMacros } from "@/lib/fitness";
import {
  deleteFood,
  deleteRecipe,
  displayName,
  invalidateNutrition,
  setRecipeFavorite,
} from "@/lib/nutrition";
import { foodsQuery, recipesQuery, type Food } from "@/lib/queries";
import { FoodFormDialog, MacroLine } from "./FoodFormDialog";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function MyFoods({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: foods } = useSuspenseQuery(foodsQuery(userId));
  const { data: recipes } = useSuspenseQuery(recipesQuery(userId));
  const [editing, setEditing] = useState<Food | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const removeFood = useMutation({
    mutationFn: deleteFood,
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success("Aliment supprimé. Les repas déjà notés sont conservés.");
    },
    onError: () => toast.error("Impossible de supprimer."),
  });
  const removeRecipe = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success("Repas supprimé.");
    },
    onError: () => toast.error("Impossible de supprimer."),
  });
  const favorite = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => setRecipeFavorite(id, v),
    onSuccess: () => invalidateNutrition(qc),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title={`Mes aliments (${foods.length})`}
        icon={UtensilsCrossed}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Créer
          </Button>
        }
      >
        {foods.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Pas encore d'aliment"
            text="Crée un aliment avec les valeurs de son étiquette, ou ajoute un produit depuis la recherche."
          />
        ) : (
          <ul className="divide-y divide-border">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName(f.name, f.brand)}</p>
                  <MacroLine
                    calories={Number(f.calories_per_100g)}
                    protein={Number(f.protein_per_100g)}
                    carbs={Number(f.carbs_per_100g)}
                    fat={Number(f.fat_per_100g)}
                    suffix=" / 100 g"
                  />
                </div>
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  {f.source === "custom" ? "Perso" : "OFF"}
                </span>
                {f.source === "custom" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Modifier ${f.name}`}
                    onClick={() => {
                      setEditing(f);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <ConfirmDialog
                  title="Supprimer l'aliment ?"
                  description="Il disparaît de ta liste. Les repas déjà notés avec cet aliment restent dans ton journal."
                  confirmLabel="Supprimer"
                  onConfirm={() => removeFood.mutate(f.id)}
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      aria-label={`Supprimer ${f.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Mes repas (${recipes.length})`} icon={Star}>
        {recipes.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Aucun repas enregistré"
            text="Dans ton journal, utilise « Enregistrer comme repas » sous un repas."
          />
        ) : (
          <ul className="divide-y divide-border">
            {recipes.map((r) => {
              const t = sumMacros(
                r.saved_recipe_items.map((i) => {
                  const m = macrosForQuantity(
                    {
                      calories: Number(i.calories_per_100g),
                      protein: Number(i.protein_per_100g),
                      carbs: Number(i.carbs_per_100g),
                      fat: Number(i.fat_per_100g),
                    },
                    Number(i.quantity_g),
                  );
                  return {
                    calories: m.calories,
                    protein_g: m.protein,
                    carbs_g: m.carbs,
                    fat_g: m.fat,
                  };
                }),
              );
              return (
                <li key={r.id} className="flex items-start gap-2 py-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0"
                    aria-label={r.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    aria-pressed={r.is_favorite}
                    onClick={() => favorite.mutate({ id: r.id, v: !r.is_favorite })}
                  >
                    <Star className={r.is_favorite ? "h-4 w-4 fill-foreground" : "h-4 w-4"} />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.name}</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {r.saved_recipe_items.map((i) => (
                        <li key={i.id}>
                          {i.food_name} — {nf.format(Number(i.quantity_g))} g
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1">
                      <MacroLine
                        calories={t.calories}
                        protein={t.protein}
                        carbs={t.carbs}
                        fat={t.fat}
                      />
                    </p>
                  </div>
                  <ConfirmDialog
                    title="Supprimer ce repas ?"
                    description="Le modèle est supprimé. Ce que tu as déjà noté dans ton journal reste."
                    confirmLabel="Supprimer"
                    onConfirm={() => removeRecipe.mutate(r.id)}
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        aria-label={`Supprimer ${r.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <FoodFormDialog open={formOpen} onOpenChange={setFormOpen} food={editing} />
    </div>
  );
}
