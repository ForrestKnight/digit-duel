import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Global statistics configuration
 */
const GLOBAL_STATS_ID = "global-game-stats";

/**
 * Game statistics interface for type safety
 */
export interface GameStats {
  _id?: string;
  statsId: string;
  lightWins: number;
  darkWins: number;
  totalBattles: number;
  lastBattleAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Gets the current game statistics.
 * Returns null if no stats exist yet.
 * 
 * @returns Current game statistics or null
 */
export const getGameStats = query({
  args: {},
  handler: async (ctx): Promise<GameStats | null> => {
    // Try to get existing stats
    const existingStats = await ctx.db
      .query("gameStats")
      .withIndex("by_stats_id", (q) => q.eq("statsId", GLOBAL_STATS_ID))
      .first();

    if (existingStats) {
      return {
        _id: existingStats._id,
        statsId: existingStats.statsId,
        lightWins: existingStats.lightWins,
        darkWins: existingStats.darkWins,
        totalBattles: existingStats.totalBattles,
        lastBattleAt: existingStats.lastBattleAt,
        createdAt: existingStats.createdAt,
        updatedAt: existingStats.updatedAt,
      };
    }

    // No stats exist
    return null;
  },
});

/**
 * Records a battle victory for the specified winner.
 * Updates the persistent win counters.
 * 
 * @param winner - The winning theme ('light' or 'dark')
 * @returns Updated game statistics
 */
export const recordVictory = mutation({
  args: {
    winner: v.union(v.literal("light"), v.literal("dark")),
  },
  handler: async (ctx, { winner }): Promise<GameStats> => {
    const now = Date.now();
    let existingStats;

    for (let attempt = 0; attempt < 3; attempt++) {
      // Get existing stats or create if none exist
      existingStats = await ctx.db
        .query("gameStats")
        .withIndex("by_stats_id", (q) => q.eq("statsId", GLOBAL_STATS_ID))
        .first();

      try {
        if (!existingStats) {
          // Create initial stats record
          const initialStats = {
            statsId: GLOBAL_STATS_ID,
            lightWins: winner === "light" ? 1 : 0,
            darkWins: winner === "dark" ? 1 : 0,
            totalBattles: 1,
            lastBattleAt: now,
            createdAt: now,
            updatedAt: now,
          };

          const statsId = await ctx.db.insert("gameStats", initialStats);
          
          return {
            _id: statsId,
            ...initialStats,
          };
        } else {
          // Use optimistic concurrency control
          // const currentVersion = existingStats.updatedAt;

          const updatedStats = {
            lightWins: existingStats.lightWins + (winner === "light" ? 1 : 0),
            darkWins: existingStats.darkWins + (winner === "dark" ? 1 : 0),
            totalBattles: existingStats.totalBattles + 1,
            lastBattleAt: now,
            updatedAt: now,
          };

          await ctx.db.patch(existingStats._id, updatedStats);

          return {
            _id: existingStats._id,
            statsId: existingStats.statsId,
            createdAt: existingStats.createdAt,
            ...updatedStats,
          };
        }
      } catch (patchError: any) {
        // If patch fails due to write conflict, retry
        if (patchError?.message?.includes('Write conflict')) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 10));
          continue;
        }
        throw patchError;
      }
    }
    throw new Error('Failed to update game statistics after maximum retries');
  },
});

/**
 * Resets all game statistics to zero.
 * Useful for testing or starting fresh.
 * 
 * @returns Reset game statistics
 */
export const resetGameStats = mutation({
  args: {},
  handler: async (ctx): Promise<GameStats> => {
    const now = Date.now();

    // Get existing stats
    const existingStats = await ctx.db
      .query("gameStats")
      .withIndex("by_stats_id", (q) => q.eq("statsId", GLOBAL_STATS_ID))
      .first();

    if (!existingStats) {
      // Create fresh stats
      const initialStats = {
        statsId: GLOBAL_STATS_ID,
        lightWins: 0,
        darkWins: 0,
        totalBattles: 0,
        lastBattleAt: 0,
        createdAt: now,
        updatedAt: now,
      };

      const statsId = await ctx.db.insert("gameStats", initialStats);
      
      return {
        _id: statsId,
        ...initialStats,
      };
    }

    // Reset existing stats
    const resetStats = {
      lightWins: 0,
      darkWins: 0,
      totalBattles: 0,
      lastBattleAt: 0,
      updatedAt: now,
    };

    await ctx.db.patch(existingStats._id, resetStats);

    return {
      _id: existingStats._id,
      statsId: existingStats.statsId,
      createdAt: existingStats.createdAt,
      ...resetStats,
    };
  },
});

/**
 * Gets detailed battle statistics including win percentages.
 * 
 * @returns Detailed statistics with calculated percentages
 */
export const getDetailedStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db
      .query("gameStats")
      .withIndex("by_stats_id", (q) => q.eq("statsId", GLOBAL_STATS_ID))
      .first();

    if (!stats) {
      return {
        lightWins: 0,
        darkWins: 0,
        totalBattles: 0,
        lightWinPercentage: 0,
        darkWinPercentage: 0,
        lastBattleAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const lightWinPercentage = stats.totalBattles > 0 
      ? (stats.lightWins / stats.totalBattles) * 100 
      : 0;
    
    const darkWinPercentage = stats.totalBattles > 0 
      ? (stats.darkWins / stats.totalBattles) * 100 
      : 0;

    return {
      lightWins: stats.lightWins,
      darkWins: stats.darkWins,
      totalBattles: stats.totalBattles,
      lightWinPercentage: Math.round(lightWinPercentage * 10) / 10, // Round to 1 decimal
      darkWinPercentage: Math.round(darkWinPercentage * 10) / 10,
      lastBattleAt: stats.lastBattleAt,
      createdAt: stats.createdAt,
      updatedAt: stats.updatedAt,
    };
  },
});

/**
 * Gets statistics for the last N battles.
 * Useful for showing recent trends.
 * 
 * @param limit - Number of recent battles to consider
 * @returns Recent battle statistics
 */
export const getRecentBattleStats = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    // Note: limit parameter is for future use when we implement individual battle tracking
    // For now, we'll return the overall stats since we don't store individual battles
    // In the future, you could add a separate battles table to track individual games
    console.log(`Getting recent battle stats (limit: ${limit})`);
    
    const stats = await ctx.db
      .query("gameStats")
      .withIndex("by_stats_id", (q) => q.eq("statsId", GLOBAL_STATS_ID))
      .first();

    if (!stats) {
      return {
        lightWins: 0,
        darkWins: 0,
        totalBattles: 0,
        period: "all-time",
      };
    }

    return {
      lightWins: stats.lightWins,
      darkWins: stats.darkWins,
      totalBattles: stats.totalBattles,
      period: "all-time", // Could be enhanced to track recent battles separately
    };
  },
});
