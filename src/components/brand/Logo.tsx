import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={cn("h-8 w-8", className)} aria-hidden="true">
      <path
        d="M20 2 L37 11.5 L37 32.5 L20 42 L3 32.5 L3 11.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        className="drop-shadow-[0_0_6px_currentColor]"
      />
      <path d="M11 22 H29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13 17 V27 M27 17 V27" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M9.5 19.5 V24.5 M30.5 19.5 V24.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-xl font-bold uppercase tracking-[0.18em]">
          Fit<span className="text-muted-foreground">Tracker</span>
        </span>
      )}
    </span>
  );
}
