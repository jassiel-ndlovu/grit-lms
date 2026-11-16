import * as React from "react";

import { cn } from "@/lib/utils";
import { scenes, type SceneName } from "@/components/illustrations/generated/registry";

/**
 * EmptyState — what a list or page shows when there is nothing in it yet:
 * an illustration, one line saying what is missing, one line saying what to
 * do, and at most one action. Keep the copy short and specific
 * ("No tests yet", not "Nothing to see here").
 *
 * `illustration` takes any node. From a server component, pass
 * `<Scene name="empty-tests" />`; from a client component, import the
 * generated illustration module directly.
 */
interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  illustration?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Smaller layout for panels and table bodies. */
  compact?: boolean;
}

function EmptyState({ illustration, title, description, action, compact, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-16",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <div className={cn("text-foreground [&_svg]:h-full [&_svg]:w-auto", compact ? "h-24" : "h-36")}>
          {illustration}
        </div>
      ) : null}
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Server component: loads one Open Peeps scene by name (only that module ships). */
async function Scene({ name, title }: { name: SceneName; title?: string }) {
  const { default: Illustration } = await scenes[name]();
  return <Illustration title={title} />;
}

export { EmptyState, Scene };
