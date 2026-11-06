import { createFileRoute } from "@tanstack/react-router";
import { handleCoachChat } from "@/lib/coach.server";

export const Route = createFileRoute("/api/coach")({
  server: { handlers: { POST: ({ request }) => handleCoachChat(request) } },
});
