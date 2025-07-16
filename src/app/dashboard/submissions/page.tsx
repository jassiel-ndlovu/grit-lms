'use client';

import { submissions, courses } from '@/lib/static';
import { Clock, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function SubmissionsPage() {
  const active = submissions;
  const past = submissions;

  return (
    <div className="h-full px-6 py-6 space-y-10 bg-gray-50">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-blue-600">Submissions</h1>
        <p className="text-sm text-gray-600">
          View and manage all your pending and completed submissions.
        </p>
      </div>

      {/* Active Submissions */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Active Submissions</h2>
        {active.length === 0 ? (
          <NoSubmissions message="You have no pending submissions." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {active.map((s) => {
              const course = courses.find(c => c.courseId === s.courseId);
              return (
                <div
                  key={s.id}
                  className="bg-white rounded shadow border border-gray-200 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-blue-700">{s.title}</p>
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Due: {new Date(s.dueDate).toUTCString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Course: {course?.courseName || 'Unknown'}
                  </p>
                  <Link
                    href={`/dashboard/courses/${s.courseId}`}
                    className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Go to Course
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Submissions */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Completed Submissions</h2>
        {past.length === 0 ? (
          <NoSubmissions message="You haven’t completed any submissions yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {past.map((s) => {
              const course = courses.find(c => c.courseId === s.courseId);
              return (
                <div
                  key={s.id}
                  className="bg-white rounded shadow border border-gray-200 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-green-700">{s.title}</p>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Submitted: {new Date(s.dueDate).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Course: {course?.courseName || 'Unknown'}
                  </p>
                  <Link
                    href={`/dashboard/courses/${s.courseId}`}
                    className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                  >
                    View Course
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function NoSubmissions({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center text-gray-500 bg-white shadow rounded">
      <Image
        src="/images/empty-submissions.svg"
        alt="No submissions"
        width={180}
        height={180}
        className="mb-4"
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
