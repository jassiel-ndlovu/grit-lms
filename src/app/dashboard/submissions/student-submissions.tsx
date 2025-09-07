/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { $Enums } from "@/generated/prisma";
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, XCircle, Upload, Award, AlertTriangle, TrendingUp, Search, BookOpen, MoreHorizontal, Eye, Edit, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useRouter } from "next/navigation";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";

interface StudentSubmissionsPageProps {
  studentId: string;
}

export default function StudentSubmissionsPage({ studentId }: StudentSubmissionsPageProps) {
  const { loading: coursesLoading, fetchCoursesByStudentId } = useCourses();
  const { loading: submissionLoading, fetchSubmissionsByStudentId } = useSubmission();
  const { loading: entriesLoading, fetchEntriesByStudentId } = useSubmissionEntries();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [entries, setEntries] = useState<AppTypes.SubmissionEntry[]>([]);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  const [loading, setLoading] = useState<boolean>(true);

  // fetch courses
  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      setLoading(true);
      const studentCourses = await fetchCoursesByStudentId(studentId) as AppTypes.Course[];
      setCourses(studentCourses);
      setLoading(false);
    };

    fetch();
  }, [studentId, fetchCoursesByStudentId]);

  // fetch submissions
  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      setLoading(true);
      const subs = await fetchSubmissionsByStudentId(studentId) as AppTypes.Submission[];
      setSubmissions(subs);
      setLoading(false);
    }

    fetch();
  }, [studentId, fetchSubmissionsByStudentId]);

  // fetch student submissions
  useEffect(() => {
    if (!studentId) return;

    (async () => {
      setLoading(true);
      const fetchedEntries = await fetchEntriesByStudentId(studentId) as AppTypes.SubmissionEntry[];
      setEntries(fetchedEntries);
      setLoading(false);
    })();
  }, [studentId, fetchEntriesByStudentId]);

  const getSubmissionStatus = useCallback((submission: AppTypes.Submission) => {
    const entry = entries.find(e => e.submissionId === submission.id);

    if (!entry) {
      return new Date() > submission.dueDate
        ? $Enums.SubmissionStatus.NOT_SUBMITTED
        : $Enums.SubmissionStatus.NOT_STARTED;
    }
    return entry.status;
  }, [entries]);

  const getSubmissionWithDetails = useCallback((submission: AppTypes.Submission) => {
    const status = getSubmissionStatus(submission);
    const entry = entries.find(e => e.submissionId === submission.id);
    const course = courses.find(c => c.id === submission.courseId);
    
    return {
      ...submission,
      status,
      courseName: course?.name || 'Unknown Course',
      submittedAt: entry?.submittedAt,
      score: entry?.grade ? Math.round((entry.grade.score / entry.grade.outOf) * 100) : undefined,
      totalPoints: entry?.grade?.outOf || 0
    };
  }, [entries, courses, getSubmissionStatus]);

  const filteredSubmissions = useMemo(() => {
    let submissionsWithDetails = submissions.map(getSubmissionWithDetails);

    // Filter by course
    if (selectedCourse !== 'all') {
      submissionsWithDetails = submissionsWithDetails.filter(sub => sub.courseId === selectedCourse);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      submissionsWithDetails = submissionsWithDetails.filter(sub => sub.status === selectedStatus);
    }

    // Filter by search query
    if (searchQuery) {
      submissionsWithDetails = submissionsWithDetails.filter(sub => 
        sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.courseName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort submissions
    submissionsWithDetails.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return submissionsWithDetails;
  }, [submissions, selectedCourse, selectedStatus, searchQuery, sortBy, getSubmissionWithDetails]);

  const getStats = () => {
    const submissionsWithDetails = submissions.map(getSubmissionWithDetails);
    const total = submissionsWithDetails.length;
    const submitted = submissionsWithDetails.filter(s => s.status === 'SUBMITTED' || s.status === 'GRADED').length;
    const graded = submissionsWithDetails.filter(s => s.status === 'GRADED').length;
    const overdue = submissionsWithDetails.filter(s => s.status === 'NOT_SUBMITTED' && new Date() > new Date(s.dueDate)).length;
    
    const gradedSubmissions = submissionsWithDetails.filter(s => s.score !== undefined);
    const averageScore = gradedSubmissions.length > 0 
      ? Math.round(gradedSubmissions.reduce((acc, s) => acc + s.score!, 0) / gradedSubmissions.length)
      : 0;

    return { total, submitted, graded, overdue, averageScore };
  };

  const stats = getStats();

  const getStatusInfo = (status: string) => {
    const statusMap = {
      'SUBMITTED': {
        icon: <CheckCircle className="w-5 h-5 text-blue-600" />,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        label: 'Submitted'
      },
      'GRADED': {
        icon: <Award className="w-5 h-5 text-green-600" />,
        color: 'bg-green-100 text-green-800 border-green-200',
        label: 'Graded'
      },
      'LATE': {
        icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        label: 'Late'
      },
      'NOT_SUBMITTED': {
        icon: <XCircle className="w-5 h-5 text-red-600" />,
        color: 'bg-red-100 text-red-800 border-red-200',
        label: 'Not Submitted'
      },
      'IN_PROGRESS': {
        icon: <Clock className="w-5 h-5 text-yellow-600" />,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        label: 'In Progress'
      },
      'NOT_STARTED': {
        icon: <Clock className="w-5 h-5 text-gray-600" />,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        label: 'Not Started'
      }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap['NOT_STARTED'];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSubmissionClick = (submission: AppTypes.Submission) => {
    router.push(`/dashboard/submissions/review/${submission.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 p-8 text-white">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">My Submissions</h1>
                <p className="text-blue-100 mt-1">Track and manage your assignment submissions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            icon={<FileText className="w-6 h-6 text-blue-600" />}
            title="Total Assignments"
            value={stats.total}
            color="blue"
          />
          <StatCard
            icon={<Upload className="w-6 h-6 text-green-600" />}
            title="Submitted"
            value={stats.submitted}
            color="green"
          />
          <StatCard
            icon={<Award className="w-6 h-6 text-purple-600" />}
            title="Graded"
            value={stats.graded}
            color="purple"
          />
          <StatCard
            icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
            title="Overdue"
            value={stats.overdue}
            color="red"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-yellow-600" />}
            title="Average Score"
            value={`${stats.averageScore}%`}
            color="yellow"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="all">All Courses</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="GRADED">Graded</option>
                  <option value="NOT_SUBMITTED">Not Submitted</option>
                </select>
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="dueDate">Due Date</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submissions Grid */}
        {loading || coursesLoading || submissionLoading || entriesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState searchQuery={searchQuery} selectedCourse={selectedCourse} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubmissions.map(submission => (
              <SubmissionCard 
                key={submission.id} 
                submission={submission}
                formatDate={formatDate}
                getDaysUntilDue={getDaysUntilDue}
                getStatusInfo={getStatusInfo}
                onClick={() => handleSubmissionClick(submission)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Component definitions
function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: number | string, color: string }) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200",
    yellow: "bg-yellow-50 border-yellow-200"
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
    </div>
  );
}

function SubmissionCard({ submission, formatDate, getDaysUntilDue, getStatusInfo, onClick }: any) {
  const statusInfo = getStatusInfo(submission.status);
  const daysUntilDue = getDaysUntilDue(submission.dueDate);
  const isOverdue = daysUntilDue < 0 && submission.status !== 'SUBMITTED' && submission.status !== 'GRADED';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 group cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 group-hover:text-blue-600 transition-colors">
            {submission.title}
          </h3>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-gray-600">{submission.courseName}</span>
        </div>

        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
          {submission.description}
        </p>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.label}
          </span>
          
          {isOverdue && (
            <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-4">
        {/* Due Date */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Due: {formatDate(submission.dueDate)}</span>
          </div>
          {daysUntilDue > 0 && (
            <span className="text-blue-600 font-medium">
              {daysUntilDue} days left
            </span>
          )}
        </div>

        {/* Submission Date */}
        {submission.submittedAt && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Submitted: {formatDate(submission.submittedAt)}</span>
          </div>
        )}

        {/* Score */}
        {submission.score !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-gray-600">Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-gray-900">{submission.score}%</div>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < Math.floor(submission.score / 20) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar for Points */}
        {submission.totalPoints > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Total Points</span>
              <span>{submission.totalPoints} pts</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: submission.score ? `${submission.score}%` : '0%' }}
              ></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
            <Eye className="w-4 h-4" />
            View Details
          </button>
          
          {(submission.status === 'NOT_STARTED' || submission.status === 'IN_PROGRESS') && (
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
      <div className="h-4 w-1/2 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-2/3 bg-gray-200 rounded mb-4"></div>
      <div className="h-8 w-24 bg-gray-200 rounded-full mb-4"></div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-gray-200 rounded"></div>
        <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

function EmptyState({ searchQuery, selectedCourse }: { searchQuery: string, selectedCourse: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
      <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
        <FileText className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No submissions found
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {searchQuery || selectedCourse !== 'all'
          ? "Try adjusting your search criteria or filters"
          : "You don't have any assignments yet. Check back later for new assignments."}
      </p>
      <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
        Browse Courses
      </button>
    </div>
  );
}