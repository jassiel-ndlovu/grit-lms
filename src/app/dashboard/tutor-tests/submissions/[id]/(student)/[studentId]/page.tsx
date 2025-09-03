/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useTests } from "@/context/TestContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { useStudent } from "@/context/StudentContext";
import LessonMarkdown from "@/app/components/markdown";
import { formatDate } from "@/lib/functions";
import { CheckCircle, XCircle, FileText, Download, Clock, Calendar, Trophy } from "lucide-react";
import { useGrades } from "@/context/GradeContext";

type Mode = "view" | "grade";

export default function StudentSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id: testId, studentId } = use(params);
  const { fetchTestById } = useTests();
  const { fetchSubmissionByStudentTestId } = useTestSubmissions();
  const { fetchStudentsById } = useStudent();
  const { createGrade, fetchGradesByStudentIdTestSubId } = useGrades(); 

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");

  const [test, setTest] = useState<AppTypes.Test | null>(null);
  const [submissionGrade, setSubmissionGrade] = useState<AppTypes.Grade | null>(null);
  const [submission, setSubmission] = useState<AppTypes.TestSubmission | null>(null);
  const [student, setStudent] = useState<AppTypes.Student | null>(null);

  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [questionFeedback, setQuestionFeedback] = useState<Record<string, string>>({});
  const [finalComments, setFinalComments] = useState<string>("");

  const totalPossible = useMemo(
    () => (test?.questions ?? []).reduce((sum, q) => sum + (q.points ?? 0), 0),
  [test]);

  const totalAwarded = useMemo(
    () =>
      (test?.questions ?? []).reduce((sum, q) => {
        const s = questionScores[q.id] ?? 0;
        return sum + Math.max(0, Math.min(s, q.points ?? 0));
      }, 0),
  [test, questionScores]);

  const percentageScore = useMemo(() => {
    return totalPossible > 0 ? Math.round((totalAwarded / totalPossible) * 100) : 0;
  }, [totalAwarded, totalPossible]);

  // fetch test, test sub and student
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, sub, stu] = await Promise.all([
          fetchTestById(testId),
          fetchSubmissionByStudentTestId(studentId, testId),
          fetchStudentsById([studentId]),
        ]);

        setTest(t as AppTypes.Test);
        setSubmission(sub as AppTypes.TestSubmission);
        setStudent(stu[0] as AppTypes.Student);

        // Seed question grades if submission has them
        const existingQ = (sub as AppTypes.TestSubmission)?.questionGrades ?? [];
        const initScores: Record<string, number> = {};
        const initFb: Record<string, string> = {};

        for (const qg of existingQ) {
          if (qg.questionId) {
            initScores[qg.questionId] = qg.score;
            initFb[qg.questionId] = qg.feedback ?? "";
          }
        }

        setQuestionScores(initScores);
        setQuestionFeedback(initFb);
      } finally {
        setLoading(false);
      }
    })();
  }, [testId, studentId, fetchTestById, fetchSubmissionByStudentTestId, fetchStudentsById]);

  // fetch grade, if it exists
  useEffect(() => {
    if (!studentId || !submission) return;

    (async () => {
      setLoading(true);

      try {
        // could be null
        const grade = await fetchGradesByStudentIdTestSubId(studentId, submission.id) as AppTypes.Grade;

        setSubmissionGrade(grade);

        // Seed existing grade if available
        if (submissionGrade) {
          setFinalComments(submissionGrade.finalComments ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, submission, fetchGradesByStudentIdTestSubId, submissionGrade]);

  const handleScoreChange = (questionId: string, points: number, max: number) => {
    const clamped = Math.max(0, Math.min(points, max));
    setQuestionScores((prev) => ({ ...prev, [questionId]: clamped }));
  };

  const saveGrade = async () => {
    if (!submission || !student) return;

    try {
      await createGrade({
        testSubmissionId: submission.id,
        studentId: student.id,
        courseId: test?.courseId,
        score: totalAwarded,
        outOf: totalPossible,
        finalComments: finalComments,
      });

      const grade = await fetchGradesByStudentIdTestSubId(studentId, submission.id) as AppTypes.Grade; // refresh context
      setSubmissionGrade(grade);

      alert("Grade saved successfully!");
      setMode("view");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to save grade.");
    }
  };

  const renderStudentAnswer = (question: AppTypes.TestQuestion, studentAnswer: any) => {
    switch (question.type) {
      case 'MULTIPLE_CHOICE':
      case 'TRUE_FALSE':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => {
              const isSelected = studentAnswer === option;
              const isCorrect = question.answer === option;
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded border flex items-center gap-3 ${
                    isSelected
                      ? isCorrect
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                      : isCorrect
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {isSelected && (
                    isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  )}
                  {isCorrect && !isSelected && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  <LessonMarkdown content={option} />
                  {isCorrect && (
                    <span className="ml-auto text-sm text-green-600 font-medium">Correct</span>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'MULTI_SELECT':
        const selectedAnswers = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correctAnswers = Array.isArray(question.answer) ? question.answer : [];
        
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => {
              const isSelected = selectedAnswers.includes(option);
              const isCorrect = correctAnswers.includes(option);
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded border flex items-center gap-3 ${
                    isSelected
                      ? isCorrect
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                      : isCorrect
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {isSelected && (
                    isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  )}
                  {isCorrect && !isSelected && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  <LessonMarkdown content={option} />
                  {isCorrect && !isSelected && (
                    <span className="ml-auto text-sm text-green-600 font-medium">Should be selected</span>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'SHORT_ANSWER':
      case 'ESSAY':
        return (
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Student&apos;s Answer:</h4>
            <p className="text-gray-800 text-sm whitespace-pre-wrap">
              {studentAnswer || 'No answer provided'}
            </p>
          </div>
        );

      case 'NUMERIC':
        return (
          <div className="flex gap-4">
            <div className={`p-3 rounded border ${
              studentAnswer === question.answer 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <span className="text-sm font-medium">Student&apos;s Answer: </span>
              <span className={studentAnswer === question.answer ? 'text-green-700' : 'text-red-700'}>
                {studentAnswer}
              </span>
            </div>
            <div className="p-3 rounded border bg-green-50 border-green-200">
              <span className="text-sm font-medium">Correct Answer: </span>
              <span className="text-green-700">{question.answer as string}</span>
            </div>
          </div>
        );

      case 'CODE':
        return (
          <div className="bg-gray-900 text-white p-4 rounded">
            <h4 className="text-sm font-medium mb-2">Student&apos;s Code:</h4>
            <pre className="text-sm overflow-x-auto">
              <code>{studentAnswer || '// No code submitted'}</code>
            </pre>
          </div>
        );

      case 'FILE_UPLOAD':
        const uploadedFiles = Array.isArray(studentAnswer) ? studentAnswer : [];
        return (
          <div className="space-y-2">
            {uploadedFiles.length === 0 ? (
              <p className="text-gray-600 text-sm">No files uploaded</p>
            ) : (
              uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm flex-1 truncate">{file.fileName}</span>
                  <a 
                    href={file.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))
            )}
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 p-3 rounded">
            <span className="text-gray-600 text-sm">
              {JSON.stringify(studentAnswer, null, 2)}
            </span>
          </div>
        );
    }
  };

  if (loading || !test || !submission || !student) {
    return (
      <div className="p-6 text-sm text-gray-600 flex items-center justify-center gap-2">
        <div className="w-5 h-5 border border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading submission...
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
          <p className="text-sm text-gray-600">
            Student: <span className="font-medium">{student.fullName}</span>
          </p>
          <p className="text-sm text-gray-600">
            Submitted: {submission.submittedAt ? formatDate(submission.submittedAt) : 'Not submitted'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalAwarded} / {totalPossible}
            </div>
            <div className="text-sm text-gray-600">
              {percentageScore}%
            </div>
          </div>
          
          <div className="flex border overflow-hidden">
            <button
              onClick={() => setMode("view")}
              className={`px-4 py-2 text-sm ${mode === "view" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            >
              Review
            </button>
            <button
              onClick={() => setMode("grade")}
              className={`px-4 py-2 text-sm ${mode === "grade" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            >
              Grade
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {mode === "view" ? (
        <div className="bg-white border border-gray-200 p-6 space-y-6">
          {/* Submission Details */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Submission Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium">Time Spent</span>
                </div>
                <div className="text-lg font-semibold">
                  {submission.startedAt && submission.submittedAt 
                    ? `${Math.round((new Date(submission.submittedAt).getTime() - new Date(submission.startedAt).getTime()) / 60000)} minutes`
                    : 'N/A'
                  }
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium">Submitted At</span>
                </div>
                <div className="text-lg font-semibold">
                  {submission.submittedAt ? formatDate(submission.submittedAt) : 'Not submitted'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <div className="text-lg font-semibold">
                  {submission.status}
                </div>
              </div>
            </div>
          </section>

          {/* Questions and Answers */}
          <section className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Student Answers</h2>
            <div className="space-y-6">
              {test.questions?.map((question, index) => {
                const studentAnswer = submission.answers && typeof submission.answers === 'object' 
                  ? (submission.answers as Record<string, any>)[question.id] 
                  : null;

                return (
                  <div key={question.id} className="border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Question {index + 1} ({question.points} points)
                        </h3>
                        <div className="text-sm text-gray-500 capitalize">
                          {question.type.replace('_', ' ').toLowerCase()}
                        </div>
                      </div>
                      {questionScores[question.id] !== undefined && (
                        <div className="text-sm font-medium text-blue-600">
                          Score: {questionScores[question.id]}/{question.points}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <LessonMarkdown content={question.question} />
                    </div>

                    {renderStudentAnswer(question, studentAnswer)}

                    {questionFeedback[question.id] && (
                      <div className="mt-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                        <h4 className="font-medium text-yellow-900 mb-1">
                          Feedback:
                        </h4>
                        <LessonMarkdown content={questionFeedback[question.id]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 p-6 space-y-6">
          {/* Grading Interface */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Grade Submission</h2>
            <div className="space-y-6">
              {test.questions?.map((question, index) => {
                const studentAnswer = submission.answers && typeof submission.answers === 'object' 
                  ? (submission.answers as Record<string, any>)[question.id] 
                  : null;

                return (
                  <div key={question.id} className="border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Question {index + 1} ({question.points} points)
                        </h3>
                        <div className="text-sm text-gray-500 capitalize">
                          {question.type.replace('_', ' ').toLowerCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={question.points ?? 0}
                          value={questionScores[question.id] ?? 0}
                          onChange={(e) =>
                            handleScoreChange(question.id, Number(e.target.value), question.points ?? 0)
                          }
                          className="w-20 px-3 py-1 border border-gray-200 focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <span className="text-sm text-gray-500">/ {question.points}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <LessonMarkdown content={question.question} />
                    </div>

                    {renderStudentAnswer(question, studentAnswer)}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feedback for this question:
                      </label>
                      <textarea
                        value={questionFeedback[question.id] || ''}
                        onChange={(e) =>
                          setQuestionFeedback((prev) => ({ ...prev, [question.id]: e.target.value }))
                        }
                        placeholder="Enter feedback for this question..."
                        className="w-full p-3 border border-gray-300 focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-20 resize-y text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Final Comments and Actions */}
          <section className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Final Grade & Comments</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final Comments:
                </label>
                <textarea
                  value={finalComments}
                  onChange={(e) => setFinalComments(e.target.value)}
                  placeholder="Enter overall feedback for this submission..."
                  className="w-full p-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 min-h-32 resize-y text-sm"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Grade Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Score:</span>
                    <span className="font-medium">{totalAwarded} / {totalPossible}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Percentage:</span>
                    <span className="font-medium">{percentageScore}%</span>
                  </div>
                  <div className="pt-2 border-t">
                    <button
                      onClick={saveGrade}
                      className="w-full bg-blue-600 text-white py-2 px-4 hover:bg-blue-700 transition-colors text-sm"
                    >
                      Save Final Grade
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}