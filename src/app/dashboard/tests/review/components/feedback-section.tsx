// components/review/FeedbackSection.tsx

interface FeedbackSectionProps {
  submission: AppTypes.TestSubmission;
}

export function FeedbackSection({ submission }: FeedbackSectionProps) {
  if (!submission.feedback && !submission.grade?.finalComments) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Instructor Feedback</h2>
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        {submission.grade?.finalComments && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-blue-900 mb-1">Final Comments</h3>
            <p className="text-blue-900 whitespace-pre-wrap">{submission.grade.finalComments}</p>
          </div>
        )}
        {submission.feedback && (
          <div>
            {submission.grade?.finalComments && (
              <h3 className="text-sm font-medium text-blue-900 mb-1">Additional Feedback</h3>
            )}
            <p className="text-blue-900 whitespace-pre-wrap">{submission.feedback}</p>
          </div>
        )}
      </div>
    </div>
  );
}