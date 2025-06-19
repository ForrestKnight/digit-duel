/**
 * Core types and interfaces for the digit-duel counter application.
 * 
 * These types ensure type safety across the entire application and
 * provide clear contracts for component interactions.
 */

/**
 * Represents the current state of the global counter.
 */
export interface CounterState {
  /** The current numeric value of the counter */
  readonly value: number;
  /** Version number for optimistic updates */
  readonly version: number;
  /** Timestamp of the last update */
  readonly lastUpdated: number;
  /** Unique identifier for the counter */
  readonly name: string;
}

/**
 * Available counter operations that can be performed.
 */
export type CounterOperation = 'increment' | 'decrement' | 'reset';

/**
 * Result of a counter operation, including the new value and operation metadata.
 */
export interface CounterOperationResult {
  /** The new counter value after the operation */
  readonly newValue: number;
  /** The operation that was performed */
  readonly operation: CounterOperation;
  /** Timestamp when the operation was completed */
  readonly timestamp: number;
  /** Whether the operation was successful */
  readonly success: boolean;
}

/**
 * Props for counter-related components.
 */
export interface CounterComponentProps {
  /** Current counter value */
  readonly value: number;
  /** Whether operations are currently loading */
  readonly isLoading: boolean;
  /** Callback for increment operations */
  readonly onIncrement: () => Promise<void>;
  /** Callback for decrement operations */
  readonly onDecrement: () => Promise<void>;
  /** Optional callback for reset operations */
  readonly onReset?: () => Promise<void>;
  /** Optional error state */
  readonly error?: string | null;
}

/**
 * Button component props for counter action buttons.
 */
export interface CounterButtonProps {
  /** The counter operation this button performs */
  readonly operation: CounterOperation;
  /** Click handler for the button */
  readonly onClick: () => Promise<void>;
  /** Whether the button is currently disabled */
  readonly disabled?: boolean;
  /** Whether the button is in a loading state */
  readonly loading?: boolean;
  /** Optional custom label for the button */
  readonly label?: string;
  /** Optional custom CSS classes */
  readonly className?: string;
}

/**
 * Props for the counter display component.
 */
export interface CounterDisplayProps {
  /** Current counter value to display */
  readonly value: number;
  /** Whether the counter is currently updating */
  readonly isUpdating?: boolean;
  /** Optional previous value for animation purposes */
  readonly previousValue?: number;
  /** Optional custom CSS classes */
  readonly className?: string;
}

/**
 * Configuration options for counter behavior.
 */
export interface CounterConfig {
  /** Minimum allowed counter value */
  readonly minValue?: number;
  /** Maximum allowed counter value */
  readonly maxValue?: number;
  /** Whether to enable optimistic updates */
  readonly enableOptimisticUpdates: boolean;
  /** Retry configuration for failed operations */
  readonly retryConfig: {
    /** Maximum number of retries */
    readonly maxRetries: number;
    /** Delay between retries in milliseconds */
    readonly retryDelay: number;
  };
}

/**
 * Hook return type for counter operations.
 */
export interface UseCounterReturn {
  /** Current counter state */
  readonly counter: CounterState | null;
  /** Whether any operation is currently loading */
  readonly isLoading: boolean;
  /** Current error state, if any */
  readonly error: string | null;
  /** Function to increment the counter */
  readonly increment: () => Promise<void>;
  /** Function to decrement the counter */
  readonly decrement: () => Promise<void>;
  /** Function to reset the counter */
  readonly reset: () => Promise<void>;
  /** Function to manually refresh the counter */
  readonly refresh: () => Promise<void>;
}

/**
 * Error types that can occur during counter operations.
 */
export const CounterErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONCURRENCY_ERROR: 'CONCURRENCY_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SECURITY_ERROR: 'SECURITY_ERROR',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type CounterErrorType = typeof CounterErrorType[keyof typeof CounterErrorType];

/**
 * Security-specific error types for detailed classification.
 */
export const SecurityErrorType = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT',
  AUTOMATED_BEHAVIOR: 'AUTOMATED_BEHAVIOR',
  EXCESSIVE_REQUESTS: 'EXCESSIVE_REQUESTS',
  MALICIOUS_PATTERN: 'MALICIOUS_PATTERN',
  CLIENT_TAMPERING: 'CLIENT_TAMPERING',
} as const;

export type SecurityErrorType = typeof SecurityErrorType[keyof typeof SecurityErrorType];

/**
 * Rate limiting configuration for different operation types.
 */
export interface RateLimitConfig {
  /** Minimum time between operations in milliseconds */
  readonly minInterval: number;
  /** Maximum operations per time window */
  readonly maxOperations: number;
  /** Time window in milliseconds */
  readonly windowMs: number;
  /** Exponential backoff multiplier for violations */
  readonly backoffMultiplier: number;
  /** Maximum backoff time in milliseconds */
  readonly maxBackoffMs: number;
}

/**
 * Security violation details for logging and tracking.
 */
export interface SecurityViolation {
  /** Type of security violation */
  readonly type: SecurityErrorType;
  /** Timestamp of the violation */
  readonly timestamp: number;
  /** Severity level of the violation */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Additional context about the violation */
  readonly context: Record<string, unknown>;
  /** User identifier (if available) */
  readonly userId?: string;
  /** Client fingerprint for tracking */
  readonly fingerprint?: string;
}

/**
 * Rate limiting state for tracking user behavior.
 */
export interface RateLimitState {
  /** Last operation timestamp */
  readonly lastOperation: number;
  /** Number of operations in current window */
  readonly operationCount: number;
  /** Current backoff period in milliseconds */
  readonly backoffMs: number;
  /** Number of violations */
  readonly violationCount: number;
  /** Whether user is currently blocked */
  readonly isBlocked: boolean;
  /** Timestamp when block expires */
  readonly blockExpiresAt?: number;
}

/**
 * Server-side validation result.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  readonly isValid: boolean;
  /** Validation error messages */
  readonly errors: readonly string[];
  /** Security violations detected */
  readonly violations: readonly SecurityViolation[];
  /** Whether the request should be blocked */
  readonly shouldBlock: boolean;
}

/**
 * Security-enhanced operation context.
 */
export interface SecureOperationContext {
  /** Operation type being performed */
  readonly operation: CounterOperation;
  /** Client timestamp of the request */
  readonly clientTimestamp: number;
  /** Client fingerprint for tracking */
  readonly fingerprint: string;
  /** Request metadata */
  readonly metadata: Record<string, unknown>;
}

/**
 * Security monitoring configuration.
 */
export interface SecurityConfig {
  /** Rate limiting settings */
  readonly rateLimit: RateLimitConfig;
  /** Enable automated behavior detection */
  readonly enableBehaviorAnalysis: boolean;
  /** Enable comprehensive logging */
  readonly enableSecurityLogging: boolean;
  /** Threshold for suspicious activity detection */
  readonly suspiciousActivityThreshold: number;
  /** Enable client fingerprinting */
  readonly enableFingerprinting: boolean;
}

/**
 * Structured error information for counter operations.
 */
export interface CounterError {
  /** The type of error that occurred */
  readonly type: CounterErrorType;
  /** Human-readable error message */
  readonly message: string;
  /** Optional additional error details */
  readonly details?: Record<string, unknown>;
  /** Timestamp when the error occurred */
  readonly timestamp: number;
}

/**
 * Animation states for counter value changes.
 */
export const CounterAnimationState = {
  IDLE: 'idle',
  INCREMENTING: 'incrementing',
  DECREMENTING: 'decrementing',
  UPDATING: 'updating',
} as const;

export type CounterAnimationState = typeof CounterAnimationState[keyof typeof CounterAnimationState];

/**
 * Props for error boundary components.
 */
export interface CounterErrorBoundaryProps {
  /** Child components to wrap with error boundary */
  readonly children: React.ReactNode;
  /** Optional fallback component to render on error */
  readonly fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  /** Optional callback when an error occurs */
  readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

