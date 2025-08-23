import React, { useState, useEffect } from 'react';
import { Home, Lock, ArrowLeft, Mail, RefreshCw } from 'lucide-react';

// Props for the NotFound page
interface NotFoundPageProps {
  resourceType: 'course' | 'submission' | 'entry';
  onRedirect?: () => void;
  redirectDelay?: number;
  customMessage?: string;
}

// Props for the AccessDenied page
interface AccessDeniedPageProps {
  resourceType?: 'course' | 'submission' | 'content';
  reason?: string;
  onGoBack?: () => void;
  showContactSupport?: boolean;
  onContactSupport?: () => void;
}

// Not Found Page Component
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  resourceType,
  onRedirect,
  redirectDelay = 5,
  customMessage
}) => {
  const [countdown, setCountdown] = useState(redirectDelay);

  const resourceNames = {
    course: 'Course',
    submission: 'Submission',
    entry: 'Entry'
  };

  const defaultMessages = {
    course: 'The course you\'re looking for doesn\'t exist or may have been removed.',
    submission: 'The submission you\'re looking for doesn\'t exist or may have been removed.',
    entry: 'The entry you\'re looking for doesn\'t exist or may have been removed.'
  };

  // Handle countdown for redirect
  useEffect(() => {
    if (redirectDelay > 0) {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            if (onRedirect) {
              onRedirect();
            } else {
              window.location.href = '/dashboard';
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [redirectDelay, onRedirect]);

  const handleGoToDashboard = () => {
    if (onRedirect) {
      onRedirect();
    } else {
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <Home className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {resourceNames[resourceType]} Not Found
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {customMessage || defaultMessages[resourceType]}
          </p>
          <p className="text-gray-500 text-sm">
            You&apos;ll be redirected to the dashboard shortly.
          </p>
        </div>

        {/* Countdown */}
        {countdown > 0 && (
          <div className="mb-8">
            <div className="bg-gray-100 border border-gray-200 p-4">
              <div className="flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                <span className="text-gray-700 text-sm">
                  Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleGoToDashboard}
          className="w-full bg-gray-600 text-white text-sm px-6 py-3 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

// Access Denied Page Component
export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  resourceType = 'content',
  reason,
  onGoBack,
  showContactSupport = false,
  onContactSupport
}) => {
  const defaultMessages = {
    course: 'You don\'t have permission to access this course. Please contact your instructor if you believe this is an error.',
    submission: 'You don\'t have permission to view this submission. Only enrolled students can access their own submissions.',
    content: 'You don\'t have permission to access this content.'
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      window.history.back();
    }
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      window.location.href = '/support';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {reason || defaultMessages[resourceType]}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoBack}
            className="w-full bg-orange-500 text-sm text-white px-6 py-3 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </button>

          {showContactSupport && (
            <button
              onClick={handleContactSupport}
              className="w-full bg-white text-sm text-gray-700 px-6 py-3 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Support
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Custom hooks for easy usage
export const useErrorPages = () => {
  // Navigation helper functions
  const redirectToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const goBack = () => {
    window.history.back();
  };

  const contactSupport = () => {
    window.location.href = '/support';
  };

  // Helper to render NotFound page
  const renderNotFoundPage = (props: Partial<NotFoundPageProps> & { resourceType: 'course' | 'submission' | 'entry' }) => {
    return (
      <NotFoundPage
        onRedirect={redirectToDashboard}
        redirectDelay={5}
        {...props}
      />
    );
  };

  // Helper to render AccessDenied page  
  const renderAccessDeniedPage = (props: Partial<AccessDeniedPageProps> = {}) => {
    return (
      <AccessDeniedPage
        onGoBack={goBack}
        onContactSupport={contactSupport}
        showContactSupport={true}
        {...props}
      />
    );
  };

  return {
    renderNotFoundPage,
    renderAccessDeniedPage,
    redirectToDashboard,
    goBack,
    contactSupport
  };
};

// Example usage component showing both pages
const ErrorPageExample: React.FC = () => {
  const [currentView, setCurrentView] = useState<'menu' | 'not-found' | 'access-denied'>('menu');
  const { renderNotFoundPage, renderAccessDeniedPage } = useErrorPages();

  if (currentView === 'not-found') {
    return renderNotFoundPage({
      resourceType: 'course',
      onRedirect: () => {
        console.log('Redirecting to dashboard...');
        setCurrentView('menu');
      },
      redirectDelay: 5
    });
  }

  if (currentView === 'access-denied') {
    return renderAccessDeniedPage({
      resourceType: 'course',
      onGoBack: () => {
        console.log('Going back...');
        setCurrentView('menu');
      },
      showContactSupport: true,
      onContactSupport: () => {
        console.log('Contacting support...');
        alert('Would redirect to support page');
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Error Page Examples</h1>
        
        <button
          onClick={() => setCurrentView('not-found')}
          className="w-full px-4 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Show Course Not Found Page
        </button>

        <button
          onClick={() => setCurrentView('access-denied')}
          className="w-full px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          Show Access Denied Page
        </button>
      </div>
    </div>
  );
};

export default ErrorPageExample;