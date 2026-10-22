import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Prose, PublicLayout } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — FitTracker" },
      { name: "description", content: "Mentions légales de l'application FitTracker." },
      { property: "og:title", content: "Mentions légales — FitTracker" },
      { property: "og:description", content: "Éditeur, hébergement et propriété intellectuelle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PublicLayout>
      <PageIntro eyebrow="Légal" title="Mentions légales" />
      <Prose>
        <h2>Éditeur</h2>
        <p>
          <strong>[Nom ou raison sociale de l'éditeur]</strong> — [adresse], [SIRET le cas échéant].
          Directeur de la publication : [nom]. Contact : contact@fittracker.app.
        </p>
        <h2>Hébergement</h2>
        <p>L'application et ses données sont hébergées par Lovable (lovable.dev) et ses sous-traitants d'infrastructure cloud.</p>
        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments de l'application (textes, interface, logo, visuels) est protégé.
          Toute reproduction sans autorisation est interdite.
        </p>
        <h2>Avertissement santé</h2>
        <p>
          FitTracker est un outil de suivi. Les informations et recommandations affichées ne
          constituent pas un avis médical. Consulte un professionnel de santé avant de débuter un
          programme sportif ou nutritionnel.
        </p>
      </Prose>
    </PublicLayout>
  ),
});
