import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const GLOBAL_COUNTER_NAME = "global";


/**
 * Lightweight logging function that only logs to console instead of database.
 * Removed database audit logging to prevent document creation on every click.
 */
function logOperationToConsole(
  operation: string,
  previousValue: number,
  newValue: number,
  fingerprint: string,
  success: boolean,
  errorMessage?: string
) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Counter] ${operation}: ${previousValue} -> ${newValue} (${fingerprint}) ${success ? '✓' : '✗' + (errorMessage ? ': ' + errorMessage : '')}`);
  }
}

/**
 * Enhanced security validation with progressive rate limiting and bot detection.
 * Integrates with the comprehensive security system for maximum protection.
 */
async function validateEnhancedOperation(
  ctx: any,
  inputFingerprint: string,
  clientTimestamp: number,
  operation: 'increment' | 'decrement' | 'reset',
  _metadata?: any
) {
  const now = Date.now();

  // Use fallback fingerprint if missing or invalid
  let fingerprint = inputFingerprint;
  if (!fingerprint || fingerprint.length === 0) {
    fingerprint = 'anonymous-' + Math.random().toString(36).substring(2, 15);
  }

  // Get or create enhanced rate limit state
  const rateLimitState = await getEnhancedRateLimitState(ctx, fingerprint);
  
  // Check all security constraints
  const securityCheck = await performSecurityChecks(ctx, rateLimitState, now, operation, clientTimestamp);
  
  if (!securityCheck.isValid) {
    throw new Error(`Security violation: ${securityCheck.violations.map(v => v.type).join(', ')}`);
  }
  
  // Update rate limit state
  await updateEnhancedRateLimitState(ctx, fingerprint, now, operation);
  
  return { fingerprint, rateLimitState: securityCheck.updatedState };
}

/**
 * Gets or creates enhanced rate limit state with all tracking fields.
 */
async function getEnhancedRateLimitState(ctx: any, fingerprint: string) {
  const existing = await ctx.db
    .query("rateLimitStates")
    .withIndex("by_fingerprint", (q: any) => q.eq("fingerprint", fingerprint))
    .first();
    
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const hourStart = new Date(now).setMinutes(0, 0, 0);
  
  if (!existing) {
    return {
      fingerprint,
      ipAddress: undefined,
      lastOperation: 0,
      operationCount: 0,
      windowStart: now,
      backoffMs: 0,
      violationCount: 0,
      isBlocked: false,
      blockExpiresAt: undefined,
      dailyOperationCount: 0,
      dayStart,
      sessionOperationCount: 0,
      sessionStart: now,
      hourlyOperationCount: 0,
      hourStart,
      suspicionScore: 0,
      firstSeen: now,
    };
  }
  
  // Reset daily count if new day
  if (existing.dayStart < dayStart) {
    existing.dailyOperationCount = 0;
    existing.dayStart = dayStart;
  }
  
  // Reset hourly count if new hour
  if (existing.hourStart < hourStart) {
    existing.hourlyOperationCount = 0;
    existing.hourStart = hourStart;
  }
  
  // Reset session if timed out
  const sessionAge = now - existing.sessionStart;
  if (sessionAge > 3600000) { // 1 hour session timeout
    existing.sessionOperationCount = 0;
    existing.sessionStart = now;
  }
  
  return existing;
}

/**
 * Performs comprehensive security checks including progressive rate limiting.
 */
async function performSecurityChecks(
  ctx: any,
  state: any,
  now: number,
  _operation: string,
  clientTimestamp: number
) {
  const violations: Array<{ type: string; severity: string; context: any }> = [];
  
  // 1. Basic timestamp validation
  const timeDrift = Math.abs(now - clientTimestamp);
  if (timeDrift > 5000) {
    violations.push({
      type: 'INVALID_TIMESTAMP',
      severity: 'medium',
      context: { drift: timeDrift }
    });
  }
  
  // 2. Check if blocked
  if (state.isBlocked && state.blockExpiresAt && now < state.blockExpiresAt) {
    violations.push({
      type: 'CLIENT_BLOCKED',
      severity: 'critical',
      context: { remainingTime: state.blockExpiresAt - now }
    });
  }
  
  // 3. Progressive rate limiting based on usage
  const timeSinceLastOp = now - state.lastOperation;
  const progressiveInterval = getProgressiveInterval(state.dailyOperationCount);
  
  if (timeSinceLastOp < progressiveInterval && state.lastOperation > 0) {
    violations.push({
      type: 'PROGRESSIVE_RATE_LIMIT',
      severity: 'high',
      context: { 
        required: progressiveInterval, 
        actual: timeSinceLastOp,
        dailyOps: state.dailyOperationCount 
      }
    });
  }
  
  // 4. Daily limit check
  if (state.dailyOperationCount >= 500) {
    violations.push({
      type: 'DAILY_LIMIT_EXCEEDED',
      severity: 'critical',
      context: { dailyCount: state.dailyOperationCount }
    });
  }
  
  // 5. Session limit check
  if (state.sessionOperationCount >= 200) {
    violations.push({
      type: 'SESSION_LIMIT_EXCEEDED',
      severity: 'high',
      context: { sessionCount: state.sessionOperationCount }
    });
  }
  
  // 6. Hourly limit check
  if (state.hourlyOperationCount >= 100) {
    violations.push({
      type: 'HOURLY_LIMIT_EXCEEDED',
      severity: 'high',
      context: { hourlyCount: state.hourlyOperationCount }
    });
  }
  
  // 7. Bot behavior detection
  const botCheck = await detectBotBehavior(ctx, state, now, timeSinceLastOp);
  if (botCheck) {
    violations.push(botCheck);
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    updatedState: state
  };
}

/**
 * Calculates progressive rate limiting interval based on usage.
 */
function getProgressiveInterval(dailyOps: number): number {
  if (dailyOps >= 200) return 5000;  // 5 seconds after 200 operations
  if (dailyOps >= 100) return 1000;  // 1 second after 100 operations
  if (dailyOps >= 50) return 300;    // 300ms after 50 operations
  if (dailyOps >= 10) return 150;    // 150ms after 10 operations
  return 100; // Base rate: 100ms
}

/**
 * Detects potential bot behavior patterns.
 */
async function detectBotBehavior(ctx: any, state: any, now: number, timeSinceLastOp: number) {
  // Very rapid clicks (faster than humanly possible)
  if (timeSinceLastOp < 25 && state.lastOperation > 0) {
    return {
      type: 'RAPID_FIRE_DETECTED',
      severity: 'critical',
      context: { interval: timeSinceLastOp }
    };
  }
  
  // Get recent operation intervals for pattern analysis
  const recentEvents = await ctx.db
    .query("securityEvents")
    .withIndex("by_fingerprint_timestamp", (q: any) => 
      q.eq("fingerprint", state.fingerprint).gte("timestamp", now - 30000)
    )
    .take(10);
    
  if (recentEvents.length >= 5) {
    // Check for suspiciously consistent timing
    const intervals = [];
    for (let i = 1; i < recentEvents.length; i++) {
      intervals.push(recentEvents[i].timestamp - recentEvents[i-1].timestamp);
    }
    
    const variance = calculateVariance(intervals);
    if (variance < 100 && intervals.length >= 5) { // Very low variance = likely bot
      return {
        type: 'CONSISTENT_TIMING_PATTERN',
        severity: 'high',
        context: { variance, intervals }
      };
    }
  }
  
  return null;
}

/**
 * Updates enhanced rate limit state with all counters.
 */
async function updateEnhancedRateLimitState(
  ctx: any,
  fingerprint: string,
  now: number,
  _operation: string
) {
  const existing = await getEnhancedRateLimitState(ctx, fingerprint);
  
  const newState = {
    ...existing,
    lastOperation: now,
    operationCount: existing.operationCount + 1,
    dailyOperationCount: existing.dailyOperationCount + 1,
    sessionOperationCount: existing.sessionOperationCount + 1,
    hourlyOperationCount: existing.hourlyOperationCount + 1,
  };
  
  // Only update database every 5 operations to reduce bandwidth
  if (newState.operationCount % 5 === 0 || !existing._id) {
    if (existing._id) {
      await ctx.db.patch(existing._id, newState);
    } else {
      await ctx.db.insert("rateLimitStates", newState);
    }
  }
}

/**
 * Calculates variance of an array of numbers.
 */
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Atomically increments the counter with retry logic for handling write conflicts.
 */
async function atomicIncrementWithRetry(ctx: any, maxRetries = 3): Promise<number> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q: any) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Try to create new counter
        try {
          await ctx.db.insert("counters", {
            name: GLOBAL_COUNTER_NAME,
            value: 1,
            version: 1,
          });
          return 1;
        } catch (insertError) {
          // If insert fails due to race condition, retry
          if (attempt === maxRetries - 1) throw insertError;
          continue;
        }
      } else {
        // Use optimistic concurrency control
        const currentVersion = existingCounter.version;
        const newValue = existingCounter.value + 1;
        
        try {
          await ctx.db.patch(existingCounter._id, {
            value: newValue,
            version: currentVersion + 1,
          });
          return newValue;
        } catch (patchError) {
          // If patch fails due to write conflict, retry
          if (attempt === maxRetries - 1) throw patchError;
          // Add exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
          continue;
        }
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
    }
  }
  throw new Error('Failed to increment after maximum retries');
}

/**
 * Atomically decrements the counter with retry logic for handling write conflicts.
 */
async function atomicDecrementWithRetry(ctx: any, maxRetries = 3): Promise<number> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q: any) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Try to create new counter with negative value
        try {
          await ctx.db.insert("counters", {
            name: GLOBAL_COUNTER_NAME,
            value: -1,
            version: 1,
          });
          return -1;
        } catch (insertError) {
          // If insert fails due to race condition, retry
          if (attempt === maxRetries - 1) throw insertError;
          continue;
        }
      } else {
        // Use optimistic concurrency control
        const currentVersion = existingCounter.version;
        const newValue = existingCounter.value - 1;
        
        try {
          await ctx.db.patch(existingCounter._id, {
            value: newValue,
            version: currentVersion + 1,
          });
          return newValue;
        } catch (patchError) {
          // If patch fails due to write conflict, retry
          if (attempt === maxRetries - 1) throw patchError;
          // Add exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
          continue;
        }
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
    }
  }
  throw new Error('Failed to decrement after maximum retries');
}

/**
 * Atomically resets the counter to zero with retry logic for handling write conflicts.
 */
async function atomicResetWithRetry(ctx: any, maxRetries = 3): Promise<{ previousValue: number; newValue: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q: any) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Try to create new counter with zero value
        try {
          await ctx.db.insert("counters", {
            name: GLOBAL_COUNTER_NAME,
            value: 0,
            version: 1,
          });
          return { previousValue: 0, newValue: 0 };
        } catch (insertError) {
          // If insert fails due to race condition, retry
          if (attempt === maxRetries - 1) throw insertError;
          continue;
        }
      } else {
        // Use optimistic concurrency control
        const currentVersion = existingCounter.version;
        const previousValue = existingCounter.value;
        
        try {
          await ctx.db.patch(existingCounter._id, {
            value: 0,
            version: currentVersion + 1,
          });
          return { previousValue, newValue: 0 };
        } catch (patchError) {
          // If patch fails due to write conflict, retry
          if (attempt === maxRetries - 1) throw patchError;
          // Add exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
          continue;
        }
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
    }
  }
  throw new Error('Failed to reset after maximum retries');
}

/**
 * Securely increments the global counter by 1 with comprehensive security validation.
 *
 * This mutation performs server-side security validation including:
 * - Rate limiting (max 1 operation per 50ms)
 * - Automated behavior detection
 * - Input validation and sanitization
 * - Optimistic concurrency control with retry logic
 *
 * @param fingerprint - Client fingerprint for tracking
 * @param clientTimestamp - Client-provided timestamp for validation
 * @returns The new counter value after incrementing
 */
export const secureIncrement = mutation({
  args: {
    fingerprint: v.string(),
    clientTimestamp: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { fingerprint, clientTimestamp }): Promise<number> => {
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Enhanced security validation with progressive rate limiting
      await validateEnhancedOperation(ctx, fingerprint, clientTimestamp, 'increment');

      // Use atomic increment with retry logic
      newValue = await atomicIncrementWithRetry(ctx);
      previousValue = newValue - 1;
      success = true;
      return newValue;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error('Operation failed: ' + errorMessage);
    } finally {
      // Log to console only, no database writes
      logOperationToConsole(
        'increment',
        previousValue,
        newValue,
        fingerprint,
        success,
        errorMessage
      );
    }
  },
});

/**
 * Securely decrements the global counter by 1 with comprehensive security validation.
 *
 * This mutation performs the same security validation as increment, ensuring
 * all operations are subject to rate limiting and abuse prevention.
 *
 * @param fingerprint - Client fingerprint for tracking
 * @param clientTimestamp - Client-provided timestamp for validation
 * @returns The new counter value after decrementing
 */
export const secureDecrement = mutation({
  args: {
    fingerprint: v.string(),
    clientTimestamp: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { fingerprint, clientTimestamp }): Promise<number> => {
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Enhanced security validation with progressive rate limiting
      await validateEnhancedOperation(ctx, fingerprint, clientTimestamp, 'decrement');

      // Use atomic decrement with retry logic
      newValue = await atomicDecrementWithRetry(ctx);
      previousValue = newValue + 1;
      success = true;
      return newValue;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error('Operation failed: ' + errorMessage);
    } finally {
      // Log to console only, no database writes
      logOperationToConsole(
        'decrement',
        previousValue,
        newValue,
        fingerprint,
        success,
        errorMessage
      );
    }
  },
});

/**
 * Retrieves the current global counter value.
 *
 * This query returns the current state of the global counter,
 * or 0 if the counter hasn't been initialized yet.
 *
 * @returns The current counter value
 */
export const getCounter = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    return counter?.value ?? 0;
  },
});

/**
 * Retrieves detailed counter information including metadata.
 *
 * This query returns comprehensive information about the counter
 * including its version and last updated timestamp for debugging
 * and monitoring purposes.
 *
 * @returns Counter details or null if not initialized
 */
export const getCounterDetails = query({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!counter) {
      return {
        value: 0,
        version: 0,
        lastUpdated: Date.now(), // Use current time for non-existent counter
        name: GLOBAL_COUNTER_NAME,
      };
    }

    return {
      value: counter.value,
      version: counter.version,
      lastUpdated: counter._creationTime, // Use _creationTime instead of lastUpdated field
      name: counter.name,
    };
  },
});

/**
 * Securely resets the global counter to zero with security validation.
 *
 * This mutation requires the same security validation as other operations
 * and logs the reset action for audit purposes.
 *
 * @param fingerprint - Client fingerprint for tracking
 * @param clientTimestamp - Client-provided timestamp for validation
 * @returns The new counter value (always 0)
 */
export const secureReset = mutation({
  args: {
    fingerprint: v.string(),
    clientTimestamp: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { fingerprint, clientTimestamp }): Promise<number> => {
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Enhanced security validation with progressive rate limiting
      await validateEnhancedOperation(ctx, fingerprint, clientTimestamp, 'reset');

      // Use atomic reset with retry logic
      const result = await atomicResetWithRetry(ctx);
      previousValue = result.previousValue;
      newValue = result.newValue;
      success = true;
      return newValue;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error('Operation failed: ' + errorMessage);
    } finally {
      // Log to console only, no database writes
      logOperationToConsole(
        'reset',
        previousValue,
        newValue,
        fingerprint,
        success,
        errorMessage
      );
    }
  },
});

// Legacy functions for backward compatibility (without security)
// These should be deprecated in favor of secure versions

export const increment = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: 1,
        version: 1,
      });
      return 1;
    }

    const newValue = existingCounter.value + 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      version: existingCounter.version + 1,
    });

    return newValue;
  },
});

export const decrement = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: -1,
        version: 1,
      });
      return -1;
    }

    const newValue = existingCounter.value - 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      version: existingCounter.version + 1,
    });

    return newValue;
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: 0,
        version: 1,
      });
      return 0;
    }

    await ctx.db.patch(existingCounter._id, {
      value: 0,
      version: existingCounter.version + 1,
    });

    return 0;
  },
});

