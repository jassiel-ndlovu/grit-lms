"use client";

import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { $Enums } from "@/generated/prisma";
import { cleanUrl, formatDate } from "@/lib/functions";
import { 
  Download, 
  Eye, 
  FileText, 
  ArrowLeft, 
  Upload, 
  Paperclip, 
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  BookOpen,
  Star,
  MessageSquare
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import SubmissionDetailsSkeleton from "../../../skeletons/review-skeleton";
import { useErrorPages } from "@/app/dashboard/components/error-pages";
import LessonMarkdown from "@/app/components/markdown";

interface SubmissionReviewPageProps {
  params: Promise<{ id: string }>;
}

export default function SubmissionReviewPage({ params }: SubmissionReviewPageProps) {
  const { id } = use(params);

  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { profile } = useProfile();
  const { loading: submissionLoading, fetchSubmissionById } = useSubmission();
  const { loading: entryLoading, fetchEntryByStudentIdSubId } = useSubmissionEntries();
  const router = useRouter();
  const { renderNotFoundPage } = useErrorPages();

  const studentProfile = profile as AppTypes.Student;

  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [entry, setEntry] = useState<AppTypes.SubmissionEntry | null>();

  // fetch submission
  useEffect(() => {
    if (!id) return;

    const fetch = async () => {
      const sub = (await fetchSubmissionById(id)) as AppTypes.Submission;
      setSubmission(sub);
    };
    fetch();
  }, [id, fetchSubmissionById]);

  // fetch submission entry for student
  useEffect(() => {
    if (!id || !studentProfile || !submission) return;

    const fetch = async () => {
      const subEntry = (await fetchEntryByStudentIdSubId(studentProfile.id, id)) as AppTypes.SubmissionEntry;

      // allow resubmission if within dueDate OR lastDueDate
      const now = new Date();
      const withinDue = now <= new Date(submission.dueDate);
      const withinLate = submission.lastDueDate ? now <= new Date(submission.lastDueDate) : false;

      setCanEdit((withinDue || withinLate));
      setEntry(subEntry);
    };
    fetch();
  }, [id, studentProfile, submission, fetchEntryByStudentIdSubId]);

  // fetch course
  useEffect(() => {
    if (!id || !submission) return;

    const fetch = async () => {
      const courses = (await fetchCoursesByIds([submission.courseId])) as AppTypes.Course[];
      setCourse(courses[0]);
    };
    fetch();
  }, [id, submission, fetchCoursesByIds]);

  if (courseLoading || submissionLoading || entryLoading || !course || !submission || !studentProfile) {
    return <SubmissionDetailsSkeleton />;
  }

  if (!submission) {
    return renderNotFoundPage({
      resourceType: "submission",
      onRedirect: () => router.push("/dashboard/submissions"),
      redirectDelay: 5,
    });
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case $Enums.SubmissionStatus.GRADED:
        return {
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle,
          bgColor: "bg-emerald-100"
        };
      case $Enums.SubmissionStatus.LATE:
        return {
          color: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
          bgColor: "bg-amber-100"
        };
      default:
        return {
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: Clock,
          bgColor: "bg-blue-100"
        };
    }
  };

  const statusConfig = entry ? getStatusConfig(entry.status) : null;
  const StatusIcon = statusConfig?.icon || Clock;

  const isOverdue = new Date() > new Date(submission.dueDate) && !entry;
  const isNearDue = new Date() > new Date(new Date(submission.dueDate).getTime() - 24 * 60 * 60 * 1000) && !isOverdue && !entry;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/submissions")}
            className="group flex items-center text-slate-600 hover:text-blue-600 transition-colors duration-200 mb-6"
          >
            <div className="p-2 rounded-lg bg-white shadow-sm group-hover:shadow-md transition-all duration-200 mr-3">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="font-medium">Back to Submissions</span>
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                      {submission.title}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-500 text-sm">{course.name}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Due {formatDate(submission.dueDate)}</span>
                  </div>
                  {submission.lastDueDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-slate-600">Final due {formatDate(submission.lastDueDate)}</span>
                    </div>
                  )}
                  {entry && (
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4" />
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig?.color}`}>
                        {entry.status.replace("_", " ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {canEdit && (
                <button
                  onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  {entry ? "Resubmit" : "Submit"}
                </button>
              )}
            </div>

            {/* Alert Banners */}
            {isOverdue && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Submission Overdue</p>
                    <p className="text-red-600 text-sm">This assignment was due on {formatDate(submission.dueDate)}</p>
                  </div>
                </div>
              </div>
            )}

            {isNearDue && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">Due Soon</p>
                    <p className="text-amber-600 text-sm">This assignment is due on {formatDate(submission.dueDate)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Instructions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  Instructions
                </h2>
              </div>
              
              <div className="p-6">
                {submission.description && (
                  <div className="text-sm">
                    <LessonMarkdown content={submission.description} />
                  </div>
                )}

                {submission.descriptionFiles && submission.descriptionFiles.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="font-medium text-slate-700 text-sm uppercase tracking-wide">Attachments</h4>
                    {submission.descriptionFiles.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors duration-200"
                      >
                        <div className="p-2 bg-white group-hover:bg-blue-100 rounded-lg transition-colors duration-200">
                          <Paperclip className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <span className="text-slate-700 text-sm group-hover:text-blue-700 font-medium">
                          {cleanUrl(url.split("/").pop() ?? "File")}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submitted Files */}
            {entry && entry.fileUrl.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-xl">
                      <Upload className="w-5 h-5 text-green-600" />
                    </div>
                    Submitted Files
                  </h2>
                </div>
                
                <div className="p-6 space-y-4">
                  {entry.fileUrl.map((link, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-50/50 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{link.split("/").pop()}</p>
                          <p className="text-sm text-slate-500">Submitted on {formatDate(entry.submittedAt)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="View"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        <a
                          href={link}
                          download
                          className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            {entry && entry.feedback && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-xl">
                      <MessageSquare className="w-5 h-5 text-amber-600" />
                    </div>
                    Instructor Feedback
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6">
                    <div className="flex gap-4">
                      <div className="p-2 bg-amber-100 rounded-xl flex-shrink-0">
                        <User className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-800 leading-relaxed">{entry.feedback}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Submission Status */}
            {entry ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-900 mb-6">Submission Status</h3>
                
                <div className="space-y-6">
                  {/* Grade */}
                  {entry.grade !== undefined && (
                    <div className="text-center">
                      {entry.grade ? (
                        <div className="relative">
                          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-200">
                            <span className="text-2xl font-bold text-emerald-700">{entry?.grade?.score ?? 0}%</span>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-medium text-slate-600">Your Grade</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < Math.round((entry?.grade?.score ?? 0) / 20)
                                      ? "text-yellow-400 fill-current"
                                      : "text-slate-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full flex items-center justify-center border-4 border-slate-200">
                          <Clock className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Details */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig?.color}`}>
                        {entry.status.replace("_", " ")}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Submitted</span>
                      <span className="text-sm text-slate-900">{formatDate(entry.submittedAt)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Due Date</span>
                      <span className="text-sm text-slate-900">{formatDate(submission.dueDate)}</span>
                    </div>

                    {submission.lastDueDate && (
                      <div className="flex items-center justify-between py-3">
                        <span className="text-sm font-medium text-slate-600">Final Due</span>
                        <span className="text-sm text-slate-900">{formatDate(submission.lastDueDate)}</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Resubmit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-900 mb-6">Assignment Details</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Due Date</span>
                    <span className="text-sm text-slate-900">{formatDate(submission.dueDate)}</span>
                  </div>
                  
                  {submission.lastDueDate && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Final Due</span>
                      <span className="text-sm text-slate-900">{formatDate(submission.lastDueDate)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-slate-600">Status</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      Not Submitted
                    </span>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
                    className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Submit Assignment
                  </button>
                )}
              </div>
            )}

            {/* Course Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Course Information</h3>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 line-clamp-1">{course.name}</p>
                  {course.description && (
                    <p className="line-clamp-2 text-sm text-slate-500">
                      {course.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}