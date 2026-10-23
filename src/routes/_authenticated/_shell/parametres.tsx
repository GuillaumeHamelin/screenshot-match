import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Apple, Download, KeyRound, LogOut, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSignOut } from "@/components/app/AppShell";
import {
  NutritionGoalsFields,
  validateNutritionGoals,
  type NutritionGoalValues,
} from "@/components/app/NutritionGoalsForm";
import { PageHeader, Panel } from "@/components/app/ui";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  ageFromBirthDate,
  suggestNutritionGoals,
  weightTrend,
  type ActivityLevel,
  type MainGoal,
  type Sex,
} from "@/lib/fitness";
import { measurementsQuery, profileQuery } from "@/lib/queries";
import { translateAuthError } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/_shell/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — FitTracker" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(measurementsQuery(context.user.id)),
    ]),
  component: SettingsPage,
});

const EXPORT_TABLES = [
  "profiles",
  "body_measurements",
  "goals",
  "workout_programs",
  "workout_templates",
  "workout_template_exercises",
  "workout_sessions",
  "workout_exercises",
  "workout_sets",
  "personal_records",
  "foods",
  "meals",
  "meal_items",
  "saved_recipes",
  "saved_recipe_items",
  "water_intake",
  "progress_photos",
] as const;

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: measurements } = useSuspenseQuery(measurementsQuery(user.id));
  const qc = useQueryClient();
  const signOut = useSignOut();
  const deleteAccount = useServerFn(deleteMyAccount);
  const isEmailUser = user.app_metadata?.provider === "email";

  const [goals, setGoals] = useState<NutritionGoalValues>({
    calorie_goal: String(profile?.calorie_goal ?? 2200),
    protein_goal: String(profile?.protein_goal ?? 140),
    carbs_goal: String(profile?.carbs_goal ?? 250),
    fat_goal: String(profile?.fat_goal ?? 70),
    water_goal_ml: String(profile?.water_goal_ml ?? 2500),
  });
  const [savingGoals, setSavingGoals] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const age = ageFromBirthDate(profile?.birth_date);
  const weight = weightTrend(measurements).current;
  const canSuggest = Boolean(profile?.sex && profile?.main_goal && profile?.activity_level && age && weight && profile?.height_cm);

  function suggest() {
    if (!canSuggest || !profile) return;
    const s = suggestNutritionGoals({
      sex: profile.sex as Sex,
      weightKg: weight as number,
      heightCm: Number(profile.height_cm),
      age: age as number,
      activity: profile.activity_level as ActivityLevel,
      goal: profile.main_goal as MainGoal,
    });
    setGoals({
      calorie_goal: String(s.calories),
      protein_goal: String(s.protein),
      carbs_goal: String(s.carbs),
      fat_goal: String(s.fat),
      water_goal_ml: String(s.water),
    });
    toast.info("Suggestion calculée. Pense à enregistrer.");
  }

  async function saveGoals(e: FormEvent) {
    e.preventDefault();
    const err = validateNutritionGoals(goals);
    if (err) { toast.error(err); return; }
    setSavingGoals(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        calorie_goal: Number(goals.calorie_goal),
        protein_goal: Number(goals.protein_goal),
        carbs_goal: Number(goals.carbs_goal),
        fat_goal: Number(goals.fat_goal),
        water_goal_ml: Number(goals.water_goal_ml),
      })
      .eq("id", user.id);
    setSavingGoals(false);
    if (error) { toast.error("Enregistrement impossible."); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Objectifs nutritionnels enregistrés.");
  }

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) { toast.error("Adresse e-mail invalide."); return; }
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/auth` },
    );
    if (error) { toast.error(translateAuthError(error.message)); return; }
    setNewEmail("");
    toast.success("Un lien de confirmation a été envoyé à la nouvelle adresse.");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw))
      { toast.error("8 caractères minimum, avec lettres et chiffres."); return; }
    if (newPw !== confirmPw) { toast.error("Les deux mots de passe ne correspondent pas."); return; }
    const { error } = await supabase.auth.updateUser({
      password: newPw,
      ...(currentPw ? { current_password: currentPw } : {}),
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    if (error) { toast.error(translateAuthError(error.message)); return; }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    toast.success("Mot de passe modifié.");
  }

  async function exportData() {
    setExporting(true);
    try {
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email: user.email };
      for (const t of EXPORT_TABLES) {
        // Every exported table except profiles is keyed by user_id.
        const { data, error } =
          t === "profiles"
            ? await supabase.from("profiles").select("*").eq("id", user.id)
            : await supabase.from(t as "goals").select("*").eq("user_id", user.id);
        if (error) throw error;
        out[t] = data;
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fittracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé.");
    } catch {
      toast.error("Export impossible. Réessaie.");
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Ton compte et tes données ont été supprimés.");
      window.location.replace("/");
    } catch {
      setDeleting(false);
      toast.error("Suppression impossible. Réessaie.");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Compte" title="Paramètres" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Objectifs nutritionnels" icon={Apple} className="xl:col-span-2">
          <form onSubmit={saveGoals} className="space-y-4">
            <NutritionGoalsFields values={goals} onChange={setGoals} onSuggest={suggest} suggestDisabled={!canSuggest} />
            {!canSuggest && (
              <p className="text-xs text-muted-foreground">
                Complète ton profil (sexe, date de naissance, taille, objectif, activité) et ton poids pour obtenir une suggestion.
              </p>
            )}
            <Button type="submit" disabled={savingGoals}>{savingGoals ? "Enregistrement…" : "Enregistrer les objectifs"}</Button>
          </form>
        </Panel>

        <Panel title="Adresse e-mail" icon={Mail}>
          <form onSubmit={changeEmail} className="space-y-4">
            <p className="text-sm text-muted-foreground">Adresse actuelle : <span className="text-foreground">{user.email}</span></p>
            <div className="space-y-2">
              <Label htmlFor="s-email">Nouvelle adresse</Label>
              <Input id="s-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-11" />
            </div>
            <Button type="submit" variant="outline" disabled={!newEmail}>Modifier l'e-mail</Button>
          </form>
        </Panel>

        <Panel title="Mot de passe" icon={KeyRound}>
          <form onSubmit={changePassword} className="space-y-4">
            {isEmailUser && (
              <div className="space-y-2">
                <Label htmlFor="s-cur">Mot de passe actuel</Label>
                <Input id="s-cur" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-11" />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-new">Nouveau</Label>
                <Input id="s-new" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-conf">Confirmation</Label>
                <Input id="s-conf" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-11" />
              </div>
            </div>
            <Button type="submit" variant="outline" disabled={!newPw}>
              {isEmailUser ? "Modifier le mot de passe" : "Définir un mot de passe"}
            </Button>
          </form>
        </Panel>

        <Panel title="Confidentialité et données" icon={ShieldCheck}>
          <p className="text-sm text-muted-foreground">
            Tes données (séances, repas, mesures, photos) sont privées : elles ne sont visibles que par toi.
            Unités utilisées : kilogrammes, centimètres, kilocalories.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData} disabled={exporting}>
              <Download /> {exporting ? "Export…" : "Exporter mes données"}
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut /> Se déconnecter
            </Button>
          </div>
        </Panel>

        <Panel title="Zone sensible" icon={Trash2}>
          <p className="text-sm text-muted-foreground">
            La suppression du compte efface définitivement toutes tes données et photos. Cette action est irréversible.
          </p>
          <AlertDialog onOpenChange={(o) => !o && setDeleteText("")}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-5">
                <Trash2 /> Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-border bg-surface">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl uppercase">Supprimer le compte ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes tes données seront effacées définitivement. Tape <strong className="text-foreground">SUPPRIMER</strong> pour confirmer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} className="h-11" aria-label="Confirmation" />
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <Button variant="destructive" disabled={deleteText !== "SUPPRIMER" || deleting} onClick={confirmDelete}>
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>
      </div>
    </>
  );
}
