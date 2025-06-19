import React, { Component, type ReactNode } from 'react';
import type { CounterErrorBoundaryProps } from '../types/counter';

/**
 * Error boundary state interface.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Default error fallback component.
 */
const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      
      <div className="mt-4 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We encountered an unexpected error. Please try refreshing the page.
        </p>
        
        {import.meta.env.DEV && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-800 overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={resetError}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 focus:outline-none transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree.
 * 
 * This component provides a fallback UI when an error occurs and allows for error recovery.
 * It's specifically designed for the counter application but follows general error boundary patterns.
 * 
 * @example
 * ```tsx
 * <CounterErrorBoundary>
 *   <CounterApp />
 * </CounterErrorBoundary>
 * ```
 */
export class CounterErrorBoundary extends Component<
  CounterErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: CounterErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when an error is caught.
   * Updates the state to display the error fallback UI.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Called when an error is caught.
   * Logs the error and calls the optional onError callback.
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('CounterErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send error to monitoring service
    if (import.meta.env.PROD) {
      this.logErrorToService(error, errorInfo);
    }
  }

  /**
   * Logs error to monitoring service (placeholder implementation).
   * In a real application, this would send errors to a service like Sentry.
   */
  private logErrorToService(error: Error, errorInfo: React.ErrorInfo): void {
    // Placeholder for error logging service
    console.error('Error logged to monitoring service:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resets the error boundary state to allow for error recovery.
   */
  private resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Render custom fallback UI or default
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components.
 * This is a higher-order component that wraps children with error boundary logic.
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) => {
  const WrappedComponent = (props: P) => (
    <CounterErrorBoundary fallback={errorFallback}>
      <Component {...props} />
    </CounterErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

