/**
 * Date/time formatting that respects the viewer's time zone and locale.
 *
 * Timestamps are stored in UTC. Anything that formats them without an
 * explicit `timeZone` uses whichever machine happens to run the code — the
 * server (UTC on Vercel) during SSR, the browser after hydration — which is
 * how notification "sent at" times ended up wrong. Everything here takes
 * the zone and locale explicitly. Safe to import from server and client.
 */

export interface DateContext {
  /** IANA zone, e.g. "Africa/Johannesburg". undefined = the runtime's own. */
  timeZone?: string;
  /** BCP 47 locale, e.g. "en-ZA". */
  locale?: string;
}

/**
 * Languages offered in settings. The interface copy is English for now;
 * the choice drives date and number formatting and the page `lang`.
 */
export const LANGUAGES = [
  { value: "en-ZA", label: "English (South Africa)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "af-ZA", label: "Afrikaans" },
  { value: "zu-ZA", label: "isiZulu" },
  { value: "fr-FR", label: "Français" },
  { value: "pt-PT", label: "Português" },
] as const;

export const DEFAULT_LOCALE = "en-ZA";

/**
 * Zone for server-rendered dates when the user hasn't picked one (the
 * server itself runs in UTC). The school is in Johannesburg.
 */
export const DEFAULT_TIME_ZONE = "Africa/Johannesburg";

/** Map the stored preference (legacy rows hold "EN") to a BCP 47 tag. */
export function resolveLocale(preferred: string | null | undefined): string {
  if (!preferred || preferred.toUpperCase() === "EN") return DEFAULT_LOCALE;
  return LANGUAGES.some((l) => l.value === preferred) ? preferred : DEFAULT_LOCALE;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "18 Oct 2026, 18:58" in the viewer's zone. */
export function formatDateTime(
  value: Date | string | number,
  ctx: DateContext = {},
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat(ctx.locale ?? DEFAULT_LOCALE, {
    ...options,
    timeZone: ctx.timeZone,
  }).format(toDate(value));
}

export function formatDate(
  value: Date | string | number,
  ctx: DateContext = {},
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return formatDateTime(value, ctx, options);
}

/** Calendar day number (days since epoch) of an instant in a zone. */
function dayNumber(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/**
 * "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago",
 * then the date. Days are counted by calendar day in the viewer's zone, so
 * something sent at 23:00 shows as "yesterday" the next morning rather
 * than "9 hours ago" / "1d ago" depending on how the hours fall.
 */
export function formatRelativeTime(
  value: Date | string | number,
  now: number,
  ctx: DateContext = {},
): string {
  const date = toDate(value);
  const locale = ctx.locale ?? DEFAULT_LOCALE;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSec = Math.round((now - date.getTime()) / 1000);

  // Future timestamps (clock skew) read as "just now" rather than "in 2m".
  if (diffSec < 45) return rtf.format(0, "second");
  if (diffSec < 3600) return rtf.format(-Math.max(1, Math.round(diffSec / 60)), "minute");

  const days = dayNumber(new Date(now), ctx.timeZone) - dayNumber(date, ctx.timeZone);
  if (days === 0) return rtf.format(-Math.round(diffSec / 3600), "hour");
  if (days < 7) return rtf.format(-days, "day");
  return formatDate(date, ctx);
}

/** Hour of day (0-23) in a zone — for greetings. */
export function hourInZone(now: Date, timeZone?: string): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(h);
}

export function greetingFor(now: Date, timeZone?: string): string {
  const h = hourInZone(now, timeZone);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
