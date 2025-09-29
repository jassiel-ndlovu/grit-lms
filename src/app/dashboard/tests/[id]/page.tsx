"use client";

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingOverlay } from '../components/loading-overlay';
import { TimeWarning } from '../components/time-warning';
import { useErrorPages } from '../../components/error-pages';
import { useTestSession } from '../hooks/use-test-session';
import { TestTakingPageSkeleton } from '../skeletons/test-taking-skeleton';
import { InternetStatus } from '../components/internet-status';
import { TestHeader } from '../components/test-header';
import { TestNavigation } from '../components/test-navigation';
import { QuestionArea } from '../components/question-area';
import { SubmitConfirmation } from '../components/submit-confirmation';

type TestTakingPageProps = {
  params: Promise<{ id: string }>;
}

export default function TestTakingPage({ params }: TestTakingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { renderErrorPage, renderAccessDeniedPage } = useErrorPages();

  const {
    // State
    test,
    courses,
    answers,
    matchingAnswers,
    currentQuestionIndex,
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
    setCurrentQuestionIndex,
    setShowSubmitConfirmation,
    setShowAnswers,
    handleAnswerChange,
    handleMatchingAnswerChange,
    handleSaveProgress,
    handleSubmitTest,
    handleClearAnswer,
    handleClearFileUploadAnswer,
    getQuestionStatus,
    toggleQuestionExpansion
  } = useTestSession(id);

  // Handle auto-submit redirect
  useEffect(() => {
    if (autoSubmitted) {
      console.log('Auto-submit occurred, preparing redirect...');
      // The redirect is handled within the hook, but we can show a message
    }
  }, [autoSubmitted]);

  // Show warning when time is running low
  const showTimeWarning = timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 300; // 5 minutes

  // Render different states
  if (loadingState === 'expired') {
    return renderErrorPage({
      errorType: "timeout",
      message: errorMessage || "This test is no longer available. The due date has passed.",
      title: "Test Not Available",
      showGoBack: true,
      showGoHome: true,
      onGoHome: () => router.push("/dashboard"),
      onGoBack: () => router.push("/dashboard/tests"),
    });
  }

  if (!hasInternet) {
    return renderAccessDeniedPage({
      reason: "No internet connection. Please check your connection and try again.",
      resourceType: "test",
      onGoBack: () => router.push('/dashboard/tests')
    });
  }

  if (loadingState === 'timeout') {
    return renderErrorPage({
      errorType: "timeout",
      message: errorMessage || "Test loading timed out. Please go back and try again.",
      title: "Test Timed Out",
      showContactSupport: true,
      showGoBack: true,
      onGoBack: () => router.push("/dashboard/tests"),
    });
  }

  if (loadingState === 'error') {
    return renderErrorPage({
      errorType: "generic",
      message: errorMessage || "Unable to load the test. Please contact your tutor if this persists.",
      title: "Could not load Test",
      showRetry: true,
      showGoBack: true,
      onGoBack: () => router.push("/dashboard/tests"),
    });
  }

  if (loadingState === 'loading' || !test || !courses.length) {
    return <TestTakingPageSkeleton />;
  }

  if (test.dueDate && new Date(test.dueDate) < new Date()) {
    return renderErrorPage({
      errorType: "timeout",
      message: errorMessage || "This test is no longer available. The due date has passed.",
      title: "Test Not Available",
      showGoBack: true,
      showGoHome: true,
      onGoHome: () => router.push("/dashboard"),
      onGoBack: () => router.push("/dashboard/tests"),
    });
  }

  if (!test.isActive) {
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

  const answeredCount = Object.keys(answers).filter(key =>
    answers[key] !== undefined && answers[key] !== '' && answers[key] !== null
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/20">
      <InternetStatus hasInternet={hasInternet} />

      {/* Time warning for low time */}
      {showTimeWarning && (
        <TimeWarning
          timeRemaining={timeRemaining}
          onDismiss={() => console.log('Warning dismissed')}
        />
      )}

      {/* Auto-submit notification */}
      {autoSubmitted && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg">
            Time expired! Your test has been automatically submitted.
          </div>
        </div>
      )}

      {/* Loading overlay for save operations */}
      {isSaving && <LoadingOverlay message="Saving your progress..." />}

      {/* Submitting overlay */}
      {isSubmitting && (
        <LoadingOverlay message="Submitting your test... Please wait." />
      )}

      {/* Header */}
      <TestHeader
        test={test}
        courses={courses}
        timeRemaining={timeRemaining}
        isSaving={isSaving}
        isUploading={isUploading}
        onSaveProgress={handleSaveProgress}
        onSubmit={() => setShowSubmitConfirmation(true)}
      />

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <TestNavigation
              test={test}
              currentQuestionIndex={currentQuestionIndex}
              answeredCount={answeredCount}
              showAnswers={showAnswers}
              expandedQuestions={expandedQuestions}
              onQuestionSelect={setCurrentQuestionIndex}
              onToggleAnswers={() => setShowAnswers(!showAnswers)}
              onToggleExpansion={toggleQuestionExpansion}
              getQuestionStatus={getQuestionStatus}
            />
          </div>

          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <QuestionArea
              test={test}
              currentQuestionIndex={currentQuestionIndex}
              answers={answers}
              matchingAnswers={matchingAnswers}
              isUploading={isUploading}
              onQuestionChange={setCurrentQuestionIndex}
              onAnswerChange={handleAnswerChange}
              onMatchingAnswerChange={handleMatchingAnswerChange}
              onClearAnswer={handleClearAnswer}
              onClearFileUploadAnswer={handleClearFileUploadAnswer}
            />
          </div>
        </div>
      </div>

      {/* Submit Confirmation */}
      {showSubmitConfirmation && (
        <SubmitConfirmation
          test={test}
          answeredCount={answeredCount}
          isSubmitting={isSubmitting}
          onCancel={() => setShowSubmitConfirmation(false)}
          onSubmit={handleSubmitTest}
        />
      )}
    </div>
  );
}