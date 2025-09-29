// app/dashboard/tests/take/[id]/components/internet-status.tsx
import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';

interface InternetStatusProps {
  hasInternet: boolean;
}

export const InternetStatus: React.FC<InternetStatusProps> = ({ hasInternet }) => {
  const [showWarning, setShowWarning] = useState(!hasInternet);
  const [isVisible, setIsVisible] = useState(!hasInternet);

  useEffect(() => {
    if (!hasInternet) {
      setShowWarning(true);
      setIsVisible(true);
    } else {
      // Add a small delay before hiding to show reconnection message
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Hide completely after fade out animation
        setTimeout(() => setShowWarning(false), 300);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [hasInternet]);

  if (!showWarning) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`p-4 rounded-xl shadow-lg border backdrop-blur-sm ${
        hasInternet 
          ? 'bg-green-50 border-green-200 text-green-800' 
          : 'bg-red-50 border-red-200 text-red-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            hasInternet ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {hasInternet ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              {hasInternet ? 'Connection Restored' : 'No Internet Connection'}
            </p>
            <p className="text-sm opacity-90">
              {hasInternet 
                ? 'Your test progress will be saved automatically.' 
                : 'Please check your connection. Answers will be saved when online.'}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => setShowWarning(false), 300);
            }}
            className="p-1 hover:bg-black/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress bar for reconnection message */}
        {hasInternet && (
          <div className="w-full bg-green-200 rounded-full h-1 mt-2 overflow-hidden">
            <div className="bg-green-500 h-1 rounded-full animate-progress" />
          </div>
        )}
      </div>
    </div>
  );
};