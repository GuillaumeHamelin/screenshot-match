import coachAvatar from "@/assets/coach-avatar.jpg";
import { cn } from "@/lib/utils";

export function CoachAvatar({ className }: { className?: string }) {
  return (
    <img
      src={coachAvatar}
      alt="Coach"
      width={192}
      height={192}
      className={cn("h-8 w-8 shrink-0 rounded-lg border border-border object-cover", className)}
    />
  );
}
