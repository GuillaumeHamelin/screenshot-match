import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/calendrier")({
  head: () => ({ meta: [{ title: "Calendrier — FitTracker" }] }),
  component: CalendrierPage,
});

function CalendrierPage() {
  return (
    <ComingSoon
      eyebrow="Planning"
      title="Calendrier"
      phase="Phase 4 — Suivi avancé"
      intro="Le calendrier affichera tes séances dès que le module d'entraînement sera en place."
      items={[
        "Vue mensuelle et hebdomadaire",
        "Séances prévues, terminées, manquées",
        "Jours de repos",
        "Ajouter, déplacer, modifier, supprimer une séance",
      ]}
    />
  );
}
