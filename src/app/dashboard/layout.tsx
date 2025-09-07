"use client"

import { ReactNode } from 'react';
import Footer from './models/footer'
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-full max-h-screen flex flex-col">
      {/* Layout Container */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Nav />

        {/* Main Content */}
        <main className="h-screen flex-1 flex flex-col">
          <Header />
          <div className="h-full pb-[50vh] max-h-screen overflow-y-auto bg-gray-50">
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

      {/* Footer */}
      <Footer />
    </div>
  );
}