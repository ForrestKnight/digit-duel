import { mutation, query } from "./_generated/server";

const GLOBAL_COUNTER_NAME = "global";

/**
 * Atomically increments the global counter by 1.
 * 
 * This mutation uses Convex's built-in atomic operations to ensure
 * that concurrent increment operations don't result in race conditions.
 * The operation will retry automatically if there's a conflict.
 * 
 * @returns The new counter value after incrementing
 */
export const increment = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Get the current counter or create it if it doesn't exist
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      // Initialize counter if it doesn't exist
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: 1,
        lastUpdated: Date.now(),
        version: 1,
      });
      return 1;
    }

    // Atomically increment the counter
    const newValue = existingCounter.value + 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      lastUpdated: Date.now(),
      version: existingCounter.version + 1,
    });

    return newValue;
  },
});

/**
 * Atomically decrements the global counter by 1.
 * 
 * This mutation uses Convex's built-in atomic operations to ensure
 * that concurrent decrement operations don't result in race conditions.
 * The operation will retry automatically if there's a conflict.
 * 
 * @returns The new counter value after decrementing
 */
export const decrement = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Get the current counter or create it if it doesn't exist
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      // Initialize counter if it doesn't exist
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: -1,
        lastUpdated: Date.now(),
        version: 1,
      });
      return -1;
    }

    // Atomically decrement the counter
    const newValue = existingCounter.value - 1;
    await ctx.db.patch(existingCounter._id, {
      value: newValue,
      lastUpdated: Date.now(),
      version: existingCounter.version + 1,
    });

    return newValue;
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
 * Resets the global counter to zero.
 * 
 * This mutation atomically resets the counter value to 0.
 * Useful for testing or administrative purposes.
 * 
 * @returns The new counter value (always 0)
 */
export const reset = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const existingCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", GLOBAL_COUNTER_NAME))
      .first();

    if (!existingCounter) {
      // Create counter with value 0
      await ctx.db.insert("counters", {
        name: GLOBAL_COUNTER_NAME,
        value: 0,
        lastUpdated: Date.now(),
        version: 1,
      });
      return 0;
    }

    // Reset existing counter to 0
    await ctx.db.patch(existingCounter._id, {
      value: 0,
      lastUpdated: Date.now(),
      version: existingCounter.version + 1,
    });

    return 0;
  },
});

