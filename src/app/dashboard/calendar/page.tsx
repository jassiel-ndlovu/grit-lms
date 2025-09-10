'use client'

import { useSession } from "next-auth/react";
import TutorSchedulePage from "./tutor-calendar";
import StudentSchedulePage from "./student-calendar";

export default function CalendarPage() {
  const { data: session, status } = useSession();
  
    if (status === 'loading') {
      return <div className="p-6 text-gray-600">Loading dashboard...</div>;
    }
  
    const role = session?.user?.role;
  
    if (role === 'TUTOR') {
      return <TutorSchedulePage />;
    }
  
    // default to student
    return <StudentSchedulePage />;
}
