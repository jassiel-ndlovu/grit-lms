/**
 * /account/revert-email?token=… — from the email-change emails (#185; viewer
 * contract Draft 1.9). Works signed out. The button calls
 * revertEmailChange({ token }) on click, never on load (mail scanners).
 */

import { Undo2 } from "lucide-react";

import { EMAIL_LINK_COPY } from "@/components/account/account-copy";
import { EmailLinkAction } from "@/components/account/token-actions";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";

const copy = EMAIL_LINK_COPY.revert;

export const metadata = { title: copy.title };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length >= 10 && token.length <= 200;
  return (
    <PageFrame type="settings" helpHref={null} breadcrumb={[{ label: "Nexa", href: "/" }, { label: copy.title }]}>
      <PageTitle icon={<Undo2 />} eyebrow="Your account" title={copy.title} description={copy.lead} />
      <PageSection>
        {valid ? (
          <EmailLinkAction kind="revert" token={token} />
        ) : (
          <p role="alert" className="text-muted-foreground text-sm">
            This link is incomplete. Open it again from the email, or copy the whole link into your browser.
          </p>
        )}
      </PageSection>
    </PageFrame>
  );
}
