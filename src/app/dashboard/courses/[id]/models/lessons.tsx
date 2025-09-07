import { BookOpen, CheckCircle, ChevronRight, Clock, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type LessonProps = {
  studentId: string;
  lessons: AppTypes.Lesson[];
  lessonCompletions: AppTypes.LessonCompletion[];
  loading?: boolean;
}

export default function Lessons({ studentId, lessons, lessonCompletions, loading = false }: LessonProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const pathname = usePathname();
  const courseId = pathname.split('/').pop();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="inline text-xl font-semibold text-gray-900 cursor-pointer">
            Course Lessons
          </h2>
          <Link
            href={`/dashboard/courses/lessons/${courseId}`}
            className="ml-4 text-xs text-blue-500 hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200">
        <div className="divide-y divide-gray-200">
          {loading ? (
            <LessonsSkeleton />
          ) : lessons.length === 0 ? (
            <NoLessonsCard />
          ) :
            lessons.map((lesson, index) => {
              const completed = lessonCompletions.find(c => c.studentId === studentId && c.lessonId === lesson.id);

              return (
                <div key={lesson.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {completed ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                          <div className="h-6 w-6 border-2 border-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-xs text-gray-500">{index + 1}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text font-medium text-gray-900">{lesson.title}</h3>
                        {lesson.duration && <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500 flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {lesson.duration}
                          </span>
                        </div>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {completed ? (
                        <Link
                          href={`/dashboard/courses/lessons/${courseId}?index=${index}`}
                          className="px-4 py-2 text-blue-600 hover:underline text-sm font-medium">
                          Review
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/courses/lessons/${courseId}?index=${index}`}
                          className="px-4 py-1 bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                          Start
                        </Link>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              )
            }
            )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- No Lessons Card ---------------- */
function NoLessonsCard() {
  return (
    <div className="p-10 text-center text-gray-600">
      <div className="flex flex-col items-center space-y-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <BookOpen className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Lessons Found</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          This course doesn’t have any lessons yet. Please check back later or
          contact your instructor for updates.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Skeleton Loader ---------------- */
function LessonsSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-6 w-6 bg-gray-200 rounded-full" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}