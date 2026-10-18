/**
 * /verify-email?token=… — landing page for the link in verification emails.
 *
 * Verification happens on a button press rather than on page load: mail
 * scanners (Outlook Safe Links and friends) open every link in a message,
 * and a GET that changes state would let them verify on the user's behalf.
 */

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/branding";

import { VerifyEmailButton } from "./verify-email-button";

export const metadata = { title: "Verify email" };

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-display text-xl text-foreground">{APP_NAME}</span>
        </div>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground">
          Verify your email
        </h1>
        {token ? (
          <VerifyEmailButton token={token} />
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            This link is missing its token. Open the link from your email again, or
            request a new one from{" "}
            <Link href="/dashboard/settings" className="text-brand-terracotta underline">
              Settings
            </Link>
            .
          </p>
        )}
      </Card>
    </main>
  );
}
