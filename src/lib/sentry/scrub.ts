/**
 * Privacy scrubbing for Sentry events (design 06 §9).
 * Pure functions, no Sentry import, so scripts/check-sentry-scrub.ts can run
 * them under tsx. Used as `beforeSend` on server, edge and browser.
 *
 * Removes: request bodies, cookies, auth headers, the user object (kept: an
 * opaque id only), emails anywhere in strings. Names never leave the app
 * because the user object and request data are dropped; free text in
 * messages is passed through the email filter only.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-csrf-token",
  "upstash-signature",
  "x-cron-secret",
]);
const NAME_KEYS = /^(name|first_?name|last_?name|full_?name|display_?name|email|username|phone|password|token)$/i;

export function scrubString(s: string): string {
  return s.replace(EMAIL_RE, "[email]");
}

function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrubString(v);
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = NAME_KEYS.test(k) ? "[redacted]" : scrubValue(val, depth + 1);
  }
  return out;
}

// Loose shape: works for ErrorEvent without importing Sentry types.
type AnyEvent = {
  user?: { id?: string | number } & Record<string, unknown>;
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
    url?: string;
  } & Record<string, unknown>;
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: unknown }>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  server_name?: string;
};

export function scrubEvent<T extends object>(input: T): T {
  const event = input as AnyEvent;
  if (event.user) {
    event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
  }
  if (event.request) {
    const r = event.request;
    delete r.data;
    delete r.cookies;
    delete r.query_string;
    if (r.url) r.url = scrubString(r.url.split("?")[0]);
    if (r.headers) {
      for (const h of Object.keys(r.headers)) {
        if (SENSITIVE_HEADERS.has(h.toLowerCase())) delete r.headers[h];
      }
    }
  }
  if (event.message) event.message = scrubString(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubString(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrubString(b.message);
    if (b.data) b.data = scrubValue(b.data);
  }
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  delete event.server_name;
  return input;
}

/** Shared init options. Everything is off unless a DSN is given. */
export function baseOptions(dsn: string | undefined) {
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // No session replay: the integration is never added.
    beforeSend: scrubEvent,
  };
}
