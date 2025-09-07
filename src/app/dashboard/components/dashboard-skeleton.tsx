import { Calendar, FileText, Send } from "lucide-react";

export default function DashboardSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 space-y-12 bg-gray-50 overflow-y-auto">
      {/* Banner Skeleton */}
      <div className="h-48 rounded-xl bg-white border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
        <div className="p-6 flex-1">
          <div className="h-8 w-48 bg-gray-200 rounded mb-3"></div>
          <div className="h-4 w-80 bg-gray-200 rounded"></div>
        </div>
        <div className="relative w-64 h-24 md:h-full bg-gray-200 rounded"></div>
      </div>

      {/* Continue Working Section Skeleton */}
      <section>
        <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>

      {/* Enrolled Courses Section Skeleton */}
      <section>
        <div className="h-6 w-36 bg-gray-200 rounded mb-4 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>

      {/* Events, Assessments, Submissions Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonSection 
          icon={<Calendar className="w-5 h-5 text-blue-500" />}
          title="Upcoming Meetings"
          color="blue"
        />
        <SkeletonSection 
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
          title="Upcoming Assessments"
          color="indigo"
        />
        <SkeletonSection 
          icon={<Send className="w-5 h-5 text-emerald-600" />}
          title="Upcoming Submissions"
          color="emerald"
        />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="h-32 bg-white border border-gray-200 rounded-xl shadow-sm p-4 animate-pulse">
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-1/2 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
    </div>
  );
}

export function SkeletonSection({ icon, title, color }: { 
  icon: React.ReactNode; 
  title: string; 
  color: 'blue' | 'indigo' | 'emerald' 
}) {
  const colorClasses = {
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600'
  };

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className={`text-md font-semibold ${colorClasses[color]} mb-4 flex items-center gap-2`}>
        {icon}
        {title}
      </h2>
      <div className="space-y-3">
        {[...Array(1)].map((_, i) => (
          <div key={i} className="bg-gray-50 p-3 rounded animate-pulse">
            <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}