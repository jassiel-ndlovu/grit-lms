# Domain, DNS and email sender

`nexa-lms.co.za` is registered at xneelo. Its DNS is served by Cloudflare
(nameservers `grant.ns.cloudflare.com` and `jasmine.ns.cloudflare.com`, set at
xneelo on 2026-11-19). The app is hosted on Vercel (project `grit-lms`).

## Records (Cloudflare zone `nexa-lms.co.za`)

Every record is **DNS-only (grey cloud)**. Do not turn on the orange-cloud proxy
for the Vercel records: Vercel then can't renew its certificates, and the apex
and www start failing TLS.

| Name | Type | Value | Why |
|---|---|---|---|
| `nexa-lms.co.za` | A | `216.198.79.1`, `216.198.79.65` | Vercel. The apex redirects 308 to www. |
| `www` | A | `216.198.79.1`, `216.198.79.65` | Vercel. Canonical host. |
| `_domainconnect` | CNAME | `_domainconnect.vercel-dns.com` | Vercel Domain Connect |
| `nexa-lms.co.za` | CAA | `letsencrypt.org`, `pki.goog`, `sectigo.com` | CAs Vercel may use |
| `resend._domainkey.notify` | TXT | DKIM key from Resend | Resend signing |
| `send.notify` | CNAME | `send.forge.rmta.net` | Resend return path (SPF) |
| `rsend.notify` | CNAME | `rsend-euw1.forge.rmta.net` | Resend return path (SPF) |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | DMARC, monitor only |

The Cloudflare import also brought a proxied wildcard `*` A record; it was
deleted because nothing uses other subdomains.

To read or change records: `cf dns records list -z nexa-lms.co.za` (the `cf`
CLI, signed in as the owner). Edits take a JSON `--body`; deletes need `--force`.

## Email

- Resend domain `notify.nexa-lms.co.za`, region eu-west-1, sending only.
  Verified 2026-11-19.
- `EMAIL_FROM="Nexa LMS <noreply@notify.nexa-lms.co.za>"` on Vercel Production
  (`src/lib/email/config.ts`). Preview and local keep Resend's dev sender, which
  only delivers to the Resend account owner.
- Later: tighten DMARC to `p=quarantine` once a few weeks of sends look clean,
  and set `EMAIL_REPLY_TO` when a support inbox exists (for example Cloudflare
  Email Routing for `support@nexa-lms.co.za`).

## Canonical URL

`APP_URL=https://www.nexa-lms.co.za` (Production). QStash schedules target it
(`scripts/qstash-sync-schedules.ts`), and QStash signatures are checked against
it, so if the canonical host ever changes: update `APP_URL`, re-run the schedule
sync, change the Vercel redirect, then redeploy.
