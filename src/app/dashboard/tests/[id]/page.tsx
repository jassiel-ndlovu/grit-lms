/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Timer, Send, ChevronLeft, ChevronRight, Flag, Save, Eye, EyeOff, Upload, Trash2, ImageIcon, FileText, Eraser } from 'lucide-react';
import { useTests } from '@/context/TestContext';
import { TestTakingPageSkeleton } from '../skeletons/test-taking-skeleton';
import { formatTime } from '@/lib/functions';
import { useCourses } from '@/context/CourseContext';
import { useProfile } from '@/context/ProfileContext';
import { useTestSubmissions } from '@/context/TestSubmissionContext';
import { $Enums } from '@/generated/prisma';
import LessonMarkdown from '@/app/components/markdown';
import { JsonArray } from '@prisma/client/runtime/library';
import { deleteFile, uploadFile } from '@/lib/blob';

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
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [answers, setAnswers] = useState<AppTypes.AnswerMap>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [testStartTime, setTestStartTime] = useState<Date | null>(null);
  const [submission, setSubmission] = useState<AppTypes.TestSubmission | null>(null);
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, Record<string, string>>>({});

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

  const handleSubmitTest = async () => {
    setIsSubmitting(true);

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

      alert("Submission complete!");

      router.push(`/dashboard/tests/review/${test.id}`);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert("An error occurred while submitting the test. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      const secondsToDueDate = Math.floor((new Date(test.dueDate).getTime() - now.getTime()) / 1000);

      // take the smallest of the two times
      if (secondsToDueDate > 0 && remainingSeconds > 0) {
        return Math.min(secondsToDueDate, remainingSeconds);
      } 

      return 5;
    };

    setTimeRemaining(calculateRemainingTime());
  }, [testStartTime, test?.dueDate, test?.timeLimit]);

  if (!test || !courses || !courses.length) return <TestTakingPageSkeleton />;

  const currentQuestion = test.questions[currentQuestionIndex];

  // functions
  const handleClearFileUploadAnswer = async (questionId: string) => {
    const answer = answers[questionId];

    // Type guard to check if it's a FileUploadAnswer array
    const isFileUploadAnswerArray = (ans: any): ans is FileUploadAnswer[] => {
      return Array.isArray(ans) && ans.every(item =>
        item && typeof item === 'object' && 'fileUrl' in item
      );
    };

    // If it's a file upload answer, delete files from blob storage
    if (isFileUploadAnswerArray(answer)) {
      try {
        // Delete all files from blob storage
        await Promise.allSettled(
          answer.map(file =>
            deleteFile(file.fileUrl).catch(err => {
              console.error(`Failed to delete file ${file.fileUrl}:`, err);
            })
          )
        );
      } catch (error) {
        console.error('Error deleting files:', error);
      }
    }

    // Clear the answer from state
    handleClearAnswer(questionId);
  };

  const handleClearAnswer = (questionId: string) => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleMatchingAnswerChange = (questionId: string, leftItem: string, rightItem: string) => {
    setMatchingAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [leftItem]: rightItem
      }
    }));

    // Convert the matching answers to the format expected by the backend
    const formattedAnswer = Object.entries(matchingAnswers[questionId] || {})
      .map(([left, right]) => ({ left, right }));

    handleAnswerChange(questionId, formattedAnswer);
  };

  const handleSaveProgress = async () => {
    if (!test || !studentProfile?.id) return;

    setIsSaving(true);

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
    } finally {
      setIsSaving(false);
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

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) {
      return <ImageIcon className="w-4 h-4 text-blue-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-600" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="w-4 h-4 text-blue-600" />;
    }
    return <FileText className="w-4 h-4 text-gray-600" />;
  };

  // Helper function to format file type for display
  const formatFileType = (fileType: string) => {
    if (fileType.includes('image')) return 'Image';
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('word') || fileType.includes('document')) return 'Word Document';
    return fileType;
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
                <div className="text-sm">
                  <LessonMarkdown content={option} />
                </div>
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
                <div className="inline-flex text-gray-700">
                  <LessonMarkdown content={option} />
                </div>
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
            className="w-full p-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 min-h-24 resize-y"
          />
        );

      case 'ESSAY':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Write your essay here..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-48 resize-y"
          />
        );

      case 'FILE_UPLOAD':
        // Type guard to check if answer is a FileUploadAnswer array
        const isFileUploadAnswer = (ans: any): ans is FileUploadAnswer[] => {
          return Array.isArray(ans) && ans.every(item =>
            item && typeof item === 'object' && 'fileName' in item && 'fileUrl' in item
          );
        };

        const fileUploadAnswer = isFileUploadAnswer(answer) ? answer : [];
        const allowedFileTypes = ['.png', '.jpeg', '.jpg', '.pdf', '.docx'];
        const maxFileSize = 4 * 1024 * 1024; // 4MB in bytes

        const handleFileUpload = async (files: FileList | null) => {
          if (!files) return;

          setIsUploading(true);

          const newFiles: FileUploadAnswer[] = [];
          const errors: string[] = [];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Validate file type
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!allowedFileTypes.includes(fileExtension || '')) {
              errors.push(`${file.name}: Invalid file type. Allowed: ${allowedFileTypes.join(', ')}`);
              continue;
            }

            // Validate file size
            if (file.size > maxFileSize) {
              errors.push(`${file.name}: File too large. Maximum size is 4MB`);
              continue;
            }

            try {
              // Upload to blob storage
              const fileUrl = await uploadFile(file);
              newFiles.push({
                fileName: file.name,
                fileType: file.type,
                fileUrl: fileUrl
              });
            } catch (error) {
              errors.push(`${file.name}: Upload failed`);
              console.error('File upload error:', error);
            }
          }

          setIsUploading(false);

          // Show validation errors
          if (errors.length > 0) {
            alert(`Upload errors:\n${errors.join('\n')}`);
          }

          // Update answers with new files
          if (newFiles.length > 0) {
            handleAnswerChange(question.id, [...fileUploadAnswer, ...newFiles]);
          }
        };

        const handleFileDelete = async (fileUrl: string, index: number) => {
          setIsUploading(true);

          try {
            // Delete from blob storage
            await deleteFile(fileUrl);

            // Remove from answers
            const updatedFiles = fileUploadAnswer.filter((_, i) => i !== index);
            handleAnswerChange(question.id, updatedFiles.length > 0 ? updatedFiles : null);
          } catch (error) {
            console.error('File deletion error:', error);
            alert('Failed to delete file. Please try again.');
          } finally {
            setIsUploading(false);
          }
        };

        return (
          <div className="border border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center mb-4">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm mb-2">Upload your files here</p>
              <p className="text-xs text-gray-500 mb-4">
                Allowed formats: PNG, JPG, JPEG, PDF, DOCX (Max 4MB each)
              </p>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".png,.jpeg,.jpg,.pdf,.docx"
                className="hidden"
                id={`file-${question.id}`}
              />
              <label
                htmlFor={`file-${question.id}`}
                className={`px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 cursor-pointer inline-block ${isUploading ? "animate-bounce" : "animate-none"}`}
              >
                {isUploading ? "Uploading..." : "Choose Files"}
              </label>
            </div>

            {fileUploadAnswer.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Files:</h4>
                {fileUploadAnswer.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        {getFileIcon(file.fileType)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileType(file.fileType)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileDelete(file.fileUrl, index)}
                      disabled={isUploading}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'MULTI_SELECT':
        const multiSelectAnswer = Array.isArray(answer) ? answer : [];
        return (
          <div className="space-y-3">
            {question.options?.map((option: string, index: number) => (
              <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  name={question.id}
                  value={option}
                  checked={(multiSelectAnswer as string[]).includes(option)}
                  onChange={(e) => {
                    const newAnswer = e.target.checked
                      ? [...multiSelectAnswer, option]
                      : (multiSelectAnswer as string[]).filter((item: string) => item !== option);
                    handleAnswerChange(question.id, newAnswer);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <LessonMarkdown content={option} />
                {/* <span>{option}</span> */}
              </label>
            ))}
          </div>
        );

      case 'CODE':
        return (
          <div className="space-y-3">
            {question.language && (
              <div className="text-sm text-gray-500">
                Language: {question.language}
              </div>
            )}
            <textarea
              value={answer as string}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Write your code here..."
              className="w-full p-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 min-h-48 resize-y font-mono text-sm"
            />
          </div>
        );

      case 'MATCHING':
        const matchPairs = question.matchPairs || [];
        const currentMatchingAnswers = matchingAnswers[question.id] || {};

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="font-medium text-gray-700">Items</div>
              <div className="font-medium text-gray-700">Matches</div>

              {(matchPairs as JsonArray).map((pair: any, index: number) => (
                <React.Fragment key={index}>
                  <div className="p-3 bg-gray-50 text-sm">
                    <LessonMarkdown content={pair.left} />
                  </div>
                  <select
                    value={currentMatchingAnswers[pair.left] || ''}
                    onChange={(e) => handleMatchingAnswerChange(question.id, pair.left, e.target.value)}
                    className="p-3 border border-gray-300 text-sm focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a match</option>
                    {(matchPairs as JsonArray).map((p: any, idx: number) => (
                      <option key={idx} value={p.right}>
                        {/* <LessonMarkdown content={p.right} /> */}
                        {p.right}
                      </option>
                    ))}
                  </select>
                </React.Fragment>
              ))}
            </div>
          </div>
        );

      case 'REORDER':
        const reorderItems = question.reorderItems || [];
        const reorderAnswer = Array.isArray(answer) ? answer : [];

        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-4">
              Drag to reorder the items into the correct sequence
            </div>
            <div className="space-y-2">
              {reorderItems.map((item: string, index: number) => (
                <div
                  key={index}
                  className="p-3 border border-gray-300 bg-white flex items-center gap-3 cursor-move"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIndex = index;
                    const newOrder = [...reorderAnswer.length ? reorderAnswer : reorderItems];
                    const [movedItem] = newOrder.splice(fromIndex, 1);
                    newOrder.splice(toIndex, 0, movedItem);
                    handleAnswerChange(question.id, newOrder);
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-600">
                    {index + 1}
                  </div>
                  <LessonMarkdown content={item} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'FILL_IN_THE_BLANK':
        const blankCount = question.blankCount || (question.question.match(/_{3,}/g)?.length || 1) || 1;
        const blankAnswer = Array.isArray(answer) ? answer : new Array(blankCount).fill('');

        return (
          <div className="space-y-4">
            <LessonMarkdown content={question.question} />
            <div className="grid gap-3">
              {Array.from({ length: blankCount }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Blank {index + 1}:</span>
                  <input
                    type="text"
                    value={blankAnswer[index] || ''}
                    onChange={(e) => {
                      const newAnswer = [...blankAnswer];
                      newAnswer[index] = e.target.value;
                      handleAnswerChange(question.id, newAnswer);
                    }}
                    className="flex-1 p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Answer for blank ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'NUMERIC':
        return (
          <input
            type="number"
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter a number"
            step="any"
          />
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
                disabled={isUploading || isSubmitting || isSaving}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 text-sm hover:text-gray-800 border border-gray-300 hover:bg-gray-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Progress
                  </>
                )}
              </button>

              <button
                onClick={() => setShowSubmitConfirmation(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700"
                disabled={timeRemaining === 0 || isUploading}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {timeRemaining === 0 ? 'Time Expired' : 'Submit Test'}
                  </>
                )}
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
                  {currentQuestion.type.replace('_', ' ').toLowerCase()}
                </span>
              </div>

              <LessonMarkdown content={currentQuestion.question} />

            </div>

            {/* Question Content */}
            <div className="p-6">
              {renderQuestionInput(currentQuestion)}
            </div>

            {/* Navigation Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0 || isUploading || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 text-sm hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {answeredCount} answered, {test.questions.length - answeredCount} remaining
                  </span>
                </div>

                {/* Clear Answer Button */}
                {answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== '' && answers[currentQuestion.id] !== null && (
                  <button
                    onClick={() => {
                      if (answers[currentQuestion.id]) {
                        if (currentQuestion.type === 'FILE_UPLOAD') {
                          handleClearFileUploadAnswer(currentQuestion.id);
                        } else {
                          handleClearAnswer(currentQuestion.id);
                        }
                      } else {
                        alert("This action can't be performed at the moment.");
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 text-sm transition-colors"
                    title="Clear answer"
                  >
                    <Eraser className="w-4 h-4" />
                    Clear Answer
                  </button>
                )}
              </div>

              <button
                onClick={() => setCurrentQuestionIndex(Math.min(test.questions.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === test.questions.length - 1 || isUploading || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 text-sm hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Submit Test
                  </h2>
                  <p className="text-gray-500">
                    Review your answers before submitting
                  </p>
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
                  disabled={isSubmitting || isUploading}
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