import React, { useState, useEffect } from 'react';
import { useSecureCounter } from '../hooks/useCounter';
import { CounterDisplay, CounterDisplaySkeleton, CounterDisplayError } from './CounterDisplay';
import { CounterButton, CounterButtonGroup, CounterButtonSkeleton } from './CounterButton';

/**
 * Status indicator component showing connection state and user activity.
 */
const StatusIndicator: React.FC<{
  isConnected: boolean;
  lastUpdated: number;
}> = ({ isConnected, lastUpdated }) => {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = Date.now();
      const diff = now - lastUpdated;
      
      if (diff < 1000) {
        setTimeAgo('just now');
      } else if (diff < 60000) {
        setTimeAgo(`${Math.floor(diff / 1000)}s ago`);
      } else if (diff < 3600000) {
        setTimeAgo(`${Math.floor(diff / 60000)}m ago`);
      } else {
        setTimeAgo(`${Math.floor(diff / 3600000)}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
        title={isConnected ? 'Connected' : 'Disconnected'}
      />
      <span>
        {isConnected ? 'Live' : 'Offline'} • Last updated {timeAgo}
      </span>
    </div>
  );
};

/**
 * Main counter component that orchestrates all counter functionality.
 * 
 * This component serves as the primary interface for the digit-duel application,
 * providing real-time counter updates, atomic operations, and comprehensive
 * error handling with a clean, accessible user interface.
 * 
 * Features:
 * - Real-time counter synchronization across all connected users
 * - Atomic increment/decrement operations with race condition prevention
 * - Optimistic updates for better perceived performance
 * - Comprehensive error handling and retry mechanisms
 * - Loading states and accessibility support
 * - Responsive design for mobile and desktop
 * 
 * @returns JSX element for the complete counter interface
 */
export const Counter: React.FC = () => {
  const {
    counter,
    isLoading,
    error,
    increment,
    decrement,
    reset,
    refresh,
  } = useSecureCounter();

  const [previousValue, setPreviousValue] = useState<number | undefined>(undefined);

  // Track value changes for animations
  useEffect(() => {
    if (counter && counter.value !== previousValue) {
      setPreviousValue(counter?.value);
    }
  }, [counter?.value, previousValue]);


  // Loading state - show skeletons while initial data loads
  if (!counter && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8">
          {/* Header skeleton */}
          <div className="space-y-4">
            <div className="h-12 bg-gray-300 rounded-lg animate-pulse mx-auto w-64" />
            <div className="h-6 bg-gray-200 rounded animate-pulse mx-auto w-96" />
          </div>

          {/* Counter display skeleton */}
          <CounterDisplaySkeleton className="my-12" />

          {/* Button group skeleton */}
          <CounterButtonGroup className="justify-center">
            <CounterButtonSkeleton operation="decrement" />
            <CounterButtonSkeleton operation="increment" />
            <CounterButtonSkeleton operation="reset" />
          </CounterButtonGroup>

          {/* Status skeleton */}
          <div className="h-4 bg-gray-200 rounded animate-pulse mx-auto w-32" />
        </div>
      </div>
    );
  }

  // Error state - show error message with retry option
  if (error && !counter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <CounterDisplayError 
          error={error} 
          onRetry={refresh}
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Digit Duel
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              A real-time global counter with atomic operations. Join users worldwide in this collaborative counting experience!
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8">
          {/* Error banner */}
          {error && (
            <div 
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg"
              role="alert"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">
                    {error}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={refresh}
                    className="text-red-800 hover:text-red-900 text-sm font-medium"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Counter display */}
          <div className="relative">
            <CounterDisplay
              value={counter?.value ?? 0}
              isUpdating={isLoading}
              previousValue={previousValue}
              className="my-12"
            />
          </div>

          {/* Action buttons */}
          <CounterButtonGroup className="justify-center flex-wrap">
            <CounterButton
              operation="decrement"
              onClick={decrement}
              loading={isLoading}
              disabled={isLoading}
            />
            <CounterButton
              operation="increment"
              onClick={increment}
              loading={isLoading}
              disabled={isLoading}
            />
            <CounterButton
              operation="reset"
              onClick={reset}
              loading={isLoading}
              disabled={isLoading}
              className="md:order-last order-first w-full md:w-auto"
            />
          </CounterButtonGroup>

          {/* Status and info */}
          <div className="space-y-4">
            {counter && (
              <StatusIndicator
                isConnected={!error}
                lastUpdated={counter.lastUpdated}
              />
            )}
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                Version: {counter?.version ?? 0} • 
                Users worldwide are collaborating on this counter
              </p>
              <p>
                All operations are atomic and prevent race conditions
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            Built with React, TypeScript, Vite, and Convex • 
            <a 
              href="https://github.com/yourusername/digit-duel" 
              className="text-blue-600 hover:text-blue-700 ml-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Counter;

