// app/dashboard/tests/take/[id]/components/test-header.tsx
import React from 'react';
import { Timer, Save, Send } from 'lucide-react';
import { formatTime } from '@/lib/functions';

interface TestHeaderProps {
  test: AppTypes.Test;
  courses: AppTypes.Course[];
  timeRemaining: number | null;
  isSaving: boolean;
  isUploading: boolean;
  onSaveProgress: () => void;
  onSubmit: () => void;
}

export const TestHeader: React.FC<TestHeaderProps> = ({
  test,
  courses,
  timeRemaining,
  isSaving,
  isUploading,
  onSaveProgress,
  onSubmit
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
              {test.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {courses[0]?.name} • {test.questions.length} questions
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                timeRemaining < 300 
                  ? 'bg-red-100 text-red-700 animate-pulse' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono">{formatTime(timeRemaining)}</span>
              </div>
            )}

            <button
              onClick={onSaveProgress}
              disabled={isUploading || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>

            <button
              onClick={onSubmit}
              disabled={timeRemaining === 0 || isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {timeRemaining === 0 ? 'Time Expired' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};