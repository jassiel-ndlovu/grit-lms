import Skeleton from "../components/skeleton";

export default function ManageLessonsSkeleton() {
  return (
    <div className="h-full grid grid-cols-[250px_1fr] bg-gray-100">
      {/* Sidebar Skeleton */}
      <aside className="h-full p-4 bg-gray-600 text-white space-y-4">
        <Skeleton className="h-6 w-3/4 bg-gray-400" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full bg-gray-800 rounded" />
          ))}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="p-8 space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="space-y-1">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>

        {/* Lesson Content Card */}
        <div className="bg-white p-6 border border-gray-300 rounded space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full" />

          {/* Videos */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-56 w-full rounded-md" />
          </div>

          {/* Resources */}
          <div className="space-y-2 mt-4">
            <Skeleton className="h-5 w-1/3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-2/3" />
            ))}
          </div>

          {/* Button */}
          <div className="pt-4">
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </main>
    </div>
  );
}
