"use client";

import { SessionProvider } from 'next-auth/react';

// Legacy Batch 1 (design 07) removed the activity-log and notification
// providers; Batch 3b removed profile and courses, once the assignment
// editor stopped reading them. Only the next-auth session is left.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
