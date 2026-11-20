"use client";

/**
 * The welcome page for a self sign-up (owner decision, A's #158), in two
 * steps:
 *   1. "How will you use Nexa?": tutor, student or parent, chosen once
 *      (A's chooseAccountRole, saved straight away).
 *   2. A few preferences: start page, time zone, theme and, for students
 *      and tutors, course layout (updateOwnPreferences). Skippable; all
 *      of them stay in Settings.
 * Then a tutor goes on to set up a workspace; a student or parent lands
 * on their dashboard and waits for a tutor to add or link them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Presentation, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DashboardTab } from "@/features/shared/enums";
import { updateOwnPreferences } from "@/features/users/actions";
import { chooseAccountRole } from "@/features/users/choose-role";
import { startPageOptions } from "@/features/users/start-page";
import { cn } from "@/lib/utils";

type Role = "TUTOR" | "STUDENT" | "PARENT";
type View = "GRID" | "LIST";

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

const AUTO_ZONE = "__auto";

function allTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Africa/Johannesburg", "UTC"];
  }
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

export function RoleChooser() {
  const [chosen, setChosen] = React.useState<{ role: Role; next: string } | null>(null);
  return chosen ? <PreferencesStep role={chosen.role} next={chosen.next} /> : <RoleStep onChosen={setChosen} />;
}

function RoleStep({ onChosen }: { onChosen: (c: { role: Role; next: string }) => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Role | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(role: Role) {
    setBusy(role);
    setError(null);
    const res = await chooseAccountRole({ role });
    if (!res?.data) {
      setBusy(null);
      if (res?.serverError === "You don't have access to do that.") {
        // Already chosen (another tab, say): carry on to the dashboard.
        router.replace("/dashboard/start");
        router.refresh();
        return;
      }
      setError("That didn't work. Try again.");
      return;
    }
    onChosen(res.data);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-foreground text-base font-semibold">How will you use Nexa?</h2>
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
      <p className="text-muted-foreground text-xs">You choose this once. Next, a few preferences.</p>
      <ErrorText error={error} />
    </div>
  );
}

function Row({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p id={id} className="text-foreground text-sm font-medium">
          {title}
        </p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function PreferencesStep({ role, next }: { role: Role; next: string }) {
  const router = useRouter();
  const options = startPageOptions(role);
  const zones = React.useMemo(allTimeZones, []);
  const [deviceZone, setDeviceZone] = React.useState<string | null>(null);
  React.useEffect(() => setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null), []);

  const [tab, setTab] = React.useState<DashboardTab>(options[0]?.value ?? "COURSES");
  const [zone, setZone] = React.useState<string>(AUTO_ZONE);
  const [dark, setDark] = React.useState(false);
  const [view, setView] = React.useState<View>("GRID");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const showLayout = role === "STUDENT" || role === "TUTOR";

  function go() {
    router.push(next);
    router.refresh();
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateOwnPreferences({
      defaultDashboardTab: tab,
      timeZone: zone === AUTO_ZONE ? null : zone,
      darkMode: dark,
      ...(showLayout ? { preferredView: view } : {}),
    });
    if (!res?.data) {
      setBusy(false);
      setError("Your preferences weren't saved. Try again, or skip and set them in Settings.");
      return;
    }
    go();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground text-base font-semibold">A few preferences</h2>
        <p className="text-muted-foreground text-sm">You can change any of these later in Settings.</p>
      </div>
      <div className="divide-border border-border divide-y rounded-xl border px-4">
        {options.length > 1 ? (
          <Row id="pref-start" title="Start page" description="Where you land after signing in.">
            <Select value={tab} onValueChange={(v) => setTab(v as DashboardTab)}>
              <SelectTrigger className="w-44" aria-labelledby="pref-start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        ) : null}
        <Row id="pref-zone" title="Time zone" description="Due dates and lessons are shown in this zone.">
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="w-full sm:w-80" aria-labelledby="pref-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={AUTO_ZONE}>Use this device{deviceZone ? ` (${deviceZone.replace(/_/g, " ")})` : ""}</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row id="pref-dark" title="Dark mode" description="Light text on a dark background.">
          <Switch checked={dark} onCheckedChange={setDark} aria-labelledby="pref-dark" />
        </Row>
        {showLayout ? (
          <Row id="pref-view" title="Course layout" description="Show course lists as cards or as rows.">
            <Select value={view} onValueChange={(v) => setView(v as View)}>
              <SelectTrigger className="w-32" aria-labelledby="pref-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GRID">Grid</SelectItem>
                <SelectItem value="LIST">List</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        ) : null}
      </div>
      <ErrorText error={error} />
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={go} disabled={busy}>
          Skip for now
        </Button>
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {role === "TUTOR" ? "Save and set up workspace" : "Save and continue"}
        </Button>
      </div>
    </div>
  );
}
