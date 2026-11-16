"use client";

import type { ReactNode } from "react";

import { MathProvider, type MathJaxVersion } from "@/app/components/math-provider";
import { EventProvider } from "@/context/EventContext";
import { SubmissionEntryProvider } from "@/context/SubmissionEntryContext";
import { SubmissionProvider } from "@/context/SubmissionContext";

/**
 * The context providers today's dashboard pages still read from. Both the
 * legacy shell and the revamp shell (REVAMP_UI) wrap pages in these, so
 * every existing page keeps working inside the new frame.
 *
 * Legacy Batch 1 (design 07) removed the eight providers nothing read
 * (students, tutors, lessons, tests, test submissions, grades, question
 * grades, lesson completions). These three go in Batch 3, with the legacy
 * assignment pages.
 */
export function LegacyProviders({ children, mathjax = 3 }: { children: ReactNode; mathjax?: MathJaxVersion }) {
  return (
    <MathProvider version={mathjax}>
      <SubmissionProvider>
        <SubmissionEntryProvider>
          <EventProvider>{children}</EventProvider>
        </SubmissionEntryProvider>
      </SubmissionProvider>
    </MathProvider>
  );
}
