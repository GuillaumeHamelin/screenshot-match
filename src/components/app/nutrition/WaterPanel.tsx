import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, GlassWater, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Meter, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { percentOf } from "@/lib/fitness";
import { addWater, deleteWater, invalidateNutrition } from "@/lib/nutrition";
import type { NutritionDay } from "@/lib/queries";

const nf = new Intl.NumberFormat("fr-FR");
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function WaterPanel({ date, entries, goalMl }: { date: string; entries: NutritionDay["water"]; goalMl: number }) {
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const total = entries.reduce((s, e) => s + e.amount_ml, 0);
  const remaining = Math.max(0, goalMl - total);

  const add = useMutation({
    mutationFn: (ml: number) => addWater(date, ml),
    onSuccess: (_d, ml) => {
      invalidateNutrition(qc);
      toast.success(`+${nf.format(ml)} ml d'eau.`);
      setCustom("");
    },
    onError: () => toast.error("Impossible d'enregistrer."),
  });
  const remove = useMutation({
    mutationFn: deleteWater,
    onSuccess: () => invalidateNutrition(qc),
    onError: () => toast.error("Impossible de supprimer."),
  });

  return (
    <Panel title="Hydratation" icon={Droplets}>
      <p className="font-display text-5xl font-bold leading-none">
        {nf.format(total)}
        <span className="ml-1 text-lg font-semibold text-muted-foreground">/ {nf.format(goalMl)} ml</span>
      </p>
      <Meter value={percentOf(total, goalMl)} className="mt-4 h-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {remaining > 0 ? `Encore ${nf.format(remaining)} ml pour atteindre ton objectif.` : "Objectif atteint."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {[250, 500].map((ml) => (
          <Button key={ml} variant="secondary" className="h-12 text-base" disabled={add.isPending} onClick={() => add.mutate(ml)}>
            <GlassWater /> +{ml} ml
          </Button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const ml = Number(custom);
          if (!(ml >= 10 && ml <= 5000)) {
          toast.error("Quantité : entre 10 et 5000 ml.");
          return;
        }
          add.mutate(Math.round(ml));
        }}
      >
        <Input
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Autre quantité (ml)"
          className="h-11"
          aria-label="Quantité d'eau personnalisée en ml"
        />
        <Button type="submit" variant="outline" className="h-11" disabled={add.isPending || !custom}>
          <Plus /> Ajouter
        </Button>
      </form>

      {entries.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-border pt-4">
          {[...entries].reverse().map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{time.format(new Date(e.created_at))}</span>
              <span className="flex items-center gap-2">
                {nf.format(e.amount_ml)} ml
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`Supprimer ${e.amount_ml} ml`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(e.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
