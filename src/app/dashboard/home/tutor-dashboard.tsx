import Link from "next/link";

export default function TutorDashboard() {
  return (
    <div className="h-full px-6 pt-6 pb-10 space-y-12 bg-gray-50 overflow-y-auto">
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Welcome Tutor 👋</h1>
        <p className="text-sm text-gray-600">Manage your courses, meetings, and assessments below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/dashboard/my-courses" className="block p-6 bg-white rounded-xl border border-gray-200 hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold text-blue-600">My Courses</h2>
          <p className="text-sm text-gray-500 mt-1">Edit content, manage enrolments, and more.</p>
        </Link>

        <Link href="/dashboard/calendar" className="block p-6 bg-white rounded-xl border border-gray-200 hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold text-indigo-600">Meeting Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">Keep track of upcoming sessions.</p>
        </Link>
      </div>
    </div>
  );
}
