/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { AlertCircle, Calendar, Clock, FileText, Trophy } from "lucide-react";
import QuestionReview from "../../models/question-review";
import TestReviewSkeleton from "../../skeletons/test-review-skeleton";
import { use, useEffect, useState } from "react";
import { useTests } from "@/context/TestContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { useProfile } from "@/context/ProfileContext";
import { useRouter } from "next/navigation";

type TestReviewPageProps = {
  params: Promise<{ id: string }>;
}

export default function TestReviewPage({ params }: TestReviewPageProps) {
  // test id
  const { id } = use(params);
  const { loading: testLoading, fetchTestById } = useTests();
  const { loading: submissionLoading, fetchSubmissionByStudentTestId } = useTestSubmissions();
  const { profile } = useProfile();
  const router = useRouter();

  const studentProfile = profile as AppTypes.Student;

  const [submission, setSubmission] = useState<AppTypes.TestSubmission | null>(null);
  const [questions, setQuestions] = useState<AppTypes.TestQuestion[]>([]);
  const [test, setTest] = useState<AppTypes.Test | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch submission
  useEffect(() => {
    if (!id || !studentProfile) return;

    const fetchData = async () => {
      setLoading(true);

      const sub = await fetchSubmissionByStudentTestId(studentProfile.id, id) as AppTypes.TestSubmission;

      setSubmission(sub);
      setLoading(false);
    };

    fetchData();
  }, [id, studentProfile, fetchSubmissionByStudentTestId]);

  // Fetch test
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      const fetchedTest = await fetchTestById(id) as AppTypes.Test;

      setQuestions(fetchedTest.questions);
      setTest(fetchedTest);

      setLoading(false);
    };

    fetchData();
  }, [id, fetchTestById]);

  const calculateTimeSpent = () => {
    if (!submission?.startedAt || !submission?.submittedAt) return 'N/A';
    const start = new Date(submission.startedAt);
    const end = new Date(submission.submittedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      GRADED: 'bg-green-100 text-green-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      LATE: 'bg-red-100 text-red-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  // Calculate score based on grade if available, otherwise use submission score
  const calculateScore = () => {
    if (submission?.grade) {
      // Use grade data if available
      return {
        percentage: (submission.grade.score / submission.grade.outOf) * 100,
        points: submission.grade.score,
        totalPoints: submission.grade.outOf
      };
    } else if (submission?.score !== null && submission?.score !== undefined) {
      // Fall back to submission score
      return {
        percentage: submission.score,
        points: Math.round(submission.score * test!.totalPoints / 100),
        totalPoints: test!.totalPoints
      };
    }
    return null;
  };

  // Get question grade for a specific question
  const getQuestionGrade = (questionId: string) => {
    if (!submission?.questionGrades) return null;
    return submission.questionGrades.find(qg => qg.questionId === questionId);
  };

  // Type-safe version with additional checks
  const areAnswersEqual = (studentAnswer: any, correctAnswer: any): boolean => {
    // If both are null/undefined, consider them equal
    if (studentAnswer == null && correctAnswer == null) {
      return true;
    }

    // If only one is null/undefined, they're not equal
    if (studentAnswer == null || correctAnswer == null) {
      return false;
    }

    // Handle different types
    if (typeof studentAnswer !== typeof correctAnswer) {
      return false;
    }

    // Special handling for arrays
    if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
      if (studentAnswer.length !== correctAnswer.length) {
        return false;
      }
      return studentAnswer.every((item, index) =>
        JSON.stringify(item) === JSON.stringify(correctAnswer[index])
      );
    }

    // String comparison for other cases
    return JSON.stringify(studentAnswer) === JSON.stringify(correctAnswer);
  };

  if (loading || testLoading || submissionLoading) {
    return <TestReviewSkeleton />;
  }

  if (!submission || !questions || !questions.length || !test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Test Not Found
          </h2>
          <p className="text-gray-600">
            The test submission could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const scoreData = calculateScore();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {test.title}
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(submission.status)}`}>
              {submission.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Score</span>
              </div>
              <div className="font-semibold text-blue-900">
                {scoreData ? (
                  <span className={getScoreColor(scoreData.percentage)}>
                    {scoreData.percentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-gray-500">
                    Pending
                  </span>
                )}
              </div>
              <div className="text-xs text-blue-700">
                {scoreData && `${scoreData.points}/${scoreData.totalPoints} points`}
              </div>
              {submission.grade && (
                <div className="text-xs text-blue-700 mt-1">
                  Graded
                </div>
              )}
            </div>

            <div className="bg-green-50 p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Time Spent
                </span>
              </div>
              <div className="font-semibold text-green-900">
                {calculateTimeSpent()}
              </div>
              {test.timeLimit && (
                <div className="text-xs text-green-700">
                  Limit: {test.timeLimit}m
                </div>
              )}
            </div>

            <div className="bg-purple-50 p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">
                  Submitted
                </span>
              </div>
              <div className="font-semibold text-purple-900">
                {submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleDateString()
                  : 'Not submitted'
                }
              </div>
              <div className="text-xs text-purple-700">
                {submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleTimeString()
                  : ''
                }
              </div>
            </div>

            <div className="bg-orange-50 p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">
                  Questions
                </span>
              </div>
              <div className="font-semibold text-orange-900">
                {questions.length}
              </div>
              <div className="text-xs text-orange-700">
                Total questions
              </div>
            </div>
          </div>
        </div>

        {/* Grade Information */}
        {submission.grade && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Grade Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-1">Final Score</h3>
                <p className="text-2xl font-bold text-blue-900">
                  {submission.grade.score}/{submission.grade.outOf}
                </p>
                <p className="text-sm text-blue-700">
                  {(submission.grade.score / submission.grade.outOf * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-900 mb-1">Graded On</h3>
                <p className="text-sm text-green-900">
                  {new Date(submission.grade.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-green-700">
                  {new Date(submission.grade.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {(submission.feedback || submission.grade?.finalComments) && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Instructor Feedback</h2>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              {submission.grade?.finalComments && (
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-blue-900 mb-1">Final Comments</h3>
                  <p className="text-blue-900 whitespace-pre-wrap">{submission.grade.finalComments}</p>
                </div>
              )}
              {submission.feedback && (
                <div>
                  {submission.grade?.finalComments && (
                    <h3 className="text-sm font-medium text-blue-900 mb-1">Additional Feedback</h3>
                  )}
                  <p className="text-blue-900 whitespace-pre-wrap">{submission.feedback}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Questions Review */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Question Review</h2>
          {questions.map((question, i) => {
            // Safe access with type checking
            let studentAnswer = null;
            if (submission.answers && typeof submission.answers === 'object' && !Array.isArray(submission.answers)) {
              studentAnswer = (submission.answers as Record<string, any>)[question.id];
            }

            const isCorrect = areAnswersEqual(studentAnswer, question.answer);
            const questionGrade = getQuestionGrade(question.id);

            return (
              <QuestionReview
                key={question.id}
                question={question}
                questionNumber={i + 1}
                studentAnswer={studentAnswer}
                isCorrect={isCorrect}
                questionGrade={questionGrade as AppTypes.QuestionGrade}
              />
            );
          })}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={() => router.push("/dashboard/tests")}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-3 transition-colors"
          >
            Return to Tests
          </button>
        </div>
      </div>
    </div>
  );
};