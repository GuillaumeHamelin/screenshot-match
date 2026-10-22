import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/nutrition")({
  head: () => ({ meta: [{ title: "Nutrition — FitTracker" }] }),
  component: NutritionPage,
});

function NutritionPage() {
  return (
    <ComingSoon
      eyebrow="Alimentation"
      title="Nutrition"
      phase="Phase 3 — Nutrition"
      intro="Tes objectifs nutritionnels sont déjà enregistrés (modifiables dans Paramètres). Le journal alimentaire arrive à la phase 3."
      items={[
        "Journal : petit-déjeuner, déjeuner, dîner, collations",
        "Recherche dans la base Open Food Facts",
        "Calcul automatique des calories et macros",
        "Aliments et repas personnalisés, favoris",
        "Suivi de l'hydratation (250 ml, 500 ml, personnalisé)",
        "Historique et moyennes hebdomadaires",
      ]}
    />
  );
}
