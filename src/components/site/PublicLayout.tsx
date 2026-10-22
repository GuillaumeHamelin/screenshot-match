import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { sessionUserQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: user } = useQuery({ ...sessionUserQuery(), enabled: typeof window !== "undefined" });

  return (
    <header
      className={cn(
        "z-40 w-full",
        overlay
          ? "absolute inset-x-0 top-0"
          : "sticky top-0 border-b border-border bg-background/85 backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" aria-label="Accueil FitTracker">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Mon dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Se connecter</Link>
              </Button>
              <Button asChild>
                <Link to="/inscription">Commencer</Link>
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <div className="border-t border-border bg-background/95 px-5 pb-6 pt-2 backdrop-blur md:hidden">
          <nav className="flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="border-b border-border py-4 font-display text-lg uppercase tracking-[0.14em] text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link to="/dashboard">Mon dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link to="/inscription">Commencer gratuitement</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Se connecter</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const cols = [
    {
      title: "Application",
      links: [
        { to: "/", label: "Accueil" },
        { to: "/fonctionnalites", label: "Fonctionnalités" },
        { to: "/auth", label: "Connexion" },
        { to: "/inscription", label: "Inscription" },
      ],
    },
    {
      title: "Aide",
      links: [
        { to: "/contact", label: "Contact" },
        { to: "/faq", label: "FAQ" },
      ],
    },
    {
      title: "Légal",
      links: [
        { to: "/mentions-legales", label: "Mentions légales" },
        { to: "/confidentialite", label: "Politique de confidentialité" },
        { to: "/cgu", label: "Conditions générales d'utilisation" },
      ],
    },
  ] as const;

  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="led-line absolute inset-x-0 top-0 h-px opacity-40" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 md:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Ton centre de contrôle pour l'entraînement, la nutrition et la progression physique.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-7xl px-5 py-6 text-xs text-muted-foreground md:px-8">
          © {new Date().getFullYear()} FitTracker. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1 bg-hex">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-16 md:px-8 md:pt-24">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-none md:text-7xl">
        {title}
      </h1>
      {children && <div className="mt-5 max-w-2xl text-lg text-muted-foreground">{children}</div>}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-5 pb-24 md:px-8">
      <div className="panel space-y-6 p-6 text-muted-foreground md:p-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
