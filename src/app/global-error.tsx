"use client";

/**
 * When the root layout itself fails, nothing else renders, so this page
 * brings its own <html> and <body>. The app's fonts and providers aren't
 * there; globals.css still gives it the Nexa colours.
 */

import "./globals.css";

import { ErrorBoundaryScreen } from "@/components/error-screen-client";
import { ErrorFrame } from "@/components/error-screen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorFrame>
          <ErrorBoundaryScreen error={error} reset={reset} home="/" homeLabel="Go to the home page" />
        </ErrorFrame>
      </body>
    </html>
  );
}
