import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageIntro, PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "Fonctionnalités — FitTracker" },
      {
        name: "description",
        content:
          "Entraînements, performances, nutrition, mensurations, objectifs et calendrier : découvre tout ce que FitTracker suit pour toi.",
      },
      { property: "og:title", content: "Fonctionnalités — FitTracker" },
      {
        property: "og:description",
        content: "Musculation, nutrition et progression physique réunies dans une seule application.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="Fonctionnalités" title="Tout ton suivi, au même endroit.">
        De la première série à la dernière bouchée : FitTracker enregistre, calcule et visualise ta
        progression.
      </PageIntro>
      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-24 md:grid-cols-2 md:px-8">
        {FEATURES.map((f) => (
          <article key={f.title} className="panel p-7 md:p-9">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold uppercase">{f.title}</h2>
            </div>
            <p className="mt-4 text-muted-foreground">{f.text}</p>
            <ul className="mt-5 space-y-2.5">
              {f.points.map((p) => (
                <li key={p} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section className="mx-auto w-full max-w-7xl px-5 pb-24 text-center md:px-8">
        <Button variant="hero" size="xl" asChild>
          <Link to="/inscription">Commencer gratuitement</Link>
        </Button>
      </section>
    </PublicLayout>
  );
}
