/*
 * Nexa offline reading (#216 phase 1). Contract: viewer.md, "Offline
 * reading". Agent A.
 *
 * - Lessons are kept for offline only when the student saves them
 *   (message "save"); nothing personal is cached on its own.
 * - App files (/_next/static, images) are cached as they load, so a saved
 *   lesson can open with no connection.
 * - Offline, a saved lesson opens from the cache; any other page shows
 *   /offline.html, which lists the saved lessons.
 * - Signing out sends "clear": every saved lesson is deleted (shared phones).
 * - API calls, sign-in pages and anything but GET are never cached.
 */

const VERSION = "v1";
const STATIC = `nexa-static-${VERSION}`;
const LESSONS = `nexa-lessons-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_LESSONS = 50;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("nexa-") && k !== STATIC && k !== LESSONS).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") || /^\/(covers|illustrations|images)\//.test(url.pathname) || /\.(?:woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname));

const neverCache = (url) =>
  url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth") || url.searchParams.has("_rsc");

/** Lesson pages are kept by path, without the query. */
const lessonKey = (url) => new URL(url.pathname, self.location.origin).toString();

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && !neverCache(url)) {
    event.respondWith(
      fetch(req).catch(async () => {
        const saved = await caches.open(LESSONS).then((c) => c.match(lessonKey(url)));
        return saved || (await caches.match(OFFLINE_URL)) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
    );
  }
});

async function saveLesson(path, title) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || neverCache(url)) throw new Error("not-allowed");
  const res = await fetch(url.toString(), { credentials: "include", headers: { "X-Nexa-Offline-Save": "1" } });
  if (!res.ok || res.redirected) throw new Error("not-saved");
  const cache = await caches.open(LESSONS);
  const headers = new Headers(res.headers);
  headers.set("X-Nexa-Title", encodeURIComponent(title || url.pathname));
  headers.set("X-Nexa-Saved-At", new Date().toISOString());
  await cache.put(lessonKey(url), new Response(await res.blob(), { status: 200, headers }));
  const keys = await cache.keys();
  if (keys.length > MAX_LESSONS) {
    // Drop the oldest saves beyond the limit.
    const dated = await Promise.all(keys.map(async (k) => ({ k, at: (await cache.match(k)).headers.get("X-Nexa-Saved-At") || "" })));
    dated.sort((a, b) => a.at.localeCompare(b.at));
    await Promise.all(dated.slice(0, keys.length - MAX_LESSONS).map((d) => cache.delete(d.k)));
  }
}

async function listLessons() {
  const cache = await caches.open(LESSONS);
  const keys = await cache.keys();
  return Promise.all(
    keys.map(async (k) => {
      const r = await cache.match(k);
      return { url: new URL(k.url).pathname, title: decodeURIComponent(r.headers.get("X-Nexa-Title") || ""), savedAt: r.headers.get("X-Nexa-Saved-At") };
    }),
  );
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const reply = (body) => event.ports[0] && event.ports[0].postMessage(body);
  const run = async () => {
    switch (msg.type) {
      case "save": await saveLesson(msg.url, msg.title); return { ok: true };
      case "remove": await caches.open(LESSONS).then((c) => c.delete(lessonKey(new URL(msg.url, self.location.origin)))); return { ok: true };
      case "list": return { ok: true, lessons: await listLessons() };
      case "clear": await caches.delete(LESSONS); return { ok: true };
      default: return { ok: false, error: "unknown" };
    }
  };
  event.waitUntil(run().then(reply, (e) => reply({ ok: false, error: String((e && e.message) || e) })));
});
