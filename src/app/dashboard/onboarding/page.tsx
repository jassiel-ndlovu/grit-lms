/**
 * /dashboard/onboarding — "How will you use Nexa?" (a/ux/01, section 3):
 * Solo practice or Organisation. Choosing one creates the workspace and
 * starts the trial (A's createWorkspace), then opens the setup steps.
 * Reached from "Create a workspace" in the account menu. Behind BILLING=1.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isBillingEnabled } from "@/features/billing/errors";
import { OnboardingFrame, StepHeading } from "@/features/courses/components/onboarding-frame";
import { KindChooser } from "@/features/courses/components/onboarding-forms";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Set up Nexa" };

export default async function OnboardingPage() {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");

  return (
    <OnboardingFrame step={null} trialDays={null}>
      <StepHeading title="How will you use Nexa?" lead="This sets up your workspace. Only you can see it until you add people." />
      {viewer.user.emailVerified ? (
        <KindChooser />
      ) : (
        <p role="status" className="border-warning/40 bg-warning/5 rounded-lg border p-4 text-sm">
          Verify your email address first: open the link we sent to {viewer.user.email}.{" "}
          <Link href="/dashboard" className="text-foreground font-medium underline underline-offset-2">
            Back to Nexa
          </Link>
        </p>
      )}
    </OnboardingFrame>
  );
}
