// app/dashboard/tests/take/[id]/components/submit-confirmation.tsx
import React from 'react';
import { Send, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

interface SubmitConfirmationProps {
  test: AppTypes.Test;
  answeredCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export const SubmitConfirmation: React.FC<SubmitConfirmationProps> = ({
  test,
  answeredCount,
  isSubmitting,
  onCancel,
  onSubmit
}) => {
  const unansweredCount = test.questions.length - answeredCount;
  const completionPercentage = (answeredCount / test.questions.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Submit Test</h2>
                <p className="text-gray-600">Review your answers before submitting</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Summary */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{answeredCount}</div>
                <div className="text-gray-600">Answered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{unansweredCount}</div>
                <div className="text-gray-600">Unanswered</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Completion</span>
                <span>{Math.round(completionPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warnings */}
          {unansweredCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-800">Incomplete Test</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    You have {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}. 
                    Are you sure you want to submit?
                  </p>
                </div>
              </div>
            </div>
          )}

          {unansweredCount === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-800">All Questions Answered</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Great job! You&apos;ve answered all the questions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Test Information */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Once submitted, you cannot make changes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Your progress has been saved automatically</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Review Answers
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
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
  );
};