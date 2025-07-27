import Skeleton from "../../components/skeleton";

export function TestCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex gap-2 ml-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center space-y-1">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-3 w-3/4 mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-3 w-3/4 mx-auto" />
          </div>
        </div>

        {/* Submission stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-2 text-sm">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Time limit */}
        <div className="flex items-center gap-2 text-sm">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Status */}
        <div className="pt-4 border-t border-gray-100">
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}
