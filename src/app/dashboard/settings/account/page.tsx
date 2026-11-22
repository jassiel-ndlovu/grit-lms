/**
 * /dashboard/settings/account — email address, your data, delete account
 * (#182, #185; viewer contract Drafts 1.8 and 1.9). New screen, so it uses
 * the page frame (#205, Settings type, Reading width).
 *
 * - Email: requestEmailChange (password re-check). Students made without an
 *   address see "Add your email address". Google-only accounts have no
 *   password, so the form is hidden for them (contract).
 * - Your data: the JSON export (GET /api/account/export), once a day.
 * - Delete account: getAccountDeletionStatus first (sole owners hand over),
 *   then a typed DELETE and requestAccountDeletion. That signs the user
 *   out, so there's no "pending" state to show here: sign-in is refused
 *   until it's cancelled from the emailed link.
 */

import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";

import { deletionConsequences } from "@/components/account/account-copy";
import { DataExportButton, DeleteAccountPanel, EmailChangeForm } from "@/components/account/account-settings";
import { getAccountFacts } from "@/components/account/queries";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { DELETION_GRACE_DAYS } from "@/features/users/deletion";
import { getAccountDeletionStatus } from "@/features/users/privacy-actions";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Account · Settings" };

export default async function AccountSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");

  const [facts, status] = await Promise.all([getAccountFacts(viewer.user.id), getAccountDeletionStatus({})]);
  if (!facts) redirect("/auth");

  const consequences = deletionConsequences({
    isGuardian: viewer.children.length > 0,
    isLearner: viewer.learner != null || viewer.workspaces.some((w) => w.as === "learner"),
    isStaff: viewer.workspaces.some((w) => w.as === "staff"),
  });

  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Settings", href: "/dashboard/settings" }, { label: "Account" }]}>
      <PageTitle
        icon={<UserRound />}
        eyebrow="Settings"
        title="Account"
        description="Your email address, a copy of your data, and deleting your account."
      />

      <PageSection
        id="email"
        title={facts.email ? "Email address" : "Add your email address"}
        description="Sign-in, password resets and notifications go here."
      >
        {facts.hasPassword ? (
          <EmailChangeForm currentEmail={facts.email} twoFactorEnabled={facts.twoFactorEnabled} />
        ) : (
          <div className="bg-muted/60 rounded-lg p-4 text-sm">
            <p>
              Your email address is <strong className="[overflow-wrap:anywhere]">{facts.email ?? viewer.user.email}</strong>.
            </p>
            <p className="text-muted-foreground mt-1">
              You sign in with Google, so you can&apos;t change your address here yet.
            </p>
          </div>
        )}
      </PageSection>

      <PageSection
        id="data"
        title="Your data"
        description="A file with everything Nexa holds about you: your profile, courses, work, grades, attendance, notifications and payments. No passwords."
      >
        <div>
          <DataExportButton />
          <p className="text-muted-foreground mt-2 text-xs">One download a day.</p>
        </div>
      </PageSection>

      <PageSection id="delete" title="Delete your account" description="This can't be undone once the waiting period ends.">
        {status?.data ? (
          <DeleteAccountPanel
            soleOwnerOf={status.data.soleOwnerOf}
            graceDays={DELETION_GRACE_DAYS}
            consequences={consequences}
            hasRealEmail={facts.email != null}
            isMinor={viewer.learner?.isMinor ?? false}
          />
        ) : (
          <p role="alert" className="text-muted-foreground text-sm">
            We couldn&apos;t check your account just now. Refresh to try again.
          </p>
        )}
      </PageSection>
    </PageFrame>
  );
}
