import { Link } from "@tanstack/react-router";
import { Construction, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-none md:text-5xl">
          {title}
        </h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title?: string | undefined;
  icon?: LucideIcon | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel p-5 md:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title && <h2 className="eyebrow">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string | undefined;
  sub?: ReactNode | undefined;
  progress?: number | undefined;
}) {
  return (
    <div className="panel group p-4 transition-all duration-300 hover:border-foreground/25 hover:shadow-glow md:p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-[0.68rem]">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none md:text-4xl">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
      {progress != null && <Meter value={progress} className="mt-3" />}
    </div>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-foreground shadow-glow transition-[width] duration-700"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-10 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-lg font-semibold uppercase">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ComingSoon({
  eyebrow,
  title,
  phase,
  intro,
  items,
}: {
  eyebrow: string;
  title: string;
  phase: string;
  intro: string;
  items: string[];
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <div className="panel relative overflow-hidden p-6 md:p-10">
        <div className="led-line absolute inset-x-0 top-0 h-px opacity-60" />
        <div className="flex items-center gap-3">
          <Construction className="h-5 w-5" />
          <span className="rounded border border-border px-2 py-0.5 text-xs uppercase tracking-widest text-muted-foreground">
            {phase}
          </span>
        </div>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{intro}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i} className="rounded-lg border border-border bg-background/50 px-4 py-3 text-sm">
              {i}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/dashboard">Retour au dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/physique">Enregistrer mes mesures</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
