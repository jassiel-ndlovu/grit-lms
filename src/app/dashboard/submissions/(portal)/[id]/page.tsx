/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { 
  Calendar, 
  FileText, 
  ArrowLeft, 
  Plus, 
  Upload, 
  CloudUpload,
  File,
  CheckCircle,
  Clock,
  BookOpen,
  AlertCircle,
  X
} from "lucide-react";
import { use, useEffect, useState } from "react";
import SubmissionUploadSkeleton from "../../skeletons/portal-skeleton";
import { useRouter } from "next/navigation";
import { Dialog, useDialog } from "@/app/dashboard/components/pop-up";
import { uploadFile } from "@/lib/blob";
import { useErrorPages } from "@/app/dashboard/components/error-pages";
import { formatDate } from "@/lib/functions";

// submission id
interface SubmissionPortalProps {
  params: Promise<{ id: string }>;
}

export default function SubmissionPortal({ params }: SubmissionPortalProps) {
  const { id } = use(params);

  const { loading: submissionLoading, fetchSubmissionById } = useSubmission();
  const { loading: entryLoading, fetchEntryByStudentIdSubId, createEntry, updateEntry } = useSubmissionEntries();
  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { profile } = useProfile();
  const router = useRouter();
  const { showDialog, hideDialog, dialogState } = useDialog();
  const { renderNotFoundPage, renderAccessDeniedPage } = useErrorPages();

  const studentProfile = profile as AppTypes.Student;

  // useStates
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [submissionEntry, setSubmissionEntry] = useState<AppTypes.SubmissionEntry | null>(null);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // first find submission
  useEffect(() => {
    if (!id) return;

    const fetch = async () => {
      const sub = await fetchSubmissionById(id) as AppTypes.Submission;
      setSubmission(sub);
    }

    fetch();
  }, [id, fetchSubmissionById]);

  // then find submission entry, if it exists
  useEffect(() => {
    if (!id || !studentProfile) return;

    const fetch = async () => {
      const entry = await fetchEntryByStudentIdSubId(studentProfile.id, id) as AppTypes.SubmissionEntry;
      setSubmissionEntry(entry);
    }

    fetch();
  }, [id, studentProfile, fetchEntryByStudentIdSubId]);

  // also find the course for the course name
  useEffect(() => {
    if (!id || !submission) return;

    const fetch = async () => {
      const courses = await fetchCoursesByIds([submission.courseId]) as AppTypes.Course[];
      setCourse(courses[0]);
    }

    fetch();
  }, [id, submission, fetchCoursesByIds]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      let uploadedUrls: string[] = [];

      // Upload all files from uploadedFiles state
      if (uploadedFiles.length > 0) {
        const uploads = await Promise.all(
          uploadedFiles.map(async (file) => {
            const url = await uploadFile(file);
            return url;
          })
        );
        uploadedUrls = uploads;
      }

      if (submissionEntry) {
        console.log("Submission Entry exists", submissionEntry);
        // Update existing entry
        await updateEntry(submissionEntry.id, {
          submittedAt: new Date(),
          status: "SUBMITTED",
          attemptNumber: submissionEntry.attemptNumber + 1,
          fileUrl: uploadedUrls,
        });
      } else {
        // Create a new submission entry
        await createEntry({
          studentId: (profile as AppTypes.Student).id,
          submissionId: (submission as AppTypes.Submission).id,
          submittedAt: new Date(),
          status: "SUBMITTED",
          attemptNumber: 1,
          fileUrl: uploadedUrls,
          feedback: "",
          grade: null,
        });
      }

      // Clear uploaded files after successful submission
      setUploadedFiles([]);

      showDialog({
        type: "success",
        title: "Success!",
        message: "Your operation completed successfully.",
        onConfirm: () => router.push(`/dashboard/submissions/review/${(submission as AppTypes.Submission).id}`),
      });
    } catch (err: any) {
      console.error(err);
      showDialog({
        type: "error",
        title: "Error",
        message: err.message || "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getAcceptedFileTypes = (submission: AppTypes.Submission) => {
    return [
      ...submission.fileType.split(',').map(type => {
        switch (type.trim()) {
          case 'PDF': return '.pdf';
          case 'DOCX': return '.docx,.doc';
          case 'ZIP': return '.zip';
          case 'JPEG': return '.jpg,.jpeg';
          default: return '';
        }
      }),
      "application/zip",
    ].join(",");
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <File className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx':
        return <File className="w-5 h-5 text-blue-600" />;
      case 'zip':
        return <File className="w-5 h-5 text-amber-500" />;
      case 'jpg':
      case 'jpeg':
        return <File className="w-5 h-5 text-green-500" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const dueDate = new Date(submission?.dueDate || '');
  const now = new Date();
  const timeUntilDue = dueDate.getTime() - now.getTime();
  const hoursUntilDue = Math.floor(timeUntilDue / (1000 * 60 * 60));
  const isUrgent = hoursUntilDue <= 24 && hoursUntilDue > 0;

  if (courseLoading || entryLoading || submissionLoading || !submission || !course) {
    return <SubmissionUploadSkeleton />
  }

  if (!submission) {
    return renderNotFoundPage({
      resourceType: "submission",
      onRedirect: () => router.push("/dashboard/submissions"),
      redirectDelay: 5,
    });
  }

  if (new Date() > new Date(submission.dueDate)) {
    return renderAccessDeniedPage({
      reason: "This submission portal is closed. No further submissions are accepted",
      resourceType: "submission",
      onGoBack: () => router.push(`/dashboard/submissions/review/${submission.id}`)
    });
  }

  return (
    <>
      <Dialog
        isOpen={dialogState.isOpen}
        onClose={hideDialog}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        autoClose={dialogState.autoClose}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="max-w-4xl mx-auto px-6 py-8">
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
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Upload className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
                      {submission.title}
                    </h1>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-600 font-medium">{course.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600">Due {formatDate(dueDate)}</span>
                      </div>
                      {submissionEntry && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-600">
                            Resubmission (Attempt #{submissionEntry.attemptNumber + 1})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    isUrgent 
                      ? "bg-amber-50 text-amber-700 border-amber-200" 
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {isUrgent ? "Due Soon" : "Active"}
                  </div>
                </div>
              </div>

              {/* Urgency Alert */}
              {isUrgent && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Assignment Due Soon</p>
                      <p className="text-amber-600 text-sm">
                        Only {hoursUntilDue} hours remaining until the deadline
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <CloudUpload className="w-5 h-5 text-emerald-600" />
                </div>
                Upload Your Submission
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Accepted formats: {submission.fileType.split(',').join(', ')}, ZIP
              </p>
            </div>

            <div className="p-6">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50/50 scale-[1.02]'
                    : uploadedFiles.length > 0
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className={`transition-all duration-200 ${dragActive ? 'scale-110' : ''}`}>
                  <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${
                    dragActive 
                      ? 'bg-blue-100' 
                      : uploadedFiles.length > 0 
                      ? 'bg-emerald-100' 
                      : 'bg-slate-100'
                  }`}>
                    {dragActive ? (
                      <CloudUpload className="w-8 h-8 text-blue-600" />
                    ) : uploadedFiles.length > 0 ? (
                      <CheckCircle className="w-8 h-8 text-emerald-600" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-500" />
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-slate-800 mb-2">
                    {dragActive 
                      ? 'Drop files here' 
                      : uploadedFiles.length > 0 
                      ? `${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} ready to submit`
                      : 'Drop files here or click to browse'
                    }
                  </h3>
                  
                  <p className="text-slate-500 text-sm mb-6">
                    {dragActive 
                      ? 'Release to upload files'
                      : 'Maximum file size: 4MB per file'
                    }
                  </p>

                  <input
                    type="file"
                    multiple
                    accept={getAcceptedFileTypes(submission)}
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Choose Files
                  </label>
                </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-600" />
                    Selected Files ({uploadedFiles.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all duration-200">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="p-2 bg-white rounded-lg border border-slate-200">
                            {getFileIcon(file.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{file.name}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                              <span>{formatFileSize(file.size)}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Just now
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeFile(index)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Section */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    {uploadedFiles.length === 0 
                      ? "Please select files to submit"
                      : `Ready to submit ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}`
                    }
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={uploadedFiles.length === 0 || submitting}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-medium rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Submit Assignment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                Submission Guidelines
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  Ensure all files are in the accepted formats
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  Maximum file size is 4MB per file
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  Submit only one file at a time; multiple file uploads are not allowed
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  You can resubmit before the deadline
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  Review your submission after uploading
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                Important Dates
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-slate-600">Due Date</span>
                  <span className="text-sm text-slate-900 font-medium">
                    {formatDate(dueDate)}
                  </span>
                </div>
                {submission.lastDueDate && (
                  <div className="flex items-center justify-between py-2 border-t border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Final Due Date</span>
                    <span className="text-sm text-slate-900 font-medium">
                      {formatDate(submission.lastDueDate)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Time Remaining</span>
                  <span className={`text-sm font-medium ${isUrgent ? 'text-amber-600' : 'text-slate-900'}`}>
                    {hoursUntilDue > 0 ? `${hoursUntilDue} hours` : 'Overdue'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}