import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_shell/objectifs")({
  head: () => ({ meta: [{ title: "Mes objectifs — FitTracker" }] }),
  component: ObjectifsPage,
});

function ObjectifsPage() {
  return (
    <ComingSoon
      eyebrow="Cibles"
      title="Mes objectifs"
      phase="Phase 4 — Suivi avancé"
      intro="Fixe des objectifs de force, physiques ou alimentaires et suis ta progression."
      items={[
        "Ex. : 100 kg au développé couché",
        "Ex. : atteindre 65 kg, baisser la masse grasse",
        "Ex. : 150 g de protéines par jour",
        "Valeur initiale, actuelle, cible et pourcentage",
      ]}
    />
  );
}
