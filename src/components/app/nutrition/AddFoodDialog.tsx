import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Barcode, Loader2, Plus, Search, Star, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { macrosForQuantity, MEAL_TYPES, sumMacros, type MealType } from "@/lib/fitness";
import { searchOpenFoodFacts, type OffFood } from "@/lib/nutrition.functions";
import {
  addFoodToMeal,
  addRecipeToMeal,
  displayName,
  invalidateNutrition,
  type PickedFood,
} from "@/lib/nutrition";
import { foodsQuery, recipesQuery, type Food } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { FoodFormDialog, MacroLine } from "./FoodFormDialog";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const fromFood = (f: Food): PickedFood => ({
  foodId: f.id,
  name: f.name,
  brand: f.brand,
  per100: {
    calories: Number(f.calories_per_100g),
    protein: Number(f.protein_per_100g),
    carbs: Number(f.carbs_per_100g),
    fat: Number(f.fat_per_100g),
  },
  source: f.source === "openfoodfacts" ? "openfoodfacts" : "custom",
  externalId: f.external_id,
  servingG: null,
});

const fromOff = (f: OffFood): PickedFood => ({
  foodId: null,
  name: f.name,
  brand: f.brand,
  per100: f.per100,
  source: "openfoodfacts",
  externalId: f.code,
  servingG: f.servingG,
});

export function AddFoodDialog({
  open,
  onOpenChange,
  userId,
  date,
  mealType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  date: string;
  mealType: MealType;
}) {
  const qc = useQueryClient();
  const { data: foods } = useSuspenseQuery(foodsQuery(userId));
  const { data: recipes } = useSuspenseQuery(recipesQuery(userId));
  const search = useServerFn(searchOpenFoodFacts);
  const meal = MEAL_TYPES.find((m) => m.key === mealType)!;

  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [grams, setGrams] = useState("100");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setPicked(null);
      setGrams("100");
    }
  }, [open]);

  const offSearch = useMutation({
    mutationFn: (q: string) => search({ data: { query: q } }),
    onError: (e: Error) => toast.error(e.message || "Recherche impossible."),
  });

  const add = useMutation({
    mutationFn: () => addFoodToMeal({ date, mealType, food: picked!, grams: Number(grams) }),
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success(`${picked!.name} ajouté ${meal.short}.`);
      onOpenChange(false);
    },
    onError: () => toast.error("Impossible d'ajouter l'aliment."),
  });

  const addRecipe = useMutation({
    mutationFn: (recipeId: string) =>
      addRecipeToMeal({ date, mealType, recipe: recipes.find((r) => r.id === recipeId)! }),
    onSuccess: () => {
      invalidateNutrition(qc);
      toast.success(`Repas ajouté ${meal.short}.`);
      onOpenChange(false);
    },
    onError: () => toast.error("Impossible d'ajouter ce repas."),
  });

  const myFoods = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? foods.filter((x) => `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(f)) : foods;
  }, [foods, filter]);

  const g = Number(grams);
  const validGrams = g > 0 && g <= 5000;
  const preview = picked && validGrams ? macrosForQuantity(picked.per100, g) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-border bg-surface p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border p-5">
            <DialogTitle className="font-display text-2xl uppercase">
              Ajouter {meal.short}
            </DialogTitle>
            <DialogDescription>
              {picked
                ? "Indique la quantité consommée."
                : "Cherche un produit, choisis un de tes aliments ou un repas enregistré."}
            </DialogDescription>
          </DialogHeader>

          {picked ? (
            <form
              className="space-y-5 overflow-y-auto p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validGrams) {
                  toast.error("Quantité : entre 1 et 5000 g.");
                  return;
                }
                add.mutate();
              }}
            >
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <p className="font-semibold">{displayName(picked.name, picked.brand)}</p>
                <p className="mt-1">
                  <MacroLine
                    calories={picked.per100.calories}
                    protein={picked.per100.protein}
                    carbs={picked.per100.carbs}
                    fat={picked.per100.fat}
                    suffix=" pour 100 g"
                  />
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantité (g)</Label>
                <Input
                  id="qty"
                  autoFocus
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) =>
                    setGrams(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))
                  }
                  className="h-12 text-lg"
                />
                <div className="flex flex-wrap gap-2">
                  {picked.servingG && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setGrams(String(picked.servingG))}
                    >
                      1 portion ({picked.servingG} g)
                    </Button>
                  )}
                  {[30, 50, 100, 150, 200, 250].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setGrams(String(v))}
                    >
                      {v} g
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { l: "Calories", v: preview?.calories, u: "kcal" },
                  { l: "Protéines", v: preview?.protein, u: "g" },
                  { l: "Glucides", v: preview?.carbs, u: "g" },
                  { l: "Lipides", v: preview?.fat, u: "g" },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg border border-border p-3">
                    <p className="eyebrow text-[0.6rem]">{x.l}</p>
                    <p className="mt-1 font-display text-xl font-bold">
                      {x.v != null ? nf.format(x.v) : "—"}
                      <span className="ml-0.5 text-xs text-muted-foreground">{x.u}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setPicked(null)}>
                  <ArrowLeft /> Retour
                </Button>
                <Button type="submit" disabled={add.isPending || !validGrams}>
                  {add.isPending ? "Ajout…" : "Ajouter"}
                </Button>
              </div>
            </form>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-5 mt-4 grid grid-cols-3">
                <TabsTrigger value="search">Rechercher</TabsTrigger>
                <TabsTrigger value="mine">Mes aliments</TabsTrigger>
                <TabsTrigger value="recipes">Mes repas</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = query.trim();
                    if (q.length < 2) {
                      toast.error("Tape au moins 2 caractères.");
                      return;
                    }
                    offSearch.mutate(q);
                  }}
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nom du produit ou code-barres"
                      className="h-11 pl-9"
                      maxLength={100}
                      aria-label="Rechercher un aliment"
                    />
                  </div>
                  <Button type="submit" className="h-11" disabled={offSearch.isPending}>
                    {offSearch.isPending ? <Loader2 className="animate-spin" /> : "Chercher"}
                  </Button>
                </form>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Barcode className="h-3.5 w-3.5" /> Données Open Food Facts. Tape les chiffres
                  sous le code-barres pour un produit précis.
                </p>

                <div className="mt-4 space-y-2">
                  {offSearch.data && offSearch.data.results.length === 0 && (
                    <EmptyState
                      icon={Search}
                      title="Aucun résultat"
                      text="Essaie un autre mot, ou crée l'aliment toi-même avec les valeurs de l'étiquette."
                      action={
                        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                          <Plus /> Créer un aliment
                        </Button>
                      }
                    />
                  )}
                  {offSearch.data?.results.map((f) => (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => setPicked(fromOff(f))}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition-colors hover:border-foreground/30"
                    >
                      {f.imageUrl ? (
                        <img
                          src={f.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-11 w-11 shrink-0 rounded-md bg-muted object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.brand ?? "Marque inconnue"}
                        </p>
                        <MacroLine
                          calories={f.per100.calories}
                          protein={f.per100.protein}
                          carbs={f.per100.carbs}
                          fat={f.per100.fat}
                          suffix=" / 100 g"
                        />
                      </div>
                    </button>
                  ))}
                  {offSearch.data && offSearch.data.hidden > 0 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      {offSearch.data.hidden} produit{offSearch.data.hidden > 1 ? "s" : ""} masqué
                      {offSearch.data.hidden > 1 ? "s" : ""} : valeurs nutritionnelles incomplètes.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mine" className="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
                <div className="flex gap-2">
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrer mes aliments"
                    className="h-11"
                    aria-label="Filtrer mes aliments"
                  />
                  <Button variant="outline" className="h-11" onClick={() => setCreateOpen(true)}>
                    <Plus /> Créer
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  {myFoods.length === 0 && (
                    <EmptyState
                      icon={UtensilsCrossed}
                      title={foods.length ? "Aucun aliment trouvé" : "Pas encore d'aliment"}
                      text="Les produits que tu ajoutes depuis la recherche et ceux que tu crées apparaissent ici."
                    />
                  )}
                  {myFoods.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPicked(fromFood(f))}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition-colors hover:border-foreground/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{displayName(f.name, f.brand)}</p>
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
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recipes" className="mt-0 min-h-0 flex-1 overflow-y-auto p-5">
                <div className="space-y-2">
                  {recipes.length === 0 && (
                    <EmptyState
                      icon={Star}
                      title="Aucun repas enregistré"
                      text="Dans ton journal, utilise « Enregistrer comme repas » pour réutiliser un repas en un clic."
                    />
                  )}
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
                      <button
                        key={r.id}
                        type="button"
                        disabled={addRecipe.isPending || r.saved_recipe_items.length === 0}
                        onClick={() => addRecipe.mutate(r.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition-colors hover:border-foreground/30 disabled:opacity-50",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">
                            {r.is_favorite && (
                              <Star className="h-3.5 w-3.5 shrink-0 fill-foreground" />
                            )}
                            {r.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.saved_recipe_items.map((i) => i.food_name).join(", ")}
                          </p>
                          <MacroLine
                            calories={t.calories}
                            protein={t.protein}
                            carbs={t.carbs}
                            fat={t.fat}
                          />
                        </div>
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <FoodFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={async (id) => {
          const list = await qc.fetchQuery(foodsQuery(userId));
          const f = list.find((x) => x.id === id);
          if (f) setPicked(fromFood(f));
        }}
      />
    </>
  );
}
