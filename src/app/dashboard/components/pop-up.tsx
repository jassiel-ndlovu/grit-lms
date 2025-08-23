import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

// Dialog types for different message styles
export type DialogType = 'info' | 'success' | 'warning' | 'error';

// Props interface for the Dialog component
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  autoClose?: number; // Auto close after X milliseconds
  className?: string;
}

// Icon mapping for different dialog types
const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

// Color schemes for different dialog types
const typeStyles = {
  info: {
    icon: 'text-blue-500',
    button: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
    border: 'border-blue-200',
  },
  success: {
    icon: 'text-green-500',
    button: 'bg-green-500 hover:bg-green-600 focus:ring-green-500',
    border: 'border-green-200',
  },
  warning: {
    icon: 'text-yellow-500',
    button: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500',
    border: 'border-yellow-200',
  },
  error: {
    icon: 'text-red-500',
    button: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
    border: 'border-red-200',
  },
};

// Main Dialog Component
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = false,
  autoClose,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Handle auto-close functionality
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, onClose]);

  // Handle visibility animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const IconComponent = typeIcons[type];
  const styles = typeStyles[type];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-150 ${
          isOpen ? 'opacity-30' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Dialog container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative transform overflow-hidden bg-white shadow-xl transition-all duration-150 w-full max-w-md ${
            isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${className}`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded-full p-1"
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="flex items-start space-x-4">
              {/* Icon */}
              <div className={`flex-shrink-0 ${styles.icon}`}>
                <IconComponent size={24} />
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {title}
                  </h3>
                )}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
            {showCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:text-sm"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className={`w-full sm:w-auto inline-flex justify-center px-4 py-2 text-sm text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom hook for managing dialog state
export const useDialog = () => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as DialogType,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    autoClose: undefined as number | undefined,
    onConfirm: undefined as (() => void) | undefined,
    onCancel: undefined as (() => void) | undefined,
  });

  const showDialog = (options: Partial<typeof dialogState> & { message: string }) => {
    setDialogState(prev => ({ ...prev, ...options, isOpen: true }));
  };

  const hideDialog = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  return { dialogState, showDialog, hideDialog };
};

// Example usage component
const DialogExample: React.FC = () => {
  const { dialogState, showDialog, hideDialog } = useDialog();

  const showInfoDialog = () => {
    showDialog({
      type: 'info',
      title: 'Information',
      message: 'This is an informational message. Click OK to continue.',
    });
  };

  const showSuccessDialog = () => {
    showDialog({
      type: 'success',
      title: 'Success!',
      message: 'Your operation completed successfully.',
      autoClose: 3000,
    });
  };

  const showWarningDialog = () => {
    showDialog({
      type: 'warning',
      title: 'Warning',
      message: 'Are you sure you want to proceed? This action cannot be undone.',
      showCancel: true,
      confirmText: 'Proceed',
      onConfirm: () => {
        console.log('User confirmed warning');
        hideDialog();
      },
    });
  };

  const showErrorDialog = () => {
    showDialog({
      type: 'error',
      title: 'Error',
      message: 'Something went wrong. Please try again later.',
      confirmText: 'Retry',
      showCancel: true,
      cancelText: 'Cancel',
      onConfirm: () => {
        console.log('User clicked retry');
        hideDialog();
      },
    });
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dialog Examples</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={showInfoDialog}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Show Info Dialog
        </button>

        <button
          onClick={showSuccessDialog}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Show Success (Auto-close)
        </button>

        <button
          onClick={showWarningDialog}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
        >
          Show Warning Dialog
        </button>

        <button
          onClick={showErrorDialog}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Show Error Dialog
        </button>
      </div>

      {/* Dialog component */}
      <Dialog
        isOpen={dialogState.isOpen}
        onClose={hideDialog}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        autoClose={dialogState.autoClose}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
      />
    </div>
  );
};

export default DialogExample;