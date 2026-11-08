import { createFileRoute, redirect } from "@tanstack/react-router";
import { CoachAvatar } from "@/components/app/coach/CoachAvatar";
import { COACH_STARTERS } from "@/components/app/coach/CoachChat";
import { Button } from "@/components/ui/button";
import { coachThreadsQuery } from "@/lib/queries";
import { useNewThread } from "./coach";

export const Route = createFileRoute("/_authenticated/_shell/coach/")({
  beforeLoad: async ({ context }) => {
    const threads = await context.queryClient.ensureQueryData(coachThreadsQuery(context.user.id));
    if (threads[0]) throw redirect({ to: "/coach/$threadId", params: { threadId: threads[0].id }, replace: true });
  },
  component: CoachStart,
});

function CoachStart() {
  const { start, busy } = useNewThread();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <CoachAvatar className="h-20 w-20 rounded-xl" />
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Ton coach IA</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Un plan d'entraînement et des repas adaptés à ton objectif, à ton niveau et à tes autres sports.
        </p>
      </div>
      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {COACH_STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => start(s)}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/40"
          >
            {s}
          </button>
        ))}
      </div>
      <Button onClick={() => start()} disabled={busy}>Commencer une discussion</Button>
    </div>
  );
}
