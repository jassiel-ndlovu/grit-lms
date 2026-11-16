"use client";

import { CoursesProvider } from '@/context/CourseContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from 'next-auth/react';

// Legacy Batch 1 (design 07): the activity-log and notification providers
// are gone; nothing read them. Profile and courses go in Batches 2 and 3.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} >
      <ProfileProvider>
        <CoursesProvider>
          {children}
        </CoursesProvider>
      </ProfileProvider>
    </SessionProvider>
  );
}
