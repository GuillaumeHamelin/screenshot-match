import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import {
  NutritionGoalsFields,
  validateNutritionGoals,
  type NutritionGoalValues,
} from "@/components/app/NutritionGoalsForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_LABELS,
  MAIN_GOAL_LABELS,
  SEX_LABELS,
  ageFromBirthDate,
  parseNum,
  suggestNutritionGoals,
  toISODate,
  type ActivityLevel,
  type MainGoal,
  type Sex,
} from "@/lib/fitness";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bienvenue — FitTracker" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery(context.user.id)),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [sex, setSex] = useState<Sex | "">((profile?.sex as Sex) ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState<MainGoal | "">((profile?.main_goal as MainGoal) ?? "");
  const [activity, setActivity] = useState<ActivityLevel | "">((profile?.activity_level as ActivityLevel) ?? "");
  const [sessions, setSessions] = useState(String(profile?.weekly_sessions_goal ?? 4));
  const [goals, setGoals] = useState<NutritionGoalValues>({
    calorie_goal: String(profile?.calorie_goal ?? 2200),
    protein_goal: String(profile?.protein_goal ?? 140),
    carbs_goal: String(profile?.carbs_goal ?? 250),
    fat_goal: String(profile?.fat_goal ?? 70),
    water_goal_ml: String(profile?.water_goal_ml ?? 2500),
  });
  const [terms, setTerms] = useState(Boolean(profile?.terms_accepted_at));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const age = ageFromBirthDate(birthDate);
  const w = parseNum(weight);
  const h = parseNum(height);
  const canSuggest = Boolean(sex && goal && activity && age && w && h);

  function suggest() {
    if (!canSuggest) return;
    const s = suggestNutritionGoals({
      sex: sex as Sex,
      weightKg: w as number,
      heightCm: h as number,
      age: age as number,
      activity: activity as ActivityLevel,
      goal: goal as MainGoal,
    });
    setGoals({
      calorie_goal: String(s.calories),
      protein_goal: String(s.protein),
      carbs_goal: String(s.carbs),
      fat_goal: String(s.fat),
      water_goal_ml: String(s.water),
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.trim().length < 2) return setError("Le pseudonyme doit contenir au moins 2 caractères.");
    if (h === null || Number.isNaN(h) || h < 100 || h > 250) return setError("Indique ta taille (100 à 250 cm).");
    if (w === null || Number.isNaN(w) || w < 25 || w > 350) return setError("Indique ton poids actuel (25 à 350 kg).");
    if (!goal) return setError("Choisis ton objectif principal.");
    if (birthDate && (age === null || age < 13 || age > 110)) return setError("Date de naissance invalide.");
    const ng = validateNutritionGoals(goals);
    if (ng) return setError(ng);
    const s = Number(sessions);
    if (!(s >= 1 && s <= 14)) return setError("Séances par semaine : entre 1 et 14.");
    if (!terms) return setError("Tu dois accepter les conditions d'utilisation.");
    setError(null);
    setSaving(true);

    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        sex: sex || null,
        birth_date: birthDate || null,
        height_cm: h,
        main_goal: goal,
        activity_level: activity || null,
        weekly_sessions_goal: s,
        calorie_goal: Number(goals.calorie_goal),
        protein_goal: Number(goals.protein_goal),
        carbs_goal: Number(goals.carbs_goal),
        fat_goal: Number(goals.fat_goal),
        water_goal_ml: Number(goals.water_goal_ml),
        terms_accepted_at: profile?.terms_accepted_at ?? new Date().toISOString(),
        onboarding_completed: true,
      })
      .eq("id", user.id);
    if (pErr) {
      setSaving(false);
      return setError("Impossible d'enregistrer ton profil. Réessaie.");
    }
    const { error: mErr } = await supabase
      .from("body_measurements")
      .insert({ measured_on: toISODate(), weight_kg: w, height_cm: h });
    setSaving(false);
    if (mErr) toast.error("Profil enregistré, mais la pesée n'a pas pu être sauvegardée.");
    await qc.invalidateQueries();
    toast.success("Profil prêt. Bienvenue !");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background bg-hex">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
        <Logo />
        <p className="eyebrow mt-12">Étape finale</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none md:text-6xl">
          Ton profil sportif
        </h1>
        <p className="mt-3 text-muted-foreground">
          Ces informations servent à calculer tes objectifs et ton évolution. Tu pourras les modifier à
          tout moment.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <section className="panel space-y-5 p-6">
            <h2 className="eyebrow">Toi</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="o-username">Pseudonyme</Label>
                <Input id="o-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Sexe (pour les calculs)</Label>
                <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEX_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-birth">Date de naissance <span className="text-muted-foreground">(facultatif)</span></Label>
                <Input id="o-birth" type="date" value={birthDate} max={toISODate()} onChange={(e) => setBirthDate(e.target.value)} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="o-height">Taille (cm)</Label>
                  <Input id="o-height" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-weight">Poids (kg)</Label>
                  <Input id="o-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-11" />
                </div>
              </div>
            </div>
          </section>

          <section className="panel space-y-5 p-6">
            <h2 className="eyebrow">Objectifs</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Objectif principal</Label>
                <Select value={goal} onValueChange={(v) => setGoal(v as MainGoal)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAIN_GOAL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Niveau d'activité</Label>
                <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-sessions">Séances / semaine</Label>
                <Input id="o-sessions" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/[^\d]/g, ""))} className="h-11" />
              </div>
            </div>
            <div className="border-t border-border pt-5">
              <p className="mb-4 text-sm text-muted-foreground">Objectifs nutritionnels quotidiens</p>
              <NutritionGoalsFields values={goals} onChange={setGoals} onSuggest={suggest} suggestDisabled={!canSuggest} />
              {!canSuggest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Renseigne sexe, date de naissance, taille, poids, objectif et activité pour obtenir une suggestion.
                </p>
              )}
            </div>
          </section>

          {!profile?.terms_accepted_at && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
              <Checkbox className="mt-0.5" checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
              <span>
                J'accepte les{" "}
                <a href="/cgu" target="_blank" className="text-foreground underline underline-offset-4">conditions d'utilisation</a>{" "}
                et la{" "}
                <a href="/confidentialite" target="_blank" className="text-foreground underline underline-offset-4">politique de confidentialité</a>.
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={saving}>
            {saving ? "Enregistrement…" : "Accéder à mon dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
