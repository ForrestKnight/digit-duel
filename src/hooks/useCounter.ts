import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { 
  UseCounterReturn, 
  CounterState, 
  CounterError, 
  CounterConfig 
} from '../types/counter';
import { CounterErrorType } from '../types/counter';

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

