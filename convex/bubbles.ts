import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Game session configuration
 */
const GAME_CONFIG = {
  maxBubbles: 40,
  minBubbles: 30,
  bubbleLifetime: 30000, // 30 seconds max bubble lifetime
  cleanupInterval: 60000, // Cleanup old bubbles every minute
  sessionTimeout: 300000, // 5 minutes session timeout
};

/**
 * Bubble interface for type safety
 */
export interface Bubble {
  _id?: string;
  bubbleId: string;
  type: 'light' | 'dark';
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  createdAt: number;
  depth: number;
  isPopping?: boolean;
  gameSessionId: string;
}

/**
 * Creates a new bubble and adds it to the game state.
 * 
 * @param bubble - The bubble data to create
 * @returns The created bubble ID
 */
export const createBubble = mutation({
  args: {
    bubbleId: v.string(),
    type: v.union(v.literal("light"), v.literal("dark")),
    x: v.number(),
    y: v.number(),
    size: v.number(),
    vx: v.number(),
    vy: v.number(),
    createdAt: v.number(),
    depth: v.number(),
    gameSessionId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // Check if bubble with this ID already exists
    const existingBubble = await ctx.db
      .query("bubbles")
      .withIndex("by_bubble_id", (q) => q.eq("bubbleId", args.bubbleId))
      .first();

    if (existingBubble) {
      // Update existing bubble position
      await ctx.db.patch(existingBubble._id, {
        x: args.x,
        y: args.y,
        vx: args.vx,
        vy: args.vy,
      });
      return existingBubble._id;
    }

    // Create new bubble
    const bubbleId = await ctx.db.insert("bubbles", args);
    return bubbleId;
  },
});

/**
 * Updates a bubble's position and velocity.
 * 
 * @param bubbleId - The bubble ID to update
 * @param x - New X position
 * @param y - New Y position
 * @param vx - New X velocity
 * @param vy - New Y velocity
 */
export const updateBubble = mutation({
  args: {
    bubbleId: v.string(),
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),
  },
  handler: async (ctx, { bubbleId, x, y, vx, vy }) => {
    const bubble = await ctx.db
      .query("bubbles")
      .withIndex("by_bubble_id", (q) => q.eq("bubbleId", bubbleId))
      .first();

    if (bubble) {
      await ctx.db.patch(bubble._id, { x, y, vx, vy });
    }
  },
});

/**
 * Marks a bubble as popping and removes it from the game.
 * 
 * @param bubbleId - The bubble ID to pop
 * @returns Whether the bubble was successfully popped
 */
export const popBubble = mutation({
  args: {
    bubbleId: v.string(),
  },
  handler: async (ctx, { bubbleId }): Promise<boolean> => {
    const bubble = await ctx.db
      .query("bubbles")
      .withIndex("by_bubble_id", (q) => q.eq("bubbleId", bubbleId))
      .first();

    if (bubble && !bubble.isPopping) {
      // Immediately delete the bubble for instant synchronization
      await ctx.db.delete(bubble._id);
      return true;
    }

    return false;
  },
});

/**
 * Gets all active bubbles for the current game session.
 * 
 * @param gameSessionId - The game session ID
 * @returns Array of active bubbles
 */
export const getBubbles = query({
  args: {
    gameSessionId: v.string(),
  },
  handler: async (ctx, { gameSessionId }): Promise<Bubble[]> => {
    const bubbles = await ctx.db
      .query("bubbles")
      .withIndex("by_game_session", (q) => q.eq("gameSessionId", gameSessionId))
      .collect();

    // Filter out old bubbles
    const now = Date.now();
    return bubbles
      .filter(bubble => !bubble.isPopping && (now - bubble.createdAt) < GAME_CONFIG.bubbleLifetime)
      .map(bubble => ({
        _id: bubble._id,
        bubbleId: bubble.bubbleId,
        type: bubble.type,
        x: bubble.x,
        y: bubble.y,
        size: bubble.size,
        vx: bubble.vx,
        vy: bubble.vy,
        createdAt: bubble.createdAt,
        depth: bubble.depth,
        gameSessionId: bubble.gameSessionId,
      }));
  },
});

/**
 * Gets all active bubbles across all sessions (for global synchronization).
 * 
 * @returns Array of all active bubbles
 */
export const getAllBubbles = query({
  args: {},
  handler: async (ctx): Promise<Bubble[]> => {
    const bubbles = await ctx.db
      .query("bubbles")
      .collect();

    // Filter out old and popping bubbles
    const now = Date.now();
    return bubbles
      .filter(bubble => !bubble.isPopping && (now - bubble.createdAt) < GAME_CONFIG.bubbleLifetime)
      .map(bubble => ({
        _id: bubble._id,
        bubbleId: bubble.bubbleId,
        type: bubble.type,
        x: bubble.x,
        y: bubble.y,
        size: bubble.size,
        vx: bubble.vx,
        vy: bubble.vy,
        createdAt: bubble.createdAt,
        depth: bubble.depth,
        gameSessionId: bubble.gameSessionId,
      }));
  },
});

/**
 * Bulk updates multiple bubbles' positions (for efficient synchronization).
 * 
 * @param bubbles - Array of bubble updates
 */
export const updateBubbles = mutation({
  args: {
    bubbles: v.array(v.object({
      bubbleId: v.string(),
      x: v.number(),
      y: v.number(),
      vx: v.number(),
      vy: v.number(),
    })),
  },
  handler: async (ctx, { bubbles }) => {
    // Update all bubbles in parallel
    await Promise.all(
      bubbles.map(async (bubbleUpdate) => {
        const bubble = await ctx.db
          .query("bubbles")
          .withIndex("by_bubble_id", (q) => q.eq("bubbleId", bubbleUpdate.bubbleId))
          .first();

        if (bubble) {
          await ctx.db.patch(bubble._id, {
            x: bubbleUpdate.x,
            y: bubbleUpdate.y,
            vx: bubbleUpdate.vx,
            vy: bubbleUpdate.vy,
          });
        }
      })
    );
  },
});

/**
 * Cleans up old and popping bubbles.
 */
export const cleanupBubbles = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all bubbles
    const allBubbles = await ctx.db.query("bubbles").collect();
    
    // Remove old or popping bubbles
    const bubblesToDelete = allBubbles.filter(bubble => 
      bubble.isPopping || (now - bubble.createdAt) > GAME_CONFIG.bubbleLifetime
    );

    // Delete in parallel
    await Promise.all(
      bubblesToDelete.map(bubble => ctx.db.delete(bubble._id))
    );

    return bubblesToDelete.length;
  },
});

/**
 * Gets the current game statistics.
 */
export const getGameStats = query({
  args: {},
  handler: async (ctx) => {
    const bubbles = await ctx.db.query("bubbles").collect();
    const now = Date.now();
    
    const activeBubbles = bubbles.filter(bubble => 
      !bubble.isPopping && (now - bubble.createdAt) < GAME_CONFIG.bubbleLifetime
    );

    const lightBubbles = activeBubbles.filter(b => b.type === 'light').length;
    const darkBubbles = activeBubbles.filter(b => b.type === 'dark').length;

    return {
      totalBubbles: activeBubbles.length,
      lightBubbles,
      darkBubbles,
      maxBubbles: GAME_CONFIG.maxBubbles,
      minBubbles: GAME_CONFIG.minBubbles,
    };
  },
});

/**
 * Initializes a game session with initial bubbles.
 * 
 * @param gameSessionId - The game session ID
 * @param initialBubbles - Array of initial bubbles to create
 */
export const initializeGameSession = mutation({
  args: {
    gameSessionId: v.string(),
    initialBubbles: v.array(v.object({
      bubbleId: v.string(),
      type: v.union(v.literal("light"), v.literal("dark")),
      x: v.number(),
      y: v.number(),
      size: v.number(),
      vx: v.number(),
      vy: v.number(),
      createdAt: v.number(),
      depth: v.number(),
    })),
  },
  handler: async (ctx, { gameSessionId, initialBubbles }) => {
    // Clean up any existing bubbles for this session
    const existingBubbles = await ctx.db
      .query("bubbles")
      .withIndex("by_game_session", (q) => q.eq("gameSessionId", gameSessionId))
      .collect();

    await Promise.all(
      existingBubbles.map(bubble => ctx.db.delete(bubble._id))
    );

    // Create new bubbles
    await Promise.all(
      initialBubbles.map(bubble =>
        ctx.db.insert("bubbles", {
          ...bubble,
          gameSessionId,
        })
      )
    );

    return initialBubbles.length;
  },
});

