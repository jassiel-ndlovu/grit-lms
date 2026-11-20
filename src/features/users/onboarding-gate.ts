import "server-only";

import { isBillingEnabled } from "@/features/billing/errors";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/viewer";

/**
 * Where a new account must go before its dashboard, or null (A's #154 and
 * #158). A self sign-up first picks tutor, student or parent on
 * /dashboard/welcome. A tutor with no workspace yet then sets one up in
 * /dashboard/onboarding (only behind BILLING=1, where onboarding exists).
 * Students and parents go straight to their dashboard and wait for a
 * tutor to add or link them.
 */
export async function newAccountRedirect(): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (!viewer.user.roleConfirmed) return "/dashboard/welcome";
  if (!isBillingEnabled() || viewer.persona !== "none" || viewer.workspace) return null;
  const session = await auth();
  return session?.user?.role === "TUTOR" ? "/dashboard/onboarding" : null;
}
