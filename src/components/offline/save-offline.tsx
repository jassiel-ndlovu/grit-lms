"use client";

/**
 * "Save for offline" on a lesson (Core; viewer.md Draft 1.18). A's service
 * worker keeps the lesson's page; this also asks for the app files that
 * page needs, so it opens without a connection. Nothing shows where saving
 * isn't possible.
 */

import * as React from "react";
import { CloudDownload, CloudCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { listSavedLessons, removeSavedLesson, saveLessonForOffline } from "@/lib/offline";

import { offlineReady } from "./offline-support";
import { forgetVersion, pageFiles, rememberVersion, saveError, savedVersion } from "./saved";

/** Saves the page and the app files it names. The service worker keeps those as they pass through it. */
export async function savePage(path: string, title: string, version?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await saveLessonForOffline(path, title);
  if (!res.ok) return res;
  try {
    const copy = await caches.match(new URL(path, window.location.origin).toString());
    const files = copy ? pageFiles(await copy.text()) : [];
    const loaded = performance.getEntriesByType("resource").flatMap((e) => {
      const url = new URL(e.name, window.location.origin);
      return url.origin === window.location.origin && url.pathname.startsWith("/_next/static/") ? [url.pathname] : [];
    });
    await Promise.allSettled([...new Set([...files, ...loaded])].map((f) => fetch(f)));
  } catch {
    // The page is saved; its files are usually in the browser's own cache.
  }
  if (version) rememberVersion(window.localStorage, path, version);
  return res;
}

type State = "unknown" | "unavailable" | "none" | "saving" | "saved";

export function SaveOffline({ path, title, version }: { path: string; title: string; version: string }) {
  const [state, setState] = React.useState<State>("unknown");

  React.useEffect(() => {
    let live = true;
    setState("unknown");
    void (async () => {
      const ok = await offlineReady();
      const saved = ok && (await listSavedLessons()).some((l) => l.url === path);
      if (!live) return;
      setState(!ok ? "unavailable" : saved ? "saved" : "none");
      // The tutor changed the lesson since it was saved: bring the copy up to date.
      if (saved && navigator.onLine && savedVersion(window.localStorage, path) !== version) await savePage(path, title, version);
    })();
    return () => {
      live = false;
    };
  }, [path, title, version]);

  async function save() {
    setState("saving");
    const res = await savePage(path, title, version);
    setState(res.ok ? "saved" : "none");
    if (res.ok) toast.success("Saved. This lesson opens without a connection.");
    else toast.error(saveError(res.error, navigator.onLine));
  }

  async function remove() {
    const res = await removeSavedLesson(path);
    if (!res.ok) return void toast.error("The saved copy couldn't be removed. Try again.");
    forgetVersion(window.localStorage, path);
    setState("none");
  }

  if (state === "unavailable") return null;
  return <SaveOfflineView state={state} onSave={save} onRemove={remove} />;
}

/** The control itself, for /design-system/offline. */
export function SaveOfflineView({ state, onSave, onRemove }: { state: Exclude<State, "unavailable">; onSave: () => void; onRemove: () => void }) {
  if (state === "saved") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <CloudCheck aria-hidden className="text-success size-4" /> Saved for offline
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 aria-hidden className="size-4" /> Remove
        </Button>
      </div>
    );
  }
  return (
    // Takes its room while it finds out, so the lesson doesn't jump.
    <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={state !== "none"} className={state === "unknown" ? "invisible" : undefined}>
      {state === "saving" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <CloudDownload aria-hidden className="size-4" />}
      {state === "saving" ? "Saving…" : "Save for offline"}
    </Button>
  );
}
