"use client";

/** A crash inside a dashboard page, shown in the shell with Try again. */

import { ErrorBoundaryScreen } from "@/components/error-screen-client";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryScreen error={error} reset={reset} />;
}
