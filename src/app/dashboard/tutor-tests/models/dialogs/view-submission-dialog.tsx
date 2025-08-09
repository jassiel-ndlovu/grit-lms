import { GraduationCap, Star, User } from "lucide-react";
import DialogOverlay from "./dialog-overlay";
import DialogHeader from "./dialog-header";
import { useState } from "react";

type ViewSubmissionsDialogProps = {
  test: AppTypes.Test; 
  course: AppTypes.Course; 
  onClose: () => void;
}
const ViewSubmissionsDialog = ({ test, course, onClose }: ViewSubmissionsDialogProps) => {
  const [selectedSubmission, setSelectedSubmission] = useState<AppTypes.TestSubmission | null>(null);
  console.log(selectedSubmission);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'late': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatScore = (score?: number, totalPoints?: number) => {
    if (score === undefined) return 'Not graded';
    return `${score}/${totalPoints || test.totalPoints} (${Math.round((score / (totalPoints || test.totalPoints)) * 100)}%)`;
  };

  return (
    <DialogOverlay onClose={onClose}>
      <DialogHeader title={`Submissions - ${test.title}`} onClose={onClose} />
      
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {/* Test Overview */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Course:</span>
              <p className="font-medium">{course.name}</p>
            </div>
            <div>
              <span className="text-gray-500">Due Date:</span>
              <p className="font-medium">{new Date(test.dueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Total Points:</span>
              <p className="font-medium">{test.totalPoints}</p>
            </div>
            <div>
              <span className="text-gray-500">Questions:</span>
              <p className="font-medium">{test.questions.length}</p>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 mb-4">
            Student Submissions ({test.submissions.length})
          </h3>
          
          {test.submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {test.submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{submission.studentId}</h4>
                        <p className="text-sm text-gray-500">
                          Submitted: {new Date(submission.submittedAt as Date).toLocaleDateString()} at{' '}
                          {new Date(submission.submittedAt as Date).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </span>
                      
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatScore(submission.score as number, test.totalPoints)}
                        </p>
                        {submission.score !== undefined && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-gray-500">
                              {Math.round(((submission.score as number) / test.totalPoints) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setSelectedSubmission(submission)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                  
                  {submission.feedback && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                      <p className="text-sm text-gray-700">{submission.feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          Close
        </button>
        <button className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">
          Export Results
        </button>
      </div>
    </DialogOverlay>
  );
};

export default ViewSubmissionsDialog;