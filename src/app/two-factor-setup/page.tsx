/**
 * /two-factor-setup — owners and Nexa admins must use two-factor sign-in
 * (#178; design 02, section 7; viewer.user.twoFactorRequired). The
 * dashboard layout sends them here once Better Auth is on; NextAuth can't
 * do two-factor, so before the cutover this page just goes back.
 */

import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-parts";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { authProvider } from "@/lib/better-auth";
import { getViewer } from "@/lib/viewer";

import { remindTwoFactorLater } from "./remind";

export const metadata = { title: "Set up two-factor sign-in" };

export default async function TwoFactorSetupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (authProvider() !== "better-auth" || !viewer.user.twoFactorRequired) redirect("/dashboard");

  return (
    <AuthFrame
      title="Protect your account"
      lead="As an owner you can see fees and student records, so Nexa asks for a code from your phone when you sign in."
    >
      <TwoFactorSetup remindLater={remindTwoFactorLater} />
    </AuthFrame>
  );
}
