import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Ruler, Scale, Trash2 } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { MeasurementDialog } from "@/components/app/MeasurementDialog";
import { ProgressPhotos } from "@/components/app/physique/ProgressPhotos";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { weightTrend } from "@/lib/fitness";
import { measurementsQuery, photosQuery, type Measurement } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/physique")({
  head: () => ({
    meta: [
      { title: "Suivi physique — FitTracker" },
      { name: "description", content: "Poids, mensurations et photos avant/après privées." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(measurementsQuery(context.user.id)),
      context.queryClient.ensureQueryData(photosQuery(context.user.id)),
    ]),
  component: PhysiquePage,
});

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};

type MetricKey = "weight_kg" | "body_fat_pct" | "muscle_mass_kg" | "waist_cm" | "chest_cm" | "arm_cm" | "thigh_cm" | "calf_cm";
const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Poids", unit: "kg" },
  { key: "body_fat_pct", label: "Masse grasse", unit: "%" },
  { key: "muscle_mass_kg", label: "Masse musculaire", unit: "kg" },
  { key: "waist_cm", label: "Taille", unit: "cm" },
  { key: "chest_cm", label: "Poitrine", unit: "cm" },
  { key: "arm_cm", label: "Bras", unit: "cm" },
  { key: "thigh_cm", label: "Cuisse", unit: "cm" },
  { key: "calf_cm", label: "Mollet", unit: "cm" },
];
const PERIODS = [
  { key: "30", label: "30 j", days: 30 },
  { key: "90", label: "3 mois", days: 90 },
  { key: "180", label: "6 mois", days: 180 },
  { key: "365", label: "1 an", days: 365 },
  { key: "all", label: "Tout", days: Infinity },
] as const;

function latest(ms: Measurement[], key: MetricKey) {
  const m = ms.find((x) => x[key] != null);
  return m ? Number(m[key]) : null;
}

function PhysiquePage() {
  const { user } = Route.useRouteContext();
  const { data: measurements } = useSuspenseQuery(measurementsQuery(user.id));
  const qc = useQueryClient();
  const [metric, setMetric] = useState<MetricKey>("weight_kg");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("90");
  const trend = weightTrend(measurements);

  const chart = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)!.days;
    const cutoff = Number.isFinite(days) ? Date.now() - days * 86400000 : 0;
    return measurements
      .filter((m) => m[metric] != null && new Date(m.measured_on).getTime() >= cutoff)
      .slice()
      .reverse()
      .map((m) => ({
        date: new Date(m.measured_on).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        value: Number(m[metric]),
      }));
  }, [measurements, metric, period]);
  const metricInfo = METRICS.find((m) => m.key === metric)!;

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("body_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Mesure supprimée.");
    },
    onError: () => toast.error("Suppression impossible."),
  });

  return (
    <>
      <PageHeader
        eyebrow="Corps"
        title="Suivi physique"
        description="Poids, composition corporelle, mensurations et photos de progression."
        actions={
          <>
            <MeasurementDialog mode="weight" trigger={<Button variant="outline"><Scale /> Pesée</Button>} />
            <MeasurementDialog mode="full" trigger={<Button><Plus /> Nouvelles mesures</Button>} />
          </>
        }
      />

      <Tabs defaultValue="mesures">
        <TabsList className="mb-6">
          <TabsTrigger value="mesures">Mesures</TabsTrigger>
          <TabsTrigger value="photos">Photos avant / après</TabsTrigger>
        </TabsList>
        <TabsContent value="mesures">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            icon={Scale}
            label="Poids"
            value={trend.current != null ? nf.format(trend.current) : "—"}
            unit={trend.current != null ? "kg" : undefined}
            sub={trend.delta != null ? `${trend.delta > 0 ? "+" : ""}${nf.format(trend.delta)} kg` : undefined}
          />
          {(["body_fat_pct", "muscle_mass_kg", "waist_cm"] as const).map((k) => {
            const v = latest(measurements, k);
            const info = METRICS.find((m) => m.key === k)!;
            return <StatCard key={k} icon={Ruler} label={info.label} value={v != null ? nf.format(v) : "—"} unit={v != null ? info.unit : undefined} />;
          })}
        </div>

        <Panel className="mt-4" title="Évolution">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m) => (
                <Button key={m.key} size="sm" variant={metric === m.key ? "default" : "outline"} onClick={() => setMetric(m.key)}>
                  {m.label}
                </Button>
              ))}
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                {PERIODS.map((p) => <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>
          {chart.length >= 2 ? (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${nf.format(v)} ${metricInfo.unit}`} />
                  <Line type="monotone" dataKey="value" name={metricInfo.label} stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-1)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Ruler} title="Pas assez de données" text={`Au moins deux mesures « ${metricInfo.label} » sur la période sont nécessaires.`} />
          )}
        </Panel>

        <Panel className="mt-4" title="Historique">
          {measurements.length === 0 ? (
            <EmptyState icon={Scale} title="Aucune mesure" text="Commence par enregistrer ton poids." />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Date</th>
                    {METRICS.map((m) => <th key={m.key} className="px-2 py-2 font-medium">{m.label}</th>)}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 50).map((m) => (
                    <tr key={m.id} className="border-b border-border/60 last:border-0">
                      <td className="whitespace-nowrap px-2 py-2.5">{new Date(m.measured_on).toLocaleDateString("fr-FR")}</td>
                      {METRICS.map((k) => (
                        <td key={k.key} className="px-2 py-2.5 text-muted-foreground">
                          {m[k.key] != null ? <span className="text-foreground">{nf.format(Number(m[k.key]))}</span> : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-right">
                        <Button variant="ghost" size="icon" aria-label="Supprimer la mesure" onClick={() => del.mutate(m.id)} disabled={del.isPending}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        </TabsContent>
        <TabsContent value="photos">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement des photos…</p>}>
            <ProgressPhotos userId={user.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}
