import Skeleton from "../../components/skeleton";

const TutorTestsTableSkeleton: React.FC = () => {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50">
      <div className="mb-8">
        <Skeleton className="w-64 h-8 mb-2" />
        <Skeleton className="w-96 h-4" />
      </div>

      <div className="mb-6 p-6 bg-white border border-gray-200 flex justify-between items-center">
        <div className="flex gap-4">
          <Skeleton className="w-64 h-10" />
          <Skeleton className="w-40 h-10" />
          <Skeleton className="w-32 h-10" />
        </div>
        <Skeleton className="w-36 h-10" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Skeleton className="w-full h-8 mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-gray-100 last:border-b-0">
              <Skeleton className="w-48 h-5" />
              <Skeleton className="w-32 h-5" />
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-20 h-5" />
              <Skeleton className="w-32 h-5" />
              <Skeleton className="w-8 h-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TutorTestsTableSkeleton;