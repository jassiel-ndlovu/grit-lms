"use client";

/** The lessons saved on this device (viewer.md Draft 1.18). Offline, A's /offline.html lists the same ones. */

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type DateContext } from "@/lib/datetime";
import { clearOfflineData, listSavedLessons, removeSavedLesson, type SavedLesson } from "@/lib/offline";

import { offlineReady } from "./offline-support";
import { forgetVersion, newestFirst } from "./saved";

export function SavedLessons({ ctx, illustration }: { ctx: DateContext; illustration?: React.ReactNode }) {
  const [lessons, setLessons] = React.useState<SavedLesson[] | "unavailable" | null>(null);

  React.useEffect(() => {
    let live = true;
    void (async () => {
      const list = (await offlineReady()) ? newestFirst(await listSavedLessons()) : ("unavailable" as const);
      if (live) setLessons(list);
    })();
    return () => {
      live = false;
    };
  }, []);

  async function remove(lesson: SavedLesson) {
    const res = await removeSavedLesson(lesson.url);
    if (!res.ok) return void toast.error("The saved copy couldn't be removed. Try again.");
    forgetVersion(window.localStorage, lesson.url);
    setLessons((s) => (Array.isArray(s) ? s.filter((l) => l.url !== lesson.url) : s));
  }

  async function removeAll() {
    await clearOfflineData();
    if (Array.isArray(lessons)) for (const l of lessons) forgetVersion(window.localStorage, l.url);
    const left = newestFirst(await listSavedLessons());
    setLessons(left);
    if (left.length > 0) toast.error("Some saved lessons couldn't be removed. Try again.");
  }

  if (lessons === null) {
    return (
      <div aria-busy className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  return <SavedLessonList lessons={lessons} ctx={ctx} illustration={illustration} onRemove={remove} onRemoveAll={removeAll} />;
}

/** The list itself, for /design-system/offline. */
export function SavedLessonList({
  lessons, ctx, illustration, onRemove, onRemoveAll,
}: {
  lessons: SavedLesson[] | "unavailable";
  ctx: DateContext;
  illustration?: React.ReactNode;
  onRemove: (l: SavedLesson) => void;
  onRemoveAll: () => void;
}) {
  if (lessons === "unavailable") {
    return <EmptyState className="border-input rounded-lg border border-dashed" illustration={illustration} title="This browser can't save lessons" description="Try another browser, or leave its private window." />;
  }
  if (lessons.length === 0) {
    return <EmptyState className="border-input rounded-lg border border-dashed" illustration={illustration} title="No lessons saved yet" description="Open a lesson and choose Save for offline." />;
  }
  return (
    <div className="space-y-3">
      <ul className="divide-border border-border divide-y rounded-lg border">
        {lessons.map((l) => (
          <li key={l.url} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="min-w-0">
              <Link href={l.url} className="text-foreground block font-medium underline-offset-2 [overflow-wrap:anywhere] hover:underline">
                {l.title || "Lesson"}
              </Link>
              {l.savedAt ? <span className="text-muted-foreground text-xs">Saved {formatDate(l.savedAt, ctx)}</span> : null}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(l)} aria-label={`Remove ${l.title || "this lesson"}`}>
              <Trash2 aria-hidden className="size-4" /> Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">Up to 50 lessons on this device. Signing out removes them.</p>
        {lessons.length > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemoveAll}>
            <Trash2 aria-hidden className="size-4" /> Remove all
          </Button>
        ) : null}
      </div>
    </div>
  );
}
