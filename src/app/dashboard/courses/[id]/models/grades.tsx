import { BarChart3 } from "lucide-react";

type GradesProps = {
  grades: AppTypes.Grade[];
  loading?: boolean;
}

export default function Grades({ grades, loading }: GradesProps) {
  const calculateOverallGrade = () => {
    const total = grades.reduce((sum, grade) => sum + grade.score, 0);
    const maxTotal = grades.reduce((sum, grade) => sum + grade.outOf, 0);
    return maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Your Grades
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{calculateOverallGrade()}%</div>
          <div className="text-sm text-gray-600">
            Overall Average
          </div>
        </div>
      </div>

      {loading ? (
        <GradesSkeleton />
      ) : grades.length === 0 ? (
        <NoGradesCard />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 border-b border-gray-200 text-sm font-medium text-gray-900">{grade.title}</td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${grade.type === 'Assignment' ? 'bg-blue-100 text-blue-800' :
                      grade.type === 'Quiz' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                      {grade.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200 text-sm font-medium text-gray-900">
                    {grade.score}/{grade.outOf}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200 text-sm font-medium text-gray-900">
                    {Math.round((grade.score / grade.outOf) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- No Grades Card ---------------- */
export function NoGradesCard() {
  return (
    <div className="p-10 text-center text-gray-600 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col items-center space-y-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <BarChart3 className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Grades Available</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Your grades will appear here once you’ve completed assessments and they
          have been marked.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Grades Skeleton ---------------- */
export function GradesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="text-right space-y-1">
          <div className="h-8 w-16 bg-gray-200 rounded ml-auto" />
          <div className="h-4 w-24 bg-gray-200 rounded ml-auto" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr>
              {["Assessment", "Type", "Score", "Percentage"].map((col, i) => (
                <th key={i} className="px-6 py-3 border-b text-left">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 border-b">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-4 border-b">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-4 border-b">
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-4 border-b">
                  <div className="h-4 w-12 bg-gray-200 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}