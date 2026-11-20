/**
 * GET /api/calendar/feed/[token].ics: a user's private calendar
 * subscription (Google Calendar, Apple Calendar, Outlook). The token is the
 * only credential; getCalendarFeedUrl replaces it. Feeds for minors and
 * guardians carry titles, times and places only (no descriptions or links).
 */

import { NextResponse } from "next/server";

import { feedIcsForToken } from "@/features/calendar/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ics = await feedIcsForToken(token.replace(/\.ics$/i, ""));
  if (!ics) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "Content-Disposition": "inline; filename=\"nexa.ics\"",
    },
  });
}
