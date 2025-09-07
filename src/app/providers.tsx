"use client";

import { ActivityLogProvider } from '@/context/ActivityLogContext';
import { CoursesProvider } from '@/context/CourseContext';
import { NotificationProvider } from '@/context/NotificationsContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} >
      <ProfileProvider>
        <CoursesProvider>
          <NotificationProvider>
            <ActivityLogProvider>
              {children}
            </ActivityLogProvider>
          </NotificationProvider>
        </CoursesProvider>
      </ProfileProvider>
    </SessionProvider>
  );
}
