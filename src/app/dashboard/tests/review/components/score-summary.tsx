// components/review/ScoreSummary.tsx
import { Trophy, Clock, Calendar, FileText } from "lucide-react";

interface ScoreSummaryProps {
  test: AppTypes.Test;
  submission: AppTypes.TestSubmission;
  scoreData: {
    percentage: number;
    points: number;
    totalPoints: number;
  } | null;
}

export function ScoreSummary({ test, submission, scoreData }: ScoreSummaryProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      GRADED: 'bg-green-100 text-green-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      LATE: 'bg-red-100 text-red-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const calculateTimeSpent = () => {
    if (!submission?.startedAt || !submission?.submittedAt) return 'N/A';
    const start = new Date(submission.startedAt);
    const end = new Date(submission.submittedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {test.title}
        </h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(submission.status)}`}>
          {submission.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Score</span>
          </div>
          <div className="font-semibold text-blue-900">
            {scoreData ? (
              <span className={getScoreColor(scoreData.percentage)}>
                {scoreData.percentage.toFixed(1)}%
              </span>
            ) : (
              <span className="text-gray-500">Pending</span>
            )}
          </div>
          <div className="text-xs text-blue-700">
            {scoreData && `${scoreData.points}/${scoreData.totalPoints} points`}
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Time Spent</span>
          </div>
          <div className="font-semibold text-green-900">{calculateTimeSpent()}</div>
          {test.timeLimit && (
            <div className="text-xs text-green-700">Limit: {test.timeLimit}m</div>
          )}
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Submitted</span>
          </div>
          <div className="font-semibold text-purple-900">
            {submission.submittedAt
              ? new Date(submission.submittedAt).toDateString()
              : 'Not submitted'
            }
          </div>
          <div className="text-xs text-purple-700">
            {submission.submittedAt
              ? new Date(submission.submittedAt).toTimeString()
              : ''
            }
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Questions</span>
          </div>
          <div className="font-semibold text-orange-900">{test.questions.length}</div>
          <div className="text-xs text-orange-700">Total questions</div>
        </div>
      </div>
    </div>
  );
}