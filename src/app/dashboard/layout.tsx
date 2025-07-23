"use client"

import { ReactNode } from 'react';
import Footer from './models/footer'
import Header from './models/header';
import Nav from './models/nav';
import { StudentProvider } from '@/context/StudentContext';
import { TutorProvider } from '@/context/TutorContext';
import { CoursesProvider } from '@/context/CourseContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Layout Container */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Nav />

        {/* Main Content */}
        <main className="h-[100vh] flex-1 flex flex-col">
          <Header />
          <div className="h-[92vh]">
            <StudentProvider>
              <TutorProvider>
                <CoursesProvider>
                  {children}
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