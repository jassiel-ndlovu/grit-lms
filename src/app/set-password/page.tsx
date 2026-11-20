/**
 * /set-password — after signing in with a tutor's sign-in code, choose your
 * own password (#174; viewer.user.mustChangePassword). The dashboard layout
 * sends people here until they do. Outside /dashboard so that redirect
 * can't loop.
 */

import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-parts";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Choose a password" };

export default async function SetPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.user.mustChangePassword) redirect("/dashboard");

  return (
    <AuthFrame title={`Welcome, ${viewer.user.name.split(" ")[0]}`} lead="Your sign-in code only works once. Choose a password for next time.">
      <SetPasswordForm />
    </AuthFrame>
  );
}
