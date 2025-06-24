import React from 'react';
import type { CounterButtonProps, CounterOperation } from '../types/counter';

/**
 * Button configuration for different counter operations.
 */
const BUTTON_CONFIG: Record<CounterOperation, {
  defaultLabel: string;
  icon: React.ReactNode;
  baseStyles: string;
  hoverStyles: string;
  activeStyles: string;
  ariaLabel: string;
}> = {
  increment: {
    defaultLabel: '+1',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    baseStyles: 'bg-green-500 text-white border-green-500',
    hoverStyles: 'hover:bg-green-600 hover:border-green-600',
    activeStyles: 'active:bg-green-700',
    ariaLabel: 'Increment counter by 1',
  },
  decrement: {
    defaultLabel: '-1',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
      </svg>
    ),
    baseStyles: 'bg-red-500 text-white border-red-500',
    hoverStyles: 'hover:bg-red-600 hover:border-red-600',
    activeStyles: 'active:bg-red-700',
    ariaLabel: 'Decrement counter by 1',
  },
  reset: {
    defaultLabel: 'Reset',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    baseStyles: 'bg-gray-500 text-white border-gray-500',
    hoverStyles: 'hover:bg-gray-600 hover:border-gray-600',
    activeStyles: 'active:bg-gray-700',
    ariaLabel: 'Reset counter to zero',
  },
};

/**
 * Counter button component that provides accessible, interactive buttons for counter operations.
 * 
 * This component handles the visual states, loading indicators, and accessibility features
 * for counter action buttons following design system principles.
 * 
 * @param props - Counter button properties
 * @returns JSX element for the counter button
 */
export const CounterButton: React.FC<CounterButtonProps> = ({
  operation,
  onClick,
  disabled = false,
  loading = false,
  label,
  className = '',
}) => {
  const [feedback, setFeedback] = React.useState<'success' | 'error' | null>(null);
  const config = BUTTON_CONFIG[operation];
  const displayLabel = label || config.defaultLabel;
  const isDisabled = disabled || loading;

  /**
   * Handles button click with proper event handling and loading state.
   */
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    
    if (isDisabled) return;

    try {
      await onClick();
      // Show success feedback
      setFeedback('success');
      setTimeout(() => setFeedback(null), 600);
    } catch (error) {
      // Show error feedback
      setFeedback('error');
      setTimeout(() => setFeedback(null), 600);
      console.error(`Error executing ${operation} operation:`, error);
    }
  };

  /**
   * Handles keyboard events for better accessibility.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      aria-label={config.ariaLabel}
      aria-pressed={false}
      aria-busy={loading}
      data-testid={`counter-${operation}-button`}
      className={`
        relative flex items-center justify-center gap-2 px-6 py-4
        text-lg font-semibold rounded-xl border-2
        transition-all ease-in-out
        transform-gpu
        min-w-[120px] h-[60px]
        focus:outline-none
        select-none user-select-none
        ${feedback === 'success' ? 'animate-success-flash' : ''}
        ${feedback === 'error' ? 'animate-error-flash animate-shake' : ''}
        ${config.baseStyles}
        ${!isDisabled && config.hoverStyles}
        ${!isDisabled && config.activeStyles}
        ${!isDisabled && 'hover:scale-105 active:scale-95 hover:shadow-lg'}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${loading ? 'cursor-wait animate-pulse' : ''}
        ${className}
      `}
    >
      {/* Loading spinner overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
        </div>
      )}

      {/* Button content */}
      <div className={`flex items-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        {config.icon}
        <span className="font-bold">{displayLabel}</span>
      </div>

      {/* Ripple effect container */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="ripple-effect" />
      </div>
    </button>
  );
};

/**
 * Loading state variant of the counter button.
 */
export const CounterButtonSkeleton: React.FC<{
  operation: CounterOperation;
  className?: string;
}> = ({ operation, className = '' }) => {
  const config = BUTTON_CONFIG[operation];
  
  return (
    <div
      className={`
        flex items-center justify-center px-6 py-4
        min-w-[120px] h-[60px] rounded-xl
        ${config.baseStyles}
        opacity-50 animate-pulse
        ${className}
      `}
      role="status"
      aria-label={`Loading ${operation} button`}
    >
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="font-bold">{config.defaultLabel}</span>
      </div>
    </div>
  );
};

/**
 * Compound component for grouped counter buttons with consistent spacing.
 */
export const CounterButtonGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}> = ({ 
  children, 
  className = '',
  orientation = 'horizontal'
}) => (
  <div
    className={`
      flex gap-4
      ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
      ${className}
    `}
    role="group"
    aria-label="Counter operation buttons"
  >
    {children}
  </div>
);

/**
 * Quick action floating button for increment operation.
 * Useful for mobile interfaces or quick access scenarios.
 */
export const QuickIncrementButton: React.FC<{
  onClick: () => Promise<void>;
  loading?: boolean;
  className?: string;
}> = ({ onClick, loading = false, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-label="Quick increment"
    className={`
      fixed bottom-6 right-6 z-50
      w-14 h-14 rounded-full
      bg-green-500 text-white
      shadow-lg hover:shadow-xl
      hover:bg-green-600 active:bg-green-700
      focus:outline-none
      transition-all
      flex items-center justify-center
      ${loading ? 'cursor-wait opacity-75' : 'cursor-pointer hover:scale-110 active:scale-95'}
      ${className}
    `}
  >
    {loading ? (
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
    ) : (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    )}
  </button>
);

