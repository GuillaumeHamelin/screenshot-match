import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/performances")({
  head: () => ({ meta: [{ title: "Performances — FitTracker" }] }),
  component: PerformancesPage,
});

function PerformancesPage() {
  return (
    <ComingSoon
      eyebrow="Analyse"
      title="Performances"
      phase="Phase 2 — Musculation"
      intro="L'analyse de ta progression s'appuiera sur tes séances enregistrées."
      items={[
        "Charge max, meilleure série, 1RM estimé",
        "Courbes : charges, reps, volume, 1RM",
        "Filtres de 7 jours à toutes les données",
        "Détection et historique des records",
        "Comparaison de deux séances",
      ]}
    />
  );
}
