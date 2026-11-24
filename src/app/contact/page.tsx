/**
 * /contact: ask for an account, or talk to us about an organisation
 * (landing page). `?kind=ACCESS|TEAM|OTHER` picks the starting choice.
 */

import Link from "next/link";

import { EnquiryForm } from "@/features/marketing/components/enquiry-form";
import { ENQUIRY_KINDS, type EnquiryKind } from "@/features/marketing/enquiry-rules";
import { PublicHelpFrame } from "@/features/support/components/public-frame";

export const metadata = {
  title: "Contact us",
  description: "Ask for an account on Nexa LMS, or talk to us about using it in your organisation.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ kind?: string; from?: string }> }) {
  const sp = await searchParams;
  const kind = (ENQUIRY_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as EnquiryKind) : "ACCESS";
  const source = sp.from && /^[\w.-]{1,60}$/.test(sp.from) ? sp.from : "/contact";
  return (
    <PublicHelpFrame
      title="Contact us"
      lead="Ask for an account, or tell us about your organisation. We usually reply within one working day."
    >
      <EnquiryForm initialKind={kind} source={source} />
      <p className="text-muted-foreground text-sm">
        Already using Nexa and need help? Go to <Link href="/support" className="text-primary underline underline-offset-2">Help and support</Link>.
      </p>
    </PublicHelpFrame>
  );
}
