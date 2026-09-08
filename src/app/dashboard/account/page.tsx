/**
 * /dashboard/account — legacy alias.
 *
 * The account surface moved to /dashboard/profile as part of the profile
 * refresh. This tiny redirect keeps any bookmarks or in-app links from
 * 404-ing while the sidebar has already been switched over.
 */

import { redirect } from "next/navigation";

export default function AccountRedirect() {
  redirect("/dashboard/profile");
}
