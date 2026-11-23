"use client";

/**
 * Offline reading, client side (#216 phase 1). The service worker is
 * public/sw.js; contract: viewer.md, "Offline reading".
 *
 *   registerOfflineSupport()      once, from the dashboard layout (B)
 *   saveLessonForOffline(url, t)  the "Save for offline" button on a lesson
 *   removeSavedLesson(url)
 *   listSavedLessons()            for a "Saved for offline" list
 *   clearOfflineData()            on sign-out (appSignOut calls it)
 *
 * Every call is safe where service workers aren't available: it does
 * nothing, or answers "not available".
 */

export type SavedLesson = { url: string; title: string; savedAt: string | null };
type Reply = { ok: boolean; error?: string; lessons?: SavedLesson[] };

export function offlineSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof caches !== "undefined";
}

/** Registers the service worker (production builds only, to keep development predictable). */
export async function registerOfflineSupport(): Promise<boolean> {
  if (!offlineSupported() || process.env.NODE_ENV !== "production") return false;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return true;
  } catch {
    return false;
  }
}

/**
 * The worker to talk to, or null. `serviceWorker.ready` never settles when
 * nothing is registered, so it's only awaited for a registration that is
 * still installing, and then with a limit. Sign-out waits on this.
 */
async function activeWorker(waitMs: number): Promise<ServiceWorker | null> {
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (!reg) return null;
  if (reg.active) return reg.active;
  const limit = new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs));
  return (await Promise.race([navigator.serviceWorker.ready, limit]))?.active ?? null;
}

async function ask(message: Record<string, unknown>, timeoutMs = 20_000): Promise<Reply> {
  if (!offlineSupported()) return { ok: false, error: "not-available" };
  const worker = await activeWorker(timeoutMs);
  if (!worker) return { ok: false, error: "not-available" };
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve({ ok: false, error: "timeout" }), timeoutMs);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data as Reply); };
    worker.postMessage(message, [ch.port2]);
  });
}

/** Saves a lesson page (a same-site path such as /dashboard/courses/lessons/abc) for reading offline. */
export async function saveLessonForOffline(url: string, title: string): Promise<{ ok: boolean; error?: string }> {
  return ask({ type: "save", url, title });
}

export async function removeSavedLesson(url: string): Promise<{ ok: boolean }> {
  return ask({ type: "remove", url });
}

export async function listSavedLessons(): Promise<SavedLesson[]> {
  return (await ask({ type: "list" })).lessons ?? [];
}

/** Deletes every saved lesson. Called on sign-out, so a shared phone keeps nothing. */
export async function clearOfflineData(): Promise<void> {
  if (!offlineSupported()) return;
  await ask({ type: "clear" }, 3_000);
  // Belt and braces, in case the worker isn't running.
  const keys = await caches.keys().catch(() => [] as string[]);
  await Promise.all(keys.filter((k) => k.startsWith("nexa-lessons-")).map((k) => caches.delete(k)));
}
