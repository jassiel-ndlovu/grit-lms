/**
 * The pure parts of offline reading's screens (viewer.md Draft 1.18),
 * checked by scripts/check-offline-ui.ts. A's calls are in @/lib/offline.
 */

import type { SavedLesson } from "@/lib/offline";

/** Why a save failed, for the student. */
export function saveError(code: string | undefined, online: boolean): string {
  if (!online) return "You're offline. Save it when you're connected.";
  if (code === "not-available") return "This browser can't save lessons.";
  if (code === "timeout") return "Saving took too long. Try again on a better connection.";
  if (code && /quota/i.test(code)) return "This device is out of space. Remove a saved lesson and try again.";
  return "The lesson couldn't be saved. Try again.";
}

/** Newest first; a lesson without a date comes last. */
export const newestFirst = (lessons: readonly SavedLesson[]): SavedLesson[] =>
  [...lessons].sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));

/** "Maths Grade 10 · Functions": the title a saved lesson is listed under. */
export const savedTitle = (course: string, lesson: string) => `${course} · ${lesson}`;

/**
 * A fingerprint of what the student reads (FNV-1a), so a saved copy is
 * refreshed once the tutor changes the lesson and not otherwise.
 */
export function lessonVersion(parts: unknown): string {
  const text = JSON.stringify(parts) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}:${text.length.toString(36)}`;
}

/**
 * The app files a saved page needs: its scripts, styles and fonts. Next
 * writes them as "/_next/static/…" in tags and as "static/chunks/…" in the
 * page's data.
 */
export function pageFiles(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:\/_next\/)?(static\/(?:chunks|css|media)\/[\w./%@()[\]~-]+\.(?:js|css|woff2?))/g)) found.add(`/_next/${m[1]}`);
  return [...found];
}

/* ───── The versions saved on this device ───── */

const VERSIONS_KEY = "nexa-offline-versions";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function read(store: Store): Record<string, string> {
  try {
    const v: unknown = JSON.parse(store.getItem(VERSIONS_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function write(store: Store, versions: Record<string, string>) {
  try {
    store.setItem(VERSIONS_KEY, JSON.stringify(versions));
  } catch {
    // Private windows and full storage: the copy is refreshed more often, no harm.
  }
}

export const savedVersion = (store: Store, path: string): string | null => read(store)[path] ?? null;

export const rememberVersion = (store: Store, path: string, version: string) => write(store, { ...read(store), [path]: version });

export function forgetVersion(store: Store, path: string) {
  const versions = read(store);
  delete versions[path];
  write(store, versions);
}

/* ───── Whose device this is ───── */

const USER_KEY = "nexa-offline-user";

/**
 * Notes who uses this device; true when it was someone else, whose saved
 * lessons must go. Sign-out already deletes them (A's appSignOut); this
 * covers a session that ended without one.
 */
export function someoneElse(store: Store, userId: string): boolean {
  try {
    const before = store.getItem(USER_KEY);
    if (before === userId) return false;
    store.setItem(USER_KEY, userId);
    if (before === null) return false;
    store.removeItem(VERSIONS_KEY);
    return true;
  } catch {
    return false;
  }
}
