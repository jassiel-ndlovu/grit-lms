'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Message } from '@/lib/message.class';

type ProfileContextType = {
  session: ReturnType<typeof useSession>['data'];
  status: ReturnType<typeof useSession>['status'];
  profile: Student | Tutor | null;
  loading: boolean;
  message: Message | null;
  fetchProfile: () => Promise<void>;
  clearMessage: () => void;
  updateProfile: (updatedData: Partial<Student | Tutor>) => Promise<void>;
};

export const ProfileContext = createContext<ProfileContextType>({
  session: null,
  status: 'loading',
  profile: null,
  loading: false,
  message: null,
  fetchProfile: async () => {},
  clearMessage: () => {},
  updateProfile: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Student | Tutor | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id || !session.user.role) {
      setMessage(Message.warning(
        'Session information incomplete',
        { duration: 3000 }
      ));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/profile?role=${session.user.role}`);
      if (!res.ok) {
        throw new Error(res.statusText || 'Failed to fetch profile');
      }
      const data = await res.json();
      setProfile(data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Error loading profile',
        { title: 'Profile Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const updateProfile = useCallback(async (updatedData: Partial<Student | Tutor>) => {
    if (!profile?.id || !session?.user?.role) {
      setMessage(Message.error(
        'Cannot update profile - missing required information',
        { duration: 5000 }
      ));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedData,
          role: session.user.role,
          id: profile.id
        }),
      });

      if (!res.ok) {
        throw new Error(res.statusText || 'Failed to update profile');
      }

      const data = await res.json();
      setProfile(data);
      setMessage(Message.success(
        'Profile updated successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Error updating profile',
        { title: 'Update Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, [profile, session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider
      value={{
        session,
        status,
        profile,
        loading,
        message,
        fetchProfile,
        clearMessage,
        updateProfile
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};