import { ArrowLeft } from "lucide-react";
import Skeleton from "../../components/skeleton";

export default function SubmissionFormSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button className="text-blue-600 hover:text-blue-800 mb-4 flex items-center" disabled>
            <ArrowLeft className="w-4 h-4 mr-3" /> Back to Submissions
          </button>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>

        <div className="bg-white p-6 border border-gray-200 space-y-6">
          {/* Title */}
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* Description */}
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-20 w-full mb-2" />
            <Skeleton className="h-16 w-full" />
          </div>

          {/* Instruction Files */}
          <div>
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-24 w-full" />
          </div>

          {/* Course */}
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* File Type */}
          <div>
            <Skeleton className="h-4 w-36 mb-2" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* Due Date */}
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* Last Due Date */}
          <div>
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-9 w-full mb-2" />
            <Skeleton className="h-3 w-64" />
          </div>

          {/* Max Attempts */}
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
