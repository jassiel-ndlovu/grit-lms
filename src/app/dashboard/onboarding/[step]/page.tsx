/**
 * /dashboard/onboarding/[step] — the setup steps for the active workspace
 * (a/ux/01, section 4): business (name and time zone,
 * updateWorkspaceProfile), course (createCourse) and payouts (the payout
 * form, or "I'll collect fees myself"). Only the name is required.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isBillingEnabled } from "@/features/billing/errors";
import { OnboardingFrame, StepHeading } from "@/features/courses/components/onboarding-frame";
import { CourseForm } from "@/features/courses/components/course-form";
import { BusinessForm } from "@/features/courses/components/onboarding-forms";
import { PayoutConnect } from "@/features/courses/components/payout-connect";
import { ONBOARDING_PATH, parseStep, stepHref, trialDaysLeft } from "@/features/courses/lib/onboarding-ui";
import { getPayoutSettings, listBanks } from "@/features/payments/fee-queries";
import { AddStudentForm } from "@/features/courses/components/accounts/add-student-form";
import { coursesForAdding } from "@/features/courses/lib/roster";
import { needsScope } from "@/lib/viewer-core";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Set up Nexa" };

interface PageProps {
  params: Promise<{ step: string }>;
}

export default async function OnboardingStepPage({ params }: PageProps) {
  if (!isBillingEnabled()) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const step = parseStep((await params).step);
  if (!step) notFound();
  // Setting up needs a workspace you run; anyone else starts from the choice.
  if (!viewer.workspace || !can(viewer, "workspace.settings")) redirect(ONBOARDING_PATH);

  const ws = viewer.workspace;
  const trialDays = ws.billingState === "TRIAL" ? trialDaysLeft(ws.trialEndsAt, new Date().toISOString()) : null;
  const organisation = ws.kind === "ORGANISATION";

  if (step === "business") {
    return (
      <OnboardingFrame step={step} trialDays={trialDays}>
        <StepHeading
          title={organisation ? "What's your organisation called?" : "What's your practice called?"}
          lead="Students and parents see this name on fees and receipts."
        />
        <BusinessForm name={ws.name} timezone={ws.timezone ?? "Africa/Johannesburg"} organisation={organisation} />
      </OnboardingFrame>
    );
  }

  if (step === "course") {
    return (
      <OnboardingFrame step={step} trialDays={trialDays}>
        <StepHeading
          title="Create your first course"
          lead="One course is one class, billed per student after the trial. You can add more later."
        />
        <CourseForm students={[]} showStudents={false} redirectTo={stepHref("students")} />
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button asChild variant="ghost">
            <Link href={stepHref("business")}>Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={stepHref("students")}>Skip for now</Link>
          </Button>
        </div>
      </OnboardingFrame>
    );
  }

  if (step === "students") {
    const courses = await coursesForAdding(viewer);
    return (
      <OnboardingFrame step={step} trialDays={trialDays}>
        <StepHeading
          title="Add your students (optional)"
          lead="Each student gets a username and a sign-in code to print or send. They don't need an email. You can add more later under Students."
        />
        <AddStudentForm courses={courses} workspaceName={ws.name} coursesRequired={needsScope(viewer, "learners.invite")} />
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button asChild variant="ghost">
            <Link href={stepHref("course")}>Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={stepHref("payouts")}>Next</Link>
          </Button>
        </div>
      </OnboardingFrame>
    );
  }

  // Payouts.
  const done = (
    <Button asChild>
      <Link href="/dashboard">Finish setting up</Link>
    </Button>
  );
  if (!can(viewer, "payouts.connect")) {
    return (
      <OnboardingFrame step={step} trialDays={trialDays}>
        <StepHeading title="Get paid through Nexa" lead="Your owner connects the account parents' payments go to." />
        <div className="flex justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href={stepHref("students")}>Back</Link>
          </Button>
          {done}
        </div>
      </OnboardingFrame>
    );
  }
  const [payouts, banks] = await Promise.all([getPayoutSettings().catch(() => null), listBanks().catch(() => [])]);
  const mine = payouts?.accounts.find((a) => (a.membershipId ?? null) === (payouts.payoutMode === "PER_TUTOR" ? viewer.membership?.id ?? null : null)) ?? null;

  return (
    <OnboardingFrame step={step} trialDays={trialDays}>
      <StepHeading
        title="Get paid through Nexa (optional)"
        lead="Parents can pay your fees online. Money goes straight to your bank account. Nexa keeps 2%; card fees come off your payout."
      />
      {payouts && banks.length > 0 ? (
        <PayoutConnect banks={banks} current={mine} defaultBusinessName={mine?.businessName ?? ws.name} />
      ) : (
        <p className="text-muted-foreground text-sm">
          We couldn&apos;t load the bank list just now. You can connect payouts later in Settings.
        </p>
      )}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button asChild variant="ghost">
          <Link href={stepHref("students")}>Back</Link>
        </Button>
        {mine ? (
          done
        ) : (
          <Button asChild variant="outline">
            <Link href="/dashboard">I&apos;ll collect fees myself</Link>
          </Button>
        )}
      </div>
      {mine ? null : (
        <p className="text-muted-foreground text-xs">
          Without payouts you can still record fees and mark them paid when you collect them.
        </p>
      )}
    </OnboardingFrame>
  );
}
