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
  spawnInterval: 100, // ms between spawns (even faster for more responsive gameplay)
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
  const initializationAttemptRef = useRef<number>(0);

  /**
   * Creates a new bubble with balanced type distribution
   */
  const createBubble = useCallback((forceType?: 'light' | 'dark'): LocalBubble => {
    const now = Date.now();
    const size = BUBBLE_CONFIG.sizeVariation[Math.floor(Math.random() * BUBBLE_CONFIG.sizeVariation.length)];
    
    // Determine type - ensure equal distribution unless forced
    let type: 'light' | 'dark';
    if (forceType) {
      type = forceType;
    } else {
      // Count current bubbles to maintain balance
      const lightCount = localBubbles.filter(b => b.type === 'light').length;
      const darkCount = localBubbles.filter(b => b.type === 'dark').length;
      
      if (lightCount > darkCount) {
        type = 'dark'; // Create dark bubble to balance
      } else if (darkCount > lightCount) {
        type = 'light'; // Create light bubble to balance
      } else {
        type = Math.random() < 0.5 ? 'light' : 'dark'; // Equal counts, random choice
      }
    }

    const bubbleId = `bubble-${nextIdRef.current++}-${now}`;

    return {
      _id: undefined,
      bubbleId,
      id: bubbleId, // For React keys
      type,
      x: Math.random() * 90 + 5, // 5% to 95% - random spawn position
      y: Math.random() * 80 + 10, // 10% to 90% - random spawn position
      size,
      vx: 0, // No horizontal movement - stationary
      vy: 0, // No vertical movement - stationary
      createdAt: now,
      depth: size,
      gameSessionId,
    };
  }, [lightPercentage, darkPercentage, gameSessionId]);

  /**
   * Synchronizes local bubbles with server state - SERVER IS AUTHORITATIVE
   */
  const syncWithServer = useCallback(() => {
    if (!serverBubbles || !isActive) return;

    // SERVER IS THE SINGLE SOURCE OF TRUTH
    // Convert server bubbles to local format, excluding recently popped ones
    const serverBubblesLocal: LocalBubble[] = serverBubbles
      .filter((bubble: Bubble) => !recentlyPopped.has(bubble.bubbleId))
      .map((bubble: Bubble) => ({
        ...bubble,
        id: bubble.bubbleId,
      }));

    // Replace local state with server state (with minimal optimistic updates)
    setLocalBubbles(prev => {
      const now = Date.now();
      const optimisticGracePeriod = 500; // Very short grace period for optimistic updates
      
      // Keep only very recent local bubbles that might not be synced to server yet
      const recentOptimisticBubbles = prev.filter(localBubble => 
        !localBubble._id && // Not from server
        (now - localBubble.createdAt) < optimisticGracePeriod && // Very recent
        !recentlyPopped.has(localBubble.bubbleId) && // Not popped
        !serverBubbles.some(s => s.bubbleId === localBubble.bubbleId) // Not already on server
      );
      
      // Combine server bubbles (authoritative) with recent optimistic bubbles
      return [...serverBubblesLocal, ...recentOptimisticBubbles];
    });
  }, [serverBubbles, isActive, recentlyPopped]);

  /**
   * Pops a bubble and removes it from local state
   */
  const popBubble = useCallback(async (bubbleId: string): Promise<void> => {
    // Mark as recently popped to prevent reappearing during sync
    setRecentlyPopped(prev => new Set(prev).add(bubbleId));
    
    // Get current bubble state for balance calculations before removing
    const currentBubbles = localBubbles;
    const lightCount = currentBubbles.filter(b => b.type === 'light').length;
    const darkCount = currentBubbles.filter(b => b.type === 'dark').length;
    const poppedBubble = currentBubbles.find(b => b.bubbleId === bubbleId);
    
    // Optimistically remove from local state
    setLocalBubbles(prev => prev.filter(b => b.bubbleId !== bubbleId));
    
    // Notify server
    try {
      await popBubbleMutation({ bubbleId });
      
      // IMMEDIATELY spawn a new bubble to replace the popped one
      // This ensures continuous action and prevents button clicking all bubbles
      // Try to maintain balance by replacing with opposite type when possible
      let preferredType: 'light' | 'dark' | undefined;
      if (poppedBubble) {
        // If we're unbalanced, prefer the underrepresented type
        if (poppedBubble.type === 'light' && lightCount <= darkCount) {
          preferredType = 'light'; // Keep light if lights are equal or fewer
        } else if (poppedBubble.type === 'dark' && darkCount <= lightCount) {
          preferredType = 'dark'; // Keep dark if darks are equal or fewer
        }
        // Otherwise let createBubble decide based on current balance
      }
      
      const newBubble = createBubble(preferredType);
      
      // Add to local state optimistically
      setLocalBubbles(prev => [...prev, newBubble]);
      
      // Send new bubble to server immediately
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
  }, [popBubbleMutation, syncWithServer, createBubble, createBubbleMutation, localBubbles]);

  /**
   * Updates bubble syncing with server periodically (bubbles are stationary now)
   */
  const updateBubbles = useCallback(() => {
    if (!isActive) return;

    const now = Date.now();
    
    // Sync with server periodically (no position updates needed since bubbles are stationary)
    if (now - lastSyncRef.current > BUBBLE_CONFIG.syncInterval) {
      lastSyncRef.current = now;
      
      // Since bubbles are stationary, we only need to sync new bubbles that haven't been sent to server yet
      const localOnlyBubbles = localBubbles.filter(b => !b._id); // Only sync bubbles that originated locally
      
      if (localOnlyBubbles.length > 0) {
        const updates = localOnlyBubbles.map(b => ({
          bubbleId: b.bubbleId,
          x: b.x,
          y: b.y,
          vx: b.vx, // Will be 0 for stationary bubbles
          vy: b.vy, // Will be 0 for stationary bubbles
        }));
        
        updateBubblesMutation({ bubbles: updates }).catch(console.error);
      }
    }
  }, [isActive, updateBubblesMutation, localBubbles]);

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
    // Increase spawn probability when bubble count is low for more responsive gameplay
    const bubbleRatio = totalServerBubbles / BUBBLE_CONFIG.maxBubbles;
    const spawnProbability = bubbleRatio < 0.5 ? 0.1 : bubbleRatio < 0.75 ? 0.05 : 0.02;
    
    const shouldSpawn = totalServerBubbles < BUBBLE_CONFIG.minBubbles || 
                       (totalServerBubbles < BUBBLE_CONFIG.maxBubbles && Math.random() < spawnProbability);
    
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
   * Initializes the game session - SERVER IS FULLY AUTHORITATIVE
   */
  const initializeGame = useCallback(async () => {
    if (isInitialized || !isActive) return;

    // Wait for server bubbles to be loaded
    if (serverBubbles === undefined) return;

    // If bubbles already exist on server, just sync and mark as initialized
    if (serverBubbles.length > 0) {
      setIsInitialized(true);
      // Force sync with server state immediately
      syncWithServer();
      return;
    }

    // Only attempt initialization once with strict debouncing
    const now = Date.now();
    const timeSinceLastAttempt = now - initializationAttemptRef.current;
    const minInterval = 5000; // 5 second minimum between attempts to prevent race conditions
    
    if (timeSinceLastAttempt < minInterval) {
      return;
    }

    initializationAttemptRef.current = now;

    try {
      // Generate initial bubbles with perfect balance
      const initialBubbles = Array.from({ length: BUBBLE_CONFIG.initialBubbles }, (_, index) => {
        const forceType = index < BUBBLE_CONFIG.initialBubbles / 2 ? 'light' : 'dark';
        const bubble = createBubble(forceType);
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
      
      // Mark as initialized regardless of result to prevent multiple attempts
      setIsInitialized(true);
      console.log(`Initialization result: ${result} bubbles created`);
      
    } catch (error) {
      console.error('Failed to initialize game session:', error);
      // Still mark as initialized to prevent repeated failed attempts
      setIsInitialized(true);
    }
  }, [isInitialized, isActive, gameSessionId, serverBubbles, createBubble, initializeGameMutation, syncWithServer]);

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

