import { formatDate, formatTimeAgo } from "@/lib/functions";
import { JsonObject } from "@prisma/client/runtime/library";
import { Award, CheckCircle, Upload, BookOpen, FileText, AlertCircle } from "lucide-react";

type OverviewProps = {
  submissions: AppTypes.Submission[];
  tests: AppTypes.Test[];
  testsLoading?: boolean;
  submissionsLoading?: boolean;
  testSubmissions: AppTypes.TestSubmission[];
  entries: AppTypes.SubmissionEntry[];
  progressPercentage: number;
  notifications: AppTypes.Notification[];
  activities: AppTypes.ActivityLog[];
  calculateOverallGrade: () => number;
}

export default function Overview({ 
  submissions, 
  entries, 
  tests, 
  testsLoading = false, 
  submissionsLoading = false, 
  testSubmissions, 
  progressPercentage, 
  notifications, 
  activities,
  calculateOverallGrade 
}: OverviewProps) {
  
  const getActivityIcon = (action: string) => {
    const actionMap: { [key: string]: React.ReactNode } = {
      'LESSON_COMPLETED': <CheckCircle className="h-5 w-5 text-green-500" />,
      'TEST_COMPLETED': <Award className="h-5 w-5 text-blue-500" />,
      'ASSIGNMENT_SUBMITTED': <Upload className="h-5 w-5 text-purple-500" />,
      'GRADE_RECEIVED': <Award className="h-5 w-5 text-yellow-500" />,
      'COURSE_VIEWED': <BookOpen className="h-5 w-5 text-indigo-500" />,
      'COURSE_LOAD_ERROR': <AlertCircle className="h-5 w-5 text-red-500" />,
      'default': <FileText className="h-5 w-5 text-gray-500" />
    };

    return actionMap[action] || actionMap.default;
  };

  const getActivityDescription = (activity: AppTypes.ActivityLog) => {
    const actionMap: { [key: string]: string } = {
      'LESSON_COMPLETED': 'Completed lesson',
      'TEST_COMPLETED': 'Completed test',
      'ASSIGNMENT_SUBMITTED': 'Submitted assignment',
      'GRADE_RECEIVED': 'Received grade',
      'COURSE_VIEWED': 'Viewed course',
      'COURSE_LOAD_ERROR': 'Course loading error',
      'default': 'Activity performed'
    };

    const baseDescription = actionMap[activity.action] || actionMap.default;
    
    if ((activity.meta as JsonObject)?.lessonTitle) {
      return `${baseDescription}: ${(activity.meta as JsonObject).lessonTitle}`;
    }
    if ((activity.meta as JsonObject)?.score) {
      return `${baseDescription}: ${(activity.meta as JsonObject).score}%`;
    }
    
    return baseDescription;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {activities.length === 0 ? (
                <NoResourcePage resource="Recent activity" />
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.action)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Loading State */}
              {(submissionsLoading || testsLoading) && (
                <LoadingResource />
              )}
              
              {/* Empty State */}
              {(!submissionsLoading && !testsLoading && submissions.length === 0 && tests.length === 0) && (
                <NoResourcePage resource="Upcoming deadlines" />
              )}
              
              {/* Submissions */}
              {!submissionsLoading && submissions.length > 0 && submissions
                .filter(s => new Date(s.dueDate) > new Date() && !entries.some(e => e.submissionId === s.id))
                .map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-md">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{assignment.title}</p>
                      <p className="text-sm text-gray-600">Due {formatDate(assignment.dueDate)}</p>
                    </div>
                    <button className="px-3 py-1 bg-orange-600 text-white text-sm hover:bg-orange-700 rounded">
                      View
                    </button>
                  </div>
                ))
              }

              {/* Tests */}
              {!testsLoading && tests.length > 0 && tests
                .filter(t => new Date(t.dueDate) > new Date() && !testSubmissions.some(s => s.testId === t.id))
                .map(test => (
                  <div key={test.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-md">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{test.title}</p>
                      <p className="text-sm text-gray-600">Due {formatDate(test.dueDate)}</p>
                    </div>
                    <button className="px-3 py-1 bg-orange-600 text-white text-sm hover:bg-orange-700 rounded">
                      View
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Course Progress</span>
              <span className="font-semibold text-gray-900">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Assignments Submitted</span>
              <span className="font-semibold text-gray-900">
                {entries.filter(e => e.status === "SUBMITTED").length}/{submissions.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Grade</span>
              <span className="font-semibold text-gray-900">{calculateOverallGrade()}%</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <span className="text-xs text-blue-600 hover:underline cursor-pointer">View all</span>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <NoResourcePage resource="Notifications" />
              ) : (
                notifications.slice(0, 3).map(notification => (
                  <div key={notification.id} className={`p-3 rounded-md ${!notification.isRead ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                    <p className="text-sm text-gray-900 font-medium">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoResourcePage({ resource }: { resource: string }) {
  return (
    <div className="text-center py-6 text-gray-500 text-sm">
      No {resource.toLowerCase()} found
    </div>
  );
}

function LoadingResource() {
  return (
    <div className="py-6 bg-gray-100 rounded animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
    </div>
  );
}