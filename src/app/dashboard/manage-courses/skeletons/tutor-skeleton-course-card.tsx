import Skeleton from "../../components/skeleton";

export default function TutorCourseCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow animate-pulse">
      {/* Image Skeleton */}
      <div className="h-40 w-full bg-gray-200" />

      {/* Info Skeleton */}
      <div className="p-5 space-y-3">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-full bg-gray-300" />
          <Skeleton className="h-4 w-2/3 bg-gray-300 rounded" />
        </div>

        {/* Description */}
        <Skeleton className="h-3 w-full bg-gray-200 rounded" />
        <Skeleton className="h-3 w-5/6 bg-gray-200 rounded" />
        <Skeleton className="h-3 w-4/6 bg-gray-200 rounded" />

        {/* Student count */}
        <div className="flex items-center gap-1 pt-1">
          <Skeleton className="w-4 h-4 rounded-full bg-gray-300" />
          <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2 pt-3">
          <Skeleton className="h-6 w-32 rounded-full bg-gray-200" />
          <Skeleton className="h-6 w-24 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
