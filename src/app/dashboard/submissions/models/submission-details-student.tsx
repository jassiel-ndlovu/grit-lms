import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { Download, Eye, FileText, MoveLeft, Upload } from "lucide-react";

interface SubmissionDetailsProps {
  submission: AppTypes.Submission;
  studentId: string;
  onBack: () => void;
  onEdit: () => void;
}

export default function SubmissionDetails({ submission, studentId, onBack, onEdit }: SubmissionDetailsProps) {
  const entry = submission.entries.find(e => e.studentId === studentId);

  if (!entry) {
    return <div>No submission found</div>;
  }

  const canEdit = entry.status === $Enums.SubmissionStatus.SUBMITTED && new Date() <= submission.dueDate;

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            <MoveLeft className="w-5 h-5 mr-2" /> Back to Submissions
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {submission.title}
          </h1>
          <p className="text-gray-600 text-sm">
            {submission.courseId}
          </p>
        </div>

        {/* Submission Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Submission Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Due Date</p>
              <p className="text-gray-900 text-sm">
                {formatDate(submission.dueDate)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Submitted</p>
              <p className="text-gray-900 test-sm">
                {formatDate(entry.submittedAt)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${entry.status === $Enums.SubmissionStatus.GRADED
                  ? 'bg-green-100 text-green-800'
                  : entry.status === $Enums.SubmissionStatus.LATE
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                {entry.status.replace('_', ' ')}
              </span>
            </div>

            {entry.grade !== undefined && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Grade</p>
                {entry.grade ? (
                  <p className="text-2xl font-bold text-green-600">{entry.grade}%</p>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200">
                    Not Graded
                  </span>
                )}

              </div>
            )}
          </div>

          {canEdit && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                Resubmit
              </button>
            </div>
          )}
        </div>

        {/* Submitted File */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Submitted Files
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-gray-400 mr-4" />
              <div>
                {entry.fileUrl.map((link, i) => (
                  <p
                    key={i}
                    className="font-medium text-gray-900"
                  >
                    {link.split('/').pop()}
                  </p>
                ))}
                <p className="text-sm text-gray-500">
                  Submitted on {formatDate(entry.submittedAt)}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button className="p-2 text-gray-600 hover:text-gray-800">
                <Eye className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-800">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {entry.feedback && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Instructor Feedback</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-gray-700">{entry.feedback}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}