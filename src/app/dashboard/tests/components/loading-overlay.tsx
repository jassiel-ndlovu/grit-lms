// app/dashboard/tests/take/[id]/components/loading-overlay.tsx
import React from 'react';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = "Saving your progress..." 
}) => {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-40">
      <div className="bg-white rounded-xl p-6 shadow-lg flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-700 font-medium">{message}</span>
      </div>
    </div>
  );
};