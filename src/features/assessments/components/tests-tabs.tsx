/**
 * TestsTabs — client-only tab shell for the student tests page.
 *
 * The RSC parent hands over pre-computed buckets keyed by FilterBucket
 * plus each bucket's rendered children. This component just orchestrates
 * which bucket is currently visible, so the tab state doesn't force the
 * whole page to become a Client Component.
 */

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FILTER_LABELS,
  type FilterBucket,
} from "@/features/assessments/lib/filters";

const ORDER: FilterBucket[] = [
  "all",
  "upcoming",
  "missed",
  "submitted",
  "graded",
];

interface Props {
  counts: Record<FilterBucket, number>;
  panels: Partial<Record<FilterBucket, React.ReactNode>>;
  defaultValue?: FilterBucket;
}

export function TestsTabs({ counts, panels, defaultValue = "upcoming" }: Props) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        {ORDER.map((b) => (
          <TabsTrigger key={b} value={b}>
            {FILTER_LABELS[b]}
            <span className="bg-muted text-muted-foreground ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums">
              {counts[b]}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {ORDER.map((b) => (
        <TabsContent key={b} value={b} className="pt-4">
          {panels[b]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
