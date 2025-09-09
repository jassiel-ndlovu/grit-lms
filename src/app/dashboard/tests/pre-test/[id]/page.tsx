"use client";

import { BookOpen, Calendar, Clock, FileText, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import StartTestConfirmationDialog from "../../models/start-test-confirmation";
import { useTests } from "@/context/TestContext";
import { formatDate } from "@/lib/functions";
import { PreTestInstructionsPageSkeleton } from "../../skeletons/pre-test-skeleton";
import LessonMarkdown from "@/app/components/markdown";
import { useCourses } from "@/context/CourseContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { $Enums } from "@/generated/prisma";
import { useProfile } from "@/context/ProfileContext";
import { useErrorPages } from "@/app/dashboard/components/error-pages";

type PreTestInstructionsPageProps = {
  params: Promise<{ id: string }>;
}

const PreTestInstructionsPage = ({ params }: PreTestInstructionsPageProps) => {
  const { id } = use(params);
  const router = useRouter();
  const { currentTest, fetchTestById } = useTests();
  const { courses, fetchCoursesByIds } = useCourses();
  const { message: submissionMessage, createSubmission, fetchSubmissionByStudentTestId, updateSubmission } = useTestSubmissions();
  const { profile } = useProfile();
  const { renderAccessDeniedPage, renderErrorPage } = useErrorPages();

  const studentProfile = profile as AppTypes.Student;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingState('loading');
        await fetchTestById(id);
      } catch (err) {
        setLoadingState('error');
        setError('Failed to load test. Please try again.');
        console.error('Error loading test:', err);
      }
    };

    loadData();
  }, [id, fetchTestById]);

  useEffect(() => {
    if (currentTest) {
      fetchCoursesByIds([currentTest.courseId]);
      
      // Check if test is overdue immediately
      if (new Date(currentTest.dueDate) < new Date()) {
        setLoadingState('error');
        setError('This test is overdue and can no longer be attempted.');
        return;
      }
      
      setLoadingState('success');
    }
  }, [currentTest, fetchCoursesByIds]);

  const handleStartTest = async () => {
    if (!studentProfile?.id || !currentTest) return;

    setIsLoading(true);
    setError(null);

    try {
      const sub = await fetchSubmissionByStudentTestId(studentProfile.id, currentTest.id);

      if (sub) {
        await handleExistingSubmission(sub);
      } else {
        await handleNewSubmission();
      }
    } catch (err) {
      console.error('Error starting test:', err);
      setError('Failed to start test. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExistingSubmission = async (submission: AppTypes.TestSubmission) => {
    const isCompleted = submission.status === $Enums.SubmissionStatus.SUBMITTED;
    const isOverdue = new Date(currentTest!.dueDate) < new Date();
    
    const testStartTime = new Date(submission.startedAt).getTime();
    const dueDateTime = testStartTime + (currentTest!.timeLimit as number) * 60 * 1000;
    const timeExceeded = dueDateTime < Date.now();

    if (isCompleted) {
      setError('You have already completed this test.');
      return;
    }

    if (timeExceeded) {
      // Auto-submit as late
      await updateSubmission(submission.id, {
        status: $Enums.SubmissionStatus.LATE,
        submittedAt: new Date(),
      });
      
      setError('You have exceeded the time limit for this test.');
      router.push('/dashboard/tests');
      return;
    }

    if (isOverdue) {
      setError('This test is overdue. Please contact your tutor for assistance.');
      return;
    }

    // Continue with existing submission
    if (window.confirm('You have an existing submission for this test. Do you wish to continue where you left off?')) {
      router.push(`/dashboard/tests/${currentTest!.id}`);
    }
  };

  const handleNewSubmission = async () => {
    const submission = await createSubmission({
      testId: currentTest!.id,
      studentId: studentProfile.id,
      status: $Enums.SubmissionStatus.IN_PROGRESS,
      startedAt: new Date(),
      answers: {},
    });

    if (submission || (submissionMessage && submissionMessage.isSuccess())) {
      router.push(`/dashboard/tests/${currentTest!.id}`);
    } else {
      setError(submissionMessage?.content || 'Failed to create test submission. Please try again.');
    }
  };

  // Render error states
  if (loadingState === 'error') {
    return renderErrorPage({
      message: error || 'Unable to load test instructions.',
      showGoBack: true,
      showContactSupport: true,
      onGoBack: () => router.push('/dashboard/tests')
    });
  }

  if (!currentTest || !courses.length || loadingState === 'loading') {
    return <PreTestInstructionsPageSkeleton />;
  }

  // Final check for overdue test
  if (new Date(currentTest.dueDate) < new Date()) {
    return renderAccessDeniedPage({
      reason: 'This test is overdue and can no longer be attempted.',
      resourceType: 'test',
      onGoBack: () => router.push('/dashboard/tests')
    });
  }

  if (!currentTest.isActive) {
    return renderErrorPage({
      errorType: "validation",
      message: "This test is still in draft. We apologise that you can see this. We are fixing this bug.",
      title: "Test Not Available",
      showGoBack: true,
      showGoHome: true,
      onGoHome: () => router.push("/dashboard"),
      onGoBack: () => router.push("/dashboard/tests"),
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{currentTest.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <BookOpen className="w-4 h-4 opacity-80" />
                  <span className="opacity-90">{courses[0].name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Test Overview */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(currentTest.dueDate)}
                  </p>
                </div>
              </div>

              {currentTest.timeLimit && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Time Limit</p>
                    <p className="font-medium text-gray-900">{currentTest.timeLimit} minutes</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Total Points</p>
                  <p className="font-medium text-gray-900">{currentTest.totalPoints} points</p>
                </div>
              </div>
            </div>

            {/* {isOverdue && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-medium text-red-800">Test Overdue</h3>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  This test was due on {formatDate(currentTest.dueDate)}. Late submissions may be penalized.
                </p>
              </div>
            )} */}
          </div>
        </div>

        {/* Test Description and Scope */}
        {currentTest.description && (
          <div className="bg-white border border-gray-200 mb-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Test Description and Scope
              </h2>
              <p className="text-sm text-gray-700">
                {currentTest.description}
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white border border-gray-200 mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Test Instructions
            </h2>

            {currentTest.preTestInstructions ? (
              <div className="text-sm">
                <LessonMarkdown content={currentTest.preTestInstructions} />
              </div>
            ) : (
              <div className="space-y-4 text-gray-700 text-sm">
                <p>Please read the following instructions carefully before starting the test:</p>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Answer all questions to the best of your ability.</li>
                  <li>Make sure you have a stable internet connection.</li>
                  {currentTest.timeLimit && (
                    <li>You have <strong>{currentTest.timeLimit} minutes</strong> to complete this test.</li>
                  )}
                  <li>Save your progress frequently by clicking the <strong>&quot;Save Progress&quot; button</strong>.</li>
                  <li>You can navigate between questions using the navigation panel.</li>
                  <li>Review your answers before submitting.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Test Details */}
        <div className="bg-white border border-gray-200 mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Test Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Number of Questions:</span>
                    <span className="font-medium">{currentTest.questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Points:</span>
                    <span className="font-medium">{currentTest.totalPoints}</span>
                  </div>
                  {currentTest.timeLimit && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Time Allowed:</span>
                      <span className="font-medium">{currentTest.timeLimit} minutes</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Question Types</h4>
                <div className="space-y-2 text-sm">
                  {/* Count different question types */}
                  {Object.entries(
                    currentTest.questions.reduce((acc, q) => {
                      acc[q.type] = (acc[q.type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-gray-500 capitalize">{type.replace('_', ' ')}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={isLoading}
            className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting Test...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                Start Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <StartTestConfirmationDialog
          test={currentTest}
          onConfirm={handleStartTest}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
};

export default PreTestInstructionsPage;