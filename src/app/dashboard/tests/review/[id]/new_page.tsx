/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { AlertCircle } from "lucide-react";
import TestReviewSkeleton from "../../skeletons/test-review-skeleton";
import { use, useEffect, useState } from "react";
import { useTests } from "@/context/TestContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { useProfile } from "@/context/ProfileContext";
import { useRouter } from "next/navigation";
import { ScoreSummary } from "../components/score-summary";
import { FeedbackSection } from "../components/feedback-section";
import QuestionReview from "../../models/question-review";

type TestReviewPageProps = {
  params: Promise<{ id: string }>;
}

export default function TestReviewPage({ params }: TestReviewPageProps) {
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

  // Fetch submission and test data
  useEffect(() => {
    if (!id || !studentProfile) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [sub, fetchedTest] = await Promise.all([
          fetchSubmissionByStudentTestId(studentProfile.id, id) as Promise<AppTypes.TestSubmission>,
          fetchTestById(id) as Promise<AppTypes.Test>
        ]);

        setSubmission(sub);
        setTest(fetchedTest);
        
        // Flatten questions with sub-questions for easier rendering
        const flattenedQuestions = flattenQuestions(fetchedTest.questions);
        setQuestions(flattenedQuestions);
      } catch (error) {
        console.error("Error fetching review data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, studentProfile, fetchSubmissionByStudentTestId, fetchTestById]);

  // Helper function to flatten questions with sub-questions
  const flattenQuestions = (questions: AppTypes.TestQuestion[]): AppTypes.TestQuestion[] => {
    const flattened: AppTypes.TestQuestion[] = [];
    
    questions.forEach(question => {
      flattened.push(question);
      if (question.subQuestions && question.subQuestions.length > 0) {
        // @ts-expect-error subQuestions is already of type TestQuestion[]
        flattened.push(...flattenQuestions(question.subQuestions));
      }
    });
    
    return flattened;
  };

  // Calculate score based on grade if available, otherwise use submission score
  const calculateScore = () => {
    if (submission?.grade) {
      return {
        percentage: (submission.grade.score / submission.grade.outOf) * 100,
        points: submission.grade.score,
        totalPoints: submission.grade.outOf
      };
    } else if (submission?.score !== null && submission?.score !== undefined && test) {
      return {
        percentage: submission.score,
        points: Math.round(submission.score * test.totalPoints / 100),
        totalPoints: test.totalPoints
      };
    }
    return null;
  };

  // Get question grade for a specific question
  const getQuestionGrade = (questionId: string) => {
    if (!submission?.questionGrades) return null;
    return submission.questionGrades.find(qg => qg.questionId === questionId);
  };

  // Type-safe answer comparison
  const areAnswersEqual = (studentAnswer: any, correctAnswer: any): boolean => {
    if (studentAnswer == null && correctAnswer == null) return true;
    if (studentAnswer == null || correctAnswer == null) return false;
    if (typeof studentAnswer !== typeof correctAnswer) return false;

    if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
      if (studentAnswer.length !== correctAnswer.length) return false;
      return studentAnswer.every((item, index) =>
        JSON.stringify(item) === JSON.stringify(correctAnswer[index])
      );
    }

    return JSON.stringify(studentAnswer) === JSON.stringify(correctAnswer);
  };

  if (loading || testLoading || submissionLoading) {
    return <TestReviewSkeleton />;
  }

  if (!submission || !questions.length || !test) {
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
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Score Summary */}
        <ScoreSummary test={test} submission={submission} scoreData={scoreData} />

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

        {/* Feedback Section */}
        <FeedbackSection submission={submission} />

        {/* Questions Review */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Question Review</h2>
            <div className="text-sm text-gray-600">
              {questions.length} questions total
            </div>
          </div>
          
          <div className="space-y-6">
            {questions.map((question, index) => {
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
                  questionNumber={index + 1}
                  studentAnswer={studentAnswer}
                  isCorrect={isCorrect}
                  level={question.parentId ? 1 : 0}
                />
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={() => router.push("/dashboard/tests")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Return to Tests
          </button>
        </div>
      </div>
    </div>
  );
}