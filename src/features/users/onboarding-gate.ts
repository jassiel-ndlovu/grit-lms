import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { getViewer } from "@/lib/viewer";

/**
 * True for a brand-new account (A's #154): signed in, but with no
 * workspace, learner record or child yet (persona "none"). Such people
 * belong in /dashboard/onboarding, not on a role dashboard. Onboarding
 * only exists behind BILLING=1, so this is false while billing is off.
 */
export async function needsOnboarding(): Promise<boolean> {
  if (!isBillingEnabled()) return false;
  const viewer = await getViewer();
  return !!viewer && viewer.persona === "none" && !viewer.workspace;
}
