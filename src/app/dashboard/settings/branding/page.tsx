/**
 * Settings › Branding (viewer.md "Branding and white-label"): the
 * organisation's logo, colour, sender name and welcome text (Plus), and
 * white-label (Pro). Needs `workspace.branding`.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { BrandingForm } from "@/features/workspaces/components/branding-form";
import { getBranding } from "@/features/workspaces/branding";
import { siteUrl } from "@/lib/site";
import { getViewer, ViewerError } from "@/lib/viewer";

export const metadata = { title: "Branding" };

export default async function BrandingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/settings/branding");
  const crumbs = [{ label: "Settings", href: "/dashboard/settings" }, { label: "Branding" }];
  let b: Awaited<ReturnType<typeof getBranding>>;
  try {
    b = await getBranding(viewer);
  } catch (e) {
    if (e instanceof ViewerError) return <PageMessage breadcrumb={crumbs}>Only owners and admins can change the organisation&apos;s branding.</PageMessage>;
    throw e;
  }
  return (
    <PageFrame type="settings" breadcrumb={crumbs}>
      <PageTitle
        title="Branding"
        description={`Put ${b.name}'s logo, colour and name on the emails your students and parents get, and on your own sign-in page.`}
      />
      <BrandingForm
        data={{
          id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl, accentColor: b.accentColor, senderName: b.senderName,
          welcomeText: b.welcomeText, hideNexaBranding: b.hideNexaBranding, supportEmail: b.supportEmail,
          canBrand: b.canBrand, canWhiteLabel: b.canWhiteLabel, signInUrl: `${siteUrl()}${b.signInPath}`,
        }}
      />
    </PageFrame>
  );
}
