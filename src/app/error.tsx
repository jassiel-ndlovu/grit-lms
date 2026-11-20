"use client";

/** A crash on a page outside the dashboard (landing, legal pages, sign-in). */

import { ErrorBoundaryScreen } from "@/components/error-screen-client";
import { ErrorFrame } from "@/components/error-screen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorFrame>
      <ErrorBoundaryScreen error={error} reset={reset} home="/" homeLabel="Go to the home page" />
    </ErrorFrame>
  );
}
