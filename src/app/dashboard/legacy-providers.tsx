"use client";

import type { ReactNode } from "react";

import { MathProvider, type MathJaxVersion } from "@/app/components/math-provider";
import { EventProvider } from "@/context/EventContext";
import { SubmissionProvider } from "@/context/SubmissionContext";

/**
 * The context providers today's dashboard pages still read from. Both the
 * legacy shell and the revamp shell (REVAMP_UI) wrap pages in these, so
 * every existing page keeps working inside the new frame.
 *
 * Legacy Batch 1 (design 07) removed the eight providers nothing read
 * (students, tutors, lessons, tests, test submissions, grades, question
 * grades, lesson completions). Batch 3a retired the portal, review and
 * overview pages, which took the submission-entry provider with them. These
 * two go when the assignment editor is rebuilt (Batch 3b).
 */
export function LegacyProviders({ children, mathjax = 3 }: { children: ReactNode; mathjax?: MathJaxVersion }) {
  return (
    <MathProvider version={mathjax}>
      <SubmissionProvider>
        <EventProvider>{children}</EventProvider>
      </SubmissionProvider>
    </MathProvider>
  );
}
