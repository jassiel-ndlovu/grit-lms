import React, { useState } from 'react';
import { 
  AlertCircle, 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Eye, 
  FileText, 
  Trash2, 
  XCircle, 
  X,
  Download,
  GraduationCap,
  User,
  Star,
  AlertTriangle,
  Edit
} from "lucide-react";

// Dialog Components
const DialogOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      {children}
    </div>
  </div>
);

const DialogHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-100">
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
    <button
      onClick={onClose}
      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
    >
      <X className="w-5 h-5 text-gray-500" />
    </button>
  </div>
);

// View Submissions Dialog
const ViewSubmissionsDialog = ({ 
  test, 
  course, 
  onClose 
}: { 
  test: Test; 
  course: Course; 
  onClose: () => void 
}) => {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

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
                        <h4 className="font-medium text-gray-900">{submission.studentName}</h4>
                        <p className="text-sm text-gray-500">
                          Submitted: {new Date(submission.submittedAt).toLocaleDateString()} at{' '}
                          {new Date(submission.submittedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </span>
                      
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatScore(submission.score, test.totalPoints)}
                        </p>
                        {submission.score !== undefined && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-gray-500">
                              {Math.round((submission.score / test.totalPoints) * 100)}%
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

// Delete Confirmation Dialog
const DeleteConfirmationDialog = ({ 
  test, 
  onConfirm, 
  onCancel 
}: { 
  test: Test; 
  onConfirm: () => void; 
  onCancel: () => void 
}) => (
  <DialogOverlay onClose={onCancel}>
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Delete Test</h2>
          <p className="text-gray-500 text-sm">This action cannot be undone</p>
        </div>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-700 text-sm mb-4">
          Are you sure you want to delete the test <strong>"{test.title}"</strong>?
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">This will permanently delete:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• The test and all {test.questions.length} questions</li>
            <li>• All {test.submissions.length} student submissions</li>
            <li>• All grades and feedback</li>
            <li>• Test analytics and statistics</li>
          </ul>
        </div>
      </div>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
        >
          Delete Test
        </button>
      </div>
    </div>
  </DialogOverlay>
);

// Test Details Dialog
const TestDetailsDialog = ({ 
  test, 
  course, 
  onClose 
}: { 
  test: Test; 
  course: Course; 
  onClose: () => void 
}) => {
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
                <p className="text-gray-700 mb-2">{question.question}</p>
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

// Enhanced TestCard with Dialog States
const getSubmissionStats = (test: Test) => {
  const total = test.submissions.length;
  const graded = test.submissions.filter(s => s.status === 'graded').length;
  const submitted = test.submissions.filter(s => s.status === 'submitted').length;
  return { total, graded, submitted };
};

const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

type TestCardProps = {
  test: Test;
  course?: Course;
  setSelectedTest: (test: Test) => void;
  setShowSubmissions: (visible: boolean) => void;
  setDeleteConfirmation: (testId: string) => void;
};

export default function TestCard({ test, course, setDeleteConfirmation, setSelectedTest, setShowSubmissions }: TestCardProps) {
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  const stats = getSubmissionStats(test);
  const isOverdue = new Date(test.dueDate) < new Date();

  const handleDelete = () => {
    // Call the actual delete function from TestContext here
    console.log('Deleting test:', test.id);
    setShowDeleteDialog(false);
    // You would call your TestContext delete function here
  };

  return (
    <>
      <div className="bg-white border rounded-xl border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 group">
        <TestCardHeader
          test={test}
          course={course as Course}
          onViewSubmissions={() => setShowSubmissionsDialog(true)}
          onDelete={() => setShowDeleteDialog(true)}
        />
        <TestCardStatus test={test} isOverdue={isOverdue} />
        <div className="p-4">
          {test.description && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">
              {test.description}
            </p>
          )}
          <TestCardStats test={test} stats={stats} />
          <TestCardProgress stats={stats} />
          <TestCardDates test={test} isOverdue={isOverdue} />
        </div>
        <TestCardFooter 
          test={test} 
          stats={stats} 
          onViewSubmissions={() => setShowSubmissionsDialog(true)}
          onViewDetails={() => setShowDetailsDialog(true)}
        />
      </div>

      {/* Dialogs */}
      {showSubmissionsDialog && (
        <ViewSubmissionsDialog
          test={test}
          course={course as Course}
          onClose={() => setShowSubmissionsDialog(false)}
        />
      )}

      {showDeleteDialog && (
        <DeleteConfirmationDialog
          test={test}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      {showDetailsDialog && (
        <TestDetailsDialog
          test={test}
          course={course as Course}
          onClose={() => setShowDetailsDialog(false)}
        />
      )}
    </>
  );
}

const TestCardFooter = ({
  test,
  stats,
  onViewSubmissions,
  onViewDetails,
}: {
  test: Test;
  stats: ReturnType<typeof getSubmissionStats>;
  onViewSubmissions: () => void;
  onViewDetails: () => void;
}) => (
  <div className="px-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <FileText className="w-3 h-3" />
        Created {new Date(test.createdAt).toLocaleDateString()}
      </div>
      <div className="flex items-center gap-1">
        {stats.submitted > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
            <AlertCircle className="w-3 h-3" />
            {stats.submitted} pending
          </span>
        )}
        <button
          onClick={onViewDetails}
          className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded transition-colors duration-200"
        >
          View Details
        </button>
      </div>
    </div>
  </div>
);

const TestCardDates = ({ test, isOverdue }: { test: Test; isOverdue: boolean }) => (
  <div className="space-y-2 text-sm">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
        Due: {formatDate(test.dueDate)}
      </span>
    </div>
    {test.timeLimit && (
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-gray-600">{test.timeLimit} minutes</span>
      </div>
    )}
  </div>
);

const TestCardProgress = ({ stats }: { stats: ReturnType<typeof getSubmissionStats> }) => {
  const completionRate = stats.total > 0 ? Math.round((stats.graded / stats.total) * 100) : 0;
  return stats.total > 0 ? (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">Completion Progress</span>
        <span className="text-xs text-gray-500">{completionRate}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionRate}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-xs">
        <span className="text-green-600">{stats.graded} graded</span>
        {stats.submitted > 0 && <span className="text-yellow-600">{stats.submitted} pending</span>}
      </div>
    </div>
  ) : null;
};

const TestCardStats = ({ test, stats }: { test: Test; stats: ReturnType<typeof getSubmissionStats> }) => (
  <div className="grid grid-cols-3 gap-3 mb-4">
    <div className="text-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
      <div className="text-lg font-bold text-gray-900">{test.questions.length}</div>
      <div className="text-xs text-gray-500 uppercase">Questions</div>
    </div>
    <div className="text-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
      <div className="text-lg font-bold text-gray-900">{test.totalPoints}</div>
      <div className="text-xs text-gray-500 uppercase">Points</div>
    </div>
    <div className="text-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
      <div className="text-lg font-bold text-gray-900">{stats.total}</div>
      <div className="text-xs text-gray-500 uppercase">Students</div>
    </div>
  </div>
);

const TestCardStatus = ({ test, isOverdue }: { test: Test; isOverdue: boolean }) => (
  <div className="mt-3 flex items-center justify-between">
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${test.isActive
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-600'
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

    {isOverdue && (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium">
        <AlertCircle className="w-3 h-3" />
        Overdue
      </span>
    )}
  </div>
);

const TestCardHeader = ({
  test,
  course,
  onViewSubmissions,
  onDelete,
}: {
  test: Test;
  course: Course;
  onViewSubmissions: () => void;
  onDelete: () => void;
}) => (
  <div className="rounded-t-xl bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold truncate">{test.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <BookOpen className="w-4 h-4 opacity-80" />
          <span className="text-sm opacity-90 truncate">{course?.name}</span>
        </div>
      </div>

      <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button 
          onClick={onViewSubmissions} 
          className="p-1.5 bg-white/20 hover:bg-white/30 rounded transition-colors duration-200" 
          title="View submissions"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button 
          onClick={onDelete} 
          className="p-1.5 bg-white/20 hover:bg-red-500 hover:bg-opacity-80 rounded transition-colors duration-200" 
          title="Delete test"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);