"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Calendar, Download, Eye, FileText, Flag, Mail, Save, X, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { $Enums } from "@/generated/prisma";
import { cleanUrl, formatDate } from "@/lib/functions";
import { useCourses } from "@/context/CourseContext";
import { useGrades } from "@/context/GradeContext";
import Link from "next/link";
import SubmissionGradingPageSkeleton from "@/app/dashboard/submissions/skeletons/student-grading-page-skeleton";
import { Dialog, useDialog } from "@/app/dashboard/components/pop-up";

type SubmissionGradingPageProps = {
  params: Promise<{ id: string; studentId: string }>;
}

export default function SubmissionGradingPage({ params }: SubmissionGradingPageProps) {
  const { id: submissionId, studentId } = use(params);
  const { loading: submissionLoading, fetchSubmissionById } = useSubmission();
  const { loading: entriesLoading, fetchEntryByStudentIdSubId, updateEntry } = useSubmissionEntries();
  const { loading: coursesLoading, fetchCoursesByIds } = useCourses();
  const { loading: gradesLoading, fetchGradesByStudentIdEntryId, createGrade, updateGrade } = useGrades();
  const { dialogState, showDialog, hideDialog } = useDialog();
  const router = useRouter();

  const [mode, setMode] = useState<"view" | "grade">("view");
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [entry, setEntry] = useState<AppTypes.SubmissionEntry | null>(null);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [existingGrade, setExistingGrade] = useState<AppTypes.Grade | null>(null);

  const [totalScore, setTotalScore] = useState<number>(0);
  const [totalOutOf, setTotalOutOf] = useState<number>(1);
  const [finalComments, setFinalComments] = useState<string>("");
  const [questionGrades, setQuestionGrades] = useState<AppTypes.QuestionGrade[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Memoized error handler to prevent infinite loops
  const showErrorDialog = useCallback(() => {
    showDialog({
      type: 'error',
      title: 'Error',
      message: 'Failed to load submission data. Please try again.',
      confirmText: 'OK',
      onConfirm: () => router.push('/dashboard/submissions')
    });
  }, [showDialog, router]);

  // Fetch submission and entry
  useEffect(() => {
    if (!submissionId || !studentId) return;

    const fetchData = async () => {
      try {
        const fetchedSubmission = await fetchSubmissionById(submissionId) as AppTypes.Submission;
        setSubmission(fetchedSubmission);

        const fetchedEntry = await fetchEntryByStudentIdSubId(studentId, submissionId) as AppTypes.SubmissionEntry;
        setEntry(fetchedEntry);

        const fetchedCourses = await fetchCoursesByIds([fetchedSubmission.courseId]) as AppTypes.Course[];
        setCourse(fetchedCourses[0] || null);

        const fetchedGrades = await fetchGradesByStudentIdEntryId(studentId, fetchedEntry.id) as AppTypes.Grade;
        if (fetchedGrades) {
          setExistingGrade(fetchedGrades);
          setFinalComments(fetchedGrades.finalComments || "");
          setTotalScore(fetchedGrades.score || 0);
          setTotalOutOf(fetchedSubmission.totalPoints);
          setQuestionGrades(fetchedEntry.questionGrades || []);
        } else {
          setFinalComments("");
          setTotalScore(0);
          setTotalOutOf(fetchedSubmission.totalPoints);
          setQuestionGrades(fetchedEntry.questionGrades || []);
        }
      } catch (error) {
        showErrorDialog();
        console.error(error);
      }
    };

    fetchData();
  }, [submissionId, studentId]);

  // helper functions
  const getStatusColor = (status: $Enums.SubmissionStatus) => {
    switch (status) {
      case 'SUBMITTED': return 'text-green-600 bg-green-50';
      case 'LATE': return 'text-orange-600 bg-orange-50';
      case 'GRADED': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const updateQuestionGrade = (id: string, field: string, value: string) => {
    setQuestionGrades(prev => prev.map(grade =>
      grade.id === id ? { ...grade, [field]: field === 'score' || field === 'outOf' ? parseFloat(value) || 0 : value } : grade
    ));
  };

  const calculateTotalFromQuestions = () => {
    const total = questionGrades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    const maxTotal = questionGrades.reduce((sum, grade) => sum + (grade.outOf || 0), 0);
    setTotalScore(total);
    setTotalOutOf(maxTotal || 1);
  };

  const handleSaveGrade = async () => {
    if (!submission || !entry) return;

    setIsSaving(true);
    try {
      const percentage = Math.round((totalScore / totalOutOf) * 100);

      if (existingGrade) {
        // Update existing grade
        await updateGrade(existingGrade.id, {
          score: totalScore,
          outOf: totalOutOf,
          finalComments: finalComments
        });
      } else {
        // Create new grade
        await createGrade({
          studentId: entry.studentId,
          courseId: submission.courseId,
          type: 'SUBMISSION',
          title: `${submission.title} - ${entry.student.fullName}`,
          score: totalScore,
          outOf: totalOutOf,
          submissionEntryId: entry.id,
          finalComments: finalComments
        });
      }

      // Update entry status to GRADED
      await updateEntry(entry.id, {
        status: $Enums.SubmissionStatus.GRADED
      });

      // Show success dialog
      showDialog({
        type: 'success',
        title: 'Grade Saved',
        message: `Grade saved successfully: ${percentage}%`,
        autoClose: 3000,
        onConfirm: () => {
          setMode('view');
          // Refresh the data by re-fetching
          if (submissionId && studentId) {
            fetchSubmissionById(submissionId).then(sub => setSubmission(sub as AppTypes.Submission));
            fetchEntryByStudentIdSubId(studentId, submissionId).then(entry => setEntry(entry as AppTypes.SubmissionEntry));
            fetchGradesByStudentIdEntryId(studentId, entry.id).then(grade => {
              if (grade) setExistingGrade(grade);
            });
          }
        }
      });

    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Error',
        message: 'Failed to save grade. Please try again.',
        confirmText: 'OK'
      });
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSaveGrade = () => {
    console.log("We arrived here");
    const percentage = Math.round((totalScore / totalOutOf) * 100);

    showDialog({
      type: 'warning',
      title: 'Confirm Grade',
      message: `Are you sure you want to save this grade? The student will receive a score of ${percentage}%.`,
      showCancel: true,
      confirmText: 'Save Grade',
      cancelText: 'Cancel',
      onConfirm: handleSaveGrade,
      onCancel: hideDialog
    });
  };

  const handleCancelGrading = () => {
    if (existingGrade) {
      // Reset to existing grade values
      setTotalScore(existingGrade.score || 0);
      setTotalOutOf(existingGrade.outOf || submission?.totalPoints || 100);
      setFinalComments(existingGrade.finalComments || "");
    } else {
      // Reset to default values
      setTotalScore(0);
      setTotalOutOf(submission?.totalPoints || 100);
      setFinalComments("");
    }
    setMode('view');
  };

  if (submissionLoading || entriesLoading || !submission || !course || coursesLoading || gradesLoading || !entry) {
    return <SubmissionGradingPageSkeleton />;
  }


  return (
    <div className="min-h-screen bg-gray-50">
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
      {/* Header */}
      <div className="bg-white border border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{submission.title}</h1>
                <p className="text-sm text-gray-500">
                  {course.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {mode === "grade" && (
                <>
                  <button
                    onClick={handleCancelGrading}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm hover:bg-gray-700"
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={confirmSaveGrade}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Grade
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="flex border overflow-hidden">
                <button
                  onClick={() => setMode("view")}
                  className={`px-4 py-2 text-sm ${mode === "view" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                  disabled={mode === "grade" && isSaving}
                >
                  Review
                </button>
                <button
                  onClick={() => setMode("grade")}
                  className={`px-4 py-2 text-sm ${mode === "grade" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                  disabled={mode === "grade" && isSaving}
                >
                  Grade
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-0 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Details */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Assignment Details</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-700 text-sm mb-4">
                  {submission.description}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-200 pt-4">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    Due: {formatDate(submission.dueDate)}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FileText className="h-4 w-4 mr-2" />
                    Type: {submission.fileType}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Total Points: {submission.totalPoints}
                  </div>
                </div>
              </div>
            </div>

            {/* Submission Files */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Submitted Files</h2>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-3">
                  {entry.fileUrl.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {`File Name: ${cleanUrl(file).split("/").pop()}`}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Link
                          href={file}
                          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium hover:bg-blue-200"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Link>
                        <Link
                          href={file}
                          download="filename"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question-by-Question Grading */}
            {mode === "grade" && questionGrades.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Detailed Grading</h2>
                  <button
                    onClick={calculateTotalFromQuestions}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={isSaving}
                  >
                    Calculate Total
                  </button>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {questionGrades.map((grade, index) => (
                      <div key={grade.id} className="p-4 border border-gray-200 rounded-md">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900">Question {index + 1}</h3>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={grade.score}
                              onChange={(e) => updateQuestionGrade(grade.id, 'score', e.target.value)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                              step="0.5"
                              min="0"
                              disabled={isSaving}
                            />
                            <span className="text-gray-500">of</span>
                            <input
                              type="number"
                              value={grade.outOf}
                              onChange={(e) => updateQuestionGrade(grade.id, 'outOf', e.target.value)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                              step="0.5"
                              min="0"
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                        <textarea
                          value={grade.feedback || ""}
                          onChange={(e) => updateQuestionGrade(grade.id, 'feedback', e.target.value)}
                          placeholder="Feedback for this question..."
                          className="w-full p-2 text-sm border border-gray-300 rounded-md resize-none"
                          rows={2}
                          disabled={isSaving}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overall Grade */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Overall Grade</h2>
              </div>
              <div className="px-6 py-4">
                {mode === "view" ? (
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="text-2xl font-bold text-gray-900 mr-2">
                        {entry.grade?.score || 0}
                      </div>
                      <div className="text-lg text-gray-500">
                        / {entry.grade?.outOf || 100}
                      </div>
                      <div className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {Math.round(((entry.grade?.score || 0) / (entry.grade?.outOf || 100)) * 100)}%
                      </div>
                    </div>
                    {entry.grade?.finalComments && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">{entry.grade.finalComments}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={totalScore}
                          onChange={(e) => setTotalScore(parseFloat(e.target.value) || 0)}
                          className="w-20 px-3 py-2 text-sm border border-gray-300 rounded"
                          step="0.5"
                          min="0"
                          max={totalOutOf}
                          disabled={isSaving}
                        />
                        <span className="text-gray-500">of</span>
                        <input
                          type="number"
                          value={totalOutOf}
                          onChange={(e) => setTotalOutOf(parseFloat(e.target.value) || 100)}
                          className="w-20 px-3 py-2 border border-gray-300 text-sm rounded"
                          step="0.5"
                          min="1"
                          disabled={isSaving}
                        />
                      </div>
                      <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {Math.round((totalScore / totalOutOf) * 100)}%
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Final Comments
                      </label>
                      <textarea
                        value={finalComments}
                        onChange={(e) => setFinalComments(e.target.value)}
                        placeholder="Overall feedback for the student..."
                        className="w-full p-3 border border-gray-300 text-sm rounded"
                        rows={4}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Student Information</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-semibold flex items-center justify-center" >
                    {entry.student.fullName.charAt(0)}
                  </div>
                  <p className="text-sm text-gray-500">{entry.student.fullName}</p>
                </div>
              </div>
            </div>

            {/* Submission Status */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Submission Status</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Attempt</span>
                  <span className="text-sm font-medium text-gray-900">#{entry.attemptNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Submitted</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(entry.submittedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="px-6 py-4 space-y-2">
                <button className="w-full flex items-center  text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => {
                    entry.fileUrl.forEach(file => {
                      const link = document.createElement('a');
                      link.href = file;
                      link.setAttribute('download', 'filename');
                      link.setAttribute('target', '_blank');
                      link.setAttribute('rel', 'noopener noreferrer');

                      link.download = file.split('/').pop() || 'download';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    });
                  }}
                >
                  <Download className="h-3 w-3 inline-block mr-2" />
                  Download All Files
                </button>
                <button
                  className="w-full flex items-center text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => router.push(`mailto:${entry.student.email}`)}
                >
                  <Mail className="h-3 w-3 inline-block mr-2" />
                  Email Student
                </button>
                <button className="w-full flex items-center  text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">
                  <Flag className="h-3 w-3 inline-block mr-2" />
                  Flag for Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}