/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTests } from "@/context/TestContext";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { $Enums } from "@/generated/prisma";
import { ExtendedTestQuestion } from "@/lib/test-creation-types";

export const useTestSession = (testId: string) => {
  const router = useRouter();
  const { fetchTestById } = useTests();
  const { courses, fetchCoursesByIds } = useCourses();
  const { profile } = useProfile();
  const { fetchSubmissionByStudentTestId, updateSubmission } =
    useTestSubmissions();

  const studentProfile = profile as AppTypes.Student;
  const workerRef = useRef<Worker | null>(null);

  // State
  const [currentQuestionId, setCurrentQuestionId] = useState<string>(''); // Changed to ID
  const [test, setTest] = useState<AppTypes.Test | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [answers, setAnswers] = useState<AppTypes.AnswerMap>({});
  const [matchingAnswers, setMatchingAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showSubmitConfirmation, setShowSubmitConfirmation] =
    useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [testStartTime, setTestStartTime] = useState<Date | null>(null);
  const [submission, setSubmission] = useState<AppTypes.TestSubmission | null>(
    null
  );
  const [loadingState, setLoadingState] = useState<
    "loading" | "success" | "error" | "timeout" | "expired"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasInternet, setHasInternet] = useState<boolean>(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set()
  );
  const [autoSubmitted, setAutoSubmitted] = useState<boolean>(false);
  const [fallbackTimer, setFallbackTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Enhanced handleSubmitTest with better error handling and state checks
  const handleSubmitTest = useCallback(
    async (isAutoSubmit = false) => {
      console.log("🔄 handleSubmitTest called", { 
        isAutoSubmit, 
        autoSubmitted, 
        test: test?.id,
        hasTest: !!test,
        loadingState 
      });

      if (isAutoSubmit && autoSubmitted) {
        console.log("✅ Already auto-submitted, skipping");
        return;
      }

      if (!test) {
        console.error("❌ No test available to submit - test is null");
        // Try to reload test data before giving up
        try {
          console.log("🔄 Attempting to reload test data...");
          const fetchedTest = await fetchTestById(testId);
          if (fetchedTest) {
            setTest(fetchedTest);
            console.log("✅ Test data reloaded, retrying submission");
            // Retry submission after short delay
            setTimeout(() => handleSubmitTest(isAutoSubmit), 100);
            return;
          }
        } catch (error) {
          console.error("❌ Failed to reload test data:", error);
        }
        
        if (!isAutoSubmit) {
          alert("Test data is not available. Please try refreshing the page.");
        }
        return;
      }

      if (!hasInternet) {
        console.error("❌ No internet connection");
        if (!isAutoSubmit) {
          alert("No internet connection. Please check your connection and try again.");
        }
        return;
      }

      if (isSubmitting) {
        console.log("⏳ Already submitting, skipping...");
        return;
      }

      setIsSubmitting(true);
      setIsUploading(true);

      try {
        console.log("🚀 Starting test submission...", {
          testId: test.id,
          studentId: studentProfile?.id,
          answersCount: Object.keys(answers).length
        });

        const submissionData: Partial<AppTypes.TestSubmission> = {
          studentId: studentProfile?.id,
          testId: test.id,
          answers: answers,
          status: $Enums.SubmissionStatus.SUBMITTED,
          startedAt: testStartTime || new Date(),
          submittedAt: new Date(),
        };

        console.log("📦 Submission data prepared", submissionData);

        // Ensure we have a submission ID
        const submissionId = submission?.id || "";
        if (!submissionId) {
          console.warn("⚠️ No submission ID found, creating new submission");
        }

        await updateSubmission(submissionId, submissionData);

        console.log("✅ Test submitted successfully");

        if (isAutoSubmit) {
          setAutoSubmitted(true);
          console.log("🏷️ Marked as auto-submitted");
        }

        // Redirect to review page
        console.log("🔀 Redirecting to review page");
        router.push(`/dashboard/tests/review/${test.id}`);
        
      } catch (error) {
        console.error("❌ Error submitting test:", error);
        if (!isAutoSubmit) {
          alert("An error occurred while submitting the test. Please try again.");
        }
        // Reset states only for manual submissions
        if (!isAutoSubmit) {
          setIsSubmitting(false);
          setIsUploading(false);
        }
      }
    },
    [
      test,
      testId,
      hasInternet,
      isSubmitting,
      autoSubmitted,
      studentProfile?.id,
      answers,
      testStartTime,
      submission?.id,
      updateSubmission,
      router,
      fetchTestById, // Added to dependencies
    ]
  );

  // Auto-submit function with additional safeguards
  const handleAutoSubmit = useCallback(async () => {
    console.log("⏰ Auto-submitting test due to time expiration");
    
    // Double-check we have a test before auto-submitting
    if (!test) {
      console.log("🔄 No test found for auto-submit, attempting to load...");
      try {
        const fetchedTest = await fetchTestById(testId);
        if (fetchedTest) {
          setTest(fetchedTest);
          console.log("✅ Test loaded for auto-submit");
          // Give a small delay for state to update
          setTimeout(() => handleSubmitTest(true), 100);
          return;
        }
      } catch (error) {
        console.error("❌ Failed to load test for auto-submit:", error);
      }
    }
    
    await handleSubmitTest(true);
  }, [test, testId, handleSubmitTest, fetchTestById]);

  // Initialize Web Worker - but only when test and start time are available
  useEffect(() => {
    // Don't start timer until we have both test and start time
    if (!test || !testStartTime) {
      console.log("⏰ Timer: Waiting for test and start time");
      return;
    }

    if (typeof Worker !== "undefined") {
      try {
        workerRef.current = new Worker(
          new URL("/public/timer-worker.js", import.meta.url)
        );

        workerRef.current.onmessage = (e) => {
          console.log("⏰ Worker message:", e.data);
          if (e.data.expired) {
            console.log("⏰ Time expired, auto-submitting...");
            handleAutoSubmit();
          } else if (e.data.remaining !== undefined) {
            setTimeRemaining(e.data.remaining);
          }
        };

        workerRef.current.onerror = (error) => {
          console.error("❌ Web Worker error:", error);
          startFallbackTimer();
        };

        console.log("✅ Web Worker initialized successfully");

        // Start the timer
        const startTime = testStartTime.getTime();
        const timeLimit = test.timeLimit || 60;
        const dueDate = test.dueDate;

        console.log("⏰ Starting Web Worker timer", {
          startTime,
          timeLimit,
          dueDate
        });

        workerRef.current.postMessage({
          command: "start",
          startTime,
          timeLimit,
          dueDate,
        });

      } catch (error) {
        console.error("❌ Failed to create Web Worker:", error);
        startFallbackTimer();
      }
    } else {
      console.log("ℹ️ Web Workers not supported, using fallback timer");
      startFallbackTimer();
    }

    return () => {
      if (workerRef.current) {
        console.log("🛑 Terminating Web Worker");
        workerRef.current.terminate();
      }
      if (fallbackTimer) {
        console.log("🛑 Clearing fallback timer");
        clearInterval(fallbackTimer);
      }
    };
  }, [test, testStartTime, handleAutoSubmit]); // Added test and testStartTime as dependencies

  // Fallback timer function - only start when test and start time are available
  const startFallbackTimer = useCallback(() => {
    if (!test || !testStartTime) {
      console.log("⏰ Fallback timer: Missing test or start time");
      return;
    }

    console.log("⏰ Starting fallback timer", {
      timeLimit: test.timeLimit,
      startTime: testStartTime
    });

    const calculateTimeRemaining = () => {
      const now = new Date();
      const elapsedSeconds = Math.floor(
        (now.getTime() - testStartTime.getTime()) / 1000
      );
      const timeLimitSeconds = (test.timeLimit || 60) * 60;
      const dueDate = new Date(test.dueDate);
      const secondsToDueDate = Math.floor(
        (dueDate.getTime() - now.getTime()) / 1000
      );

      const remainingFromStart = Math.max(0, timeLimitSeconds - elapsedSeconds);
      const remaining = Math.max(
        0,
        Math.min(remainingFromStart, secondsToDueDate)
      );

      console.log("⏰ Fallback timer - Remaining:", remaining);
      return remaining;
    };

    const initialTime = calculateTimeRemaining();
    console.log("⏰ Initial time remaining:", initialTime);
    setTimeRemaining(initialTime);

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        console.log("⏰ Fallback timer: Time expired, submitting...");
        clearInterval(timer);
        handleAutoSubmit();
      }
    }, 1000);

    setFallbackTimer(timer);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [test, testStartTime, handleAutoSubmit]);

  // Load test data - fixed version
  useEffect(() => {
    const loadTestData = async () => {
      try {
        setLoadingState("loading");
        console.log('📥 Loading test data for ID:', testId);
        const fetchedTest = await fetchTestById(testId) as AppTypes.Test;

        setTest(fetchedTest);

        console.log('✅ Fetched test:', {
          id: fetchedTest.id,
          title: fetchedTest.title,
          timeLimit: fetchedTest.timeLimit,
          dueDate: fetchedTest.dueDate,
          isActive: fetchedTest.isActive
        });

        if (!fetchedTest.isActive) {
          setLoadingState("expired");
          setErrorMessage("This test is no longer available.");
          return;
        }

        if (fetchedTest.dueDate && new Date(fetchedTest.dueDate) < new Date()) {
          setLoadingState("expired");
          setErrorMessage("This test is no longer available. The due date has passed.");
          return;
        }

        // Organize questions hierarchically
        if (fetchedTest.questions && fetchedTest.questions.length > 0) {
          const organizedQuestions = organizeQuestionsHierarchically(fetchedTest.questions);
          fetchedTest.questions = organizedQuestions as any;
          
          console.log('📊 Organized questions hierarchically:', {
            rootQuestions: organizedQuestions.length,
            totalQuestions: fetchedTest.questions.length,
            questionsWithSubquestions: organizedQuestions.filter(q => q.subQuestions && q.subQuestions.length > 0).length
          });
        }

        // Load course data after test is loaded
        await fetchCoursesByIds([fetchedTest.courseId]);

        console.log('✅ Test data loading completed');

      } catch (error) {
        console.error('❌ Error loading test:', error);
        setLoadingState("error");
        setErrorMessage("Failed to load test. Please try again.");
      }
    };

    if (testId) {
      loadTestData();
    }
  }, [testId, fetchTestById, fetchCoursesByIds]);

  // Load submission data
  useEffect(() => {
    const loadSubmissionData = async () => {
      if (test && studentProfile?.id && loadingState === "loading") {
        try {
          console.log(
            "Loading submission data for student:",
            studentProfile.id
          );
          const sub = await fetchSubmissionByStudentTestId(
            studentProfile.id,
            test.id
          );

          if (sub) {
            console.log("Submission found:", {
              status: sub.status,
              startedAt: sub.startedAt,
            });

            if (sub.status === "SUBMITTED" || sub.status === "GRADED") {
              setLoadingState("expired");
              setErrorMessage("You have already submitted this test.");
              return;
            }

            setSubmission(sub);
            setAnswers((sub.answers as AppTypes.AnswerMap) || {});
            setTestStartTime(new Date(sub.startedAt));
            setLoadingState("success");
            console.log("Submission data loaded successfully");
          } else {
            setLoadingState("expired");
            setErrorMessage("Please go to the pre-test page for instructions.");
          }
        } catch (error) {
          console.error("Error loading submission:", error);
          setLoadingState("error");
          setErrorMessage("Failed to load your test submission.");
        }
      }
    };

    if (test && loadingState === "loading") {
      loadSubmissionData();
    }
  }, [test, studentProfile?.id, fetchSubmissionByStudentTestId, loadingState]);

  // Timer logic - Start timing when test and start time are available
  useEffect(() => {
    if (!test || !testStartTime) {
      console.log("Timer: Waiting for test and start time");
      return;
    }

    console.log("Starting timer with:", {
      timeLimit: test.timeLimit,
      startTime: testStartTime,
      dueDate: test.dueDate,
    });

    if (workerRef.current && workerRef.current.onmessage) {
      const startTime = testStartTime.getTime();
      const timeLimit = test.timeLimit || 60;
      const dueDate = test.dueDate;

      console.log("Sending start command to Web Worker");
      workerRef.current.postMessage({
        command: "start",
        startTime,
        timeLimit,
        dueDate,
      });
    } else {
      console.log("Using fallback timer (Web Worker not available)");
      startFallbackTimer();
    }

    return () => {
      if (workerRef.current) {
        console.log("Stopping Web Worker timer");
        workerRef.current.postMessage({ command: "stop" });
      }
    };
  }, [test, testStartTime, startFallbackTimer]);

  // Handle visibility change for fallback timer
  useEffect(() => {
    if (workerRef.current) {
      console.log("Web Worker active, visibility changes handled by worker");
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible, recalculating time");
        if (test && testStartTime) {
          const calculateTimeRemaining = () => {
            const now = new Date();
            const elapsedSeconds = Math.floor(
              (now.getTime() - testStartTime.getTime()) / 1000
            );
            const timeLimitSeconds = (test.timeLimit || 60) * 60;
            const dueDate = new Date(test.dueDate);
            const secondsToDueDate = Math.floor(
              (dueDate.getTime() - now.getTime()) / 1000
            );

            const remainingFromStart = Math.max(
              0,
              timeLimitSeconds - elapsedSeconds
            );
            return Math.max(0, Math.min(remainingFromStart, secondsToDueDate));
          };

          setTimeRemaining(calculateTimeRemaining());
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [test, testStartTime]);

  // Auto-save progress
  useEffect(() => {
    const autoSave = async () => {
      if (!test || !studentProfile?.id || !testStartTime) return;

      try {
        setIsSaving(true);
        const submissionData: Partial<AppTypes.TestSubmission> = {
          studentId: studentProfile.id,
          testId: test.id,
          answers: answers,
          startedAt: testStartTime,
        };

        await updateSubmission(submission?.id || "", submissionData);
        console.log("Auto-save completed");
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setIsSaving(false);
      }
    };

    // Only auto-save if there are answers to save
    if (Object.keys(answers).length > 0) {
      const timeoutId = setTimeout(autoSave, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [
    answers,
    test,
    studentProfile?.id,
    testStartTime,
    submission?.id,
    updateSubmission,
  ]);

  // Utility function to organize questions hierarchically
  const organizeQuestionsHierarchically = (
    flatQuestions: AppTypes.TestQuestion[]
  ): ExtendedTestQuestion[] => {
    // Create a map for quick lookup
    const questionMap = new Map<string, ExtendedTestQuestion>();
    const rootQuestions: ExtendedTestQuestion[] = [];

    // First pass: create extended questions and store in map
    flatQuestions.forEach((question) => {
      questionMap.set(question.id, {
        ...question,
        subQuestions: [],
        isExpanded: false,
      });
    });

    // Second pass: build the hierarchy
    flatQuestions.forEach((question) => {
      const extendedQuestion = questionMap.get(question.id)!;

      if (question.parentId) {
        // This is a subquestion - add to parent's subQuestions array
        const parent = questionMap.get(question.parentId);
        if (parent) {
          parent.subQuestions = parent.subQuestions || [];
          parent.subQuestions.push(extendedQuestion);

          // Sort subquestions by order if available
          if (
            parent.subQuestions.length > 1 &&
            parent.subQuestions.every((q) => q.order != null)
          ) {
            parent.subQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
          }
        }
      } else {
        // This is a root question
        rootQuestions.push(extendedQuestion);
      }
    });

    // Sort root questions by order if available
    if (
      rootQuestions.length > 1 &&
      rootQuestions.every((q) => q.order != null)
    ) {
      rootQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return rootQuestions;
  };

  // Actions
  const handleAnswerChange = useCallback((questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleMatchingAnswerChange = useCallback(
    (questionId: string, leftItem: string, rightItem: string) => {
      setMatchingAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], [leftItem]: rightItem },
      }));
    },
    []
  );

  const handleClearAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
  }, []);

  const handleClearFileUploadAnswer = useCallback(
    async (questionId: string) => {
      // Implementation for file deletion would go here
      handleClearAnswer(questionId);
    },
    [handleClearAnswer]
  );

  const handleSaveProgress = useCallback(async () => {
    if (!test || !studentProfile?.id) return;

    setIsSaving(true);
    try {
      const submissionData: Partial<AppTypes.TestSubmission> = {
        studentId: studentProfile.id,
        testId: test.id,
        answers: answers,
        startedAt: testStartTime || new Date(),
      };

      await updateSubmission(submission?.id || "", submissionData);
      console.log("Manual save completed");
    } catch (error) {
      console.error("Error saving progress:", error);
      alert("Failed to save progress. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    test,
    studentProfile?.id,
    answers,
    testStartTime,
    submission?.id,
    updateSubmission,
  ]);

  const getQuestionStatus = useCallback(
    (questionId: string, currentQuestionId: string): "current" | "answered" | "unanswered" | undefined => {
      if (!test) return;

      const hasAnswer =
        answers[questionId] !== undefined &&
        answers[questionId] !== "" &&
        answers[questionId] !== null;
      return questionId === currentQuestionId
        ? "current"
        : hasAnswer
        ? "answered"
        : "unanswered";
    },
    [test, answers, currentQuestionId]
  );

  const toggleQuestionExpansion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }

      return newSet;
    });
  }, []);

  return {
    // State
    test,
    courses,
    submission,
    answers,
    matchingAnswers,
    currentQuestionId, // Changed from currentQuestionIndex
    setCurrentQuestionId, // Add setter
    timeRemaining,
    isUploading,
    isSaving,
    isSubmitting,
    showSubmitConfirmation,
    showAnswers,
    loadingState,
    errorMessage,
    hasInternet,
    expandedQuestions,
    autoSubmitted,

    // Actions
    setShowSubmitConfirmation,
    setShowAnswers,
    setExpandedQuestions,
    handleAnswerChange,
    handleMatchingAnswerChange,
    handleSaveProgress,
    handleSubmitTest: () => handleSubmitTest(false), // Manual submit
    handleClearAnswer,
    handleClearFileUploadAnswer,
    getQuestionStatus,
    toggleQuestionExpansion,
  };
};