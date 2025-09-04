export default function SubmissionGradingPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="flex border overflow-hidden">
                <div className="h-9 w-20 bg-gray-200 animate-pulse" />
                <div className="h-9 w-20 bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto px-4 sm:px-6 lg:px-0 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Details */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Submitted Files */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                    <div className="flex space-x-2">
                      <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                      <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Grade */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Submission Status */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="px-6 py-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 w-full bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
