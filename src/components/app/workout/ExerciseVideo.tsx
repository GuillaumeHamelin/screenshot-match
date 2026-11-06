import { PlayCircle, VideoOff } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { exerciseVideoUrl } from "@/lib/exercise-videos";
import { cn } from "@/lib/utils";

/** Exercise name that opens its demo clip. */
export function ExerciseVideoButton({
  name,
  description,
  className,
  children,
}: {
  name: string | null | undefined;
  description?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  if (!name) return <>{children}</>;
  const url = exerciseVideoUrl(name);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("group inline-flex max-w-full items-center gap-1.5 text-left hover:underline hover:underline-offset-4", className)}
          aria-label={`Voir la vidéo : ${name}`}
        >
          {children ?? <span className="truncate">{name}</span>}
          <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{name}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {url ? (
          <video
            src={url}
            className="aspect-video w-full rounded-lg border border-border bg-background"
            autoPlay
            loop
            muted
            playsInline
            controls
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background text-center text-sm text-muted-foreground">
            <VideoOff className="h-6 w-6" />
            <p>La vidéo de cet exercice n'est pas encore disponible.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Démonstration animée générée par IA : vérifie toujours ta posture et adapte la charge.</p>
      </DialogContent>
    </Dialog>
  );
}
