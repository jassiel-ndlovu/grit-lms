import { Copy, Edit3, Eye, MoreVertical, Trash2, X } from "lucide-react";
import { useState } from "react";

interface SubmissionActionsMenuProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function SubmissionActionsMenu({ onView, onEdit, onDelete, onDuplicate }: SubmissionActionsMenuProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 animate-slide-in-right">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Actions
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="text-gray-400 w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleAction(onView)}
                  className="w-full flex items-center gap-3 px-4 py-3 font-normal text-left text-gray-700 hover:bg-gray-100 transition-colors border border-gray-400"
                >
                  <Eye className="w-5 h-5" />
                  <span>View Submission Details</span>
                </button>

                <button
                  onClick={() => handleAction(onEdit)}
                  className="w-full flex items-center gap-3 px-4 py-3 font-normal text-left text-gray-700 hover:bg-gray-100 transition-colors border border-gray-400"
                >
                  <Edit3 className="w-5 h-5" />
                  <span>Edit Submission</span>
                </button>

                <button
                  onClick={() => handleAction(onDuplicate)}
                  className="w-full flex items-center gap-3 px-4 py-3 font-normal text-left text-gray-700 hover:bg-gray-100 transition-colors border border-gray-400"
                >
                  <Copy className="w-5 h-5" />
                  <span>Duplicate Submission</span>
                </button>

                <button
                  onClick={() => handleAction(onDelete)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors border border-red-400"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Submission</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}