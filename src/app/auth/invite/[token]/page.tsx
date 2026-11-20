/**
 * /auth/invite/[token] — where a staff invite email lands (#174; a/ux/01,
 * section 5; A asked B to build it). getInvite works signed out. Signed
 * in, "Join" calls acceptInvite. Signed out, sign in (and come back here)
 * or create an account with the invited address first.
 */

import Link from "next/link";

import { AcceptInvite } from "@/components/auth/accept-invite";
import { AuthFrame, signUpOpen } from "@/components/auth/auth-parts";
import { getInvite } from "@/features/auth/invite-actions";
import { formatDate } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Invitation" };

interface PageProps {
  params: Promise<{ token: string }>;
}

const ENDED: Record<string, { title: string; lead: string }> = {
  EXPIRED: { title: "This invite has expired", lead: "Invites work for 7 days. Ask the person who invited you for a new one." },
  ACCEPTED: { title: "This invite has been used", lead: "If it was you, sign in to find the workspace in your list." },
  REVOKED: { title: "This invite was cancelled", lead: "Ask the person who invited you if you think that's a mistake." },
};

const card = "rounded-lg border border-slate-200 bg-white p-6 shadow-sm";
const primary = "block w-full rounded-md bg-slate-900 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800";
const secondary = "block w-full rounded-md border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-800 hover:bg-slate-50";

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const valid = token.length >= 10 && token.length <= 200;
  const [res, viewer] = await Promise.all([valid ? getInvite({ token }) : null, getViewer()]);
  const invite = res?.data ?? null;

  if (!invite) {
    return (
      <AuthFrame title="This invite link isn't valid" lead="Check you copied the whole link from the email, or ask for a new invite.">
        <Link href="/auth" className={secondary}>
          Go to sign in
        </Link>
      </AuthFrame>
    );
  }

  const ended = ENDED[invite.state];
  if (ended) {
    return (
      <AuthFrame title={ended.title} lead={ended.lead}>
        <Link href={viewer ? "/dashboard" : "/auth"} className={secondary}>
          {viewer ? "Go to your dashboard" : "Go to sign in"}
        </Link>
      </AuthFrame>
    );
  }

  const role = invite.role === "ADMIN" ? "an admin" : "a tutor";
  const back = `/auth/invite/${token}`;

  return (
    <AuthFrame title={`Join ${invite.workspaceName}`} lead={`${invite.invitedBy} invited you to join as ${role}.`}>
      <div className={`${card} space-y-4`}>
        <p className="text-sm text-slate-600">
          The invite is for <span className="font-medium text-slate-900">{invite.emailMasked}</span> and works until{" "}
          {formatDate(String(invite.expiresAt))}.
        </p>
        {viewer ? (
          <AcceptInvite token={token} workspaceName={invite.workspaceName} signedInAs={viewer.user.email} emailMasked={invite.emailMasked} />
        ) : (
          <div className="space-y-3">
            <Link href={`/auth?callbackUrl=${encodeURIComponent(back)}`} className={primary}>
              Sign in with that email
            </Link>
            {signUpOpen ? (
              <>
                <Link href="/auth/sign-up" className={secondary}>
                  Create an account
                </Link>
                <p className="text-xs text-slate-500">
                  New to Nexa? Create an account with the invited email and verify it, then open this link again.
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>
    </AuthFrame>
  );
}
