"use client";

import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} >
      <ProfileProvider>
        {children}
      </ProfileProvider>
    </SessionProvider>
  );
}
