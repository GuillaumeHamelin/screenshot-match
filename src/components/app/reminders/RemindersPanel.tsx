import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Bell, BellOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { WeekdayChips } from "@/components/app/workout/WeekdayChips";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { profileQuery, remindersQuery, type Reminder } from "@/lib/queries";
import {
  deleteReminder,
  invalidateTracking,
  REMINDER_KINDS,
  saveReminder,
  setNotificationsEnabled,
  toggleReminder,
  type ReminderKind,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/lib/workouts";

type Perm = NotificationPermission | "unsupported";

export function RemindersPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery(userId));
  const { data: reminders } = useSuspenseQuery(remindersQuery(userId));
  const [perm, setPerm] = useState<Perm>("default");
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);
  const enabled = profile?.notifications_enabled ?? false;

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const master = useMutation({
    mutationFn: (v: boolean) => setNotificationsEnabled(userId, v),
    onSuccess: (_, v) => { invalidateTracking(qc); toast.success(v ? "Rappels activés." : "Rappels désactivés."); },
    onError: () => toast.error("Modification impossible."),
  });
  const toggle = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => toggleReminder(id, v),
    onSuccess: () => invalidateTracking(qc),
    onError: () => toast.error("Modification impossible."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => { invalidateTracking(qc); toast.success("Rappel supprimé."); },
    onError: () => toast.error("Suppression impossible."),
  });

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") toast.success("Notifications autorisées sur cet appareil.");
    else toast.info("Sans autorisation, les rappels s'affichent seulement dans l'appli.");
  }

  return (
    <Panel
      title="Rappels"
      icon={Bell}
      className="xl:col-span-2"
      action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Ajouter un rappel</Button>}
    >
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Switch id="rem-master" checked={enabled} onCheckedChange={(v) => master.mutate(v)} disabled={master.isPending} aria-label="Activer les rappels" />
          <div>
            <Label htmlFor="rem-master" className="text-sm font-semibold">Activer les rappels</Label>
            <p className="text-xs text-muted-foreground">
              Ils s'affichent pendant que FitTracker est ouvert sur ton appareil, même dans un onglet en arrière-plan.
              Un rappel d'hydratation est ignoré si ton objectif d'eau est déjà atteint, un rappel de pesée si tu t'es déjà pesé.
            </p>
          </div>
        </div>
        {perm === "unsupported" ? (
          <p className="text-xs text-muted-foreground">Ce navigateur ne gère pas les notifications : rappels dans l'appli uniquement.</p>
        ) : perm === "granted" ? (
          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><Bell className="h-3.5 w-3.5" /> Notifications autorisées</p>
        ) : perm === "denied" ? (
          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><BellOff className="h-3.5 w-3.5" /> Notifications bloquées dans ton navigateur</p>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" onClick={askPermission}><Bell /> Autoriser les notifications</Button>
        )}
      </div>

      {reminders.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aucun rappel. Ex. : séance à 18 h les lundis, mercredis et vendredis, pesée le lundi à 7 h 30.</p>
      ) : (
        <ul className={cn("mt-4 divide-y divide-border", !enabled && "opacity-60")}>
          {reminders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <Switch checked={r.enabled} onCheckedChange={(v) => toggle.mutate({ id: r.id, v })} aria-label={`Activer « ${r.label} »`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-display text-base font-bold text-foreground">{r.time_of_day.slice(0, 5)}</span>
                  {REMINDER_KINDS.find((k) => k.key === r.kind)?.label}
                  {r.weekdays.length === 7 ? <span>· Tous les jours</span> : <WeekdayChips days={[...r.weekdays].sort()} />}
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Modifier le rappel" onClick={() => { setEditing(r); setOpen(true); }}><Pencil /></Button>
              <ConfirmDialog
                title="Supprimer le rappel ?"
                confirmLabel="Supprimer"
                onConfirm={() => remove.mutate(r.id)}
                trigger={<Button size="icon" variant="ghost" aria-label="Supprimer le rappel"><Trash2 /></Button>}
              />
            </li>
          ))}
        </ul>
      )}

      <ReminderDialog open={open} onOpenChange={setOpen} reminder={editing} />
    </Panel>
  );
}

function ReminderDialog({ open, onOpenChange, reminder }: { open: boolean; onOpenChange: (o: boolean) => void; reminder: Reminder | null }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ReminderKind>("workout");
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("18:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  useEffect(() => {
    if (!open) return;
    const k = (reminder?.kind as ReminderKind) ?? "workout";
    const preset = REMINDER_KINDS.find((x) => x.key === k)!;
    setKind(k);
    setLabel(reminder?.label ?? preset.defaultLabel);
    setTime(reminder?.time_of_day.slice(0, 5) ?? preset.defaultTime);
    setDays(reminder?.weekdays ?? (k === "workout" ? [1, 3, 5] : [1, 2, 3, 4, 5, 6, 7]));
  }, [open, reminder]);

  const save = useMutation({
    mutationFn: () => saveReminder({ kind, label: label.trim(), time_of_day: time, weekdays: [...days].sort(), enabled: reminder?.enabled ?? true }, reminder?.id),
    onSuccess: () => { invalidateTracking(qc); toast.success(reminder ? "Rappel modifié." : "Rappel ajouté."); onOpenChange(false); },
    onError: () => toast.error("Enregistrement impossible."),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) { toast.error("Écris le texte du rappel."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { toast.error("Choisis une heure."); return; }
    if (days.length === 0) { toast.error("Choisis au moins un jour."); return; }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{reminder ? "Modifier le rappel" : "Nouveau rappel"}</DialogTitle>
          <DialogDescription>Choisis quand tu veux être prévenu.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  if (!v) return;
                  const k = v as ReminderKind;
                  const prev = REMINDER_KINDS.find((x) => x.key === kind)!;
                  const next = REMINDER_KINDS.find((x) => x.key === k)!;
                  setKind(k);
                  if (!label.trim() || label === prev.defaultLabel) setLabel(next.defaultLabel);
                  if (!reminder) setTime(next.defaultTime);
                }}
              >
                <SelectTrigger aria-label="Type de rappel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rem-time">Heure</Label>
              <Input id="rem-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rem-label">Texte</Label>
            <Input id="rem-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Jours</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.n);
                return (
                  <Button
                    key={d.n}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d.n) : [...cur, d.n]))}
                  >
                    {d.short}
                  </Button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{reminder ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
