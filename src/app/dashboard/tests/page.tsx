'use client'

import { assessments, courses } from '@/lib/static'
import { CalendarDays, Timer } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function TestsPage() {
  const router = useRouter()

  // Group assessments by course
  const groupedByCourse = courses
    .map((course) => ({
      ...course,
      tests: assessments.filter((a) => a.courseId === course.courseId),
    }))
    .filter((course) => course.tests.length > 0)

  return (
    <div className="h-full w-full px-6 py-10 bg-gray-50 overflow-y-auto">
      <header className="max-w-5xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-gray-800">
          Your Active Tests
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Browse and access your currently active tests across all courses.
        </p>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        {(groupedByCourse.length === 0) ? (
          <EmptyState />
        ) : (
          groupedByCourse.map((course) => (
            <section
              key={course.courseId}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <h2 className="text-lg font-semibold text-blue-600 mb-4">
                {course.courseName}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {course.tests.map((test) => (
                  <div
                    key={test.id}
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 hover:shadow transition"
                  >
                    <h3 className="text-md font-semibold text-gray-800 mb-1">
                      {test.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <CalendarDays className="w-4 h-4" />
                      Due: {new Date(test.dueDate).toLocaleString()}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Active
                      </span>

                      <button
                        onClick={() =>
                          router.push(`/courses/${course.courseId}/tests/${test.id}`)
                        }
                        className="text-sm text-white bg-blue-500 hover:bg-blue-400 px-3 py-1.5 transition"
                      >
                        Start Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
      <div className="relative mx-auto w-44 h-44 mb-2">
        <Image
          src="/images/No-Result.jpg"
          alt="No results"
          className="object-cover"
          fill
        />
      </div>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">
        No Active Tests
      </h2>
      <p className="text-sm text-gray-500">
        You currently have no tests available. Check back later or contact your tutor.
      </p>
    </div>
  );
}