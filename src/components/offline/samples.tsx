"use client";

/** The states of offline reading's controls, for /design-system/offline. */

import { PageSection } from "@/components/shell/page-frame";

import { SaveOfflineView } from "./save-offline";
import { SavedLessonList } from "./saved-lessons";

const ctx = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const LESSONS = [
  { url: "#1", title: "Grade 12 Mathematics · Functions and their inverses, with every transformation of a graph worked out", savedAt: "2026-11-20T08:00:00.000Z" },
  { url: "#2", title: "Physical Sciences · Momentum", savedAt: "2026-11-02T08:00:00.000Z" },
  { url: "#3", title: "", savedAt: null },
];
const nothing = () => {};

export function OfflineSamples() {
  return (
    <>
      <PageSection title="Save button">
        <div className="flex flex-wrap items-center gap-4">
          <SaveOfflineView state="none" onSave={nothing} onRemove={nothing} />
          <SaveOfflineView state="saving" onSave={nothing} onRemove={nothing} />
          <SaveOfflineView state="saved" onSave={nothing} onRemove={nothing} />
        </div>
      </PageSection>
      <PageSection title="Saved lessons">
        <SavedLessonList lessons={LESSONS} ctx={ctx} onRemove={nothing} onRemoveAll={nothing} />
      </PageSection>
      <PageSection title="Not possible in this browser">
        <SavedLessonList lessons="unavailable" ctx={ctx} onRemove={nothing} onRemoveAll={nothing} />
      </PageSection>
    </>
  );
}
