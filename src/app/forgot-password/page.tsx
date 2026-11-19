/** /forgot-password: request a password reset link by email. */

import { GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/branding";

import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-display text-xl text-foreground">{APP_NAME}</span>
        </div>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground">Forgot your password?</h1>
        <ForgotForm />
      </Card>
    </main>
  );
}
