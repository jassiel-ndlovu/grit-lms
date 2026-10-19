"use client"

import { ReactNode, useState } from 'react';
import { MathProvider } from '@/app/components/math-provider';
import Header from './models/header';
import Nav from './models/nav';
import { StudentProvider } from '@/context/StudentContext';
import { TutorProvider } from '@/context/TutorContext';
import { LessonProvider } from '@/context/LessonContext';
import { TestProvider } from '@/context/TestContext';
import { TestSubmissionProvider } from '@/context/TestSubmissionContext';
import { SubmissionProvider } from '@/context/SubmissionContext';
import { SubmissionEntryProvider } from '@/context/SubmissionEntryContext';
import { GradeProvider } from '@/context/GradeContext';
import { QuestionGradeProvider } from '@/context/QuestionGradeContext';
import { LessonCompletionProvider } from '@/context/LessonCompletionContext';
import { EventProvider } from '@/context/EventContext';

/*
 * Layout notes:
 *   - The document (window) is the only vertical scroller. `main` used to be
 *     its own `h-screen overflow-y-auto` box, which Next's route-change
 *     scroll reset doesn't handle: it resets `<html>` (a no-op there) and
 *     skips scrolling when the new page's first element is already in the
 *     viewport, so a short page kept the long page's offset.
 *   - The sidebar is sticky beside the content on lg+, and a drawer opened
 *     from the header below that.
 *   - No page footer — its content lives at the foot of the nav.
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <MathProvider>
    <div className="flex min-h-screen bg-background">
      <Nav mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />

      {/* min-w-0 lets wide children (tables, code) scroll inside themselves
          instead of widening the page past the viewport. */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <Header onOpenMenu={() => setMenuOpen(true)} />
          <div className="flex-1 pb-12">
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
            <EventProvider>
              {children}
            </EventProvider>
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
          </div>
      </main>
    </div>
    </MathProvider>
  );
}
