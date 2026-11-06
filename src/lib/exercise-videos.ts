// AI-generated demo clips for library exercises, keyed by exercise name. Exercises without a clip show a placeholder.
import squat from "@/assets/exercise-videos/squat.mp4.asset.json";

const VIDEOS: Record<string, string> = {
  Squat: squat.url,
};

export function exerciseVideoUrl(name: string | null | undefined): string | null {
  return name ? (VIDEOS[name] ?? null) : null;
}
