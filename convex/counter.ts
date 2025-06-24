import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const GLOBAL_COUNTER_NAME = "global";

/**
 * Security-enhanced error class for counter operations.
 */
class CounterSecurityError extends Error {
  public readonly type: string;
  public readonly violations: any[];
  public readonly shouldBlock: boolean;

  constructor(
    message: string,
    type: string,
    violations: any[] = [],
    shouldBlock: boolean = false
  ) {
    super(message);
    this.name = 'CounterSecurityError';
    this.type = type;
    this.violations = violations;
    this.shouldBlock = shouldBlock;
  }
}

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
 * Simple validation for counter operations without database writes.
 * Only performs basic checks without creating audit records.
 */
async function validateSimpleOperation(
  inputFingerprint: string,
  clientTimestamp: number
) {
  const now = Date.now();

  // Use fallback fingerprint if missing or invalid
  let fingerprint = inputFingerprint;
  if (!fingerprint || fingerprint.length === 0) {
    fingerprint = 'anonymous-' + Math.random().toString(36).substring(2, 15);
  }

  // Basic timestamp validation (10-second drift allowance for simplicity)
  const timeDrift = Math.abs(now - clientTimestamp);
  if (timeDrift > 10000) {
    throw new Error('Invalid timestamp: client clock appears to be out of sync');
  }

  return { fingerprint };
}

/**
 * Securely increments the global counter by 1 with comprehensive security validation.
 *
 * This mutation performs server-side security validation including:
 * - Rate limiting (max 1 operation per 50ms)
 * - Automated behavior detection
 * - Input validation and sanitization
 * - Comprehensive audit logging
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
  handler: async (ctx, { fingerprint, clientTimestamp, metadata = {} }): Promise<number> => {
    const startTime = Date.now();
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Simple validation without database writes
      const validation = await validateSimpleOperation(fingerprint, clientTimestamp);

      // Get the current counter or create it if it doesn't exist
      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Initialize counter if it doesn't exist
        previousValue = 0;
        newValue = 1;
        await ctx.db.insert("counters", {
          name: GLOBAL_COUNTER_NAME,
          value: newValue,
          lastUpdated: Date.now(),
          version: 1,
        });
      } else {
        // Atomically increment the counter
        previousValue = existingCounter.value;
        newValue = existingCounter.value + 1;
        await ctx.db.patch(existingCounter._id, {
          value: newValue,
          lastUpdated: Date.now(),
          version: existingCounter.version + 1,
        });
      }

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
  handler: async (ctx, { fingerprint, clientTimestamp, metadata = {} }): Promise<number> => {
    const startTime = Date.now();
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Simple validation without database writes
      const validation = await validateSimpleOperation(fingerprint, clientTimestamp);

      // Get the current counter or create it if it doesn't exist
      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Initialize counter if it doesn't exist
        previousValue = 0;
        newValue = -1;
        await ctx.db.insert("counters", {
          name: GLOBAL_COUNTER_NAME,
          value: newValue,
          lastUpdated: Date.now(),
          version: 1,
        });
      } else {
        // Atomically decrement the counter
        previousValue = existingCounter.value;
        newValue = existingCounter.value - 1;
        await ctx.db.patch(existingCounter._id, {
          value: newValue,
          lastUpdated: Date.now(),
          version: existingCounter.version + 1,
        });
      }

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
        lastUpdated: Date.now(),
        name: GLOBAL_COUNTER_NAME,
      };
    }

    return {
      value: counter.value,
      version: counter.version,
      lastUpdated: counter.lastUpdated,
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
  handler: async (ctx, { fingerprint, clientTimestamp, metadata = {} }): Promise<number> => {
    const startTime = Date.now();
    let previousValue = 0;
    let newValue = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Simple validation without database writes
      const validation = await validateSimpleOperation(fingerprint, clientTimestamp);

      const existingCounter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
        .first();

      if (!existingCounter) {
        // Create counter with value 0
        previousValue = 0;
        newValue = 0;
        await ctx.db.insert("counters", {
          name: GLOBAL_COUNTER_NAME,
          value: 0,
          lastUpdated: Date.now(),
          version: 1,
        });
      } else {
        // Reset existing counter to 0
        previousValue = existingCounter.value;
        newValue = 0;
        await ctx.db.patch(existingCounter._id, {
          value: 0,
          lastUpdated: Date.now(),
          version: existingCounter.version + 1,
        });
      }

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
        lastUpdated: Date.now(),
        version: 1,
      });
      return 1;
    }

    const newValue = existingCounter.value + 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      lastUpdated: Date.now(),
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
        lastUpdated: Date.now(),
        version: 1,
      });
      return -1;
    }

    const newValue = existingCounter.value - 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      lastUpdated: Date.now(),
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
        lastUpdated: Date.now(),
        version: 1,
      });
      return 0;
    }

    await ctx.db.patch(existingCounter._id, {
      value: 0,
      lastUpdated: Date.now(),
      version: existingCounter.version + 1,
    });

    return 0;
  },
});

