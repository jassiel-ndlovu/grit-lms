/**
 * /dashboard/welcome: where a new account lands after verifying its email
 * or signing up with Google (A's auth-client uses it as the callback).
 * Someone with no workspace yet goes to onboarding; anyone else to their
 * usual start page.
 */

import { redirect } from "next/navigation";

import { needsOnboarding } from "@/features/users/onboarding-gate";
import { auth } from "@/lib/auth";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  redirect((await needsOnboarding()) ? "/dashboard/onboarding" : "/dashboard/start");
}
