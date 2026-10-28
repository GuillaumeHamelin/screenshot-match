import { useSuspenseQuery } from "@tanstack/react-query";
import { Beef, Droplets, Flame, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, StatCard } from "@/components/app/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  lastDates,
  nutritionAverages,
  percentOf,
  sumMacros,
  type DayNutrition,
} from "@/lib/fitness";
import { nutritionHistoryQuery, type Profile } from "@/lib/queries";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" });
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};

const PERIODS = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "14", label: "14 jours", days: 14 },
  { key: "30", label: "30 jours", days: 30 },
] as const;

export function NutritionHistory({ userId, profile }: { userId: string; profile: Profile }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("7");
  const days = PERIODS.find((p) => p.key === period)!.days;
  const dates = useMemo(() => lastDates(days), [days]);
  const { data } = useSuspenseQuery(
    nutritionHistoryQuery(userId, dates[0]!, dates[dates.length - 1]!),
  );

  const rows: DayNutrition[] = useMemo(
    () =>
      dates.map((date) => {
        const items = data.meals.filter((m) => m.eaten_on === date).flatMap((m) => m.meal_items);
        const t = sumMacros(items);
        const waterMl = data.water
          .filter((w) => w.drank_on === date)
          .reduce((s, w) => s + w.amount_ml, 0);
        return { date, items: items.length, ...t, waterMl };
      }),
    [dates, data],
  );
  const avg = nutritionAverages(rows);
  const chart = rows.map((r) => {
    const [y, m, d] = r.date.split("-").map(Number);
    return { ...r, label: dayLabel.format(new Date(y!, m! - 1, d!)) };
  });
  const sub = (n: number, what: string) =>
    n ? `Moyenne sur ${n} jour${n > 1 ? "s" : ""} ${what}` : "Aucune donnée sur la période";

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
        <TabsList>
          {PERIODS.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={Flame}
          label="Calories / jour"
          value={avg.foodDays ? nf.format(avg.calories) : "—"}
          unit="kcal"
          sub={sub(avg.foodDays, "renseignés")}
          progress={avg.foodDays ? percentOf(avg.calories, profile.calorie_goal) : undefined}
        />
        <StatCard
          icon={Beef}
          label="Protéines / jour"
          value={avg.foodDays ? nf.format(avg.protein) : "—"}
          unit="g"
          sub={`Objectif ${profile.protein_goal} g`}
          progress={avg.foodDays ? percentOf(avg.protein, profile.protein_goal) : undefined}
        />
        <StatCard
          icon={Wheat}
          label="Glucides / jour"
          value={avg.foodDays ? nf.format(avg.carbs) : "—"}
          unit="g"
          sub={`Objectif ${profile.carbs_goal} g`}
          progress={avg.foodDays ? percentOf(avg.carbs, profile.carbs_goal) : undefined}
        />
        <StatCard
          icon={Flame}
          label="Lipides / jour"
          value={avg.foodDays ? nf.format(avg.fat) : "—"}
          unit="g"
          sub={`Objectif ${profile.fat_goal} g`}
          progress={avg.foodDays ? percentOf(avg.fat, profile.fat_goal) : undefined}
        />
        <StatCard
          icon={Droplets}
          label="Eau / jour"
          value={avg.waterDays ? nf.format(avg.waterMl) : "—"}
          unit="ml"
          sub={sub(avg.waterDays, "avec de l'eau")}
          progress={avg.waterDays ? percentOf(avg.waterMl, profile.water_goal_ml) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Calories par jour" icon={Flame}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (max: number) => Math.ceil(Math.max(max, profile.calorie_goal) * 1.1)]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-accent)" }}
                  formatter={(v: number) => [`${nf.format(v)} kcal`, "Calories"]}
                />
                <ReferenceLine
                  y={profile.calorie_goal}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <Bar
                  dataKey="calories"
                  fill="var(--color-chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pointillés : ton objectif de {nf.format(profile.calorie_goal)} kcal.
          </p>
        </Panel>
        <Panel title="Eau par jour" icon={Droplets}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (max: number) => Math.ceil(Math.max(max, profile.water_goal_ml) * 1.1)]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-accent)" }}
                  formatter={(v: number) => [`${nf.format(v)} ml`, "Eau"]}
                />
                <ReferenceLine
                  y={profile.water_goal_ml}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <Bar
                  dataKey="waterMl"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pointillés : ton objectif de {nf.format(profile.water_goal_ml)} ml.
          </p>
        </Panel>
      </div>
    </div>
  );
}
