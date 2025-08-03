import Skeleton from "../../components/skeleton";

export const PreTestInstructionsPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header Skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-t-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-12 h-12 rounded-full bg-white/30" />
              <div className="flex-1">
                <Skeleton className="h-8 w-80 mb-2 bg-white/30" />
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 bg-white/30" />
                  <Skeleton className="h-4 w-48 bg-white/30" />
                </div>
              </div>
            </div>
            <Skeleton className="h-5 w-full bg-white/30" />
            <Skeleton className="h-5 w-3/4 mt-2 bg-white/30" />
          </div>

          {/* Test Overview Cards */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Skeleton className="w-5 h-5" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions Section Skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="p-6">
            <Skeleton className="h-7 w-48 mb-4" />
            
            <div className="space-y-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-5/6" />
              <Skeleton className="h-5 w-4/5" />
              
              <div className="space-y-3 mt-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-2" />
                    <Skeleton className="h-5 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Test Details Section Skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Skeleton className="h-5 w-36 mb-3" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Skeleton */}
        <div className="flex justify-center">
          <Skeleton className="h-12 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
};