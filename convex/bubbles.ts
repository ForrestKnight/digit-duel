import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Game session configuration
 */
const GAME_CONFIG = {
  maxBubbles: 40,
  minBubbles: 30,
  // Bubbles should only be removed when popped, not by age
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
 * Atomically creates a bubble with retry logic for handling write conflicts.
 */
async function atomicCreateBubbleWithRetry(ctx: any, args: any, maxRetries = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if bubble with this ID already exists
      const existingBubble = await ctx.db
        .query("bubbles")
        .withIndex("by_bubble_id", (q: any) => q.eq("bubbleId", args.bubbleId))
        .first();

      if (existingBubble) {
        // Update existing bubble position with optimistic concurrency
        try {
          await ctx.db.patch(existingBubble._id, {
            x: args.x,
            y: args.y,
            vx: args.vx,
            vy: args.vy,
          });
          return existingBubble._id;
        } catch (patchError) {
          if (attempt === maxRetries - 1) throw patchError;
          // Add exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 5));
          continue;
        }
      }

      // Check bubble count with a more efficient query
      const bubbleCount = await ctx.db
        .query("bubbles")
        .filter((q: any) => q.neq(q.field("isPopping"), true))
        .collect()
        .then((bubbles: any[]) => bubbles.length);
      
      if (bubbleCount >= GAME_CONFIG.maxBubbles) {
        throw new Error(`Maximum bubble limit reached (${GAME_CONFIG.maxBubbles})`);
      }

      // Create new bubble
      try {
        const bubbleId = await ctx.db.insert("bubbles", args);
        return bubbleId;
      } catch (insertError) {
        if (attempt === maxRetries - 1) throw insertError;
        // Add exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 5));
        continue;
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 5));
    }
  }
  throw new Error('Failed to create bubble after maximum retries');
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
    return await atomicCreateBubbleWithRetry(ctx, args);
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

    // Only filter out popping bubbles
    return bubbles
      .filter(bubble => !bubble.isPopping)
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

    // Only filter out popping bubbles - bubbles persist until manually popped
    return bubbles
      .filter(bubble => !bubble.isPopping)
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
 * Cleans up only popping bubbles (bubbles should persist unless manually popped).
 */
export const cleanupBubbles = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all bubbles
    const allBubbles = await ctx.db.query("bubbles").collect();
    
    // Only remove popping bubbles
    const bubblesToDelete = allBubbles.filter(bubble => bubble.isPopping);

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
    
    // Only filter out popping bubbles
    const activeBubbles = bubbles.filter(bubble => !bubble.isPopping);

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
 * Resets all bubbles in the game.
 */
export const resetAllBubbles = mutation({
  args: {},
  handler: async (ctx) => {
    const allBubbles = await ctx.db.query("bubbles").collect();
    await Promise.all(
      allBubbles.map(bubble => ctx.db.delete(bubble._id))
    );
    return allBubbles.length;
  },
});

/**
 * Initializes a game session with initial bubbles.
 * Only creates bubbles if none exist to prevent race conditions.
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
    // Check if any bubbles already exist globally (since we use global session)
    const existingBubbles = await ctx.db
      .query("bubbles")
      .collect();

    // Only initialize if no bubbles exist at all to prevent race conditions
    if (existingBubbles.length > 0) {
      return 0; // Already initialized
    }

    // Create new bubbles only if none exist
    try {
      await Promise.all(
        initialBubbles.map(bubble =>
          ctx.db.insert("bubbles", {
            ...bubble,
            gameSessionId,
          })
        )
      );
      return initialBubbles.length;
    } catch (error) {
      console.error('Error initializing bubbles:', error);
      return 0;
    }
  },
});

