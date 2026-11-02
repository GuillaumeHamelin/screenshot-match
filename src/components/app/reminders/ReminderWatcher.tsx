import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { dueReminders, toISODate } from "@/lib/fitness";
import { dashboardQuery, measurementsQuery, profileQuery, remindersQuery, type Reminder } from "@/lib/queries";

const FIRED_KEY = "ft-reminders-fired";

const TARGET: Record<string, "/calendrier" | "/physique" | "/nutrition" | "/dashboard"> = {
  workout: "/calendrier",
  weigh_in: "/physique",
  photo: "/physique",
  water: "/nutrition",
  meals: "/nutrition",
  custom: "/dashboard",
};

function readFired(today: string): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? "[]") as string[];
    return new Set(raw.filter((k) => k.endsWith(`|${today}`)));
  } catch {
    return new Set();
  }
}

/** Checks reminders every 30 s while the app is open, and shows the due ones once per day. */
export function ReminderWatcher({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: reminders } = useQuery({ ...remindersQuery(userId), refetchInterval: 5 * 60_000 });
  const busy = useRef(false);
  const enabled = Boolean(profile?.notifications_enabled);

  useEffect(() => {
    if (!enabled || !reminders?.length) return;

    async function shouldSkip(r: Reminder, today: string): Promise<boolean> {
      if (r.kind === "water") {
        const dash = await qc.fetchQuery(dashboardQuery(userId, today));
        return (profile?.water_goal_ml ?? 0) > 0 && dash.waterMl >= (profile?.water_goal_ml ?? 0);
      }
      if (r.kind === "weigh_in") {
        const ms = await qc.fetchQuery(measurementsQuery(userId));
        return ms.some((m) => m.measured_on === today && m.weight_kg != null);
      }
      return false;
    }

    async function workoutText(r: Reminder, today: string) {
      if (r.kind !== "workout") return null;
      const dash = await qc.fetchQuery(dashboardQuery(userId, today));
      return dash.nextSession?.scheduled_date === today ? `Prévu aujourd'hui : ${dash.nextSession.name}` : null;
    }

    async function check() {
      if (busy.current) return;
      busy.current = true;
      try {
        const now = new Date();
        const today = toISODate(now);
        const fired = readFired(today);
        const due = dueReminders(reminders ?? [], now, fired);
        for (const r of due) {
          fired.add(`${r.id}|${today}`);
          window.localStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
          if (await shouldSkip(r, today).catch(() => false)) continue;
          const body = (await workoutText(r, today).catch(() => null)) ?? undefined;
          const to = TARGET[r.kind] ?? "/dashboard";
          toast(r.label, {
            description: body,
            duration: 15_000,
            action: { label: "Ouvrir", onClick: () => navigate({ to }) },
          });
          if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification("FitTracker", { body: body ? `${r.label}\n${body}` : r.label, tag: `${r.id}|${today}` });
            n.onclick = () => {
              window.focus();
              navigate({ to });
              n.close();
            };
          }
        }
      } finally {
        busy.current = false;
      }
    }

    void check();
    const t = window.setInterval(check, 30_000);
    return () => window.clearInterval(t);
  }, [enabled, reminders, userId, qc, navigate, profile?.water_goal_ml]);

  return null;
}
