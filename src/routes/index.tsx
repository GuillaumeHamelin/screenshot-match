import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Scale, Timer, Trophy } from "lucide-react";
import heroImg from "@/assets/hero-gym.jpg";
import { PublicFooter, PublicHeader } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitTracker — Repousse tes limites" },
      {
        name: "description",
        content:
          "Tes entraînements. Tes performances. Ton évolution. Suivi musculation, nutrition et progression physique au même endroit.",
      },
      { property: "og:title", content: "FitTracker — Repousse tes limites" },
      {
        property: "og:description",
        content: "Tes entraînements. Tes performances. Ton évolution. Tout au même endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader overlay />

      {/* Hero */}
      <section className="relative isolate flex min-h-[94vh] items-end overflow-hidden">
        <img
          src={heroImg}
          alt="Salle de musculation sombre éclairée par des LED hexagonales"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-hero-fade" />
        <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-40 md:px-8 md:pb-28">
          <p className="eyebrow animate-fade-up">Musculation · Nutrition · Progression</p>
          <h1 className="mt-4 animate-fade-up font-display text-[3.6rem] font-extrabold uppercase leading-[0.88] text-foreground text-glow sm:text-8xl lg:text-[9.5rem]">
            Repousse
            <br />
            tes limites.
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg text-muted-foreground md:text-xl">
            Tes entraînements. Tes performances. Ton évolution. Tout au même endroit.
          </p>
          <div className="mt-10 flex animate-fade-up flex-col gap-3 sm:flex-row">
            <Button variant="hero" size="xl" asChild>
              <Link to="/inscription">
                Commencer gratuitement <ArrowRight />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/auth">Se connecter</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="relative bg-hex">
        <div className="mx-auto w-full max-w-7xl px-5 py-24 md:px-8 md:py-32">
          <div className="max-w-2xl">
            <p className="eyebrow">Fonctionnalités</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none md:text-6xl">
              Un seul outil pour tout suivre.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="panel group p-7 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/30 hover:shadow-glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-shadow group-hover:shadow-glow">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-2xl font-bold uppercase">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <Button variant="outline" asChild>
              <Link to="/fonctionnalites">
                Voir le détail des fonctionnalités <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="relative overflow-hidden border-y border-border bg-surface">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Ton centre de contrôle</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none md:text-6xl">
              Chaque rep compte. Chaque gramme aussi.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Poids, calories, macros, séances de la semaine, volume soulevé et records : ton
              dashboard se met à jour à chaque saisie.
            </p>
            <Button className="mt-8" size="lg" asChild>
              <Link to="/inscription">Créer mon espace</Link>
            </Button>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-hex">
        <div className="mx-auto w-full max-w-4xl px-5 py-28 text-center md:px-8">
          <div className="led-line mx-auto mb-10 h-px w-40 animate-led" />
          <h2 className="font-display text-5xl font-extrabold uppercase leading-none md:text-7xl">
            Entre dans la salle.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Gratuit. Tes données restent privées et te suivent sur tous tes appareils.
          </p>
          <Button variant="hero" size="xl" className="mt-10" asChild>
            <Link to="/inscription">
              Commencer gratuitement <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

function DashboardPreview() {
  const bars = [42, 58, 51, 66, 72, 64, 80, 88];
  const kpis = [
    { icon: Scale, label: "Poids", value: "78,4 kg", sub: "−0,6 kg" },
    { icon: Flame, label: "Calories", value: "1 840", sub: "/ 2 400 kcal" },
    { icon: Timer, label: "Séances", value: "3 / 4", sub: "cette semaine" },
    { icon: Trophy, label: "Record", value: "100 kg", sub: "Développé couché" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-hex opacity-60" />
      <div className="panel overflow-hidden shadow-glow">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          </div>
          <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Aperçu · données de démonstration
          </span>
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-background/60 p-3">
                <k.icon className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {k.label}
                </p>
                <p className="font-display text-2xl font-bold">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Volume hebdomadaire
            </p>
            <div className="mt-4 flex h-32 items-end gap-2">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-foreground/80 transition-all"
                  style={{ height: `${h}%`, opacity: 0.35 + i * 0.08 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
