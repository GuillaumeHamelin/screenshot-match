import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout, GoogleButton, OrDivider } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { markSessionPersistence, safeRedirect, translateAuthError } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion — FitTracker" },
      { name: "description", content: "Connecte-toi à ton espace FitTracker." },
      { property: "og:title", content: "Connexion — FitTracker" },
      { property: "og:description", content: "Accède à ton dashboard sportif personnel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goNext = () => navigate({ to: safeRedirect(redirect), replace: true });

  // Already signed in (or returning from Google / e-mail confirmation): continue.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) goNext();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    markSessionPersistence(remember);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    goNext();
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Content de te revoir. Reprends là où tu t'es arrêté."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="font-semibold text-foreground underline underline-offset-4">
            Créer un compte
          </Link>
        </>
      }
    >
      <GoogleButton label="Continuer avec Google" onSignedIn={goNext} />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link to="/mot-de-passe-oublie" className="text-sm text-muted-foreground hover:text-foreground">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          Rester connecté
        </label>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !email || !password}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthLayout>
  );
}
