import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-gym.jpg";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { translateAuthError } from "@/lib/session";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="font-display text-6xl font-extrabold uppercase leading-[0.9] text-glow">
            Repousse
            <br />
            tes limites.
          </p>
          <p className="mt-4 max-w-md text-muted-foreground">
            Tes entraînements. Tes performances. Ton évolution.
          </p>
        </div>
      </div>
      <div className="flex flex-col bg-hex">
        <div className="flex h-20 items-center px-6 md:px-10">
          <Link to="/" aria-label="Accueil">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <div className="w-full max-w-md animate-fade-up">
            <h1 className="font-display text-4xl font-extrabold uppercase md:text-5xl">{title}</h1>
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ label, onSignedIn }: { label: string; onSignedIn: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setLoading(false);
      toast.error(translateAuthError(result.error.message));
      return;
    }
    if (result.redirected) return;
    onSignedIn();
  }
  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={handle} disabled={loading}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.47-1.67 4.3-5.35 4.3-3.22 0-5.85-2.67-5.85-5.96S8.78 6.46 12 6.46c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.9 14.55 3 12 3 6.98 3 2.92 7.03 2.92 12S6.98 21 12 21c6.93 0 9.08-4.86 9.08-7.4 0-.5-.05-.88-.12-1.27z" />
      </svg>
      {loading ? "Connexion…" : label}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
