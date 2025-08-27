const TestReviewSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-4xl mx-auto">
      {/* Header Skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="h-8 bg-gray-200 rounded mb-4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 p-4 rounded-lg">
              <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-6 bg-gray-300 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Questions Skeleton */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="h-6 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse"></div>
          <div className="h-20 bg-gray-100 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

export default TestReviewSkeleton;