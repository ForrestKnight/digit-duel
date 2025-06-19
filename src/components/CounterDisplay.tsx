import React, { useEffect, useState } from 'react';
import type { CounterDisplayProps } from '../types/counter';

/**
 * Counter display component that shows the current counter value with animations.
 * 
 * This component provides visual feedback for counter changes with smooth animations
 * and proper accessibility support.
 * 
 * @param props - Counter display properties
 * @returns JSX element displaying the counter value
 */
export const CounterDisplay: React.FC<CounterDisplayProps> = ({
  value,
  isUpdating = false,
  previousValue,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animationClass, setAnimationClass] = useState('');

  // Update display value and trigger animations when value changes
  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      // Determine animation direction
      const isIncrementing = value > previousValue;
      const animClass = isIncrementing ? 'animate-bounce-gentle' : 'animate-pulse-fast';
      
      setAnimationClass(animClass);
      setDisplayValue(value);

      // Remove animation class after animation completes
      const timeout = setTimeout(() => {
        setAnimationClass('');
      }, 2000);

      return () => clearTimeout(timeout);
    } else {
      setDisplayValue(value);
    }
  }, [value, previousValue]);

  // Format large numbers with commas for better readability
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Counter value: ${displayValue}`}
    >
      {/* Main counter display */}
      <div className="relative">
        <div
          className={`
            text-8xl md:text-9xl font-bold text-gray-800 select-none
            ${animationClass}
            ${isUpdating ? 'opacity-75' : 'opacity-100'}
            transition-opacity duration-200
          `}
          data-testid="counter-value"
        >
          {formatNumber(displayValue)}
        </div>

        {/* Updating indicator */}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 opacity-75" />
          </div>
        )}

        {/* Value change indicator */}
        {previousValue !== undefined && previousValue !== displayValue && (
          <div
            className={`
              absolute -top-4 left-1/2 transform -translate-x-1/2
              text-sm font-semibold px-2 py-1 rounded-full
              ${displayValue > previousValue 
? 'bg-green-50 text-green-600' 
                : 'bg-red-50 text-red-600'
              }
              animate-bounce-gentle
            `}
            role="status"
            aria-label={`Counter ${displayValue > previousValue ? 'increased' : 'decreased'}`}
          >
            {displayValue > previousValue ? '+1' : '-1'}
          </div>
        )}
      </div>

      {/* Accessibility enhancement - screen reader only */}
      <div className="sr-only">
        The global counter is currently at {displayValue}.
        {isUpdating && ' The counter is being updated.'}
      </div>
    </div>
  );
};

/**
 * Loading skeleton for the counter display while data is being fetched.
 */
export const CounterDisplaySkeleton: React.FC<{ className?: string }> = ({ 
  className = '' 
}) => (
  <div 
    className={`relative flex items-center justify-center ${className}`}
    role="status"
    aria-label="Loading counter value"
  >
    <div className="animate-pulse">
      <div className="bg-gray-300 rounded-lg h-24 w-48 md:h-32 md:w-64" />
    </div>
    <div className="sr-only">Loading counter value...</div>
  </div>
);

/**
 * Error state for the counter display when there's an issue loading the value.
 */
export const CounterDisplayError: React.FC<{ 
  error: string; 
  onRetry?: () => void;
  className?: string;
}> = ({ 
  error, 
  onRetry,
  className = '' 
}) => (
  <div 
    className={`relative flex flex-col items-center justify-center text-center ${className}`}
    role="alert"
  >
    <div className="text-6xl text-gray-400 mb-4">
      <svg
        className="w-16 h-16 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    
    <h3 className="text-lg font-semibold text-gray-700 mb-2">
      Unable to load counter
    </h3>
    
    <p className="text-sm text-gray-500 mb-4 max-w-sm">
      {error}
    </p>
    
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

