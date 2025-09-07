import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { Calendar, ClipboardList, Eye, Play, Star } from "lucide-react";
import Link from "next/link";

type AssessmentsProps = {
  tests: AppTypes.Test[];
  testSubs: AppTypes.TestSubmission[];
  getStatusColor: (status: $Enums.SubmissionStatus | string) => string;
  loading?: boolean;
}

export default function Assessments({ tests, testSubs, getStatusColor, loading = false }: AssessmentsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="inline text-xl font-semibold text-gray-900 cursor-pointer">
          Course Lessons
        </h2>
        <Link
          href={`/dashboard/tests`}
          className="ml-4 text-xs text-blue-500 hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <AssessmentsSkeleton />
        ) : tests.length === 0 ? (
          <NoAssessmentsCard />
        ) :
          tests.map(test => {
            const sub = testSubs.find(s => s.testId === test.id);
            return (
              <div key={test.id} className="bg-white border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-medium text-gray-900">
                        {test.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub?.status ?? "")}`}>
                        {sub ? sub.status : "Not Started"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6 mt-2">
                      <span className="text-sm text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Due {formatDate(new Date(test.dueDate))}
                      </span>
                      {/* <span className="text-sm text-gray-600">
                    Attempts: {test.attempts}
                  </span> */}
                      {test.totalPoints !== null && (
                        <span className="text-sm text-gray-600 flex items-center">
                          {sub && (
                            <>
                              <Star className="h-4 w-4 mr-1" />
                              {sub.score}/{test.totalPoints}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {test.isActive ? (
                      <Link
                        href={`/dashboard/tests/pre-test/${test.id}`}
                        className="px-4 py-2 flex items-center bg-green-600 text-white text-sm hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-1 inline" />
                        Go To Test
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/tests/review/${test.id}`}
                        className="px-4 py-2 flex items-center border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4 mr-1 inline" />
                        View Results
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ---------------- No Assessments Card ---------------- */
export function NoAssessmentsCard() {
  return (
    <div className="p-10 text-center text-gray-600 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col items-center space-y-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <ClipboardList className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Assessments Found</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          There are currently no tests or assessments available. New ones will
          appear here as soon as they are created.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Assessments Skeleton ---------------- */
export function AssessmentsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 p-6 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="flex space-x-4">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-8 w-28 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}