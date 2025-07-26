"use client"

import { ReactNode } from 'react';
import Footer from './models/footer'
import Header from './models/header';
import Nav from './models/nav';
import { StudentProvider } from '@/context/StudentContext';
import { TutorProvider } from '@/context/TutorContext';
import { CoursesProvider } from '@/context/CourseContext';
import { LessonProvider } from '@/context/LessonContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-full max-h-screen flex flex-col">
      {/* Layout Container */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Nav />

        {/* Main Content */}
        <main className="h-full max-h-[100vh] overflow-y-auto flex-1 flex flex-col">
          <Header />
          <div className="h-full max-h-[92vh]">
            <StudentProvider>
              <TutorProvider>
                <CoursesProvider>
                  <LessonProvider>
                  {children}
                  </LessonProvider>
                </CoursesProvider>
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