/**
 * The business dashboard's period, from its URL. Pure, so it can be checked
 * (scripts/check-business-ui.ts). Days are the viewer's own; A's action
 * takes instants and at most a year.
 */

import { wallToInstant } from "@/features/events/lib/calendar-ui";

export const BUSINESS_PATH = "/dashboard/business";

export const PERIODS = [
  { key: "30-days", label: "Last 30 days" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "90-days", label: "Last 90 days" },
  { key: "12-months", label: "Last 12 months" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export interface Period {
  /** Null for the viewer's own dates. */
  key: PeriodKey | null;
  /** First and last day, both counted. */
  fromDay: string;
  toDay: string;
  from: Date;
  to: Date;
  /** Why the dates in the URL weren't used. */
  error: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;

export function dayIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** `day` moved by whole calendar days. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A real calendar day: "2026-02-30" isn't one. */
export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const at = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(at) && new Date(at).toISOString().slice(0, 10) === v;
}

/** Days from one to the other, both counted. */
export const daysBetween = (fromDay: string, toDay: string) => Math.round((Date.parse(toDay) - Date.parse(fromDay)) / DAY_MS) + 1;

function presetDays(key: PeriodKey, today: string): [string, string] {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (key) {
    case "this-month":
      return [monthStart, today];
    case "last-month": {
      const last = addDays(monthStart, -1);
      return [`${last.slice(0, 7)}-01`, last];
    }
    case "90-days":
      return [addDays(today, -89), today];
    case "12-months":
      return [addDays(today, 1 - MAX_DAYS), today];
    default:
      return [addDays(today, -29), today];
  }
}

export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, timeZone: string, now: Date): Period {
  const today = dayIn(now, timeZone);
  const build = (key: PeriodKey | null, fromDay: string, toDay: string, error: string | null): Period => {
    const end = wallToInstant(addDays(toDay, 1), "00:00", timeZone);
    // A period that runs to today ends now, not tonight.
    return { key, fromDay, toDay, from: wallToInstant(fromDay, "00:00", timeZone), to: end > now ? now : end, error };
  };
  const preset = (key: PeriodKey, error: string | null = null) => build(key, ...presetDays(key, today), error);

  if (sp.from || sp.to) {
    if (!isDay(sp.from) || !isDay(sp.to)) return preset("30-days", "Choose a first and a last day.");
    if (sp.to < sp.from) return preset("30-days", "The last day is before the first.");
    if (sp.from > today) return preset("30-days", "Choose days up to today.");
    if (daysBetween(sp.from, sp.to) > MAX_DAYS) return preset("30-days", "Choose up to a year.");
    return build(null, sp.from, sp.to > today ? today : sp.to, null);
  }
  return preset(PERIODS.find((p) => p.key === sp.period)?.key ?? "30-days");
}

export const periodHref = (key: PeriodKey) => (key === "30-days" ? BUSINESS_PATH : `${BUSINESS_PATH}?period=${key}`);

/** "2026-06" → "Jun" and "June 2026". */
export function monthLabel(month: string, locale: string, long = false): string {
  const at = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, long ? { month: "long", year: "numeric", timeZone: "UTC" } : { month: "short", timeZone: "UTC" }).format(at);
}

/** Basis points as a whole percentage: never 100% while something is unpaid, nor 0% while something is paid. */
export function ratePercent(bps: number): string {
  if (bps > 0 && bps < 100) return "under 1%";
  if (bps > 9900 && bps < 10000) return "over 99%";
  return `${Math.round(bps / 100)}%`;
}
