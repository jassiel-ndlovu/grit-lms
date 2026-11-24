import { cn } from "@/lib/utils";

/**
 * How far along something is. One look for every bar in the app: give it a
 * name (`label`) and say the numbers in words nearby. Leave `value` out when
 * the amount is unknown.
 */
export function ProgressBar({ value, max = 100, label, valueText, tone, className }: {
  value?: number;
  max?: number;
  label: string;
  /** Read out instead of a percentage, e.g. "7 of 23 marked". */
  valueText?: string;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const known = typeof value === "number" && Number.isFinite(value);
  const pct = known ? (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0) : null;
  const fill = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-destructive" }[tone ?? "primary"];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct === null ? undefined : Math.round(pct)}
      aria-valuetext={valueText}
      data-slot="progress-bar"
      className={cn("bg-foreground/10 h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full", fill, pct === null ? "w-1/3 animate-pulse" : "transition-[width] duration-300 motion-reduce:transition-none")}
        style={pct === null ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}
