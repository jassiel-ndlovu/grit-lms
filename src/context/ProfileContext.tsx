'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type ProfileContextType = {
  session: ReturnType<typeof useSession>['data'];
  status: ReturnType<typeof useSession>['status'];
  profile: Student | Tutor | null;
};

export const ProfileContext = createContext<ProfileContextType>({
  session: null,
  status: 'loading',
  profile: null,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Student | Tutor | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) {
        console.warn("No user ID in session");
        return;
      }

      if (!session.user.role) {
        console.warn("No role in session user", session.user);
        return;
      }

      try {
        const res = await fetch(`/api/profile?role=${session.user.role}`);
        if (!res.ok) {
          console.error("Failed to fetch profile");
          return;
        }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };

    fetchProfile();
  }, [session]);


  return (
    <ProfileContext.Provider value={{ session, status, profile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
