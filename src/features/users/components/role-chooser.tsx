"use client";

/**
 * "How will you use Nexa?" for a self sign-up (A's chooseAccountRole,
 * #158): tutor, student or parent, chosen once. A tutor goes on to set up
 * a workspace; a student or parent lands on their dashboard and waits for
 * a tutor to add or link them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Presentation, Users } from "lucide-react";

import { chooseAccountRole } from "@/features/users/choose-role";
import { cn } from "@/lib/utils";

type Role = "TUTOR" | "STUDENT" | "PARENT";

const ROLES: { role: Role; title: string; body: string; icon: typeof Users }[] = [
  {
    role: "TUTOR",
    title: "I teach",
    body: "Run your own classes or your school's. Next, you'll set up a workspace with a free trial.",
    icon: Presentation,
  },
  {
    role: "STUDENT",
    title: "I'm a student",
    body: "Your tutor adds you to their courses using this email address. Share it with them.",
    icon: GraduationCap,
  },
  {
    role: "PARENT",
    title: "I'm a parent or guardian",
    body: "Your child's tutor links your account so you can follow their work and fees.",
    icon: Users,
  },
];

export function RoleChooser() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Role | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(role: Role) {
    setBusy(role);
    setError(null);
    const res = await chooseAccountRole({ role });
    if (!res?.data) {
      setBusy(null);
      setError(
        res?.serverError === "You don't have access to do that."
          ? "Your account type is already set. Reload the page to continue."
          : "That didn't work. Try again.",
      );
      return;
    }
    router.push(res.data.next);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            onClick={() => void choose(r.role)}
            disabled={busy != null}
            aria-busy={busy === r.role}
            className={cn(
              "border-border hover:border-primary focus-visible:ring-ring flex items-start gap-4 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 disabled:opacity-60",
              busy === r.role && "border-primary",
            )}
          >
            <span className="bg-muted text-foreground grid size-10 shrink-0 place-items-center rounded-lg">
              {busy === r.role ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <r.icon aria-hidden className="size-5" />}
            </span>
            <span className="space-y-1">
              <span className="text-foreground block font-semibold">{r.title}</span>
              <span className="text-muted-foreground block text-sm">{r.body}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        You choose this once. Your start page, time zone and theme can be changed any time in Settings.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
