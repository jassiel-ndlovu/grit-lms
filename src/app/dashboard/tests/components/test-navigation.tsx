// app/dashboard/tests/take/[id]/components/test-navigation.tsx
import React from 'react';
import { Eye, EyeOff, ChevronRight, ChevronDown } from 'lucide-react';

interface TestNavigationProps {
  test: AppTypes.Test;
  currentQuestionIndex: number;
  answeredCount: number;
  showAnswers: boolean;
  expandedQuestions: Set<string>;
  onQuestionSelect: (index: number) => void;
  onToggleAnswers: () => void;
  onToggleExpansion: (questionId: string) => void;
  getQuestionStatus: (index: number) => "current" | "answered" | "unanswered" | undefined;
}

export const TestNavigation: React.FC<TestNavigationProps> = ({
  test,
  currentQuestionIndex,
  answeredCount,
  showAnswers,
  expandedQuestions,
  onQuestionSelect,
  onToggleAnswers,
  onToggleExpansion,
  getQuestionStatus
}) => {
  const getStatusColor = (status: "current" | "answered" | "unanswered" | undefined) => {
    switch (status) {
      case 'current': return 'bg-blue-600 text-white shadow-lg scale-105';
      case 'answered': return 'bg-green-100 text-green-800 border-green-300';
      case 'unanswered': return 'bg-gray-100 text-gray-600 border-gray-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: "current" | "answered" | "unanswered" | undefined) => {
    switch (status) {
      case 'answered': return '✓';
      default: return '';
    }
  };

  const renderQuestionItem = (question: AppTypes.TestQuestion | Omit<AppTypes.TestQuestion, "subQuestions" | "parent">, index: number, level = 0) => {
    const status = getQuestionStatus(index);
    let hasSubQuestions = false;
    if ("subQuestions" in question) {
      hasSubQuestions = question.subQuestions && question.subQuestions.length > 0;
    }
    const isExpanded = expandedQuestions.has(question.id);
    const isCurrent = index === currentQuestionIndex;

    return (
      <div key={question.id}>
        {/* Main Question */}
        <div
          onClick={() => onQuestionSelect(index)}
          className={`flex items-center gap-3 p-3 mb-2 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
            isCurrent 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-transparent hover:border-gray-300'
          } ${getStatusColor(status)}`}
        >
          {/* Status Indicator */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
            isCurrent ? 'bg-white text-blue-600' : getStatusColor(status)
          }`}>
            {getStatusIcon(status) || index + 1}
          </div>

          {/* Question Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {level === 0 ? `Question ${index + 1}` : `Part ${index + 1}`}
              </span>
              {hasSubQuestions && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpansion(question.id);
                  }}
                  className="p-1 hover:bg-black/10 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            <div className={`text-xs truncate ${isCurrent ? "text-white/70": "text-gray-500"}`}>
              {question.points} pts • {question.type.replace('_', ' ').toLowerCase()}
            </div>
          </div>
        </div>

        {/* Sub-questions */}
        {"subQuestions" in question && hasSubQuestions && isExpanded && (
          <div className="ml-8 space-y-2 border-l-2 border-blue-200 pl-3">
            {question.subQuestions.map((subQ, subIndex) => 
              renderQuestionItem(subQ, subIndex, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const progressPercentage = (answeredCount / test.questions.length) * 100;

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200/60 shadow-sm sticky top-24">
      {/* Header */}
      <div className="p-6 border-b border-gray-200/60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-lg">Test Navigator</h3>
          <button
            onClick={onToggleAnswers}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title={showAnswers ? 'Hide answers' : 'Show answers'}
          >
            {showAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">
              {answeredCount}/{test.questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <div className="space-y-1">
          {test.questions.map((question, index) => 
            renderQuestionItem(question, index)
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-t border-gray-200/60 bg-gray-50/50 rounded-b-2xl">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{answeredCount}</div>
            <div className="text-gray-500">Answered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">
              {test.questions.length - answeredCount}
            </div>
            <div className="text-gray-500">Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};