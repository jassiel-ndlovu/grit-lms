/**
 * /dashboard/welcome: where a new account lands after verifying its email
 * or signing up with Google (A's auth-client uses it as the callback).
 * A self sign-up picks tutor, student or parent here, once (#158), then
 * sets a few preferences.
 * Anyone who has already chosen moves on.
 *
 * A student or parent who came through a referral link (or was sent here
 * by Find courses, `?next=`) goes on to that workspace's courses.
 */

import { cookies } from "next/headers";

import { redirect } from "next/navigation";

import { browseNext, browseUrl } from "@/features/courses/lib/join-ui";
import { OnboardingFrame, StepHeading } from "@/features/courses/components/onboarding-frame";
import { newAccountRedirect } from "@/features/users/onboarding-gate";
import { RoleChooser } from "@/features/users/components/role-chooser";
import { REFERRAL_COOKIE, referralTarget } from "@/features/workspaces/referrals";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Welcome to Nexa" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [viewer, sp] = await Promise.all([getViewer(), searchParams]);
  if (!viewer) redirect("/auth");
  const next = browseNext(typeof sp.next === "string" ? sp.next : null);
  if (viewer.user.roleConfirmed) redirect((await newAccountRedirect()) ?? next ?? "/dashboard/start");

  let after = next;
  if (!after) {
    const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
    const target = code ? await referralTarget(code) : null;
    if (target) after = browseUrl({ workspace: target.workspaceId });
  }

  const first = viewer.user.name.split(" ")[0];
  return (
    <OnboardingFrame step={null} trialDays={null}>
      <StepHeading title={first ? `Welcome, ${first}` : "Welcome to Nexa"} lead="Two quick questions and you're in." />
      <RoleChooser after={after} />
    </OnboardingFrame>
  );
}
