import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Bubble interface matching the backend
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
 * Local bubble state for client-side animations
 */
interface LocalBubble extends Bubble {
  id: string; // For React keys
}

/**
 * Bubble generation configuration
 */
const BUBBLE_CONFIG = {
  maxBubbles: 40,
  minBubbles: 35,
  initialBubbles: 40,
  spawnInterval: 150, // ms between spawns (much faster than 600ms)
  baseSpeed: 0.06, // percentage per frame (increased speed)
  sizeVariation: [1, 2, 3, 4], // size levels
  syncInterval: 100, // ms between position syncs
};

/**
 * Hook for managing realtime bubbles with server synchronization
 * 
 * @param gameSessionId - Current game session ID
 * @param lightPercentage - Current light theme percentage
 * @param darkPercentage - Current dark theme percentage
 * @param isActive - Whether the bubble system is active
 * @returns Bubble management functions and state
 */
export const useBubbles = (
  gameSessionId: string,
  lightPercentage: number,
  darkPercentage: number,
  isActive: boolean
) => {
  // Convex queries and mutations
  const serverBubbles = useQuery(api.bubbles.getAllBubbles);
  const createBubbleMutation = useMutation(api.bubbles.createBubble);
  const popBubbleMutation = useMutation(api.bubbles.popBubble);
  const updateBubblesMutation = useMutation(api.bubbles.updateBubbles);
  const initializeGameMutation = useMutation(api.bubbles.initializeGameSession);

  // Local state
  const [localBubbles, setLocalBubbles] = useState<LocalBubble[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [recentlyPopped, setRecentlyPopped] = useState<Set<string>>(new Set());
  
  // Refs for tracking
  const nextIdRef = useRef(0);
  const lastSyncRef = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef<number>(0);
  const initializationAttemptRef = useRef<number>(0);

  /**
   * Creates a new bubble with appropriate type distribution
   */
  const createBubble = useCallback((): LocalBubble => {
    const now = Date.now();
    const size = BUBBLE_CONFIG.sizeVariation[Math.floor(Math.random() * BUBBLE_CONFIG.sizeVariation.length)];
    
    // Determine type based on current battle state
    let type: 'light' | 'dark';
    if (lightPercentage > 70) {
      type = Math.random() < 0.7 ? 'light' : 'dark';
    } else if (darkPercentage > 70) {
      type = Math.random() < 0.7 ? 'dark' : 'light';
    } else {
      type = Math.random() < 0.5 ? 'light' : 'dark';
    }

    const bubbleId = `bubble-${nextIdRef.current++}-${now}`;

    return {
      _id: undefined,
      bubbleId,
      id: bubbleId, // For React keys
      type,
      x: Math.random() * 90 + 5, // 5% to 95%
      y: Math.random() * 80 + 10, // 10% to 90%
      size,
      vx: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
      vy: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
      createdAt: now,
      depth: size,
      gameSessionId,
    };
  }, [lightPercentage, darkPercentage, gameSessionId]);

  /**
   * Synchronizes local bubbles with server state
   */
  const syncWithServer = useCallback(() => {
    if (!serverBubbles || !isActive) return;

    // Convert server bubbles to local format, excluding recently popped ones
    const serverBubblesLocal: LocalBubble[] = serverBubbles
      .filter((bubble: Bubble) => !recentlyPopped.has(bubble.bubbleId))
      .map((bubble: Bubble) => ({
        ...bubble,
        id: bubble.bubbleId,
      }));

    // Update local state with server bubbles
    setLocalBubbles(prev => {
      const merged: LocalBubble[] = [];
      const serverBubbleIds = new Set(serverBubblesLocal.map(b => b.bubbleId));
      const localBubbleMap = new Map(prev.map(b => [b.bubbleId, b]));

      // Add server bubbles, preserving local animation state to avoid jitter
      for (const serverBubble of serverBubblesLocal) {
        // Skip recently popped bubbles
        if (recentlyPopped.has(serverBubble.bubbleId)) continue;
        
        const localBubble = localBubbleMap.get(serverBubble.bubbleId);
        if (localBubble) {
          // Preserve local position and velocity to avoid jitter
          // Only sync core properties that don't affect smooth animation
          merged.push({
            ...localBubble,
            type: serverBubble.type,
            size: serverBubble.size,
            depth: serverBubble.depth,
            // Keep local position and velocity for smooth movement
          });
        } else {
          // New bubble from server - use server position
          merged.push(serverBubble);
        }
      }

      // Keep local bubbles that aren't on server yet (recently created)
      // Only keep them for a short time to avoid duplication
      const now = Date.now();
      for (const localBubble of prev) {
        if (!serverBubbleIds.has(localBubble.bubbleId) && 
            !recentlyPopped.has(localBubble.bubbleId) &&
            (now - localBubble.createdAt) < 1000) { // Keep for 1 second max
          merged.push(localBubble);
        }
      }

      return merged;
    });
  }, [serverBubbles, isActive, recentlyPopped]);

  /**
   * Pops a bubble and removes it from local state
   */
  const popBubble = useCallback(async (bubbleId: string): Promise<void> => {
    // Mark as recently popped to prevent reappearing during sync
    setRecentlyPopped(prev => new Set(prev).add(bubbleId));
    
    // Optimistically remove from local state
    setLocalBubbles(prev => prev.filter(b => b.bubbleId !== bubbleId));
    
    // Notify server
    try {
      await popBubbleMutation({ bubbleId });
      
      // Clear from recently popped after a delay to ensure server sync is complete
      setTimeout(() => {
        setRecentlyPopped(prev => {
          const newSet = new Set(prev);
          newSet.delete(bubbleId);
          return newSet;
        });
      }, 2000); // Keep in recently popped for 2 seconds
      
    } catch (error) {
      console.error('Failed to pop bubble on server:', error);
      
      // Remove from recently popped on error and re-sync
      setRecentlyPopped(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubbleId);
        return newSet;
      });
      
      // Re-sync with server on error
      syncWithServer();
    }
  }, [popBubbleMutation, syncWithServer]);

  /**
   * Updates bubble positions and syncs with server periodically
   */
  const updateBubbles = useCallback(() => {
    if (!isActive) return;

    const now = Date.now();
    const deltaTime = lastFrameTime.current ? (now - lastFrameTime.current) / 16.67 : 1;
    lastFrameTime.current = now;

    setLocalBubbles(prev => {
      const updated = prev.map(bubble => {
        // Update position with delta time for smooth movement
        let newX = bubble.x + (bubble.vx * deltaTime);
        let newY = bubble.y + (bubble.vy * deltaTime);
        let newVx = bubble.vx;
        let newVy = bubble.vy;

        // Bounce off edges
        if (newX <= 0 || newX >= 100) {
          newVx = -newVx;
          newX = Math.max(0, Math.min(100, newX));
        }
        if (newY <= 0 || newY >= 100) {
          newVy = -newVy;
          newY = Math.max(0, Math.min(100, newY));
        }

        return {
          ...bubble,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
        };
      });

      // Sync with server periodically
      if (now - lastSyncRef.current > BUBBLE_CONFIG.syncInterval) {
        lastSyncRef.current = now;
        
        // Prepare updates for server
        const updates = updated
          .filter(b => !b._id) // Only sync bubbles that originated locally
          .map(b => ({
            bubbleId: b.bubbleId,
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
          }));

        if (updates.length > 0) {
          updateBubblesMutation({ bubbles: updates }).catch(console.error);
        }
      }

      return updated;
    });
  }, [isActive, updateBubblesMutation]);

  /**
   * Spawns new bubbles to maintain minimum count based on server state
   */
  const spawnBubbles = useCallback(() => {
    if (!isActive || !serverBubbles) return;

    // Use server bubble count to determine if we need to spawn
    const totalServerBubbles = serverBubbles.length;
    
    // Don't spawn if we're at or above max bubbles
    if (totalServerBubbles >= BUBBLE_CONFIG.maxBubbles) return;
    
    // Only spawn if we're below minimum or randomly when below max
    const shouldSpawn = totalServerBubbles < BUBBLE_CONFIG.minBubbles || 
                       (totalServerBubbles < BUBBLE_CONFIG.maxBubbles && Math.random() < 0.02); // Much lower probability
    
    if (!shouldSpawn) return;

    const newBubble = createBubble();
    
    // Add to local state optimistically
    setLocalBubbles(prev => [...prev, newBubble]);
    
    // Send to server
    createBubbleMutation({
      bubbleId: newBubble.bubbleId,
      type: newBubble.type,
      x: newBubble.x,
      y: newBubble.y,
      size: newBubble.size,
      vx: newBubble.vx,
      vy: newBubble.vy,
      createdAt: newBubble.createdAt,
      depth: newBubble.depth,
      gameSessionId: newBubble.gameSessionId,
    }).catch(console.error);
  }, [isActive, serverBubbles, createBubble, createBubbleMutation]);

  /**
   * Initializes the game session with bubbles only if no bubbles exist
   * Uses a more robust check to prevent race conditions
   */
  const initializeGame = useCallback(async () => {
    if (isInitialized || !isActive) return;

    // More robust check: wait for server bubbles to be defined first
    if (serverBubbles === undefined) {
      // Still loading, don't initialize yet
      return;
    }

    // If bubbles already exist, just mark as initialized
    if (serverBubbles.length > 0) {
      setIsInitialized(true);
      return;
    }

    // Double-check we're not already initialized to prevent race conditions
    if (isInitialized) return;

    // Prevent rapid initialization attempts - debounce with exponential backoff
    const now = Date.now();
    const timeSinceLastAttempt = now - initializationAttemptRef.current;
    const minInterval = 1000; // 1 second minimum between attempts
    
    if (timeSinceLastAttempt < minInterval) {
      return; // Too soon since last attempt
    }

    initializationAttemptRef.current = now;

    // Only initialize if no bubbles exist and we haven't already tried
    try {
      const initialBubbles = Array.from({ length: BUBBLE_CONFIG.initialBubbles }, () => {
        const bubble = createBubble();
        return {
          bubbleId: bubble.bubbleId,
          type: bubble.type,
          x: bubble.x,
          y: bubble.y,
          size: bubble.size,
          vx: bubble.vx,
          vy: bubble.vy,
          createdAt: bubble.createdAt,
          depth: bubble.depth,
        };
      });

      const result = await initializeGameMutation({
        gameSessionId,
        initialBubbles,
      });
      
      // Only mark as initialized if we actually created bubbles
      if (result > 0) {
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Failed to initialize game session:', error);
      // Don't mark as initialized on error, allow retry
    }
  }, [isInitialized, isActive, gameSessionId, serverBubbles, createBubble, initializeGameMutation]);

  // Sync with server when server state changes
  useEffect(() => {
    syncWithServer();
  }, [syncWithServer]);

  // Initialize game session
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Animation loop
  useEffect(() => {
    if (!isActive) return;

    const animate = () => {
      updateBubbles();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, updateBubbles]);

  // Bubble spawning
  useEffect(() => {
    if (!isActive) return;

    const spawnInterval = setInterval(spawnBubbles, BUBBLE_CONFIG.spawnInterval);
    return () => clearInterval(spawnInterval);
  }, [isActive, spawnBubbles]);

  return {
    bubbles: localBubbles,
    popBubble,
    isInitialized,
    bubbleConfig: BUBBLE_CONFIG,
  };
};

