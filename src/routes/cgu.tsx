import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Prose, PublicLayout } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — FitTracker" },
      { name: "description", content: "Conditions générales d'utilisation de l'application FitTracker." },
      { property: "og:title", content: "CGU — FitTracker" },
      { property: "og:description", content: "Les règles d'utilisation de FitTracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PublicLayout>
      <PageIntro eyebrow="Légal" title="Conditions d'utilisation" />
      <Prose>
        <h2>Objet</h2>
        <p>
          Les présentes conditions encadrent l'utilisation de FitTracker, application de suivi
          sportif, nutritionnel et physique.
        </p>
        <h2>Compte</h2>
        <p>
          Tu es responsable de la confidentialité de tes identifiants et des informations que tu
          enregistres. Un compte est strictement personnel.
        </p>
        <h2>Usage</h2>
        <p>
          FitTracker fournit des outils de suivi et des estimations (1RM, besoins caloriques). Ces
          informations sont indicatives et ne remplacent pas l'avis d'un médecin, d'un diététicien
          ou d'un coach diplômé. Tu pratiques sous ta propre responsabilité.
        </p>
        <h2>Données</h2>
        <p>
          Le traitement de tes données est décrit dans la politique de confidentialité. Tu peux
          supprimer ton compte et l'ensemble de tes données à tout moment.
        </p>
        <h2>Évolution</h2>
        <p>Ces conditions peuvent évoluer ; la version en vigueur est celle publiée sur cette page.</p>
      </Prose>
    </PublicLayout>
  ),
});
