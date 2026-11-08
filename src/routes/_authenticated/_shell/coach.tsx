import { Link, Outlet, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CoachAvatar } from "@/components/app/coach/CoachAvatar";
import { Button } from "@/components/ui/button";
import { createCoachThread, deleteCoachThread, invalidateCoach } from "@/lib/coach-actions";
import { coachThreadsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/coach")({
  head: () => ({
    meta: [
      { title: "Coach IA — FitTracker" },
      { name: "description", content: "Discute avec ton coach IA : programme d'entraînement et repas adaptés à ton objectif et à tes sports." },
      { property: "og:title", content: "Coach IA — FitTracker" },
      { property: "og:description", content: "Un coach IA qui adapte ton entraînement et ton alimentation à ton profil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coachThreadsQuery(context.user.id)),
  component: CoachLayout,
});

export function useNewThread() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function start(ask?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createCoachThread();
      invalidateCoach(qc);
      await navigate({ to: "/coach/$threadId", params: { threadId: id }, search: ask ? { ask } : {} });
    } catch {
      toast.error("Impossible de créer la discussion.");
    } finally {
      setBusy(false);
    }
  }
  return { start, busy };
}

function CoachLayout() {
  const { user } = Route.useRouteContext();
  const { data: threads = [] } = useQuery(coachThreadsQuery(user.id));
  const params = useParams({ strict: false }) as { threadId?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { start, busy } = useNewThread();

  async function remove(id: string) {
    try {
      await deleteCoachThread(id);
      invalidateCoach(qc);
      if (params.threadId === id) navigate({ to: "/coach" });
    } catch {
      toast.error("Suppression impossible.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[480px] gap-6 md:h-[calc(100dvh-5rem)]">
      <aside className="hidden w-64 shrink-0 flex-col md:flex">
        <div className="mb-4 flex items-center gap-3">
          <CoachAvatar className="h-10 w-10" />
          <div>
            <p className="font-display text-xl font-bold uppercase leading-none">Coach IA</p>
            <p className="text-xs text-muted-foreground">Entraînement & nutrition</p>
          </div>
        </div>
        <Button onClick={() => start()} disabled={busy} className="mb-3 w-full">
          <MessageSquarePlus /> Nouvelle discussion
        </Button>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Discussions">
          {threads.length === 0 && <p className="px-2 text-xs text-muted-foreground">Aucune discussion pour l'instant.</p>}
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center rounded-md border border-transparent",
                params.threadId === t.id ? "border-border bg-surface-2" : "hover:bg-surface",
              )}
            >
              <Link to="/coach/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate px-3 py-2 text-sm">
                {t.title}
              </Link>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label={`Supprimer « ${t.title} »`}
                className="mr-1 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </nav>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2 md:hidden">
          <select
            aria-label="Choisir une discussion"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm"
            value={params.threadId ?? ""}
            onChange={(e) => e.target.value && navigate({ to: "/coach/$threadId", params: { threadId: e.target.value } })}
          >
            <option value="">Discussions…</option>
            {threads.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => start()} disabled={busy} aria-label="Nouvelle discussion">
            <MessageSquarePlus />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
