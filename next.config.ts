import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated into src/generated/prisma, and Next's
  // file tracing doesn't always copy its query engine into every function
  // (production /forgot-password failed with "could not locate the Query
  // Engine"). Include it in every route explicitly.
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/*.node"],
  },
  experimental: {
    // forbidden() and unauthorized() render src/app/forbidden.tsx and
    // unauthorized.tsx (B, #151; requested in #152).
    authInterrupts: true,
  },
  images: {
    // Vercel Blob serves files from this hostname pattern. Required for
    // next/image to load remote covers/avatars produced by the blob client.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

// Sentry (docs/revamp/a/ops/sentry-setup.md). The build never needs a token:
// source maps are uploaded only when SENTRY_AUTH_TOKEN is set.
const uploadMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !uploadMaps },
  widenClientFileUpload: uploadMaps,
  disableLogger: true,
});
