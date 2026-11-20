"use client";

/**
 * The client parts of the error pages: the address that wasn't found, a Back
 * button, and the 500 screen that error.tsx files render (it reports the
 * error to Sentry and offers Try again).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { ArrowLeft, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ErrorScreen } from "./error-screen";

/** "Address: /dashboard/x" under the 404 text, so people can spot a typo. */
export function MissingPath() {
  const path = usePathname();
  if (!path || path === "/") return null;
  return (
    <p>
      Address: <span className="text-foreground font-mono break-all">{path}</span>
    </p>
  );
}

/** Goes back when there's somewhere to go back to; otherwise hidden. */
export function BackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = React.useState(false);
  React.useEffect(() => setCanGoBack(window.history.length > 1), []);
  if (!canGoBack) return null;
  return (
    <Button variant="outline" onClick={() => router.back()}>
      <ArrowLeft aria-hidden />
      Go back
    </Button>
  );
}

/** What an error.tsx renders: report, then offer Try again and a way home. */
export function ErrorBoundaryScreen({
  error,
  reset,
  home = "/dashboard",
  homeLabel = "Go to your dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home?: string;
  homeLabel?: string;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <ErrorScreen
      kind="500"
      detail={
        error.digest ? (
          <p>
            Reference for support: <span className="text-foreground font-mono">{error.digest}</span>
          </p>
        ) : null
      }
      actions={
        <>
          <Button onClick={reset}>
            <RotateCw aria-hidden />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href={home}>{homeLabel}</Link>
          </Button>
        </>
      }
    />
  );
}
