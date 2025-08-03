import { BookOpen, Calendar, CheckCircle, Clock, Edit, FileText, XCircle } from "lucide-react";
import DialogHeader from "./dialog-header";
import DialogOverlay from "./dialog-overlay";

type TestDetailsDialogProps = {
  test: Test; 
  course: Course; 
  onClose: () => void;
}

const TestDetailsDialog = ({ test, course, onClose }: TestDetailsDialogProps) => {
  const stats = {
    total: test.submissions.length,
    graded: test.submissions.filter(s => s.status === 'graded').length,
    submitted: test.submissions.filter(s => s.status === 'submitted').length,
    late: test.submissions.filter(s => s.status === 'late').length
  };

  const averageScore = stats.graded > 0 
    ? test.submissions
        .filter(s => s.score !== undefined)
        .reduce((sum, s) => sum + (s.score || 0), 0) / stats.graded
    : 0;

  return (
    <DialogOverlay onClose={onClose}>
      <DialogHeader title="Test Details" onClose={onClose} />
      
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {/* Test Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
          <h3 className="text-2xl font-bold mb-2">{test.title}</h3>
          <div className="flex items-center gap-2 opacity-90">
            <BookOpen className="w-4 h-4" />
            <span>{course.name}</span>
          </div>
          {test.description && (
            <p className="text-sm mt-3 opacity-90">{test.description}</p>
          )}
        </div>

        {/* Test Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Test Information</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  <strong>Due:</strong> {new Date(test.dueDate).toLocaleDateString()} at{' '}
                  {new Date(test.dueDate).toLocaleTimeString()}
                </span>
              </div>
              
              {test.timeLimit && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    <strong>Time Limit:</strong> {test.timeLimit} minutes
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  <strong>Total Points:</strong> {test.totalPoints}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  test.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {test.isActive ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Inactive
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Statistics</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{test.questions.length}</div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500">Submissions</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-700">{stats.graded}</div>
                <div className="text-xs text-green-600">Graded</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-yellow-700">{stats.submitted}</div>
                <div className="text-xs text-yellow-600">Pending</div>
              </div>
            </div>
            
            {stats.graded > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-700">
                  {Math.round(averageScore)}/{test.totalPoints}
                </div>
                <div className="text-xs text-blue-600">Average Score</div>
              </div>
            )}
          </div>
        </div>

        {/* Questions Preview */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Questions ({test.questions.length})</h4>
          
          <div className="space-y-3">
            {test.questions.slice(0, 3).map((question, index) => (
              <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-500">Question {index + 1}</span>
                  <span className="text-sm text-gray-500">{question.points} pts</span>
                </div>
                <p className="text-gray-700 text-sm mb-2">
                  {question.question}
                </p>
                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {question.type}
                </span>
              </div>
            ))}
            
            {test.questions.length > 3 && (
              <div className="text-center py-2">
                <span className="text-sm text-gray-500">
                  ... and {test.questions.length - 3} more questions
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          Close
        </button>
        <button className="px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700 transition-colors flex items-center gap-2">
          <Edit className="w-4 h-4" />
          Edit Test
        </button>
      </div>
    </DialogOverlay>
  );
};

export default TestDetailsDialog;