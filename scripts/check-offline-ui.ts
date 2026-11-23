/**
 * Checks the pure parts of offline reading's screens (viewer.md Draft 1.18).
 *
 *   npx tsx scripts/check-offline-ui.ts
 */

import { forgetVersion, lessonVersion, newestFirst, pageFiles, rememberVersion, savedTitle, savedVersion, saveError, someoneElse } from "../src/components/offline/saved";
import { studentCourseRoutes } from "../src/features/courses/lib/student-routes";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

class Memory {
  items = new Map<string, string>();
  getItem(k: string) { return this.items.get(k) ?? null; }
  setItem(k: string, v: string) { this.items.set(k, v); }
  removeItem(k: string) { this.items.delete(k); }
}
const broken = { getItem() { throw new Error("no storage"); }, setItem() { throw new Error("no storage"); }, removeItem() { throw new Error("no storage"); } };

// --- Addresses: one path per lesson, which is what the service worker keeps by.
const paths = [studentCourseRoutes.lessons("c1"), studentCourseRoutes.lessons("c1", "l1"), studentCourseRoutes.lessons("c1", "l2")];
check("each lesson has its own path, without a query", [new Set(paths).size, paths.some((p) => p.includes("?"))], [3, false]);

// --- Words
check("offline comes before any other reason", saveError("timeout", false), "You're offline. Save it when you're connected.");
check("no support", saveError("not-available", true), "This browser can't save lessons.");
check("out of space", saveError("QuotaExceededError: The quota has been exceeded.", true), "This device is out of space. Remove a saved lesson and try again.");
check("anything else", [saveError("not-saved", true), saveError(undefined, true)], ["The lesson couldn't be saved. Try again.", "The lesson couldn't be saved. Try again."]);
check("title", savedTitle("Maths", "Functions"), "Maths · Functions");
check("newest first, undated last", newestFirst([{ url: "a", title: "", savedAt: null }, { url: "b", title: "", savedAt: "2026-01-01" }, { url: "c", title: "", savedAt: "2026-02-01" }]).map((l) => l.url), ["c", "b", "a"]);

// --- Versions
check("the same lesson, the same version", lessonVersion(["t", { a: 1 }]), lessonVersion(["t", { a: 1 }]));
check("a changed lesson, another version", lessonVersion(["t", "x"]) === lessonVersion(["t", "y"]), false);
const store = new Memory();
check("nothing remembered", savedVersion(store, "/a"), null);
rememberVersion(store, "/a", "1");
rememberVersion(store, "/b", "2");
forgetVersion(store, "/a");
check("remember and forget", [savedVersion(store, "/a"), savedVersion(store, "/b")], [null, "2"]);
store.setItem("nexa-offline-versions", "[broken");
check("a broken record reads as none", savedVersion(store, "/b"), null);
rememberVersion(broken, "/a", "1");
check("no storage: no version, no error", savedVersion(broken, "/a"), null);

// --- Whose device
const device = new Memory();
check("first person: nothing to delete", someoneElse(device, "u1"), false);
check("the same person", someoneElse(device, "u1"), false);
rememberVersion(device, "/a", "1");
check("someone else: delete", someoneElse(device, "u2"), true);
check("and forget the versions", savedVersion(device, "/a"), null);
check("then they're the person", someoneElse(device, "u2"), false);
check("no storage: not someone else", someoneElse(broken, "u1"), false);

// --- The files a page names
check(
  "scripts, styles and fonts, from tags and from the page's data, once each",
  pageFiles(`<link href="/_next/static/css/ab12.css"><script src="/_next/static/chunks/main-9.js?dpl=x"></script><script>self.__next_f.push([1,"[\\"static/chunks/main-9.js\\",\\"static/chunks/app/dashboard/courses/lessons/%5Bid%5D/page-7.js\\"]"])</script><link href="/_next/static/media/f.p.woff2">`),
  ["/_next/static/css/ab12.css", "/_next/static/chunks/main-9.js", "/_next/static/chunks/app/dashboard/courses/lessons/%5Bid%5D/page-7.js", "/_next/static/media/f.p.woff2"],
);
check("nothing from elsewhere", pageFiles(`<img src="/covers/a.png"><script src="https://cdn.example/x.js"></script>`), []);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
