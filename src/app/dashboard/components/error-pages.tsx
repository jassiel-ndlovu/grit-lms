import React, { useEffect, useState } from 'react';
import { Home, Lock, ArrowLeft, Mail, RefreshCw, AlertTriangle } from 'lucide-react';

// ===== INTERFACES =====

// Props for the NotFound page
interface NotFoundPageProps {
  resourceType: 'course' | 'submission' | 'entry' | 'test';
  onRedirect?: () => void;
  redirectDelay?: number;
  customMessage?: string;
}

// Props for the AccessDenied page
interface AccessDeniedPageProps {
  resourceType?: 'course' | 'submission' | 'content' | 'test';
  reason?: string;
  onGoBack?: () => void;
  showContactSupport?: boolean;
  onContactSupport?: () => void;
}

// Props for the Generic Error page
interface ErrorPageProps {
  title?: string;
  message?: string;
  errorCode?: string | number;
  errorType?: 'network' | 'server' | 'client' | 'validation' | 'timeout' | 'generic';
  showRetry?: boolean;
  onRetry?: () => void;
  showGoBack?: boolean;
  onGoBack?: () => void;
  showGoHome?: boolean;
  onGoHome?: () => void;
  showContactSupport?: boolean;
  onContactSupport?: () => void;
  retryText?: string;
  isRetrying?: boolean;
}

// ===== COMPONENTS =====

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
    entry: 'Entry',
    test: 'Test',
  };

  const defaultMessages = {
    course: 'The course you\'re looking for doesn\'t exist or may have been removed.',
    submission: 'The submission you\'re looking for doesn\'t exist or may have been removed.',
    entry: 'The entry you\'re looking for doesn\'t exist or may have been removed.',
    test: 'The test you\'re looking for doesn\'t exist or may have been removed.'
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
    submission: 'You don\'t have permission to view this submission. Only enrolled students can access their own test.',
    content: 'You don\'t have permission to access this content.',
    test: 'You don\'t have permission to view this test. Only enrolled students can access their tests.'
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

// Generic Error Page Component
export const ErrorPage: React.FC<ErrorPageProps> = ({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again or contact support if the problem persists.",
  errorCode,
  errorType = 'generic',
  showRetry = true,
  onRetry,
  showGoBack = true,
  onGoBack,
  showGoHome = true,
  onGoHome,
  showContactSupport = false,
  onContactSupport,
  retryText = "Try Again",
  isRetrying = false
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      window.history.back();
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      window.location.href = '/support';
    }
  };

  const getErrorTypeConfig = () => {
    switch (errorType) {
      case 'network':
        return {
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-500',
          primaryBtnColor: 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500'
        };
      case 'server':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-500',
          primaryBtnColor: 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
        };
      case 'validation':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-500',
          primaryBtnColor: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500'
        };
      case 'timeout':
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-500',
          primaryBtnColor: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
        };
      default:
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-500',
          primaryBtnColor: 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
        };
    }
  };

  const errorConfig = getErrorTypeConfig();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className={`mx-auto w-24 h-24 ${errorConfig.iconBg} rounded-full flex items-center justify-center`}>
            <AlertTriangle className={`w-10 h-10 ${errorConfig.iconColor}`} />
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {title}
          </h1>
          {errorCode && (
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-mono">
                Error: {errorCode}
              </span>
            </div>
          )}
          <p className="text-gray-600 text-sm leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {showRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className={`w-full text-sm text-white px-6 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${errorConfig.primaryBtnColor}`}
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : retryText}
            </button>
          )}

          {showGoBack && (
            <button
              onClick={handleGoBack}
              className="w-full bg-white text-sm text-gray-700 px-6 py-3 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Back
            </button>
          )}

          {showGoHome && (
            <button
              onClick={handleGoHome}
              className="w-full bg-white text-sm text-gray-700 px-6 py-3 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-2" />
              Go to Dashboard
            </button>
          )}

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

// ===== CUSTOM HOOKS =====

// Main error pages hook
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

  const retry = () => {
    window.location.reload();
  };

  // Helper to render NotFound page
  const renderNotFoundPage = (props: Partial<NotFoundPageProps> & { resourceType: 'course' | 'submission' | 'entry' | 'test' }) => {
    // Note: NotFoundPage component would need to be imported or defined elsewhere
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
    // Note: AccessDeniedPage component would need to be imported or defined elsewhere
    return (
      <AccessDeniedPage
        onGoBack={goBack}
        onContactSupport={contactSupport}
        showContactSupport={true}
        {...props}
      />
    );
  };

  // Helper to render generic Error page
  const renderErrorPage = (props: Partial<ErrorPageProps> = {}) => {
    return (
      <ErrorPage
        onRetry={retry}
        onGoBack={goBack}
        onGoHome={redirectToDashboard}
        onContactSupport={contactSupport}
        {...props}
      />
    );
  };

  return {
    renderNotFoundPage,
    renderAccessDeniedPage,
    renderErrorPage,
    redirectToDashboard,
    goBack,
    contactSupport,
    retry
  };
};

// Specialized error hooks for common scenarios
export const useNetworkError = () => {
  const { renderErrorPage } = useErrorPages();
  
  const renderNetworkError = (customProps: Partial<ErrorPageProps> = {}) => {
    return renderErrorPage({
      title: "Connection Problem",
      message: "Unable to connect to the server. Please check your internet connection and try again.",
      errorType: 'network',
      errorCode: 'NETWORK_ERROR',
      showContactSupport: false,
      ...customProps
    });
  };

  return { renderNetworkError };
};

export const useServerError = () => {
  const { renderErrorPage } = useErrorPages();
  
  const renderServerError = (customProps: Partial<ErrorPageProps> = {}) => {
    return renderErrorPage({
      title: "Server Error",
      message: "Our servers are experiencing issues. We're working to fix this problem.",
      errorType: 'server',
      errorCode: '500',
      showContactSupport: true,
      showRetry: false,
      ...customProps
    });
  };

  return { renderServerError };
};

export const useValidationError = () => {
  const { renderErrorPage } = useErrorPages();
  
  const renderValidationError = (customProps: Partial<ErrorPageProps> = {}) => {
    return renderErrorPage({
      title: "Invalid Data",
      message: "The information provided is invalid. Please check your input and try again.",
      errorType: 'validation',
      errorCode: 'VALIDATION_ERROR',
      showContactSupport: false,
      showGoHome: false,
      retryText: "Fix and Retry",
      ...customProps
    });
  };

  return { renderValidationError };
};

export const useTimeoutError = () => {
  const { renderErrorPage } = useErrorPages();
  
  const renderTimeoutError = (customProps: Partial<ErrorPageProps> = {}) => {
    return renderErrorPage({
      title: "Request Timeout",
      message: "The request took too long to complete. Please try again.",
      errorType: 'timeout',
      errorCode: 'TIMEOUT',
      showContactSupport: false,
      ...customProps
    });
  };

  return { renderTimeoutError };
};

// Advanced error handling hook with retry logic
export const useErrorHandling = () => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const { renderErrorPage } = useErrorPages();

  const handleRetry = async (retryFn: () => Promise<void>, maxRetries = 3) => {
    if (retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);
    try {
      await retryFn();
      setRetryCount(0);
    } catch (error) {
      setRetryCount(prev => prev + 1);
      console.error(error);
    } finally {
      setIsRetrying(false);
    }
  };

  const renderErrorWithRetry = (
    retryFn: () => Promise<void>,
    errorProps: Partial<ErrorPageProps> = {},
    maxRetries = 3
  ) => {
    return renderErrorPage({
      isRetrying,
      onRetry: () => handleRetry(retryFn, maxRetries),
      showRetry: retryCount < maxRetries,
      message: retryCount >= maxRetries 
        ? "Maximum retry attempts reached. Please contact support."
        : errorProps.message,
      showContactSupport: retryCount >= maxRetries,
      ...errorProps
    });
  };

  return {
    renderErrorWithRetry,
    isRetrying,
    retryCount,
    resetRetryCount: () => setRetryCount(0)
  };
};

// ===== USAGE EXAMPLES =====

// Example component showing different error scenarios
export const ErrorPageExamples: React.FC = () => {
  const { renderErrorPage } = useErrorPages();
  const { renderNetworkError } = useNetworkError();
  const { renderServerError } = useServerError();
  const { renderValidationError } = useValidationError();
  const { renderTimeoutError } = useTimeoutError();
  
  const [currentError, setCurrentError] = React.useState<string | null>(null);

  const errorExamples = {
    generic: () => renderErrorPage(),
    network: () => renderNetworkError(),
    server: () => renderServerError(),
    validation: () => renderValidationError(),
    timeout: () => renderTimeoutError(),
    custom: () => renderErrorPage({
      title: "Custom Error",
      message: "This is a custom error with specific styling.",
      errorCode: "CUSTOM_001",
      errorType: 'validation',
      retryText: "Try Custom Action",
      onRetry: () => {
        alert('Custom retry action!');
        setCurrentError(null);
      }
    })
  };

  if (currentError && errorExamples[currentError as keyof typeof errorExamples]) {
    return errorExamples[currentError as keyof typeof errorExamples]();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Error Page Examples</h1>
        
        <button
          onClick={() => setCurrentError('generic')}
          className="w-full px-4 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Generic Error
        </button>

        <button
          onClick={() => setCurrentError('network')}
          className="w-full px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Network Error
        </button>

        <button
          onClick={() => setCurrentError('server')}
          className="w-full px-4 py-3 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Server Error
        </button>

        <button
          onClick={() => setCurrentError('validation')}
          className="w-full px-4 py-3 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Validation Error
        </button>

        <button
          onClick={() => setCurrentError('timeout')}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Timeout Error
        </button>

        <button
          onClick={() => setCurrentError('custom')}
          className="w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Custom Error
        </button>
      </div>
    </div>
  );
};

export default ErrorPageExamples;