/**
 * /w/<slug>: an organisation's own sign-in page (viewer.md "Branding and
 * white-label"): its logo, name, colour and welcome text over the usual
 * sign-in form. Organisations without Plus branding go to the normal page.
 */

import * as React from "react";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-parts";
import { SignInCard } from "@/components/auth/sign-in-card";
import { brandForSlug } from "@/features/workspaces/branding";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = /^[a-z0-9-]{1,80}$/.test(slug) ? await brandForSlug(slug) : null;
  return { title: b ? `Sign in to ${b.name}` : "Sign in", robots: { index: false, follow: false } };
}

export default async function BrandedSignInPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = /^[a-z0-9-]{1,80}$/.test(slug) ? await brandForSlug(slug) : null;
  if (!b) redirect("/auth");
  return (
    <AuthFrame
      title={`Sign in to ${b.name}`}
      lead={b.welcomeText || "Sign in to see your classes, work and marks."}
      brand={{ name: b.name, logoUrl: b.logoUrl, accentColor: b.accentColor, whiteLabel: b.whiteLabel }}
    >
      <React.Suspense fallback={<div className="border-border bg-card min-h-[380px] rounded-xl border shadow-sm" />}>
        <SignInCard />
      </React.Suspense>
      {b.whiteLabel && b.supportEmail ? (
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Need help signing in? Email <a href={`mailto:${b.supportEmail}`} className="text-primary underline underline-offset-2">{b.supportEmail}</a>.
        </p>
      ) : null}
    </AuthFrame>
  );
}
