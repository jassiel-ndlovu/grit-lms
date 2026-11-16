"use client";

import type { ReactNode } from "react";

import { MathProvider, type MathJaxVersion } from "@/app/components/math-provider";
import { EventProvider } from "@/context/EventContext";
import { GradeProvider } from "@/context/GradeContext";
import { LessonCompletionProvider } from "@/context/LessonCompletionContext";
import { LessonProvider } from "@/context/LessonContext";
import { QuestionGradeProvider } from "@/context/QuestionGradeContext";
import { StudentProvider } from "@/context/StudentContext";
import { SubmissionEntryProvider } from "@/context/SubmissionEntryContext";
import { SubmissionProvider } from "@/context/SubmissionContext";
import { TestProvider } from "@/context/TestContext";
import { TestSubmissionProvider } from "@/context/TestSubmissionContext";
import { TutorProvider } from "@/context/TutorContext";

/**
 * The context providers today's dashboard pages read from. Both the legacy
 * shell and the revamp shell (REVAMP_UI) wrap pages in these, so every
 * existing page keeps working inside the new frame. They go away page by
 * page as pages move to server data.
 */
export function LegacyProviders({ children, mathjax = 3 }: { children: ReactNode; mathjax?: MathJaxVersion }) {
  return (
    <MathProvider version={mathjax}>
      <StudentProvider>
        <TutorProvider>
          <LessonProvider>
            <TestProvider>
              <TestSubmissionProvider>
                <SubmissionProvider>
                  <SubmissionEntryProvider>
                    <GradeProvider>
                      <QuestionGradeProvider>
                        <LessonCompletionProvider>
                          <EventProvider>{children}</EventProvider>
                        </LessonCompletionProvider>
                      </QuestionGradeProvider>
                    </GradeProvider>
                  </SubmissionEntryProvider>
                </SubmissionProvider>
              </TestSubmissionProvider>
            </TestProvider>
          </LessonProvider>
        </TutorProvider>
      </StudentProvider>
    </MathProvider>
  );
}
