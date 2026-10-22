import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, PublicLayout } from "@/components/site/PublicLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — FitTracker" },
      {
        name: "description",
        content: "Questions fréquentes sur FitTracker : compte, données, confidentialité et suivi.",
      },
      { property: "og:title", content: "FAQ — FitTracker" },
      { property: "og:description", content: "Toutes les réponses sur ton espace FitTracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const QA = [
  {
    q: "FitTracker est-il gratuit ?",
    a: "Oui. La création d'un compte et l'utilisation des fonctionnalités de suivi sont gratuites.",
  },
  {
    q: "Mes données sont-elles privées ?",
    a: "Oui. Chaque information (séances, repas, mesures, photos) est rattachée à ton compte et protégée : aucun autre utilisateur ne peut y accéder.",
  },
  {
    q: "Puis-je utiliser l'application sur mon téléphone ?",
    a: "Oui. L'interface s'adapte au smartphone, avec une barre de navigation en bas de l'écran pour enregistrer tes séries rapidement pendant la séance.",
  },
  {
    q: "Mes données sont-elles synchronisées entre mes appareils ?",
    a: "Oui. Tout est enregistré en ligne : tu retrouves tes données dès que tu te connectes, sur n'importe quel appareil.",
  },
  {
    q: "Puis-je exporter ou supprimer mes données ?",
    a: "Oui. Depuis les paramètres, tu peux exporter toutes tes données ou supprimer définitivement ton compte.",
  },
  {
    q: "Comment sont calculées les recommandations nutritionnelles ?",
    a: "Les objectifs suggérés utilisent la formule de Mifflin-St Jeor ajustée à ton niveau d'activité et à ton objectif. Ce sont des repères : tu peux les modifier à tout moment. Ils ne remplacent pas l'avis d'un professionnel de santé.",
  },
];

function FaqPage() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="FAQ" title="Questions fréquentes" />
      <section className="mx-auto w-full max-w-4xl px-5 pb-24 md:px-8">
        <Accordion type="single" collapsible className="panel px-6 md:px-8">
          {QA.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`} className="border-border">
              <AccordionTrigger className="py-5 text-left font-display text-lg uppercase tracking-wide">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </PublicLayout>
  );
}
