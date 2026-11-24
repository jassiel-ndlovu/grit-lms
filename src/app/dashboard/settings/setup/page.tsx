/**
 * Settings › Getting set up: an organisation's onboarding checklist and each
 * branch's rollout (viewer.md "Bulk onboarding"). Needs `teams.manage`.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

import { PageFrame, PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { BranchRollout } from "@/features/workspaces/components/branch-rollout";
import { onboardingStatus } from "@/features/workspaces/rollout";
import { getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Getting set up" };

/** Where each checklist step is done, and its plain name. */
const STEP: Record<string, { label: string; href: string; hint: string }> = {
  branches: { label: "Add your branches and teams", href: "/dashboard/imports?kind=branches", hint: "Import them from a spreadsheet, or add them in Branches and teams." },
  staff: { label: "Invite your staff", href: "/dashboard/imports?kind=staff", hint: "Import tutors and admins, with the teams they belong to." },
  students: { label: "Add your students", href: "/dashboard/imports?kind=students", hint: "Import them, with their parents if you have their details." },
  calendar: { label: "Add your timetable", href: "/dashboard/imports?kind=calendar", hint: "Import classes from your current calendar." },
  payout: { label: "Add the bank account for fees", href: "/dashboard/settings/payouts", hint: "So families can pay fees by card." },
  fees: { label: "Set up fees", href: "/dashboard/fees", hint: "Send fees, or set them to repeat." },
  brand: { label: "Add your logo and sender name", href: "/dashboard/settings/branding", hint: "On families' emails and your sign-in page." },
  enquiries: { label: "Switch on the online enquiry form", href: "/dashboard/enquiries", hint: "So new families can ask about classes." },
};
const ROLLOUT = { PLANNED: { label: "Planning", tone: "neutral" }, PILOT: { label: "Pilot", tone: "info" }, LIVE: { label: "Live", tone: "success" } } as const;

export default async function SetupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/settings/setup");
  const crumbs = [{ label: "Settings", href: "/dashboard/settings" }, { label: "Getting set up" }];
  let s: Awaited<ReturnType<typeof onboardingStatus>>;
  try {
    s = await onboardingStatus(viewer);
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={crumbs}>Only owners and admins who manage teams can see this page.</PageMessage>;
    throw e;
  }
  const required = s.checklist.filter((c) => !c.optional);
  const doneRequired = required.filter((c) => c.done).length;
  const canMove = viewer.membership?.scope !== "BRANCHES";

  return (
    <PageFrame type="settings" breadcrumb={crumbs}>
      <PageTitle
        title="Getting set up"
        description={`Bringing ${s.name} onto Nexa, step by step. ${doneRequired} of ${required.length} main steps done${s.branches.length ? `; ${s.live} of ${s.branches.length} branches live` : ""}.`}
      />

      <PageSection title="Steps" description="The first three get everyone in. The rest you can do any time.">
        <ol className="divide-border border-border divide-y rounded-lg border">
          {s.checklist.map((c) => {
            const step = STEP[c.key] ?? { label: c.label, href: "/dashboard/settings", hint: "" };
            return (
              <li key={c.key} className="flex items-start gap-3 px-4 py-3">
                {c.done ? <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle aria-label="Not done yet" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <Link href={step.href} className="text-foreground text-sm font-medium hover:underline">{step.label}</Link>
                  {c.optional ? <span className="text-muted-foreground ml-2 text-xs">Optional</span> : null}
                  <p className="text-muted-foreground text-xs">{step.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </PageSection>

      <PageSection title="Branches" description="Bring branches on one at a time: plan, try it with a pilot, then go live. A branch goes live once it has staff and at least one course.">
        {s.branches.length === 0 ? (
          <p className="text-muted-foreground text-sm">No branches yet. <Link href="/dashboard/imports?kind=branches" className="text-primary underline underline-offset-2">Import them</Link> or add them in <Link href="/dashboard/settings/branches" className="text-primary underline underline-offset-2">Branches and teams</Link>.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {s.branches.map((b) => {
              const r = ROLLOUT[b.rollout as keyof typeof ROLLOUT];
              return (
                <li key={b.id} className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">{b.name} <StatusChip tone={r.tone}>{r.label}</StatusChip></p>
                    <div className="bg-muted mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full" role="progressbar" aria-valuenow={b.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.name} set-up`}>
                      <div className="bg-primary h-full" style={{ width: `${b.progress.percent}%` }} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {b.progress.steps.map((st) => `${st.done ? "✓" : "○"} ${st.label}`).join(" · ")}
                      {b.progress.waitingOnInvites ? ` · ${b.progress.waitingOnInvites} invitation${b.progress.waitingOnInvites === 1 ? "" : "s"} not accepted yet` : ""}
                    </p>
                  </div>
                  {canMove ? <BranchRollout branchId={b.id} rollout={b.rollout as "PLANNED" | "PILOT" | "LIVE"} name={b.name} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>
    </PageFrame>
  );
}
