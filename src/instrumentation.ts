import * as Sentry from "@sentry/nextjs";

import { baseOptions } from "@/lib/sentry/scrub";

// Sentry is a no-op without SENTRY_DSN (see docs/revamp/a/ops/sentry-setup.md).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(baseOptions(process.env.SENTRY_DSN));
  }
}

export const onRequestError = Sentry.captureRequestError;
