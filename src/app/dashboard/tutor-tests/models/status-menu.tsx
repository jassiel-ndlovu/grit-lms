import { CheckCircle, Clock, X, XCircle } from "lucide-react";
import { useState } from "react";

type StatusCheckProps = {
  stats: {
    gradedCount: number;
    submittedCount: number;
    inProgressCount: number;
  };
  isActive: boolean;
}

export default function StatusCheck({ stats, isActive }: StatusCheckProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-1 text-sm text-blue-600 hover:underline transition"
      >
        {isActive ? "View Status" : "Check Status"}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 animate-slide-in-right">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Status
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="text-gray-400 w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
                  }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>

                {stats.gradedCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {stats.gradedCount} graded
                  </span>
                )}

                {stats.inProgressCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    {stats.inProgressCount} in progress
                  </span>
                )}

                {stats.submittedCount === 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <XCircle className="w-3 h-3 mr-1" />
                    No submissions
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}