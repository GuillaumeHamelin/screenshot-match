import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  Apple,
  CalendarClock,
  ClipboardPlus,
  Droplets,
  Dumbbell,
  Flame,
  Play,
  Scale,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Weight,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MeasurementDialog } from "@/components/app/MeasurementDialog";
import { EmptyState, Meter, PageHeader, Panel, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  formatDuration,
  percentOf,
  startOfWeek,
  sumMacros,
  toISODate,
  weightTrend,
} from "@/lib/fitness";
import { dashboardQuery, measurementsQuery, profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FitTracker" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dashboardQuery(context.user.id, toISODate())),
      context.queryClient.ensureQueryData(measurementsQuery(context.user.id)),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
    ]),
  component: Dashboard,
});

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};

const RECORD_LABEL: Record<string, string> = {
  max_weight: "Charge max",
  est_1rm: "1RM estimé",
  max_reps: "Répétitions max",
  max_volume: "Volume max",
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const today = toISODate();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: dash } = useSuspenseQuery(dashboardQuery(user.id, today));
  const { data: measurements } = useSuspenseQuery(measurementsQuery(user.id));

  const macros = sumMacros(dash.mealItems);
  const trend = weightTrend(measurements);
  const goals = {
    calories: profile?.calorie_goal ?? 0,
    protein: profile?.protein_goal ?? 0,
    carbs: profile?.carbs_goal ?? 0,
    fat: profile?.fat_goal ?? 0,
    water: profile?.water_goal_ml ?? 0,
    sessions: profile?.weekly_sessions_goal ?? 0,
  };

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const thisWeek = dash.sessions.filter((s) => s.started_at && new Date(s.started_at) >= weekStart);
  const weekDuration = thisWeek.reduce((s, x) => s + (x.duration_seconds ?? 0), 0);
  const weekVolume = thisWeek.reduce((s, x) => s + Number(x.total_volume_kg ?? 0), 0);

  const weightData = useMemo(
    () =>
      measurements
        .filter((m) => m.weight_kg != null)
        .slice(0, 60)
        .reverse()
        .map((m) => ({
          date: new Date(m.measured_on).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          poids: Number(m.weight_kg),
        })),
    [measurements],
  );

  const weekly = useMemo(() => {
    const buckets: { label: string; start: Date; volume: number; seances: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(weekStart);
      start.setDate(start.getDate() - i * 7);
      buckets.push({
        label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        start,
        volume: 0,
        seances: 0,
      });
    }
    for (const s of dash.sessions) {
      if (!s.started_at) continue;
      const d = new Date(s.started_at);
      const b = [...buckets].reverse().find((x) => d >= x.start);
      if (b) {
        b.volume += Number(s.total_volume_kg ?? 0);
        b.seances += 1;
      }
    }
    return buckets;
  }, [dash.sessions, weekStart]);
  const hasSessions = dash.sessions.length > 0;

  const macroPie = [
    { name: "Protéines", value: Math.round(macros.protein * 4) },
    { name: "Glucides", value: Math.round(macros.carbs * 4) },
    { name: "Lipides", value: Math.round(macros.fat * 9) },
  ];
  const macroColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

  const hello = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        title={`${hello}, ${profile?.username ?? "athlète"}`}
        description="Ton centre de contrôle du jour."
      />

      {/* Quick actions */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <QuickAction to="/entrainements" icon={Play} label="Démarrer une séance" primary />
        <QuickAction to="/nutrition" icon={Apple} label="Ajouter un repas" />
        <MeasurementDialog
          mode="weight"
          trigger={
            <button className="panel flex h-full flex-col items-start gap-3 p-4 text-left transition-all hover:border-foreground/30 hover:shadow-glow">
              <Scale className="h-5 w-5" />
              <span className="font-display text-sm font-semibold uppercase tracking-wider">Enregistrer mon poids</span>
            </button>
          }
        />
        <QuickAction to="/performances" icon={TrendingUp} label="Mes performances" />
        <QuickAction to="/programmes" icon={ClipboardPlus} label="Créer un programme" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Weight}
          label="Poids actuel"
          value={trend.current != null ? nf.format(trend.current) : "—"}
          unit={trend.current != null ? "kg" : undefined}
          sub={
            trend.delta != null ? (
              <span className="inline-flex items-center gap-1">
                {trend.delta <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {trend.delta > 0 ? "+" : ""}
                {nf.format(trend.delta)} kg depuis la dernière pesée
              </span>
            ) : trend.current != null ? (
              "Première pesée enregistrée"
            ) : (
              "Aucune pesée"
            )
          }
        />
        <StatCard
          icon={Flame}
          label="Calories du jour"
          value={nf.format(macros.calories)}
          unit={`/ ${nf.format(goals.calories)} kcal`}
          sub={`${nf.format(Math.max(0, goals.calories - macros.calories))} kcal restantes`}
          progress={percentOf(macros.calories, goals.calories)}
        />
        <StatCard
          icon={Activity}
          label="Séances cette semaine"
          value={thisWeek.length}
          unit={`/ ${goals.sessions}`}
          sub={`${formatDuration(weekDuration)} d'entraînement`}
          progress={percentOf(thisWeek.length, goals.sessions)}
        />
        <StatCard
          icon={Dumbbell}
          label="Volume semaine"
          value={nf.format(weekVolume)}
          unit="kg"
          sub="Charge × répétitions"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Macros */}
        <Panel title="Macronutriments du jour" icon={Apple}>
          <div className="space-y-4">
            <MacroRow label="Protéines" value={macros.protein} goal={goals.protein} />
            <MacroRow label="Glucides" value={macros.carbs} goal={goals.carbs} />
            <MacroRow label="Lipides" value={macros.fat} goal={goals.fat} />
            <MacroRow label="Hydratation" value={dash.waterMl} goal={goals.water} unit="ml" icon={Droplets} />
          </div>
          {macros.calories > 0 ? (
            <div className="mt-5 h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={macroPie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} stroke="var(--color-card)" strokeWidth={3}>
                    {macroPie.map((_, i) => <Cell key={i} fill={macroColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} kcal`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              className="mt-5 py-6"
              icon={Apple}
              title="Rien mangé aujourd'hui"
              text="Ajoute ton premier repas pour voir la répartition."
            />
          )}
        </Panel>

        {/* Weight chart */}
        <Panel
          title="Évolution du poids"
          icon={Scale}
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/physique">Détails</Link>
            </Button>
          }
        >
          {weightData.length >= 2 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={weightData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${nf.format(v)} kg`} />
                  <Area type="monotone" dataKey="poids" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#wfill)" dot={{ r: 2, fill: "var(--color-chart-1)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Scale}
              title={weightData.length === 1 ? "Une seule pesée" : "Aucune pesée"}
              text="Enregistre au moins deux pesées pour voir ta courbe."
              action={<MeasurementDialog mode="weight" trigger={<Button size="sm">Enregistrer mon poids</Button>} />}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Volume par semaine" icon={Dumbbell} className="lg:col-span-2">
          {hasSessions ? (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} formatter={(v: number) => `${nf.format(v)} kg`} />
                  <Bar dataKey="volume" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="Aucune séance terminée"
              text="Ton volume hebdomadaire et ta fréquence d'entraînement apparaîtront ici."
              action={
                <Button size="sm" asChild>
                  <Link to="/entrainements">Démarrer une séance</Link>
                </Button>
              }
            />
          )}
        </Panel>

        <div className="grid gap-4">
          <Panel title="Prochaine séance" icon={CalendarClock}>
            {dash.nextSession ? (
              <div>
                <p className="font-display text-2xl font-bold uppercase">{dash.nextSession.name}</p>
                <p className="text-sm text-muted-foreground">
                  {dash.nextSession.scheduled_date &&
                    new Date(dash.nextSession.scheduled_date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune séance programmée.</p>
            )}
          </Panel>
          <Panel title="Fréquence" icon={Timer}>
            {hasSessions ? (
              <div className="h-24">
                <ResponsiveContainer>
                  <BarChart data={weekly}>
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} formatter={(v: number) => `${v} séance(s)`} />
                    <Bar dataKey="seances" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore de données sur 8 semaines.</p>
            )}
          </Panel>
          <Panel title="Derniers records" icon={Trophy}>
            {dash.records.length > 0 ? (
              <ul className="space-y-2.5">
                {dash.records.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">
                      {r.exercises?.name}
                      <span className="block text-xs text-muted-foreground">{RECORD_LABEL[r.record_type]}</span>
                    </span>
                    <span className="font-display text-lg font-bold">{nf.format(Number(r.value))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Tes records personnels s'afficheront ici.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: "/entrainements" | "/nutrition" | "/performances" | "/programmes";
  icon: typeof Play;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "flex flex-col items-start gap-3 rounded-xl bg-primary p-4 text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-glow-strong"
          : "panel flex flex-col items-start gap-3 p-4 transition-all hover:border-foreground/30 hover:shadow-glow"
      }
    >
      <Icon className="h-5 w-5" />
      <span className="font-display text-sm font-semibold uppercase tracking-wider">{label}</span>
    </Link>
  );
}

function MacroRow({
  label,
  value,
  goal,
  unit = "g",
  icon: Icon,
}: {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  icon?: typeof Droplets;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
        <span>
          <span className="font-semibold">{nf.format(value)}</span>
          <span className="text-muted-foreground"> / {nf.format(goal)} {unit}</span>
        </span>
      </div>
      <Meter value={percentOf(value, goal)} />
    </div>
  );
}
