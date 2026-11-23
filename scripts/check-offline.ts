/**
 * Checks that offline calls (src/lib/offline.ts) always answer. Sign-out
 * waits for clearOfflineData, so one that never answers is a sign-out that
 * never happens.
 *
 *   npx tsx scripts/check-offline.ts
 */

import { clearOfflineData, listSavedLessons, saveLessonForOffline } from "../src/lib/offline";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const never = new Promise<never>(() => {});
let deleted: string[] = [];

/** A browser with this registration; `ready` never settles, as when nothing is registered. */
function browser(getRegistration: () => Promise<unknown>) {
  deleted = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { ready: never, getRegistration } } });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { keys: async () => ["nexa-static-v1", "nexa-lessons-v1"], delete: async (k: string) => deleted.push(k) },
  });
}

/** "answered", or "hung" after `ms`. */
const answers = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.then(() => "answered", () => "refused"), new Promise((r) => setTimeout(() => r("hung"), ms))]);

async function main() {
  browser(async () => undefined);
  check("no worker registered: sign-out goes on", await answers(clearOfflineData(), 1_000), "answered");
  check("and saved lessons are still deleted", deleted, ["nexa-lessons-v1"]);
  check("no worker registered: save says so", await Promise.race([saveLessonForOffline("/x", "X"), new Promise((r) => setTimeout(() => r("hung"), 1_000))]), { ok: false, error: "not-available" });
  check("no worker registered: the list is empty", await Promise.race([listSavedLessons(), new Promise((r) => setTimeout(() => r("hung"), 1_000))]), []);

  browser(async () => { throw new Error("blocked"); });
  check("registrations refused: sign-out goes on", await answers(clearOfflineData(), 1_000), "answered");

  browser(async () => ({ active: null }));
  check("a worker stuck installing: sign-out goes on within its limit", await answers(clearOfflineData(), 4_000), "answered");

  browser(async () => ({ active: { postMessage: () => undefined } }));
  check("a worker that never replies: the same", await answers(clearOfflineData(), 4_000), "answered");

  browser(async () => ({ active: { postMessage: (_m: unknown, [port]: MessagePort[]) => port.postMessage({ ok: true, lessons: [{ url: "/a", title: "A", savedAt: null }] }) } }));
  check("a worker that replies", await listSavedLessons(), [{ url: "/a", title: "A", savedAt: null }]);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
