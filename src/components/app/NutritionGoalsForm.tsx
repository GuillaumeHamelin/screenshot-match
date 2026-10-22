import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type NutritionGoalValues = {
  calorie_goal: string;
  protein_goal: string;
  carbs_goal: string;
  fat_goal: string;
  water_goal_ml: string;
};

const FIELDS: { key: keyof NutritionGoalValues; label: string; unit: string }[] = [
  { key: "calorie_goal", label: "Calories", unit: "kcal" },
  { key: "protein_goal", label: "Protéines", unit: "g" },
  { key: "carbs_goal", label: "Glucides", unit: "g" },
  { key: "fat_goal", label: "Lipides", unit: "g" },
  { key: "water_goal_ml", label: "Hydratation", unit: "ml" },
];

export function NutritionGoalsFields({
  values,
  onChange,
  onSuggest,
  suggestDisabled,
}: {
  values: NutritionGoalValues;
  onChange: (v: NutritionGoalValues) => void;
  onSuggest?: () => void;
  suggestDisabled?: boolean;
}) {
  const macroKcal =
    Number(values.protein_goal || 0) * 4 + Number(values.carbs_goal || 0) * 4 + Number(values.fat_goal || 0) * 9;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={`g-${f.key}`}>
              {f.label} <span className="text-muted-foreground">({f.unit})</span>
            </Label>
            <Input
              id={`g-${f.key}`}
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value.replace(/[^\d]/g, "") })}
              className="h-11"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Les macros représentent {Math.round(macroKcal)} kcal.</span>
        {onSuggest && (
          <Button type="button" variant="outline" size="sm" onClick={onSuggest} disabled={suggestDisabled}>
            <Sparkles /> Calculer selon mon profil
          </Button>
        )}
      </div>
    </div>
  );
}

export function validateNutritionGoals(v: NutritionGoalValues): string | null {
  const n = (s: string) => Number(s);
  if (!(n(v.calorie_goal) >= 800 && n(v.calorie_goal) <= 8000)) return "Calories : entre 800 et 8000 kcal.";
  if (!(n(v.protein_goal) >= 0 && n(v.protein_goal) <= 500)) return "Protéines : entre 0 et 500 g.";
  if (!(n(v.carbs_goal) >= 0 && n(v.carbs_goal) <= 1000)) return "Glucides : entre 0 et 1000 g.";
  if (!(n(v.fat_goal) >= 0 && n(v.fat_goal) <= 400)) return "Lipides : entre 0 et 400 g.";
  if (!(n(v.water_goal_ml) >= 500 && n(v.water_goal_ml) <= 8000)) return "Hydratation : entre 500 et 8000 ml.";
  return null;
}
