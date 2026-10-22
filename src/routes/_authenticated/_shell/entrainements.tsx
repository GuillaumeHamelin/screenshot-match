import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/entrainements")({
  head: () => ({ meta: [{ title: "Mes entraînements — FitTracker" }] }),
  component: EntrainementsPage,
});

function EntrainementsPage() {
  return (
    <ComingSoon
      eyebrow="Musculation"
      title="Mes entraînements"
      phase="Phase 2 — Musculation"
      intro="Le module de séance guidée arrive à l'étape suivante. Tes séances seront enregistrées automatiquement et alimenteront ton dashboard."
      items={[
        "Démarrer une séance depuis un programme",
        "Saisie charge, répétitions, RPE / RIR et type de série",
        "Chronomètre global et minuteur de repos",
        "Résultats de la séance précédente affichés",
        "Récapitulatif de fin de séance et records battus",
        "Historique complet des entraînements",
      ]}
    />
  );
}
