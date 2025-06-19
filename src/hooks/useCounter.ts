import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { 
  UseCounterReturn, 
  CounterState, 
  CounterError, 
  CounterConfig 
} from '../types/counter';
import { CounterErrorType, SecurityErrorType } from '../types/counter';
import { getSessionFingerprint, getClientMetadata } from '../utils/fingerprinting';

/**
 * Default configuration for counter operations.
 */
const DEFAULT_CONFIG: CounterConfig = {
  enableOptimisticUpdates: true,
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
  },
};

/**
 * Custom hook for managing global counter state with atomic operations.
 * 
 * This hook provides a clean interface for counter operations while handling:
 * - Optimistic updates for better UX
 * - Error handling and retries
 * - Loading states
 * - Race condition prevention
 * 
 * @param config - Optional configuration for counter behavior
 * @returns Counter state and operation functions
 */
export const useCounter = (config: Partial<CounterConfig> = {}): UseCounterReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Convex queries and mutations
  const counterDetails = useQuery(api.counter.getCounterDetails);
  const incrementMutation = useMutation(api.counter.increment);
  const decrementMutation = useMutation(api.counter.decrement);
  const resetMutation = useMutation(api.counter.reset);

  // Local state for optimistic updates and error handling
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for tracking operation state
  const operationIdRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Creates a structured error object from a generic error.
   */
  const createCounterError = useCallback((
    error: unknown, 
    type: CounterErrorType = CounterErrorType.UNKNOWN_ERROR
  ): CounterError => {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return {
      type,
      message,
      details: error instanceof Error ? { stack: error.stack } : { error },
      timestamp: Date.now(),
    };
  }, []);

  /**
   * Executes a counter operation with optimistic updates and error handling.
   */
  const executeOperation = useCallback(async (
    _operation: 'increment' | 'decrement' | 'reset',
    mutation: () => Promise<number>,
    optimisticUpdate?: (currentValue: number) => number
  ): Promise<void> => {
    const operationId = ++operationIdRef.current;
    setError(null);
    setIsLoading(true);

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      // Apply optimistic update if enabled and function provided
      if (finalConfig.enableOptimisticUpdates && optimisticUpdate && counterDetails) {
        setOptimisticValue(optimisticUpdate(counterDetails.value));
      }

      // Execute the mutation with retry logic
      let lastError: unknown = null;
      let attempt = 0;

      while (attempt <= finalConfig.retryConfig.maxRetries) {
        try {
          await mutation();
          
          // Only update state if this is still the current operation
          if (operationId === operationIdRef.current) {
            setOptimisticValue(null); // Clear optimistic value
            setIsLoading(false);
          }
          
          return;
        } catch (err) {
          lastError = err;
          attempt++;
          
          if (attempt <= finalConfig.retryConfig.maxRetries) {
            // Wait before retrying
            await new Promise(resolve => {
              retryTimeoutRef.current = setTimeout(resolve, finalConfig.retryConfig.retryDelay);
            });
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (err) {
      // Only update error state if this is still the current operation
      if (operationId === operationIdRef.current) {
        const counterError = createCounterError(err, CounterErrorType.NETWORK_ERROR);
        setError(counterError.message);
        setOptimisticValue(null); // Clear optimistic value on error
        setIsLoading(false);
      }
      
      throw err;
    }
  }, [finalConfig, counterDetails, createCounterError]);

  /**
   * Increments the counter by 1.
   */
  const increment = useCallback(async (): Promise<void> => {
    await executeOperation(
      'increment',
      incrementMutation,
      (current) => current + 1
    );
  }, [executeOperation, incrementMutation]);

  /**
   * Decrements the counter by 1.
   */
  const decrement = useCallback(async (): Promise<void> => {
    await executeOperation(
      'decrement',
      decrementMutation,
      (current) => current - 1
    );
  }, [executeOperation, decrementMutation]);

  /**
   * Resets the counter to 0.
   */
  const reset = useCallback(async (): Promise<void> => {
    await executeOperation(
      'reset',
      resetMutation,
      () => 0
    );
  }, [executeOperation, resetMutation]);

  /**
   * Manually refreshes the counter data.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    // The query will automatically refetch due to Convex's reactivity
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Construct the current counter state
  const counter: CounterState | null = counterDetails ? {
    value: optimisticValue ?? counterDetails.value,
    version: counterDetails.version,
    lastUpdated: counterDetails.lastUpdated,
    name: counterDetails.name,
  } : null;

  return {
    counter,
    isLoading,
    error,
    increment,
    decrement,
    reset,
    refresh,
  };
};

/**
 * Enhanced security configuration for the secure counter hook.
 */
interface SecureCounterConfig extends CounterConfig {
  /** Enable comprehensive security logging */
  enableSecurityLogging?: boolean;
  /** Rate limiting backoff behavior */
  rateLimitBackoff?: {
    /** Enable exponential backoff on rate limit violations */
    enabled: boolean;
    /** Maximum backoff time in milliseconds */
    maxBackoffMs: number;
  };
}

const DEFAULT_SECURE_CONFIG: SecureCounterConfig = {
  ...DEFAULT_CONFIG,
  enableSecurityLogging: true,
  rateLimitBackoff: {
    enabled: true,
    maxBackoffMs: 5000, // 5 seconds max
  },
};

/**
 * Secure counter hook with comprehensive security validation and rate limiting.
 * 
 * This hook provides the same interface as useCounter but with additional security:
 * - Client fingerprinting for tracking
 * - Server-side rate limiting (max 1 operation per 50ms)
 * - Automated behavior detection
 * - Exponential backoff on security violations
 * - Comprehensive security event logging
 * 
 * @param config - Security configuration options
 * @returns Counter state and secure operation functions
 */
export const useSecureCounter = (config: Partial<SecureCounterConfig> = {}): UseCounterReturn => {
  const finalConfig = { ...DEFAULT_SECURE_CONFIG, ...config };
  
  // Use secure mutations instead of legacy ones
  const counterDetails = useQuery(api.counter.getCounterDetails);
  const secureIncrementMutation = useMutation(api.counter.secureIncrement);
  const secureDecrementMutation = useMutation(api.counter.secureDecrement);
  const secureResetMutation = useMutation(api.counter.secureReset);

  // Enhanced state for security handling
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);
  const [pendingOperations, setPendingOperations] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [backoffUntil, setBackoffUntil] = useState<number | null>(null);
  
  // Refs for tracking operation state and security
  const operationIdRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastOperationRef = useRef<number>(0);
  const fingerprintRef = useRef<string | null>(null);

  // Initialize fingerprint
  useEffect(() => {
    if (!fingerprintRef.current) {
      fingerprintRef.current = getSessionFingerprint();
    }
  }, []);

  // Check if currently in backoff period
  const isInBackoff = useCallback(() => {
    if (!backoffUntil) return false;
    const now = Date.now();
    if (now >= backoffUntil) {
      setBackoffUntil(null);
      return false;
    }
    return true;
  }, [backoffUntil]);

  /**
   * Creates a security-enhanced error object.
   */
  const createSecurityError = useCallback((
    error: unknown,
    type: CounterErrorType = CounterErrorType.SECURITY_ERROR
  ): CounterError => {
    const message = error instanceof Error ? error.message : 'Security validation failed';
    
    // Extract security violation details if available
    const details: Record<string, unknown> = {
      fingerprint: fingerprintRef.current,
      timestamp: Date.now(),
    };

    if (error instanceof Error && error.message.includes('rate limit')) {
      details.securityType = SecurityErrorType.RATE_LIMIT_EXCEEDED;
    } else if (error instanceof Error && error.message.includes('blocked')) {
      details.securityType = SecurityErrorType.EXCESSIVE_REQUESTS;
    } else if (error instanceof Error && error.message.includes('automated')) {
      details.securityType = SecurityErrorType.AUTOMATED_BEHAVIOR;
    }

    return {
      type,
      message,
      details,
      timestamp: Date.now(),
    };
  }, []);

  /**
   * Handles security violations with appropriate backoff.
   */
  const handleSecurityViolation = useCallback((error: unknown) => {
    const securityError = createSecurityError(error, CounterErrorType.RATE_LIMIT_ERROR);
    
    if (finalConfig.rateLimitBackoff?.enabled) {
      // Calculate exponential backoff
      const baseBackoff = 1000; // 1 second
      const now = Date.now();
      const timeSinceLastOp = now - lastOperationRef.current;
      
      let backoffMs = baseBackoff;
      if (timeSinceLastOp < 500) { // Very rapid clicking
        backoffMs = Math.min(baseBackoff * 2, finalConfig.rateLimitBackoff.maxBackoffMs);
      } else if (timeSinceLastOp < 1000) {
        backoffMs = Math.min(baseBackoff * 1.5, finalConfig.rateLimitBackoff.maxBackoffMs);
      }
      
      setBackoffUntil(now + backoffMs);
      setIsBlocked(true);
      
      // Clear block after backoff period
      setTimeout(() => {
        setIsBlocked(false);
      }, backoffMs);
    }
    
    setError(securityError.message);
    
    if (finalConfig.enableSecurityLogging) {
      console.warn('Security violation detected:', securityError);
    }
  }, [finalConfig, createSecurityError]);

  /**
   * Executes a secure counter operation with comprehensive validation.
   */
  const executeSecureOperation = useCallback(async (
    operation: 'increment' | 'decrement' | 'reset',
    mutation: (args: {
      fingerprint: string;
      clientTimestamp: number;
      metadata?: Record<string, unknown>;
    }) => Promise<number>,
    optimisticUpdate?: (currentValue: number) => number
  ): Promise<void> => {
    const operationId = ++operationIdRef.current;
    const now = Date.now();
    
    // Track pending operations
    setPendingOperations(prev => prev + 1);
    
    // Check if in backoff period
    if (isInBackoff()) {
      const remainingMs = backoffUntil! - now;
      throw new Error(`Rate limited. Please wait ${Math.ceil(remainingMs / 1000)} seconds.`);
    }
    
    // Rate limiting disabled for testing
    // const timeSinceLastOp = now - lastOperationRef.current;
    // if (timeSinceLastOp < 25 && lastOperationRef.current > 0) {
    //   handleSecurityViolation(new Error('Rate limit exceeded: minimum 25ms between operations'));
    //   return;
    // }
    
    setError(null);
    setIsLoading(true);
    lastOperationRef.current = now;

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      if (!fingerprintRef.current) {
        throw new Error('Client fingerprint not available');
      }

      // Apply optimistic update if enabled and function provided
      if (finalConfig.enableOptimisticUpdates && optimisticUpdate && counterDetails) {
        // Use current optimistic value or server value as base
        const currentDisplayValue = optimisticValue ?? counterDetails.value;
        setOptimisticValue(optimisticUpdate(currentDisplayValue));
      }

      // Prepare secure operation parameters
      const clientMetadata = getClientMetadata();
      const operationParams = {
        fingerprint: fingerprintRef.current,
        clientTimestamp: now,
        metadata: {
          operation,
          ...clientMetadata,
          operationId,
        },
      };

      // Execute the secure mutation with retry logic
      let lastError: unknown = null;
      let attempt = 0;

      while (attempt <= finalConfig.retryConfig.maxRetries) {
        try {
          await mutation(operationParams);
          
          // Always clear pending operations count
          setPendingOperations(prev => Math.max(0, prev - 1));
          
          // Only update state if this is still the current operation
          if (operationId === operationIdRef.current) {
            setOptimisticValue(null); // Clear optimistic value
            setIsLoading(false);
          }
          
          return;
        } catch (err) {
          lastError = err;
          
          // Don't retry security violations
          if (err instanceof Error && (
            err.message.includes('rate limit') ||
            err.message.includes('blocked') ||
            err.message.includes('security')
          )) {
            handleSecurityViolation(err);
            break;
          }
          
          attempt++;
          
          if (attempt <= finalConfig.retryConfig.maxRetries) {
            // Wait before retrying
            await new Promise(resolve => {
              retryTimeoutRef.current = setTimeout(resolve, finalConfig.retryConfig.retryDelay);
            });
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (err) {
      // Always clear pending operations count
      setPendingOperations(prev => Math.max(0, prev - 1));
      
      // Only update error state if this is still the current operation
      if (operationId === operationIdRef.current) {
        if (err instanceof Error && (
          err.message.includes('rate limit') ||
          err.message.includes('blocked') ||
          err.message.includes('security')
        )) {
          // Security error already handled
        } else {
          const counterError = createSecurityError(err, CounterErrorType.NETWORK_ERROR);
          setError(counterError.message);
        }
        setOptimisticValue(null); // Clear optimistic value on error
        setIsLoading(false);
      }
      
      throw err;
    }
  }, [finalConfig, counterDetails, isInBackoff, backoffUntil, handleSecurityViolation, createSecurityError]);

  /**
   * Securely increments the counter by 1.
   */
  const increment = useCallback(async (): Promise<void> => {
    console.log('🚀 INCREMENT called at:', new Date().toISOString());
    try {
      await executeSecureOperation(
        'increment',
        secureIncrementMutation,
        (current) => current + 1
      );
      console.log('✅ INCREMENT completed');
    } catch (error) {
      console.error('❌ INCREMENT failed:', error);
    }
  }, [executeSecureOperation, secureIncrementMutation]);

  /**
   * Securely decrements the counter by 1.
   */
  const decrement = useCallback(async (): Promise<void> => {
    console.log('🚀 DECREMENT called at:', new Date().toISOString());
    try {
      await executeSecureOperation(
        'decrement',
        secureDecrementMutation,
        (current) => current - 1
      );
      console.log('✅ DECREMENT completed');
    } catch (error) {
      console.error('❌ DECREMENT failed:', error);
    }
  }, [executeSecureOperation, secureDecrementMutation]);

  /**
   * Securely resets the counter to 0.
   */
  const reset = useCallback(async (): Promise<void> => {
    await executeSecureOperation(
      'reset',
      secureResetMutation,
      () => 0
    );
  }, [executeSecureOperation, secureResetMutation]);

  /**
   * Manually refreshes the counter data.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    // The query will automatically refetch due to Convex's reactivity
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Construct the current counter state
  const counter: CounterState | null = counterDetails ? {
    value: optimisticValue ?? counterDetails.value,
    version: counterDetails.version,
    lastUpdated: counterDetails.lastUpdated,
    name: counterDetails.name,
  } : null;

  return {
    counter,
    isLoading: isLoading || isBlocked,
    error,
    increment,
    decrement,
    reset,
    refresh,
  };
};

