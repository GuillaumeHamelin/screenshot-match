import { WEEKDAYS } from "@/lib/workouts";

export function WeekdayChips({ days }: { days: number[] }) {
  if (!days.length) return null;
  return (
    <span className="flex gap-0.5">
      {WEEKDAYS.filter((d) => days.includes(d.n)).map((d) => (
        <span key={d.n} className="rounded border border-border px-1 py-px text-[10px] uppercase">
          {d.short}
        </span>
      ))}
    </span>
  );
}
