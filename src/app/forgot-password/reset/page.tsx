/**
 * /forgot-password/reset?token=…: choose a new password from an emailed
 * link. The reset happens on submit, never on page load (mail scanners open
 * links).
 */

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/branding";

import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
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
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground">Choose a new password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            This link is missing its token. Open the link from your email again, or{" "}
            <Link href="/forgot-password" className="text-brand-terracotta underline">
              send a new one
            </Link>
            .
          </p>
        )}
      </Card>
    </main>
  );
}
