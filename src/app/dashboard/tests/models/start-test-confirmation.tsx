import { PlayCircle, Shield } from "lucide-react";

type StartTestConfirmationDialogProps = {
  test: Test;
  onConfirm: () => void;
  onCancel: () => void;
}

const StartTestConfirmationDialog = ({ test, onConfirm, onCancel }: StartTestConfirmationDialogProps) => (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
    <div className="bg-white shadow-xl max-w-md w-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <PlayCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Start Test
            </h2>
            <p className="text-gray-500 text-sm">Are you ready to begin?</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            You are about to start <strong>&quot;{test.title}&quot;</strong>
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 mb-2">Important Reminders:</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  {test.timeLimit && (
                    <li>• You have {test.timeLimit} minutes to complete this test</li>
                  )}
                  <li>• Once started, the timer cannot be paused</li>
                  <li>• Make sure you have a stable internet connection</li>
                  <li>• Save your answers frequently</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
          >
            Not Ready
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            Start Test
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default StartTestConfirmationDialog;