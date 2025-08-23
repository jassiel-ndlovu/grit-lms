"use client";

import { useProfile } from "@/context/ProfileContext";
import StudentSubmissionsPage from "./student-submissions";
import TutorSubmissionsPage from "./tutor-submissions";

export default function SubmissionsPage() {
  const { profile, session, status } = useProfile();

  if (!profile || status === "loading") {
    return <div className="p-6 text-gray-600">
      Loading submissions...
    </div>;
  }

  if (session?.user.role === "STUDENT") {
    return <StudentSubmissionsPage studentId={(profile as AppTypes.Student).id} />
  } else if (session?.user.role === "TUTOR") {
    return <TutorSubmissionsPage tutorId={(profile as AppTypes.Tutor).id} />
  }

  return (
    <div className="p-6 text-gray-600">Not a legitimate account type...</div>
  );
}

