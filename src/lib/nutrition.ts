// Nutrition write actions (journal, foods, saved meals, water) shared by the nutrition pages.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { macrosForQuantity, per100FromTotals, type MealType, type Per100 } from "@/lib/fitness";
import type { LoggedItem, Recipe } from "@/lib/queries";

export function invalidateNutrition(qc: QueryClient) {
  for (const key of ["dashboard", "nutrition-day", "nutrition-history", "foods", "recipes"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/** A food picked for logging: either saved in the user's foods, or straight from Open Food Facts. */
export type PickedFood = {
  foodId: string | null;
  name: string;
  brand: string | null;
  per100: Per100;
  source: "custom" | "openfoodfacts";
  externalId: string | null;
  servingG: number | null;
};

export const displayName = (name: string, brand: string | null | undefined) => (brand ? `${name} (${brand})` : name);

async function ensureMeal(date: string, mealType: MealType): Promise<string> {
  const { data, error } = await supabase
    .from("meals")
    .select("id")
    .eq("eaten_on", date)
    .eq("meal_type", mealType)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (data[0]) return data[0].id;
  const { data: meal, error: ie } = await supabase
    .from("meals")
    .insert({ eaten_on: date, meal_type: mealType })
    .select("id")
    .single();
  if (ie) throw ie;
  return meal.id;
}

/** Open Food Facts products are kept in the user's foods so they show up in "Mes aliments". */
async function ensureFood(food: PickedFood): Promise<string> {
  if (food.foodId) return food.foodId;
  if (food.source === "openfoodfacts" && food.externalId) {
    const { data, error } = await supabase
      .from("foods")
      .select("id")
      .eq("source", "openfoodfacts")
      .eq("external_id", food.externalId)
      .limit(1);
    if (error) throw error;
    if (data[0]) return data[0].id;
  }
  const { data, error } = await supabase
    .from("foods")
    .insert({
      name: food.name,
      brand: food.brand,
      source: food.source,
      external_id: food.externalId,
      barcode: food.source === "openfoodfacts" ? food.externalId : null,
      calories_per_100g: food.per100.calories,
      protein_per_100g: food.per100.protein,
      carbs_per_100g: food.per100.carbs,
      fat_per_100g: food.per100.fat,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function itemValues(per100: Per100, grams: number) {
  const m = macrosForQuantity(per100, grams);
  return { quantity_g: grams, calories: m.calories, protein_g: m.protein, carbs_g: m.carbs, fat_g: m.fat };
}

export async function addFoodToMeal(input: { date: string; mealType: MealType; food: PickedFood; grams: number }) {
  const [mealId, foodId] = await Promise.all([ensureMeal(input.date, input.mealType), ensureFood(input.food)]);
  const { error } = await supabase.from("meal_items").insert({
    meal_id: mealId,
    food_id: foodId,
    food_name: displayName(input.food.name, input.food.brand),
    ...itemValues(input.food.per100, input.grams),
  });
  if (error) throw error;
}

export async function addRecipeToMeal(input: { date: string; mealType: MealType; recipe: Recipe }) {
  if (input.recipe.saved_recipe_items.length === 0) return;
  const mealId = await ensureMeal(input.date, input.mealType);
  const { error } = await supabase.from("meal_items").insert(
    input.recipe.saved_recipe_items.map((i) => ({
      meal_id: mealId,
      food_id: i.food_id,
      food_name: i.food_name,
      ...itemValues(
        {
          calories: Number(i.calories_per_100g),
          protein: Number(i.protein_per_100g),
          carbs: Number(i.carbs_per_100g),
          fat: Number(i.fat_per_100g),
        },
        Number(i.quantity_g),
      ),
    })),
  );
  if (error) throw error;
}

/** Values per 100 g of a logged item: from its food when it still exists, otherwise backed out of the item. */
export function itemPer100(item: LoggedItem): Per100 {
  if (item.foods) {
    return {
      calories: Number(item.foods.calories_per_100g),
      protein: Number(item.foods.protein_per_100g),
      carbs: Number(item.foods.carbs_per_100g),
      fat: Number(item.foods.fat_per_100g),
    };
  }
  return per100FromTotals(item, Number(item.quantity_g));
}

export async function updateItemQuantity(item: LoggedItem, grams: number) {
  const { error } = await supabase.from("meal_items").update(itemValues(itemPer100(item), grams)).eq("id", item.id);
  if (error) throw error;
}

export async function deleteMealItem(id: string) {
  const { error } = await supabase.from("meal_items").delete().eq("id", id);
  if (error) throw error;
}

export async function saveItemsAsRecipe(name: string, items: LoggedItem[]) {
  const { data: recipe, error } = await supabase.from("saved_recipes").insert({ name }).select("id").single();
  if (error) throw error;
  const { error: ie } = await supabase.from("saved_recipe_items").insert(
    items.map((i) => {
      const p = itemPer100(i);
      return {
        recipe_id: recipe.id,
        food_id: i.food_id,
        food_name: i.food_name,
        quantity_g: Number(i.quantity_g),
        calories_per_100g: Math.round(p.calories * 10) / 10,
        protein_per_100g: Math.round(p.protein * 10) / 10,
        carbs_per_100g: Math.round(p.carbs * 10) / 10,
        fat_per_100g: Math.round(p.fat * 10) / 10,
      };
    }),
  );
  if (ie) throw ie;
}

export async function setRecipeFavorite(id: string, isFavorite: boolean) {
  const { error } = await supabase.from("saved_recipes").update({ is_favorite: isFavorite }).eq("id", id);
  if (error) throw error;
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("saved_recipes").delete().eq("id", id);
  if (error) throw error;
}

export type FoodInput = { name: string; brand: string | null; per100: Per100 };

export async function saveCustomFood(input: FoodInput & { id?: string | null }) {
  const row = {
    name: input.name,
    brand: input.brand,
    calories_per_100g: input.per100.calories,
    protein_per_100g: input.per100.protein,
    carbs_per_100g: input.per100.carbs,
    fat_per_100g: input.per100.fat,
  };
  if (input.id) {
    const { error } = await supabase.from("foods").update(row).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from("foods").insert({ ...row, source: "custom" }).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Deleting a food keeps the meals already logged with it. */
export async function deleteFood(id: string) {
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) throw error;
}

export async function addWater(date: string, ml: number) {
  const { error } = await supabase.from("water_intake").insert({ drank_on: date, amount_ml: ml });
  if (error) throw error;
}

export async function deleteWater(id: string) {
  const { error } = await supabase.from("water_intake").delete().eq("id", id);
  if (error) throw error;
}
