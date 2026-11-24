/**
 * /enquire/<slug>: an organisation's public enquiry form (viewer.md
 * "Enquiry pipeline"). Not found when the organisation has it switched off.
 */

import { notFound } from "next/navigation";

import { PublicEnquiryForm } from "@/features/crm/components/public-enquiry-form";
import { enquiryFormFor } from "@/features/crm/enquiries";
import { PublicHelpFrame } from "@/features/support/components/public-frame";

async function load(slug: string) {
  return /^[a-z0-9-]{1,80}$/.test(slug) ? enquiryFormFor(slug) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const f = await load((await params).slug);
  return { title: f ? `Ask about classes at ${f.name}` : "Enquiry form", robots: { index: false, follow: false } };
}

export default async function PublicEnquiryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await load(slug);
  if (!f) notFound();
  const accent = f.accentColor && /^#[0-9a-fA-F]{6}$/.test(f.accentColor) ? f.accentColor : null;
  return (
    <div style={accent ? ({ "--primary": accent, "--brand-terracotta": accent, "--brand-terracotta-foreground": "#ffffff", "--ring": accent } as React.CSSProperties) : undefined}>
      <PublicHelpFrame title={`Ask about classes at ${f.name}`} lead={`Tell ${f.name} what you're looking for, and they'll get back to you.`}>
        {f.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.logoUrl} alt={`${f.name} logo`} className="h-10 w-auto max-w-48 object-contain" />
        ) : null}
        <PublicEnquiryForm slug={slug} name={f.name} branches={f.branches} />
      </PublicHelpFrame>
    </div>
  );
}
