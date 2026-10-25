import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { ActiveSession } from "@/components/app/workout/ActiveSession";
import { SessionSummary } from "@/components/app/workout/SessionSummary";
import { EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell/entrainements/$sessionId")({
  head: () => ({ meta: [{ title: "Séance — FitTracker" }] }),
  loader: async ({ context, params }) => {
    const s = await context.queryClient.ensureQueryData(sessionQuery(params.sessionId));
    if (!s) throw notFound();
  },
  notFoundComponent: () => (
    <EmptyState
      icon={Dumbbell}
      title="Séance introuvable"
      text="Elle a peut-être été supprimée."
      action={<Button asChild><Link to="/entrainements">Mes entraînements</Link></Button>}
    />
  ),
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { data } = useSuspenseQuery(sessionQuery(sessionId));
  if (!data) return null;
  return data.status === "in_progress" ? <ActiveSession session={data} /> : <SessionSummary session={data} />;
}
