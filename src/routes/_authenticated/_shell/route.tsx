import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell")({
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery(context.user.id));
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
  },
  component: AppShell,
});
