import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for the digit-duel application.
 * 
 * This schema supports:
 * - Global counter with atomic operations
 * - Comprehensive security monitoring
 * - Rate limiting and abuse prevention
 * - Audit logging for security events
 * 
 * @remarks
 * The schema is designed for high security with zero client-side trust,
 * implementing server-authoritative validation for all operations.
 */
export default defineSchema({
  /**
   * Global counter table with atomic operation support.
   */
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

  /**
   * Rate limiting state for each client fingerprint.
   * Tracks operation frequency and enforces security policies.
   */
  rateLimitStates: defineTable({
    /** Client fingerprint for tracking */
    fingerprint: v.string(),
    /** Timestamp of last operation */
    lastOperation: v.number(),
    /** Number of operations in current time window */
    operationCount: v.number(),
    /** Start of current time window */
    windowStart: v.number(),
    /** Current backoff period in milliseconds */
    backoffMs: v.number(),
    /** Total number of violations */
    violationCount: v.number(),
    /** Whether client is currently blocked */
    isBlocked: v.boolean(),
    /** Timestamp when block expires */
    blockExpiresAt: v.optional(v.number()),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_last_operation", ["lastOperation"])
    .index("by_block_status", ["isBlocked", "blockExpiresAt"]),

  /**
   * Security events log for monitoring and analysis.
   * Stores all security violations and suspicious activities.
   */
  securityEvents: defineTable({
    /** Client fingerprint */
    fingerprint: v.string(),
    /** Operation that triggered the event */
    operation: v.string(),
    /** List of security violations detected */
    violations: v.array(v.object({
      type: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      timestamp: v.number(),
      context: v.any(),
    })),
    /** Event timestamp */
    timestamp: v.number(),
    /** Numerical severity (1-4) for sorting */
    severity: v.number(),
    /** Additional metadata */
    metadata: v.any(),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_timestamp", ["timestamp"])
    .index("by_fingerprint_timestamp", ["fingerprint", "timestamp"])
    .index("by_severity", ["severity", "timestamp"]),

  /**
   * Audit log for all counter operations.
   * Provides complete traceability of all changes.
   */
  auditLog: defineTable({
    /** Operation performed */
    operation: v.union(v.literal("increment"), v.literal("decrement"), v.literal("reset")),
    /** Counter value before operation */
    previousValue: v.number(),
    /** Counter value after operation */
    newValue: v.number(),
    /** Client fingerprint */
    fingerprint: v.string(),
    /** Operation timestamp */
    timestamp: v.number(),
    /** Whether operation was successful */
    success: v.boolean(),
    /** Error message if operation failed */
    errorMessage: v.optional(v.string()),
    /** Client-provided timestamp for drift analysis */
    clientTimestamp: v.number(),
    /** Additional operation metadata */
    metadata: v.any(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_fingerprint", ["fingerprint"])
    .index("by_operation", ["operation", "timestamp"])
    .index("by_success", ["success", "timestamp"]),
});

