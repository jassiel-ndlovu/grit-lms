import * as Sentry from "@sentry/nextjs";

import { baseOptions } from "@/lib/sentry/scrub";

// No-op without NEXT_PUBLIC_SENTRY_DSN. No replay integration is added.
Sentry.init({ ...baseOptions(process.env.NEXT_PUBLIC_SENTRY_DSN), integrations: [] });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
