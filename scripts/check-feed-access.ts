/**
 * Guards the fix for the legacy feed routes.
 *
 * GET /api/activity and GET /api/notifications used to read `userId`,
 * `studentId` and `courseIds` from the query string and return those rows,
 * so any signed-in user could read anyone's activity and notifications.
 * They now derive the reader from the session token only.
 *
 * The handlers need a database and a session, so this check reads their
 * source and fails if a query parameter can select rows again.
 *
 *   npx tsx scripts/check-feed-access.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

const root = process.cwd(); // run from the repo root
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** The body of `export async function GET`, up to the next top-level export. */
function getHandler(source: string): string {
  const start = source.indexOf("export async function GET");
  if (start < 0) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

const activity = getHandler(read("src/app/api/activity/route.ts"));
const notifications = getHandler(read("src/app/api/notifications/route.ts"));

check("activity: GET handler found", activity.length > 0);
check("activity: ignores the query string", !/searchParams|req\.url|nextUrl/.test(activity));
check("activity: filters by the token's user id", /where:\s*\{\s*userId:\s*token\.id/.test(activity));
check("activity: does not return email addresses", !/email:\s*true/.test(activity));

check("notifications: GET handler found", notifications.length > 0);
check("notifications: ignores the query string", !/searchParams|req\.url|nextUrl/.test(notifications));
check("notifications: uses the shared recipient filter", /buildRecipientWhere\(/.test(notifications));
check("notifications: reader comes from the token", /getNotificationViewer\(\{\s*id:\s*token\.id/.test(notifications));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
