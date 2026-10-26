import { Minus, Plus, SkipForward, TimerReset } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/fitness";

type RestState = { endsAt: number; total: number; label: string } | null;

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
    o.onended = () => ctx.close();
  } catch {
    // audio not available
  }
}

/** Rest countdown persisted per session so a reload keeps it running. */
export function useRestTimer(sessionId: string) {
  const key = `ft-rest-${sessionId}`;
  const [rest, setRest] = useState<RestState>(null);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw) as RestState;
        if (v && v.endsAt > Date.now()) setRest(v);
        else window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key]);

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);

  const set = useCallback(
    (v: RestState) => {
      setRest(v);
      fired.current = false;
      setNow(Date.now());
      if (v) window.localStorage.setItem(key, JSON.stringify(v));
      else window.localStorage.removeItem(key);
    },
    [key],
  );

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (rest && remaining === 0 && !fired.current) {
      fired.current = true;
      beep();
      navigator.vibrate?.([200, 100, 200]);
      toast.success("Repos terminé, à toi de jouer !");
      set(null);
    }
  }, [rest, remaining, set]);

  return {
    rest,
    remaining,
    start: (seconds: number, label: string) => {
      if (seconds > 0) set({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
    },
    adjust: (delta: number) => {
      if (!rest) return;
      const endsAt = Math.max(Date.now() + 1000, rest.endsAt + delta * 1000);
      set({ ...rest, endsAt, total: Math.max(rest.total + delta, 1) });
    },
    stop: () => set(null),
  };
}

export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.rest || typeof document === "undefined") return null;
  const pct = Math.min(100, (timer.remaining / timer.rest.total) * 100);
  // Portal: the page wrapper is animated (transform), which would trap a fixed element.
  return createPortal(
    <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-6 md:left-auto md:right-6 md:w-[380px] md:px-0">
      <div className="panel overflow-hidden border-foreground/40 shadow-glow-strong" role="timer" aria-live="polite">
        <div className="h-1 bg-muted">
          <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              <TimerReset className="h-3.5 w-3.5" /> Repos
            </p>
            <p className="truncate text-xs text-muted-foreground">{timer.rest.label}</p>
          </div>
          <p className="font-display text-4xl font-bold tabular-nums">{formatClock(timer.remaining)}</p>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => timer.adjust(-15)} aria-label="Retirer 15 secondes"><Minus /></Button>
            <Button size="icon" variant="outline" onClick={() => timer.adjust(15)} aria-label="Ajouter 15 secondes"><Plus /></Button>
            <Button size="icon" onClick={timer.stop} aria-label="Passer le repos"><SkipForward /></Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
