import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function CourseContentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-gray-800">Course Not Found</h2>
        <p className="text-sm text-gray-500 mt-1">
          We couldn't load this course. It may have been removed or there was a server issue.
        </p>
      </div>
      <Link
        href="/dashboard/manage-courses"
        className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
      >
        Go Back to Courses
      </Link>
    </div>
  );
}