import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Exercise } from "@/lib/queries";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/workouts";

export function ExerciseFormDialog({
  trigger,
  exercise,
  onSaved,
}: {
  trigger: ReactNode;
  exercise?: Exercise;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exercise?.name ?? "");
  const [muscle, setMuscle] = useState(exercise?.muscle_group ?? "");
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [tips, setTips] = useState(exercise?.tips ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: name.trim(),
        muscle_group: muscle,
        equipment: equipment || null,
        description: description.trim() || null,
        tips: tips.trim() || null,
      };
      if (exercise) {
        const { error } = await supabase.from("exercises").update(row).eq("id", exercise.id);
        if (error) throw error;
        return exercise.id;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("exercises")
        .insert({ ...row, user_id: u.user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success(exercise ? "Exercice modifié." : "Exercice créé.");
      setOpen(false);
      if (!exercise) {
        setName("");
        setDescription("");
        setTips("");
      }
      onSaved?.(id);
    },
    onError: () => toast.error("Enregistrement impossible."),
  });

  const valid = name.trim().length >= 2 && muscle !== "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {exercise ? "Modifier l'exercice" : "Nouvel exercice"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ex-name">Nom</Label>
            <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Groupe musculaire</Label>
              <Select value={muscle} onValueChange={setMuscle}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUPS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Matériel</Label>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-desc">Description</Label>
            <Textarea id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-tips">Conseils d'exécution</Label>
            <Textarea id="ex-tips" value={tips} onChange={(e) => setTips(e.target.value)} maxLength={600} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || save.isPending}>
              {exercise ? "Enregistrer" : "Créer l'exercice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
