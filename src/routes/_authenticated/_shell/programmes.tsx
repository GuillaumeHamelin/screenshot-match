import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/programmes")({
  head: () => ({ meta: [{ title: "Programmes — FitTracker" }] }),
  component: ProgrammesPage,
});

function ProgrammesPage() {
  return (
    <ComingSoon
      eyebrow="Musculation"
      title="Programmes"
      phase="Phase 2 — Musculation"
      intro="Crée tes programmes et organise tes séances. La bibliothèque de 41 exercices est déjà prête."
      items={[
        "Push / Pull / Legs, Upper / Lower, Full Body ou personnalisé",
        "Jours d'entraînement, séries, reps cibles, charges, repos",
        "Réorganisation des exercices",
        "Dupliquer, modifier, supprimer un programme",
        "Exercices personnalisés",
      ]}
    />
  );
}
