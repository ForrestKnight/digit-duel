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
    /** Timestamp of last update (optional for backward compatibility) */
    lastUpdated: v.optional(v.number()),
    /** Version number for optimistic concurrency control (updated less frequently) */
    version: v.number(),
  })
    .index("by_name", ["name"]),

  /**
   * Rate limiting state for each client fingerprint.
   * Tracks operation frequency and enforces security policies.
   */
  rateLimitStates: defineTable({
    /** Client fingerprint for tracking */
    fingerprint: v.string(),
    /** Client IP address (if available) */
    ipAddress: v.optional(v.string()),
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
    /** Total operations today */
    dailyOperationCount: v.optional(v.number()),
    /** Start of current day (for daily limits) */
    dayStart: v.optional(v.number()),
    /** Session operation count */
    sessionOperationCount: v.optional(v.number()),
    /** Session start timestamp */
    sessionStart: v.optional(v.number()),
    /** Hourly operation count */
    hourlyOperationCount: v.optional(v.number()),
    /** Start of current hour */
    hourStart: v.optional(v.number()),
    /** Bot suspicion score (0-100) */
    suspicionScore: v.optional(v.number()),
    /** Timestamp when first seen */
    firstSeen: v.optional(v.number()),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_ip_address", ["ipAddress"])
    .index("by_last_operation", ["lastOperation"])
    .index("by_block_status", ["isBlocked", "blockExpiresAt"])
    .index("by_suspicion_score", ["suspicionScore"])
    .index("by_daily_count", ["dailyOperationCount", "dayStart"]),

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

  /**
   * Floating bubbles for realtime synchronization.
   * Stores the state of all bubbles across all clients.
   */
  bubbles: defineTable({
    /** Unique identifier for the bubble */
    bubbleId: v.string(),
    /** Type of bubble - light or dark */
    type: v.union(v.literal("light"), v.literal("dark")),
    /** X position as percentage (0-100) */
    x: v.number(),
    /** Y position as percentage (0-100) */
    y: v.number(),
    /** Size level (1-4) */
    size: v.number(),
    /** Velocity X */
    vx: v.number(),
    /** Velocity Y */
    vy: v.number(),
    /** When the bubble was created */
    createdAt: v.number(),
    /** Z-index depth for layering */
    depth: v.number(),
    /** Whether bubble is currently being popped */
    isPopping: v.optional(v.boolean()),
    /** Game session ID for cleanup */
    gameSessionId: v.string(),
  })
    .index("by_bubble_id", ["bubbleId"])
    .index("by_game_session", ["gameSessionId"])
    .index("by_created_at", ["createdAt"])
    .index("by_type", ["type"]),

  /**
   * Game statistics for persistent win tracking.
   * Stores overall battle statistics across all sessions.
   */
  gameStats: defineTable({
    /** Unique identifier for the stats record (typically "global") */
    statsId: v.string(),
    /** Number of times light theme has won */
    lightWins: v.number(),
    /** Number of times dark theme has won */
    darkWins: v.number(),
    /** Total number of battles completed */
    totalBattles: v.number(),
    /** Timestamp of last battle */
    lastBattleAt: v.number(),
    /** Timestamp when stats were created */
    createdAt: v.number(),
    /** Timestamp of last update */
    updatedAt: v.number(),
  })
    .index("by_stats_id", ["statsId"])
    .index("by_last_battle", ["lastBattleAt"]),
});

