import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthLayout, GoogleButton, OrDivider } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { markSessionPersistence, translateAuthError } from "@/lib/session";

export const Route = createFileRoute("/inscription")({
  head: () => ({
    meta: [
      { title: "Créer un compte — FitTracker" },
      { name: "description", content: "Crée gratuitement ton espace de suivi sportif FitTracker." },
      { property: "og:title", content: "Créer un compte — FitTracker" },
      { property: "og:description", content: "Commence à suivre tes entraînements et ta nutrition." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function validate(): string | null {
    if (username.trim().length < 2) return "Le pseudonyme doit contenir au moins 2 caractères.";
    if (username.trim().length > 30) return "Le pseudonyme ne doit pas dépasser 30 caractères.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Adresse e-mail invalide.";
    if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      return "Le mot de passe doit contenir des lettres et des chiffres.";
    if (password !== confirm) return "Les deux mots de passe ne correspondent pas.";
    if (!terms) return "Tu dois accepter les conditions d'utilisation.";
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate();
    setError(v);
    if (v) return;
    setLoading(true);
    markSessionPersistence(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { username: username.trim(), terms_accepted: true },
      },
    });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    if (data.session) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthLayout title="Vérifie tes e-mails">
        <div className="panel p-6">
          <MailCheck className="h-8 w-8" />
          <p className="mt-4 text-foreground">
            Un lien de confirmation a été envoyé à <strong>{sentTo}</strong>.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clique sur le lien pour activer ton compte, puis complète ton profil sportif. Pense à
            vérifier tes spams.
          </p>
          <Button variant="outline" className="mt-6 w-full" asChild>
            <Link to="/auth">Aller à la connexion</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Gratuit. Tes données restent privées."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link to="/auth" className="font-semibold text-foreground underline underline-offset-4">
            Se connecter
          </Link>
        </>
      }
    >
      <GoogleButton
        label="S'inscrire avec Google"
        onSignedIn={() => navigate({ to: "/onboarding", replace: true })}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Tu accepteras les conditions d'utilisation à l'étape suivante.
      </p>
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="username">Pseudonyme</Label>
          <Input id="username" autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="h-12" maxLength={30} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmation</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">8 caractères minimum, avec lettres et chiffres.</p>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <Checkbox className="mt-0.5" checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
          <span>
            J'accepte les{" "}
            <Link to="/cgu" target="_blank" className="text-foreground underline underline-offset-4">
              conditions d'utilisation
            </Link>{" "}
            et la{" "}
            <Link to="/confidentialite" target="_blank" className="text-foreground underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
    </AuthLayout>
  );
}
