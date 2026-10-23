import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Camera, Settings } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
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
  toISODate,
  weightTrend,
  type ActivityLevel,
  type MainGoal,
  type Sex,
} from "@/lib/fitness";
import { measurementsQuery, profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/profil")({
  head: () => ({ meta: [{ title: "Profil — FitTracker" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(measurementsQuery(context.user.id)),
    ]),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: measurements } = useSuspenseQuery(measurementsQuery(user.id));
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [sex, setSex] = useState<string>(profile?.sex ?? "");
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? "");
  const [goal, setGoal] = useState<string>(profile?.main_goal ?? "");
  const [activity, setActivity] = useState<string>(profile?.activity_level ?? "");
  const [sessions, setSessions] = useState(String(profile?.weekly_sessions_goal ?? 4));

  const trend = weightTrend(measurements);
  const age = ageFromBirthDate(profile?.birth_date);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisis une image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (5 Mo max)."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      { toast.error("Envoi de la photo impossible."); return; }
    }
    const old = profile?.avatar_url;
    const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    if (!error && old && !old.startsWith("http")) await supabase.storage.from("avatars").remove([old]);
    setUploading(false);
    if (error) { toast.error("Mise à jour impossible."); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Photo de profil mise à jour.");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const h = parseNum(height);
    const s = Number(sessions);
    if (username.trim().length < 2) return setError("Le pseudonyme doit contenir au moins 2 caractères.");
    if (h !== null && (Number.isNaN(h) || h < 100 || h > 250)) return setError("Taille : entre 100 et 250 cm.");
    if (!(s >= 1 && s <= 14)) return setError("Séances par semaine : entre 1 et 14.");
    const a = ageFromBirthDate(birthDate);
    if (birthDate && (a === null || a < 13 || a > 110)) return setError("Date de naissance invalide.");
    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        birth_date: birthDate || null,
        sex: sex || null,
        height_cm: h,
        main_goal: goal || null,
        activity_level: activity || null,
        weekly_sessions_goal: s,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return setError("Enregistrement impossible. Réessaie.");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Profil enregistré.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Compte"
        title="Profil"
        actions={
          <Button variant="outline" asChild>
            <Link to="/parametres"><Settings /> Paramètres</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel>
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <UserAvatar className="h-28 w-28 text-2xl" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-glow"
                aria-label="Changer la photo de profil"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
            </div>
            <p className="mt-5 font-display text-3xl font-bold uppercase">{profile?.username}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {uploading && <p className="mt-2 text-xs text-muted-foreground">Envoi de la photo…</p>}
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-5 text-center">
            <div>
              <dt className="eyebrow text-[0.62rem]">Poids</dt>
              <dd className="font-display text-xl font-bold">{trend.current != null ? `${trend.current} kg` : "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.62rem]">Taille</dt>
              <dd className="font-display text-xl font-bold">{profile?.height_cm ? `${profile.height_cm} cm` : "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.62rem]">Âge</dt>
              <dd className="font-display text-xl font-bold">{age != null ? `${age} ans` : "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Le poids se met à jour depuis le{" "}
            <Link to="/physique" className="text-foreground underline underline-offset-4">suivi physique</Link>.
          </p>
        </Panel>

        <Panel title="Informations">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-username">Pseudonyme</Label>
                <Input id="p-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email">Adresse e-mail</Label>
                <Input id="p-email" value={user.email ?? ""} disabled className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-birth">Date de naissance <span className="text-muted-foreground">(facultatif)</span></Label>
                <Input id="p-birth" type="date" max={toISODate()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Sexe</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Non précisé" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SEX_LABELS) as [Sex, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-height">Taille (cm)</Label>
                <Input id="p-height" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-sessions">Objectif de séances / semaine</Label>
                <Input id="p-sessions" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/[^\d]/g, ""))} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Objectif principal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(MAIN_GOAL_LABELS) as [MainGoal, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Niveau d'activité</Label>
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
