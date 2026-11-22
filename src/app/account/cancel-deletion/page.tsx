/**
 * /account/cancel-deletion?token=… — the link in the "your account will be
 * deleted" email (#182; viewer contract Draft 1.8). Works signed out. A
 * button calls cancelAccountDeletion({ token }) on click, never on load.
 */

import { ShieldCheck } from "lucide-react";

import { CancelDeletionAction } from "@/components/account/token-actions";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";

export const metadata = { title: "Keep your account" };

export default async function CancelDeletionPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length >= 10 && token.length <= 200;
  return (
    <PageFrame type="settings" helpHref={null} breadcrumb={[{ label: "Nexa", href: "/" }, { label: "Keep your account" }]}>
      <PageTitle
        icon={<ShieldCheck />}
        eyebrow="Your account"
        title="Keep your account"
        description="Your Nexa account is waiting to be deleted. Until the date in the email, you can change your mind."
      />
      <PageSection>
        {valid ? (
          <CancelDeletionAction token={token} />
        ) : (
          <p role="alert" className="text-muted-foreground text-sm">
            This link is incomplete. Open it again from the email, or copy the whole link into your browser.
          </p>
        )}
      </PageSection>
    </PageFrame>
  );
}
