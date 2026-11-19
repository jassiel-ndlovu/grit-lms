# Sentry setup (owner steps)

Nexa ships with Sentry wired in but **off**. Nothing is sent, and the build
needs no token, until you set a DSN. Plan: Sentry Developer (free, 5k errors a
month, one user). Design: `design/06-deployment.md` section 9.

## 1. Create the account and project (you, not an agent)

1. Sign up at sentry.io on the free Developer plan. Choose a data region
   (EU is the closest to South Africa; US is the default).
2. Create a project: platform **Next.js**. Copy its **DSN**
   (`https://<key>@<org>.ingest.<region>.sentry.io/<id>`).

## 2. Set variables on Vercel (Production only)

| Variable | Value | Needed for |
|---|---|---|
| `SENTRY_DSN` | the DSN | server and edge errors |
| `NEXT_PUBLIC_SENTRY_DSN` | the same DSN | browser errors (public by design) |
| `SENTRY_AUTH_TOKEN` | an org token with `project:releases` and `org:read` (optional) | source-map upload at build |
| `SENTRY_ORG` | org slug (optional, with the token) | source-map upload |
| `SENTRY_PROJECT` | project slug (optional, with the token) | source-map upload |

Leave Preview and Development without a DSN, so previews stay silent.
`NEXT_PUBLIC_SENTRY_DSN` is inlined at build time: redeploy after setting it.
Without the token, errors still arrive but stack traces show built code.

## 3. Alert rules (Alerts, Create Alert, Issues)

1. **New issue**: when a new issue is created, email the owner.
2. **Spike**: when an issue has more than 20 events in 10 minutes, email the owner.

## What is and is not sent

- `sendDefaultPii: false`; no session replay; traces sampled at 10%.
- `beforeSend` (`src/lib/sentry/scrub.ts`) drops request bodies, cookies,
  query strings and auth headers, keeps only an opaque user id, redacts
  fields called name/email/password/token, and masks email addresses in text.
  Check it with `npx tsx scripts/check-sentry-scrub.ts`.
- Free text in an error message is only filtered for emails, so do not put
  people's names in `throw new Error(...)`.
- Environment tag comes from `VERCEL_ENV`.
- Captured today: unhandled server, edge and browser errors, and `defineJob`
  failures (tagged `job`). The payment webhook gets the same one-line capture
  when it exists.

## Checking it works

After deploying with a DSN, trigger a failing scheduled job (or throw from a
temporary route) and confirm the issue appears in Sentry within a minute,
with no email address, name or cookie in the event.
