// app/dashboard/tests/take/[id]/components/time-warning.tsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface TimeWarningProps {
  timeRemaining: number;
  onDismiss?: () => void;
}

export const TimeWarning: React.FC<TimeWarningProps> = ({ timeRemaining, onDismiss }) => {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Show warning when less than 5 minutes remain
    if (timeRemaining <= 300 && timeRemaining > 0) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [timeRemaining]);

  if (!showWarning) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 animate-bounce">
      <div className="bg-amber-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <p className="font-medium">Time Almost Up!</p>
          <p className="text-sm opacity-90 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {minutes}:{seconds.toString().padStart(2, '0')} remaining
          </p>
        </div>
        <button
          onClick={() => {
            setShowWarning(false);
            onDismiss?.();
          }}
          className="p-1 hover:bg-amber-600 rounded transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
};