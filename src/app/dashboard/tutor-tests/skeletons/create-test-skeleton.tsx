import Skeleton from "../../components/skeleton";

const TestCreationSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    {/* Header Skeleton */}
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </div>

    {/* Main Content Skeleton */}
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Form Header Skeleton */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-gray-50">
          <Skeleton className="w-10 h-10 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>

          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <Skeleton className="h-px w-full" />

          {/* Questions Section Skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-20" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>

            {/* Question Cards Skeleton */}
            {[...Array(3)].map((_, index) => (
              <div key={index} className="border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="w-4 h-4" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  </div>
);

export default TestCreationSkeleton;