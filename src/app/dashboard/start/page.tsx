/**
 * /dashboard/start — post-sign-in landing. Sends the user to the start
 * page they picked in Settings ("Default view"). Sign-in and the signed-in
 * visit to "/" both point here; /dashboard itself stays the home page.
 */

import { redirect } from "next/navigation";

import { startPathFor } from "@/features/users/start-page";
import { getUserPreferences } from "@/features/users/preferences";
import { auth } from "@/lib/auth";

export default async function StartPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  const prefs = await getUserPreferences(session.user.id);
  redirect(startPathFor(session.user.role, prefs.defaultDashboardTab));
}
