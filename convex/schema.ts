import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for the digit-duel application.
 * 
 * The counter table stores a single global counter that supports
 * atomic increment/decrement operations to prevent race conditions.
 * 
 * @remarks
 * This schema is designed to handle concurrent updates safely using
 * Convex's built-in atomic operations and optimistic concurrency control.
 */
export default defineSchema({
  counters: defineTable({
    /** The current value of the counter */
    value: v.number(),
    /** Unique identifier for the counter instance */
    name: v.string(),
    /** Timestamp of the last update for audit purposes */
    lastUpdated: v.number(),
    /** Version number for optimistic concurrency control */
    version: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_last_updated", ["lastUpdated"]),
});

