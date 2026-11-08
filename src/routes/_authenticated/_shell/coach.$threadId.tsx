import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { CoachChat } from "@/components/app/coach/CoachChat";
import { coachMessagesQuery, coachThreadsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/coach/$threadId")({
  validateSearch: z.object({ ask: z.string().max(500).optional() }),
  loader: async ({ context, params }) => {
    const threads = await context.queryClient.ensureQueryData(coachThreadsQuery(context.user.id));
    if (!threads.some((t) => t.id === params.threadId)) {
      await context.queryClient.invalidateQueries({ queryKey: ["coach-threads"] });
      const fresh = await context.queryClient.fetchQuery(coachThreadsQuery(context.user.id));
      if (!fresh.some((t) => t.id === params.threadId)) throw notFound();
    }
    await context.queryClient.ensureQueryData(coachMessagesQuery(params.threadId));
  },
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">Cette discussion n'existe pas ou a été supprimée.</p>,
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { ask } = Route.useSearch();
  const navigate = useNavigate();
  const { data: rows } = useSuspenseQuery(coachMessagesQuery(threadId));
  // Snapshot once per thread: useChat owns the live transcript after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo<UIMessage[]>(() => rows.map((r) => ({ id: r.message_id, role: r.role as UIMessage["role"], parts: r.parts as UIMessage["parts"] })), [threadId]);
  const clearAsk = useCallback(() => {
    navigate({ to: "/coach/$threadId", params: { threadId }, search: {}, replace: true });
  }, [navigate, threadId]);
  return <CoachChat key={threadId} threadId={threadId} initialMessages={initial} autoSend={initial.length === 0 ? ask : undefined} onAutoSent={clearAsk} />;
}
