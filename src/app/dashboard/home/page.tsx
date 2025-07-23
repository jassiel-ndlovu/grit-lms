'use client';

import { useSession } from 'next-auth/react';
import StudentDashboard from './student-dashboard';
import TutorDashboard from './tutor-dashboard';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="p-6 text-gray-600">Loading dashboard...</div>;
  }

  const role = session?.user?.role;

  if (role === 'TUTOR') {
    return <TutorDashboard />;
  }

  // default to student
  return <StudentDashboard />;
}
