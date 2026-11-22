/**
 * /account/deletion-requested?on=YYYY-MM-DD — where Settings › Account sends
 * someone after requestAccountDeletion (#182), which has already signed
 * them out everywhere. Only the date is in the URL. `email=0` when the
 * account has no real address (no cancel link was emailed).
 */

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { formatDeletionDate } from "@/components/account/account-copy";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Account deletion requested" };

export default async function DeletionRequestedPage({ searchParams }: { searchParams: Promise<{ on?: string; email?: string }> }) {
  const { on, email } = await searchParams;
  const date = on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? formatDeletionDate(`${on}T12:00:00Z`) : "";
  const emailed = email !== "0";
  return (
    <PageFrame type="settings" helpHref={null} breadcrumb={[{ label: "Nexa", href: "/" }, { label: "Account deletion" }]}>
      <PageTitle
        icon={<CalendarClock />}
        eyebrow="Your account"
        title="Your account will be deleted"
        description={date ? `Your account will be deleted on ${date}. You've been signed out on every device.` : "You've been signed out on every device."}
      />
      <PageSection title="Changed your mind?">
        <p className="text-muted-foreground text-sm">
          {emailed
            ? "We've emailed you a link to cancel. It works until the deletion date. You can't sign in until you cancel."
            : "Your account has no email address, so ask your tutor to cancel the deletion before that date. You can't sign in until it's cancelled."}
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to Nexa</Link>
          </Button>
        </div>
      </PageSection>
    </PageFrame>
  );
}
