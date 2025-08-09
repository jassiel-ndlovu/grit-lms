/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Timer, Send, ChevronLeft, ChevronRight, Flag, Save, Eye, EyeOff, Upload, Trash2 } from 'lucide-react';
import { useTests } from '@/context/TestContext';
import { TestTakingPageSkeleton } from '../models/skeletons/test-taking-skeleton';
import { formatTime } from '@/lib/functions';
import { useCourses } from '@/context/CourseContext';
import { useProfile } from '@/context/ProfileContext';
import { useTestSubmissions } from '@/context/TestSubmissionContext';
import { $Enums } from '@/generated/prisma';

type TestTakingPageProps = {
  params: Promise<{ id: string }>;
}

type FileUploadAnswer = {
  fileUrl: string;
  fileType: string;
  fileName: string;
};

const TestTakingPage = ({ params }: TestTakingPageProps) => {
  const { id } = use(params);
  const router = useRouter();
  const { currentTest: test, fetchTestById } = useTests();
  const { courses, fetchCoursesByIds } = useCourses();
  const { fetchSubmissionByStudentTestId, updateSubmission } = useTestSubmissions();
  const { profile } = useProfile();

  const studentProfile = profile as AppTypes.Student;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<AppTypes.AnswerMap>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [testStartTime, setTestStartTime] = useState<Date | null>(null);
  const [submission, setSubmission] = useState<AppTypes.TestSubmission | null>(null);

  useEffect(() => {
    fetchTestById(id);
  }, [id, fetchTestById]);

  useEffect(() => {
    if (test) {
      fetchCoursesByIds([test.courseId]);
    }
  }, [test, fetchCoursesByIds]);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (test && studentProfile?.id) {
        const sub = await fetchSubmissionByStudentTestId(studentProfile.id, test.id);
        if (sub) {
          setSubmission(sub);
          setAnswers((sub.answers as AppTypes.AnswerMap) || {}); // Load existing answers from DB
          setTestStartTime(new Date(sub.startedAt));
        }
      }
    };

    fetchSubmission();
  }, [test, studentProfile?.id, fetchSubmissionByStudentTestId]);

  // Initialize timer when test loads
  useEffect(() => {
    if (test?.timeLimit) {
      setTestStartTime(new Date()); // Record when the test was started
      setTimeRemaining(test.timeLimit * 60); // Convert minutes to seconds
    }
  }, [test]);

  // Timer effect - runs every second
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Calculate remaining time if page is refreshed
  useEffect(() => {
    if (!testStartTime || !test?.timeLimit) return;

    const calculateRemainingTime = () => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - testStartTime.getTime()) / 1000);
      const remainingSeconds = ((test.timeLimit as number) * 60) - elapsedSeconds;

      return remainingSeconds > 0 ? remainingSeconds : 0;
    };

    setTimeRemaining(calculateRemainingTime());
  }, [testStartTime, test?.timeLimit]);

  if (!test) return <TestTakingPageSkeleton />;

  const currentQuestion = test.questions[currentQuestionIndex];

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSaveProgress = async () => {
    if (!test || !studentProfile?.id) return;

    const submissionData: Partial<AppTypes.TestSubmission> = {
      studentId: studentProfile.id,
      testId: test.id,
      answers: answers,
      startedAt: testStartTime || new Date(),
    };

    try {
      await updateSubmission(submission?.id || '', submissionData);
      setSubmission(prev => ({
        ...prev,
        ...submissionData
      } as AppTypes.TestSubmission));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleSubmitTest = async () => {
    setIsSubmitting(true);
    setShowSubmitConfirmation(false);

    if (!test || !studentProfile?.id) {
      alert("Test or student profile not found!");
      setIsSubmitting(false);
      return;
    }

    const submissionData: Partial<AppTypes.TestSubmission> = {
      studentId: studentProfile.id,
      testId: test.id,
      answers: answers,
      status: $Enums.SubmissionStatus.SUBMITTED,
      startedAt: testStartTime || new Date(),
      submittedAt: new Date(),
    };

    try {
      await updateSubmission(submission?.id || '', submissionData);

      router.push(`/dashboard/tests`);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert("An error occurred while submitting the test. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionStatus = (index: number) => {
    const question = test.questions[index];
    const hasAnswer = answers[question.id] !== undefined && answers[question.id] !== '';

    if (index === currentQuestionIndex) return 'current';
    if (hasAnswer) return 'answered';
    return 'unanswered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-blue-600 text-white';
      case 'answered': return 'bg-green-100 text-green-800 border-green-300';
      case 'unanswered': return 'bg-gray-100 text-gray-600 border-gray-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const renderQuestionInput = (question: AppTypes.TestQuestion) => {
    const answer = answers[question.id] || '';

    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-3">
            {question.options?.map((option: string, index: number) => (
              <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'TRUE_FALSE':
        return (
          <div className="space-y-3">
            {['True', 'False'].map((option) => (
              <label key={option} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'SHORT_ANSWER':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-24 resize-y"
          />
        );

      case 'ESSAY':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Write your essay here..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-48 resize-y"
          />
        );

      case 'FILE_UPLOAD':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm mb-4">Upload your file here</p>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleAnswerChange(question.id, file);
                }
              }}
              className="hidden"
              id={`file-${question.id}`}
            />
            <label
              htmlFor={`file-${question.id}`}
              className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 cursor-pointer inline-block"
            >
              Choose File
            </label>
            {answer && (
              <div className="mt-3 p-2 bg-gray-50 rounded flex items-center justify-between">
                <span className="text-sm text-gray-700">{(answer as FileUploadAnswer).fileName}</span>
                <button
                  onClick={() => handleAnswerChange(question.id, null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        );

      default:
        return <div className="text-gray-500">Question type not supported</div>;
    }
  };

  const answeredCount = Object.keys(answers).filter(key =>
    answers[key] !== undefined && answers[key] !== '' && answers[key] !== null
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Timer */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {test.title}
              </h1>
              <p className="text-sm text-gray-500">
                {courses[0].name}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {timeRemaining !== null && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                  <Timer className="w-4 h-4" />
                  <span className="font-mono font-medium">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}

              <button
                onClick={handleSaveProgress}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 text-sm hover:text-gray-800 border border-gray-300 hover:bg-gray-50"
              >
                <Save className="w-4 h-4" />
                Save Progress
              </button>

              <button
                onClick={() => setShowSubmitConfirmation(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700"
                disabled={timeRemaining === 0}
              >
                <Send className="w-4 h-4" />
                {timeRemaining === 0 ? 'Time Expired' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex gap-6">
        {/* Question Navigation Sidebar */}
        <div className="w-64 bg-white border border-gray-200 h-fit sticky top-24">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">Questions</h3>
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {showAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-sm text-gray-500">
              {answeredCount} of {test.questions.length} answered
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / test.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {test.questions.map((_, index) => {
                const status = getQuestionStatus(index);
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-10 h-10 border text-sm font-medium transition-colors ${getStatusColor(status)}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Question Area */}
        <div className="flex-1">
          <div className="bg-white border border-gray-200">
            {/* Question Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">
                    Question {currentQuestionIndex + 1} of {test.questions.length}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                    {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded">
                  {currentQuestion.type.replace('_', ' ')}
                </span>
              </div>

              <h2 className="text-lg font-medium text-gray-900 leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Question Content */}
            <div className="p-6">
              {renderQuestionInput(currentQuestion)}
            </div>

            {/* Navigation Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {answeredCount} answered, {test.questions.length - answeredCount} remaining
                </span>
              </div>

              <button
                onClick={() => setCurrentQuestionIndex(Math.min(test.questions.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === test.questions.length - 1}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirmation && (
        <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Submit Test</h2>
                  <p className="text-gray-500">Review your answers before submitting</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Questions Answered:</span>
                      <p className="font-medium">{answeredCount} of {test.questions.length}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Remaining:</span>
                      <p className="font-medium">{test.questions.length - answeredCount}</p>
                    </div>
                  </div>
                </div>

                {answeredCount < test.questions.length && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800">Incomplete Test</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          You have {test.questions.length - answeredCount} unanswered questions.
                          Are you sure you want to submit?
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSubmitConfirmation(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Review Answers
                </button>
                <button
                  onClick={handleSubmitTest}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 text-white text-sm hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Test
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestTakingPage;