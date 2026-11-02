import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Camera, Columns2, ImagePlus, Lock, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState, Panel } from "@/components/app/ui";
import { ConfirmDialog } from "@/components/app/workout/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseISODate, toISODate } from "@/lib/fitness";
import { photosQuery, type ProgressPhoto } from "@/lib/queries";
import { deleteProgressPhoto, invalidateTracking, PHOTO_POSES, poseLabel, uploadProgressPhoto } from "@/lib/tracking";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fmt = (iso: string) => dateFmt.format(parseISODate(iso));

export function ProgressPhotos({ userId }: { userId: string }) {
  const { data: photos } = useSuspenseQuery(photosQuery(userId));
  const qc = useQueryClient();
  const [pose, setPose] = useState<string>("all");
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [mode, setMode] = useState<"side" | "slider">("side");

  const pool = useMemo(() => (pose === "all" ? photos : photos.filter((p) => p.pose === pose)), [photos, pose]);
  // photos are newest first: default compare = oldest vs newest of the filtered set
  useEffect(() => {
    setBeforeId(pool.length >= 2 ? pool[pool.length - 1]!.id : null);
    setAfterId(pool.length >= 2 ? pool[0]!.id : null);
  }, [pool]);

  const before = photos.find((p) => p.id === beforeId) ?? null;
  const after = photos.find((p) => p.id === afterId) ?? null;
  const gapDays = before && after ? Math.round((parseISODate(after.taken_on).getTime() - parseISODate(before.taken_on).getTime()) / 86400000) : null;

  const remove = useMutation({
    mutationFn: (p: ProgressPhoto) => deleteProgressPhoto(p),
    onSuccess: () => { invalidateTracking(qc); toast.success("Photo supprimée."); },
    onError: () => toast.error("Suppression impossible."),
  });

  const poses = PHOTO_POSES.filter((p) => photos.some((x) => x.pose === p.key));

  return (
    <div className="space-y-4">
      <Panel
        title="Avant / après"
        icon={Columns2}
        action={<PhotoUploadDialog userId={userId} />}
      >
        <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Tes photos sont privées : toi seul peux les voir. La position GPS éventuelle est retirée à l'envoi.
        </p>
        {photos.length < 2 ? (
          <EmptyState
            icon={Camera}
            title={photos.length === 0 ? "Aucune photo" : "Encore une photo"}
            text="Ajoute au moins deux photos (même pose, même lumière) pour comparer ton évolution."
          />
        ) : (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-[auto_1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label>Pose</Label>
                <Select value={pose} onValueChange={setPose}>
                  <SelectTrigger className="md:w-36" aria-label="Pose"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {poses.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <PhotoPicker label="Avant" value={beforeId} onChange={setBeforeId} photos={pool} />
              <PhotoPicker label="Après" value={afterId} onChange={setAfterId} photos={pool} />
              <div className="flex gap-1 rounded-lg border border-border p-1">
                <Button size="sm" variant={mode === "side" ? "default" : "ghost"} onClick={() => setMode("side")}><Columns2 /> Côte à côte</Button>
                <Button size="sm" variant={mode === "slider" ? "default" : "ghost"} onClick={() => setMode("slider")}><SlidersHorizontal /> Curseur</Button>
              </div>
            </div>
            {before && after ? (
              <>
                {mode === "side" ? (
                  <div className="grid grid-cols-2 gap-2 md:gap-4">
                    <Figure photo={before} tag="Avant" />
                    <Figure photo={after} tag="Après" />
                  </div>
                ) : (
                  <CompareSlider before={before} after={after} />
                )}
                {gapDays != null && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    {gapDays === 0 ? "Même jour" : `${Math.abs(gapDays)} jours d'écart`} · {fmt(before.taken_on)} → {fmt(after.taken_on)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Il faut au moins deux photos avec cette pose.</p>
            )}
          </>
        )}
      </Panel>

      {photos.length > 0 && (
        <Panel title="Toutes mes photos" icon={Camera}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p) => (
              <div key={p.id} className={cn("overflow-hidden rounded-lg border border-border bg-background/40", (p.id === beforeId || p.id === afterId) && "border-foreground/50")}>
                <div className="aspect-[3/4] bg-muted">
                  {p.url ? <img src={p.url} alt={`Photo du ${fmt(p.taken_on)}, ${poseLabel(p.pose)}`} loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium">{fmt(p.taken_on)}</p>
                  <p className="text-xs text-muted-foreground">{poseLabel(p.pose)}{p.notes ? ` · ${p.notes}` : ""}</p>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant={p.id === beforeId ? "default" : "outline"} className="h-7 flex-1 px-2 text-xs" onClick={() => setBeforeId(p.id)}>Avant</Button>
                    <Button size="sm" variant={p.id === afterId ? "default" : "outline"} className="h-7 flex-1 px-2 text-xs" onClick={() => setAfterId(p.id)}>Après</Button>
                    <ConfirmDialog
                      title="Supprimer la photo ?"
                      description="Elle sera définitivement effacée."
                      confirmLabel="Supprimer"
                      onConfirm={() => remove.mutate(p)}
                      trigger={<Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Supprimer la photo"><Trash2 /></Button>}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function PhotoPicker({ label, value, onChange, photos }: { label: string; value: string | null; onChange: (id: string) => void; photos: ProgressPhoto[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger aria-label={`Photo ${label.toLowerCase()}`}><SelectValue placeholder="Choisir" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {photos.map((p) => <SelectItem key={p.id} value={p.id}>{fmt(p.taken_on)} · {poseLabel(p.pose)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Figure({ photo, tag }: { photo: ProgressPhoto; tag: string }) {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <div className="aspect-[3/4]">
        {photo.url && <img src={photo.url} alt={`${tag} : ${fmt(photo.taken_on)}`} className="h-full w-full object-cover" />}
      </div>
      <figcaption className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
        {tag} · {fmt(photo.taken_on)}
      </figcaption>
    </figure>
  );
}

function CompareSlider({ before, after }: { before: ProgressPhoto; after: ProgressPhoto }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="mx-auto max-w-md">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted select-none">
        {after.url && <img src={after.url} alt={`Après : ${fmt(after.taken_on)}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
        {before.url && (
          <img
            src={before.url}
            alt={`Avant : ${fmt(before.taken_on)}`}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            draggable={false}
          />
        )}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground shadow-glow" style={{ left: `${pos}%` }} />
        <span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 text-xs font-semibold uppercase tracking-wider">Avant</span>
        <span className="absolute right-2 top-2 rounded bg-background/80 px-2 py-1 text-xs font-semibold uppercase tracking-wider">Après</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Curseur avant / après"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
    </div>
  );
}

function PhotoUploadDialog({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(toISODate());
  const [pose, setPose] = useState("front");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = useMutation({
    mutationFn: () => uploadProgressPhoto({ userId, file: file!, takenOn: date, pose, notes: notes.trim() || null }),
    onSuccess: () => {
      invalidateTracking(qc);
      toast.success("Photo ajoutée.");
      setOpen(false);
      setFile(null);
      setNotes("");
      setDate(toISODate());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Envoi impossible."),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Choisis une photo."); return; }
    if (!date || date > toISODate()) { toast.error("La date ne peut pas être dans le futur."); return; }
    upload.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><ImagePlus /> Ajouter une photo</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Nouvelle photo</DialogTitle>
          <DialogDescription>Même pose, même lumière, même distance : c'est ce qui rend la comparaison parlante.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background/40 text-sm text-muted-foreground hover:border-foreground/40">
            {preview ? (
              <img src={preview} alt="Aperçu" className="max-h-72 w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 py-10"><Camera className="h-6 w-6" /> Choisir ou prendre une photo</span>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Fichier photo" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ph-date">Date</Label>
              <Input id="ph-date" type="date" value={date} max={toISODate()} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Pose</Label>
              <Select value={pose} onValueChange={setPose}>
                <SelectTrigger aria-label="Pose de la photo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHOTO_POSES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph-notes">Note</Label>
            <Textarea id="ph-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} placeholder="Ex. : à jeun, le matin" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!file || upload.isPending}>{upload.isPending ? "Envoi…" : "Enregistrer la photo"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
