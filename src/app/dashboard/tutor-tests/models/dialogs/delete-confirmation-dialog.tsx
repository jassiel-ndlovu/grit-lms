import { AlertTriangle } from "lucide-react";
import DialogOverlay from "./dialog-overlay";

type DeleteConfirmationDialogProps = {
  test: AppTypes.Test; 
  onConfirm: () => void; 
  onCancel: () => void;
}

const DeleteConfirmationDialog = ({ test, onConfirm, onCancel }: DeleteConfirmationDialogProps) => (
  <DialogOverlay onClose={onCancel}>
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Delete Test</h2>
          <p className="text-gray-500 text-sm">This action cannot be undone</p>
        </div>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-700 text-sm mb-4">
          Are you sure you want to delete the test <strong>&quot;{test.title}&quot;</strong>?
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">This will permanently delete:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• The test and all {test.questions.length} questions</li>
            <li>• All {test.submissions.length} student submissions</li>
            <li>• All grades and feedback</li>
            <li>• Test analytics and statistics</li>
          </ul>
        </div>
      </div>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
        >
          Delete Test
        </button>
      </div>
    </div>
  </DialogOverlay>
);

export default DeleteConfirmationDialog;