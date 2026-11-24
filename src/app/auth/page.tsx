"use client";

/**
 * /auth: sign-in page. The form is components/auth/sign-in-card.tsx, which
 * the branded /w/<slug> pages share.
 */

import * as React from "react";

import { AuthFrame } from "@/components/auth/auth-parts";
import { SignInCard } from "@/components/auth/sign-in-card";

export default function LoginPage() {
  return (
    <AuthFrame title="Sign in to Nexa LMS" lead="Continue where you left off.">
      <React.Suspense fallback={<div className="min-h-[380px] rounded-xl border border-border bg-card shadow-sm" />}>
        <SignInCard />
      </React.Suspense>
    </AuthFrame>
  );
}

