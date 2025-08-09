"use client";

import { AlertCircle, BookOpen, Calendar, Clock, FileText, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import StartTestConfirmationDialog from "../../models/start-test-confirmation";
import { useTests } from "@/context/TestContext";
import { formatDate } from "@/lib/functions";
import { PreTestInstructionsPageSkeleton } from "../../models/skeletons/pre-test-skeleton";
import LessonMarkdown from "@/app/components/markdown";
import { useCourses } from "@/context/CourseContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { $Enums } from "@/generated/prisma";
import { useProfile } from "@/context/ProfileContext";

type PreTestInstructionsPageProps = {
  params: Promise<{ id: string }>;
}

const PreTestInstructionsPage = ({ params }: PreTestInstructionsPageProps) => {
  const { id } = use(params);
  const router = useRouter();
  const { currentTest, fetchTestById } = useTests();
  const { courses, fetchCoursesByIds } = useCourses();;
  const { message: submissionMessage, createSubmission, fetchSubmissionByStudentTestId, updateSubmission } = useTestSubmissions();
  const { profile } = useProfile();

  const studentProfile = profile as AppTypes.Student;

  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchTestById(id);
  }, []);

  useEffect(() => {
    if (currentTest) {
      fetchCoursesByIds([currentTest.courseId]);
    }
  }, [currentTest, fetchCoursesByIds]);

  const test = currentTest;

  if (!test) return <PreTestInstructionsPageSkeleton />;

  const handleStartTest = async () => {
    setIsLoading(true);

    const sub = await fetchSubmissionByStudentTestId(studentProfile.id, test.id);

    if (sub) {
      const isCompleted = sub.status === $Enums.SubmissionStatus.SUBMITTED;
      const isOverdue = new Date(test.dueDate) < new Date();
      
      const dueDateTime = new Date(test.dueDate).getTime();
      const testStartTime = (new Date(sub.startedAt)).getTime();
      const timeExceeded = dueDateTime - testStartTime >= (test.timeLimit as number) * 60 * 1000;

      if (isCompleted) {
        alert("You have already completed this test.");
        setIsLoading(false);
        return;
      } else if (timeExceeded) {
        alert("You have exceeded the time limit for this test.");

        await updateSubmission(sub.id, {
          status: $Enums.SubmissionStatus.LATE,
          submittedAt: new Date(),
        });

        setIsLoading(false);

        router.push(`/dashboard/tests`);
        return;
      } else if (isOverdue) {
        alert("This test is overdue. Please contact your tutor for assistance.");
        setIsLoading(false);
        return;
      }

      alert("You have an existing submission for this test. Do you wish to proceed?");
      router.push(`/dashboard/tests/${test.id}`);
      return;
    }

    await createSubmission({
      testId: test.id,
      studentId: studentProfile.id,
      status: $Enums.SubmissionStatus.IN_PROGRESS,
      startedAt: new Date(),
      answers: {},
    });

    if (submissionMessage && submissionMessage.isSuccess()) {
      router.push(`/dashboard/tests/${test.id}`);
      return;
    }

    alert(submissionMessage?.content || "An error occurred. Please contact your tutor!");
  };

  const isOverdue = new Date(test.dueDate) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg  border border-gray-200 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{test.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <BookOpen className="w-4 h-4 opacity-80" />
                  <span className="opacity-90">{courses[0].name}</span>
                </div>
              </div>
            </div>

            {test.description && (
              <p className="text-sm opacity-90 text-blue-50">{test.description}</p>
            )}
          </div>

          {/* Test Overview */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatDate(test.dueDate)}
                  </p>
                </div>
              </div>

              {test.timeLimit && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Time Limit</p>
                    <p className="font-medium text-gray-900">{test.timeLimit} minutes</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Total Points</p>
                  <p className="font-medium text-gray-900">{test.totalPoints} points</p>
                </div>
              </div>
            </div>

            {isOverdue && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-medium text-red-800">Test Overdue</h3>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  This test was due on {formatDate(test.dueDate)}. Late submissions may be penalized.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white border border-gray-200 mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Test Instructions
            </h2>

            {test.preTestInstructions ? (
              <LessonMarkdown content={test.preTestInstructions} />
            ) : (
              <div className="space-y-4 text-gray-700">
                <p>Please read the following instructions carefully before starting the test:</p>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Answer all questions to the best of your ability</li>
                  <li>Make sure you have a stable internet connection</li>
                  {test.timeLimit && (
                    <li>You have {test.timeLimit} minutes to complete this test</li>
                  )}
                  <li>Save your progress frequently by clicking the &quot;Save Progress&quot; button</li>
                  <li>You can navigate between questions using the navigation panel</li>
                  <li>Review your answers before submitting</li>
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
                    <span className="font-medium">{test.questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Points:</span>
                    <span className="font-medium">{test.totalPoints}</span>
                  </div>
                  {test.timeLimit && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Time Allowed:</span>
                      <span className="font-medium">{test.timeLimit} minutes</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Question Types</h4>
                <div className="space-y-2 text-sm">
                  {/* Count different question types */}
                  {Object.entries(
                    test.questions.reduce((acc, q) => {
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
          test={test}
          onConfirm={handleStartTest}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
};

export default PreTestInstructionsPage;