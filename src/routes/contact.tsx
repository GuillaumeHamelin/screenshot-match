import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { PageIntro, PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";

const CONTACT_EMAIL = "contact@fittracker.app";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — FitTracker" },
      { name: "description", content: "Une question, un bug, une idée ? Contacte l'équipe FitTracker." },
      { property: "og:title", content: "Contact — FitTracker" },
      { property: "og:description", content: "Écris à l'équipe FitTracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="Contact" title="Parlons-en.">
        Une question sur ton compte, un bug ou une idée de fonctionnalité ? Écris-nous.
      </PageIntro>
      <section className="mx-auto w-full max-w-4xl px-5 pb-24 md:px-8">
        <div className="panel flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">E-mail</p>
              <p className="font-display text-2xl font-bold">{CONTACT_EMAIL}</p>
            </div>
          </div>
          <Button size="lg" asChild>
            <a href={`mailto:${CONTACT_EMAIL}`}>Envoyer un e-mail</a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Consulte aussi la{" "}
          <Link to="/faq" className="text-foreground underline underline-offset-4">
            FAQ
          </Link>
          , la réponse s'y trouve peut-être déjà.
        </p>
      </section>
    </PublicLayout>
  );
}
