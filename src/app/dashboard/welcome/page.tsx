/**
 * /dashboard/welcome: where a new account lands after verifying its email
 * or signing up with Google (A's auth-client uses it as the callback).
 * A self sign-up picks tutor, student or parent here, once (#158).
 * Anyone who has already chosen moves on.
 */

import { redirect } from "next/navigation";

import { OnboardingFrame, StepHeading } from "@/features/courses/components/onboarding-frame";
import { newAccountRedirect } from "@/features/users/onboarding-gate";
import { RoleChooser } from "@/features/users/components/role-chooser";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Welcome to Nexa" };

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (viewer.user.roleConfirmed) redirect((await newAccountRedirect()) ?? "/dashboard/start");

  const first = viewer.user.name.split(" ")[0];
  return (
    <OnboardingFrame step={null} trialDays={null}>
      <StepHeading title={first ? `Welcome, ${first}` : "Welcome to Nexa"} lead="How will you use Nexa?" />
      <RoleChooser />
    </OnboardingFrame>
  );
}
