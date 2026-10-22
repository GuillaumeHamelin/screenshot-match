import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/session";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — FitTracker" },
      { name: "description", content: "Réinitialise le mot de passe de ton compte FitTracker." },
      { property: "og:title", content: "Mot de passe oublié — FitTracker" },
      { property: "og:description", content: "Reçois un lien de réinitialisation par e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(translateAuthError(error.message));
    else setSent(true);
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indique ton e-mail, on t'envoie un lien pour en choisir un nouveau."
      footer={
        <Link to="/auth" className="font-semibold text-foreground underline underline-offset-4">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="panel p-6 text-muted-foreground">
          Si un compte existe pour <strong className="text-foreground">{email}</strong>, un e-mail de
          réinitialisation vient d'être envoyé. Pense à vérifier tes spams.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading || !email}>
            {loading ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
