/**
 * /dashboard/home — legacy URL kept as a redirect.
 * The dashboard landing now lives at /dashboard.
 */

import { redirect } from "next/navigation";

export default function HomeRedirect() {
  redirect("/dashboard");
}
