import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Security configuration constants for the counter application.
 * These values are tuned for optimal security while maintaining usability.
 */
const SECURITY_CONFIG = {
  // Progressive rate limiting based on usage patterns
  RATE_LIMIT: {
    // Base rate limit for new users
    BASE_MIN_INTERVAL_MS: 100,
    
    // Progressive intervals based on operation count
    PROGRESSIVE_INTERVALS: {
      LIGHT_USAGE: { threshold: 10, intervalMs: 150 },   // After 10 ops: 150ms
      MODERATE_USAGE: { threshold: 50, intervalMs: 300 }, // After 50 ops: 300ms
      HEAVY_USAGE: { threshold: 100, intervalMs: 1000 }, // After 100 ops: 1s
      EXCESSIVE_USAGE: { threshold: 200, intervalMs: 5000 }, // After 200 ops: 5s
    },
    
    MAX_OPERATIONS_PER_WINDOW: 10,
    WINDOW_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
    MAX_BACKOFF_MS: 30000, // 30 seconds max
  },
  
  // Daily/session limits to prevent script abuse
  USAGE_LIMITS: {
    MAX_DAILY_OPERATIONS: 500,    // Max 500 clicks per day
    MAX_SESSION_OPERATIONS: 200,  // Max 200 clicks per session
    MAX_HOURLY_OPERATIONS: 100,   // Max 100 clicks per hour
    SESSION_TIMEOUT_MS: 3600000,  // 1 hour session timeout
  },
  
  // Bot detection thresholds
  BOT_DETECTION: {
    SUSPICIOUS_ACTIVITY_THRESHOLD: 5,
    MAX_VIOLATIONS_BEFORE_BLOCK: 3,
    HIGH_SUSPICION_SCORE: 70,     // Block at 70+ suspicion
    CRITICAL_SUSPICION_SCORE: 90, // Immediate block at 90+
    
    // Behavioral analysis
    MIN_HUMAN_VARIANCE_MS: 50,    // Humans vary by at least 50ms
    MAX_CONSISTENT_INTERVALS: 5,  // More than 5 consistent = bot
    RAPID_FIRE_THRESHOLD_MS: 25,  // Faster than 25ms = likely bot
  },
  
  // Security thresholds
  MAX_VIOLATIONS_BEFORE_BLOCK: 3,
  BLOCK_DURATION_MS: 300000, // 5 minute initial block (increased)
  
  // Validation limits
  MAX_CLIENT_TIMESTAMP_DRIFT_MS: 5000, // 5 seconds
  MAX_FINGERPRINT_LENGTH: 256,
} as const;

/**
 * Security violation types for comprehensive threat detection.
 */
export const SecurityViolationType = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  MISSING_FINGERPRINT: 'MISSING_FINGERPRINT',
  EXCESSIVE_REQUESTS: 'EXCESSIVE_REQUESTS',
  AUTOMATED_BEHAVIOR: 'AUTOMATED_BEHAVIOR',
  MALICIOUS_PATTERN: 'MALICIOUS_PATTERN',
  CLIENT_TAMPERING: 'CLIENT_TAMPERING',
} as const;

/**
 * Validates the security context of an incoming operation request.
 * 
 * This function performs comprehensive server-side validation to ensure
 * the request is legitimate and not part of an attack pattern.
 * 
 * @param ctx - Convex context
 * @param fingerprint - Client fingerprint for tracking
 * @param clientTimestamp - Client-provided timestamp
 * @param operation - The operation being attempted
 * @returns Validation result with security assessment
 */
export const validateOperation = mutation({
  args: {
    fingerprint: v.string(),
    clientTimestamp: v.number(),
    operation: v.union(v.literal("increment"), v.literal("decrement"), v.literal("reset")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { fingerprint, clientTimestamp, operation, metadata = {} }) => {
    const now = Date.now();
    const violations: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      timestamp: number;
      context: Record<string, unknown>;
    }> = [];

    // Input validation
    if (!fingerprint || fingerprint.length > SECURITY_CONFIG.MAX_FINGERPRINT_LENGTH) {
      violations.push({
        type: SecurityViolationType.MISSING_FINGERPRINT,
        severity: 'high',
        timestamp: now,
        context: { fingerprint: fingerprint?.length || 0 },
      });
    }

    // Timestamp validation to detect client tampering
    const timeDrift = Math.abs(now - clientTimestamp);
    if (timeDrift > SECURITY_CONFIG.MAX_CLIENT_TIMESTAMP_DRIFT_MS) {
      violations.push({
        type: SecurityViolationType.INVALID_TIMESTAMP,
        severity: 'medium',
        timestamp: now,
        context: { 
          clientTimestamp, 
          serverTimestamp: now, 
          drift: timeDrift 
        },
      });
    }

    // Get or create rate limit state for this client
    const rateLimitState = await getRateLimitState(ctx, fingerprint);
    
    // Check rate limiting
    const rateLimitViolation = checkRateLimit(rateLimitState, now, operation);
    if (rateLimitViolation) {
      violations.push(rateLimitViolation);
    }

    // Update rate limit state
    await updateRateLimitState(ctx, fingerprint, now, violations.length > 0);

    // Check for automated behavior patterns
    const behaviorViolation = await detectAutomatedBehavior(ctx, fingerprint, now);
    if (behaviorViolation) {
      violations.push(behaviorViolation);
    }

    // Log security events
    if (violations.length > 0) {
      await logSecurityEvent(ctx, {
        fingerprint,
        operation,
        violations,
        timestamp: now,
        metadata,
      });
    }

    const isValid = violations.length === 0;
    const shouldBlock = violations.some(v => v.severity === 'high' || v.severity === 'critical');

    return {
      isValid,
      violations,
      shouldBlock,
      backoffMs: rateLimitState?.backoffMs || 0,
    };
  },
});

/**
 * Retrieves the current rate limiting state for a client.
 */
async function getRateLimitState(ctx: any, fingerprint: string) {
  const state = await ctx.db
    .query("rateLimitStates")
    .withIndex("by_fingerprint", (q: any) => q.eq("fingerprint", fingerprint))
    .first();

  return state || {
    fingerprint,
    lastOperation: 0,
    operationCount: 0,
    backoffMs: 0,
    violationCount: 0,
    isBlocked: false,
    windowStart: Date.now(),
  };
}

/**
 * Checks if the current operation violates rate limiting rules.
 */
function checkRateLimit(state: any, now: number, operation: string) {
  const timeSinceLastOp = now - state.lastOperation;
  
  // Check minimum interval between operations
  if (timeSinceLastOp < SECURITY_CONFIG.RATE_LIMIT.BASE_MIN_INTERVAL_MS) {
    return {
      type: SecurityViolationType.RATE_LIMIT_EXCEEDED,
      severity: 'high' as const,
      timestamp: now,
      context: {
        operation,
        timeSinceLastOp,
        minInterval: SECURITY_CONFIG.RATE_LIMIT.BASE_MIN_INTERVAL_MS,
      },
    };
  }

  // Check if client is currently blocked
  if (state.isBlocked && state.blockExpiresAt && now < state.blockExpiresAt) {
    return {
      type: SecurityViolationType.RATE_LIMIT_EXCEEDED,
      severity: 'critical' as const,
      timestamp: now,
      context: {
        operation,
        blockExpiresAt: state.blockExpiresAt,
        remainingBlockTime: state.blockExpiresAt - now,
      },
    };
  }

  // Check operations per window
  const windowElapsed = now - state.windowStart;
  if (windowElapsed < SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS) {
    if (state.operationCount >= SECURITY_CONFIG.RATE_LIMIT.MAX_OPERATIONS_PER_WINDOW) {
      return {
        type: SecurityViolationType.EXCESSIVE_REQUESTS,
        severity: 'high' as const,
        timestamp: now,
        context: {
          operation,
          operationCount: state.operationCount,
          maxOperations: SECURITY_CONFIG.RATE_LIMIT.MAX_OPERATIONS_PER_WINDOW,
          windowMs: SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS,
        },
      };
    }
  }

  return null;
}

/**
 * Updates the rate limiting state for a client (optimized for bandwidth).
 * Only updates database every 5 operations or on violations to reduce writes.
 */
async function updateRateLimitState(ctx: any, fingerprint: string, now: number, hasViolation: boolean) {
  const existing = await ctx.db
    .query("rateLimitStates")
    .withIndex("by_fingerprint", (q: any) => q.eq("fingerprint", fingerprint))
    .first();

  const windowElapsed = existing ? now - existing.windowStart : 0;
  const shouldResetWindow = windowElapsed >= SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS;
  const operationCount = shouldResetWindow ? 1 : (existing?.operationCount || 0) + 1;
  
  // Only update database on violations or every 5 operations to reduce bandwidth
  const shouldUpdateDb = hasViolation || (operationCount % 5 === 0) || !existing;
  
  if (!shouldUpdateDb) {
    return; // Skip database write for this operation
  }

  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const hourStart = new Date(now).setMinutes(0, 0, 0);
  
  const newState = {
    fingerprint,
    ipAddress: existing?.ipAddress,
    lastOperation: now,
    operationCount,
    windowStart: shouldResetWindow ? now : (existing?.windowStart || now),
    violationCount: hasViolation ? (existing?.violationCount || 0) + 1 : (existing?.violationCount || 0),
    backoffMs: hasViolation 
      ? Math.min(
          (existing?.backoffMs || SECURITY_CONFIG.RATE_LIMIT.BASE_MIN_INTERVAL_MS) * SECURITY_CONFIG.RATE_LIMIT.BACKOFF_MULTIPLIER,
          SECURITY_CONFIG.RATE_LIMIT.MAX_BACKOFF_MS
        )
      : Math.max((existing?.backoffMs || 0) * 0.5, 0),
    isBlocked: (existing?.violationCount || 0) >= SECURITY_CONFIG.MAX_VIOLATIONS_BEFORE_BLOCK,
    blockExpiresAt: (existing?.violationCount || 0) >= SECURITY_CONFIG.MAX_VIOLATIONS_BEFORE_BLOCK 
      ? now + SECURITY_CONFIG.BLOCK_DURATION_MS
      : existing?.blockExpiresAt,
    // New enhanced tracking fields
    dailyOperationCount: existing?.dayStart === dayStart ? (existing?.dailyOperationCount || 0) + 1 : 1,
    dayStart,
    sessionOperationCount: (existing?.sessionOperationCount || 0) + 1,
    sessionStart: existing?.sessionStart || now,
    hourlyOperationCount: existing?.hourStart === hourStart ? (existing?.hourlyOperationCount || 0) + 1 : 1,
    hourStart,
    suspicionScore: existing?.suspicionScore || 0,
    firstSeen: existing?.firstSeen || now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, newState);
  } else {
    await ctx.db.insert("rateLimitStates", newState);
  }
}

/**
 * Detects automated behavior patterns that may indicate bot activity.
 */
async function detectAutomatedBehavior(ctx: any, fingerprint: string, now: number) {
  // Get recent operations for this client
  const recentOps = await ctx.db
    .query("securityEvents")
    .withIndex("by_fingerprint_timestamp", (q: any) => 
      q.eq("fingerprint", fingerprint).gte("timestamp", now - 10000) // Last 10 seconds
    )
    .collect();

  // Check for suspiciously regular timing patterns
  if (recentOps.length >= 5) {
    const intervals = [];
    for (let i = 1; i < recentOps.length; i++) {
      intervals.push(recentOps[i].timestamp - recentOps[i-1].timestamp);
    }

    // Calculate variance in intervals
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);

    // Low variance indicates robotic behavior
    if (standardDeviation < 10 && mean < 200) { // Very consistent sub-200ms clicks
      return {
        type: SecurityViolationType.AUTOMATED_BEHAVIOR,
        severity: 'high' as const,
        timestamp: now,
        context: {
          recentOperationCount: recentOps.length,
          averageInterval: mean,
          standardDeviation,
          intervals,
        },
      };
    }
  }

  return null;
}

/**
 * Logs security events for monitoring and analysis.
 */
async function logSecurityEvent(ctx: any, event: {
  fingerprint: string;
  operation: string;
  violations: any[];
  timestamp: number;
  metadata: Record<string, unknown>;
}) {
  await ctx.db.insert("securityEvents", {
    ...event,
    severity: Math.max(...event.violations.map(v => 
      v.severity === 'critical' ? 4 : 
      v.severity === 'high' ? 3 : 
      v.severity === 'medium' ? 2 : 1
    )),
  });

  // Clean up old security events (keep last 24 hours)
  const oneDayAgo = event.timestamp - 24 * 60 * 60 * 1000;
  const oldEvents = await ctx.db
    .query("securityEvents")
    .withIndex("by_timestamp", (q: any) => q.lt("timestamp", oneDayAgo))
    .collect();

  for (const oldEvent of oldEvents) {
    await ctx.db.delete(oldEvent._id);
  }
}

/**
 * Retrieves security statistics for monitoring.
 */
export const getSecurityStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentEvents = await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp", (q: any) => q.gte("timestamp", oneHourAgo))
      .collect();

    const activeBlocks = await ctx.db
      .query("rateLimitStates")
      .filter((q: any) => q.and(
        q.eq(q.field("isBlocked"), true),
        q.gt(q.field("blockExpiresAt"), now)
      ))
      .collect();

    return {
      recentViolations: recentEvents.length,
      activeBlocks: activeBlocks.length,
      severityBreakdown: {
        critical: recentEvents.filter(e => e.severity === 4).length,
        high: recentEvents.filter(e => e.severity === 3).length,
        medium: recentEvents.filter(e => e.severity === 2).length,
        low: recentEvents.filter(e => e.severity === 1).length,
      },
      timestamp: now,
    };
  },
});

/**
 * Administrative function to manually block or unblock a client.
 */
export const manageClientBlock = mutation({
  args: {
    fingerprint: v.string(),
    action: v.union(v.literal("block"), v.literal("unblock")),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { fingerprint, action, durationMs = SECURITY_CONFIG.BLOCK_DURATION_MS }) => {
    const existing = await ctx.db
      .query("rateLimitStates")
      .withIndex("by_fingerprint", (q: any) => q.eq("fingerprint", fingerprint))
      .first();

    const now = Date.now();
    const dayStart = new Date(now).setHours(0, 0, 0, 0);
    const hourStart = new Date(now).setMinutes(0, 0, 0);
    
    const newState = {
      fingerprint,
      ipAddress: existing?.ipAddress,
      lastOperation: existing?.lastOperation || now,
      operationCount: existing?.operationCount || 0,
      windowStart: existing?.windowStart || now,
      violationCount: action === "block" ? SECURITY_CONFIG.MAX_VIOLATIONS_BEFORE_BLOCK : 0,
      backoffMs: action === "block" ? SECURITY_CONFIG.RATE_LIMIT.MAX_BACKOFF_MS : 0,
      isBlocked: action === "block",
      blockExpiresAt: action === "block" ? now + durationMs : undefined,
      dailyOperationCount: existing?.dailyOperationCount || 0,
      dayStart: existing?.dayStart || dayStart,
      sessionOperationCount: existing?.sessionOperationCount || 0,
      sessionStart: existing?.sessionStart || now,
      hourlyOperationCount: existing?.hourlyOperationCount || 0,
      hourStart: existing?.hourStart || hourStart,
      suspicionScore: existing?.suspicionScore || 0,
      firstSeen: existing?.firstSeen || now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, newState);
    } else if (action === "block") {
      await ctx.db.insert("rateLimitStates", newState);
    }

    // Log administrative action
    await ctx.db.insert("securityEvents", {
      fingerprint,
      operation: "admin_action",
      violations: [{
        type: action === "block" ? "MANUAL_BLOCK" : "MANUAL_UNBLOCK",
        severity: "medium",
        timestamp: now,
        context: { action, durationMs },
      }],
      timestamp: now,
      severity: 2,
      metadata: { isAdminAction: true },
    });

    return {
      success: true,
      action,
      fingerprint,
      expiresAt: newState.blockExpiresAt,
    };
  },
});

