import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { Calendar, Eye, Filter, Inbox, Star, Upload } from "lucide-react";
import Link from "next/link";

type SubmissionsProps = {
  submissions: AppTypes.Submission[];
  entries: AppTypes.SubmissionEntry[];
  getStatusColor: (status: $Enums.SubmissionStatus | string) => string;
  loading?: boolean;
}

export default function Submissions({ submissions, entries, getStatusColor, loading = false }: SubmissionsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="inline text-xl font-semibold text-gray-900 cursor-pointer">
            Submissions
          </h2>
          <Link
            href={`/dashboard/submissions`}
            className="ml-4 text-xs text-blue-500 hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select className="w-48 border border-gray-300 px-3 py-2 text-sm">
            <option>All Status</option>
            <option>Upcoming</option>
            <option>Submitted</option>
            <option>Graded</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
        <SubmissionsSkeleton />
        ) : submissions.length === 0 ? (
          <NoSubmissionsCard />
        ) : 
        submissions.map(assignment => {
          const entry = entries.find(e => e.submissionId === assignment.id)
          return (
          <div key={assignment.id} className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="font-medium text-gray-900">{assignment.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry?.status ?? "")}`}>
                    {entry ? entry.status : "Not Submitted"}
                  </span>
                </div>
                <div className="flex items-center space-x-6 mt-2">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Due {formatDate(new Date(assignment.dueDate))}
                  </span>
                  {entry && entry.grade !== null && (
                    <span className="text-sm text-gray-600 flex items-center">
                      <Star className="h-4 w-4 mr-1" />
                      {entry.grade.score}/{entry.grade.outOf}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <Link
                href={`/dashboard/submissions/review/${assignment.id}`}
                 className="px-4 py-1 border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                 >
                  <Eye className="h-4 w-4 mr-1 inline" />
                  View
                </Link>
                {assignment.isActive && (
                  <Link 
                  href={`/dashboard/submissions/${assignment.id}`}
                  className="px-4 py-1 bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4 mr-1 inline" />
                    Go To Portal
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        )}
      </div>
    </div>
  );
}

/* ---------------- No Submissions Card ---------------- */
export function NoSubmissionsCard() {
  return (
    <div className="p-10 text-center text-gray-600 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col items-center space-y-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <Inbox className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Submissions Found</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          You don’t have any submissions yet. Once assignments are created, they’ll
          appear here for you to complete and track.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Skeleton Loader ---------------- */
export function SubmissionsSkeleton() {
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
            <div className="flex space-x-2">
              <div className="h-8 w-20 bg-gray-200 rounded" />
              <div className="h-8 w-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
