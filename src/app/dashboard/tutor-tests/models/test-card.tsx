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
} from "lucide-react";
import ViewSubmissionsDialog from '../dialogs/view-submission-dialog';
import DeleteConfirmationDialog from '../dialogs/delete-confirmation-dialog';
import TestDetailsDialog from '../dialogs/test-datails-dialog';
import { $Enums } from '@/generated/prisma';

const getSubmissionStats = (test: AppTypes.Test) => {
  if (test.submissions) {
    const total = test.submissions.length;
    const graded = test.submissions.filter(s => s.status === $Enums.SubmissionStatus.GRADED).length;
    const submitted = test.submissions.filter(s => s.status === $Enums.SubmissionStatus.SUBMITTED).length;
    return { total, graded, submitted };
  } else {
    return { 
      total: 0,
      graded: 0, 
      submitted: 0 
    };
  }
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
  test: AppTypes.Test;
  course?: AppTypes.Course;
  deleteTest: (testId: string) => Promise<void>;
};

export default function TestCard({ test, course, deleteTest }: TestCardProps) {
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const stats = getSubmissionStats(test);
  const isOverdue = new Date(test.dueDate) < new Date();

  const handleDelete = () => {
    deleteTest(test.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 group">
        <TestCardHeader
          test={test}
          course={course as AppTypes.Course}
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
          courseName={(course as AppTypes.Course).name}
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
          course={course as AppTypes.Course}
          onClose={() => setShowDetailsDialog(false)}
        />
      )}
    </>
  );
}

type TestCardFooterProps = {
  test: AppTypes.Test;
  stats: ReturnType<typeof getSubmissionStats>;
  onViewSubmissions: () => void;
  onViewDetails: () => void;
}

const TestCardFooter = ({ test, stats, onViewDetails }: TestCardFooterProps) => (
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

const TestCardDates = ({ test, isOverdue }: { test: AppTypes.Test; isOverdue: boolean }) => (
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

const TestCardStats = ({ test, stats }: { test: AppTypes.Test; stats: ReturnType<typeof getSubmissionStats> }) => (
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

const TestCardStatus = ({ test, isOverdue }: { test: AppTypes.Test; isOverdue: boolean }) => (
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

type TestCardHeaderProps = {
  test: AppTypes.Test;
  course: AppTypes.Course;
  onViewSubmissions: () => void;
  onDelete: () => void;
}

const TestCardHeader = ({ test, course, onViewSubmissions, onDelete }: TestCardHeaderProps) => (
  <div className=" bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
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