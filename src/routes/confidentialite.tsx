import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Prose, PublicLayout } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — FitTracker" },
      {
        name: "description",
        content: "Comment FitTracker collecte, protège et utilise tes données personnelles et physiques.",
      },
      { property: "og:title", content: "Politique de confidentialité — FitTracker" },
      { property: "og:description", content: "Tes données t'appartiennent. Voici comment elles sont protégées." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PublicLayout>
      <PageIntro eyebrow="Légal" title="Confidentialité" />
      <Prose>
        <h2>Données collectées</h2>
        <ul>
          <li>Compte : pseudonyme, adresse e-mail, photo de profil facultative.</li>
          <li>Profil sportif : date de naissance facultative, taille, objectif principal.</li>
          <li>Suivi : séances, séries, repas, hydratation, mesures corporelles, photos de progression, objectifs.</li>
        </ul>
        <h2>Finalité</h2>
        <p>
          Ces données servent uniquement à faire fonctionner ton espace de suivi : calculs,
          statistiques et graphiques. Elles ne sont ni vendues ni partagées à des fins publicitaires.
        </p>
        <h2>Sécurité</h2>
        <p>
          Chaque donnée est liée à ton compte et protégée par des règles d'accès strictes : aucun
          autre utilisateur ne peut la consulter. Les photos sont stockées dans un espace privé.
        </p>
        <h2>Tes droits</h2>
        <p>
          Tu peux à tout moment modifier tes informations, <strong>exporter toutes tes données</strong>{" "}
          ou <strong>supprimer définitivement ton compte</strong> depuis la page Paramètres.
          Pour toute question : contact@fittracker.app.
        </p>
      </Prose>
    </PublicLayout>
  ),
});
