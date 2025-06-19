import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Bubble {
  id: string;
  type: 'light' | 'dark';
  x: number; // percentage
  y: number; // percentage
  size: number; // 1-4 (size levels)
  vx: number; // velocity x
  vy: number; // velocity y
  createdAt: number;
  depth: number; // z-index for layering
  isPopping?: boolean; // for pop animation
}

interface FloatingBubblesProps {
  onLightClick: (points: number) => Promise<void>;
  onDarkClick: (points: number) => Promise<void>;
  isActive: boolean;
  lightPercentage: number;
  darkPercentage: number;
}

/**
 * Floating bubbles system for the Light vs Dark battle.
 * 
 * Features:
 * - Natural rate limiting through spatial distribution
 * - Strategic depth with layered bubbles
 * - Smooth floating animations
 * - Dynamic bubble generation based on battle state
 */
export const FloatingBubbles: React.FC<FloatingBubblesProps> = ({
  onLightClick,
  onDarkClick,
  isActive,
  lightPercentage,
  darkPercentage,
}) => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [clickCooldowns, setClickCooldowns] = useState<Set<string>>(new Set());
  const [poppingBubbles, setPoppingBubbles] = useState<Set<string>>(new Set());
  const animationRef = useRef<number>();
  const nextIdRef = useRef(0);
  const lastFrameTime = useRef<number>(0);

  // Bubble generation configuration
  const BUBBLE_CONFIG = {
    maxBubbles: 40,
    minBubbles: 30, // Always maintain at least 30 bubbles
    initialBubbles: 40,
    spawnInterval: 600, // ms between spawns (faster to maintain count)
    baseSpeed: 0.04, // percentage per frame (increased for smoother movement)
    sizeVariation: [1, 2, 3, 4], // size levels (bigger overall)
    clickCooldown: 100, // ms between clicks for same user
    // Point values: smaller bubbles = more points
    pointValues: { 1: 4, 2: 3, 3: 2, 4: 1 }, // size 1 = 4 points, size 4 = 1 point
  };

  // Generate bubble size and visual properties
  const getBubbleStyle = (bubble: Bubble) => {
    const sizeStyles = {
      1: { size: '80px', opacity: 0.8 }, // small (2x: 40px -> 80px)
      2: { size: '110px', opacity: 0.85 }, // medium-small (2x: 55px -> 110px)
      3: { size: '140px', opacity: 0.9 }, // medium-large (2x: 70px -> 140px)
      4: { size: '170px', opacity: 0.95 }, // large (2x: 85px -> 170px)
    };

    const style = sizeStyles[bubble.size as keyof typeof sizeStyles];
    const themeColors = {
      light: {
        bg: 'radial-gradient(circle, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.85) 70%, rgba(217, 119, 6, 0.75) 100%)',
        border: '#d97706', // Darker orange border for better contrast
        glow: '0 0 15px rgba(217, 119, 6, 0.8)',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.3)', // Add shadow for contrast
      },
      dark: {
        bg: 'radial-gradient(circle, rgba(147, 51, 234, 0.8) 0%, rgba(126, 34, 206, 0.6) 70%, rgba(107, 33, 168, 0.4) 100%)',
        border: '#9333ea',
        glow: '0 0 15px rgba(147, 51, 234, 0.6)',
        shadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      },
    };

    const colors = themeColors[bubble.type];

    // Simple pulsing animation (no pop animation here)
    const baseScale = 1 + Math.sin(Date.now() * 0.003 + bubble.id.charCodeAt(0)) * 0.03;

    return {
      width: style.size,
      height: style.size,
      left: `${bubble.x}%`,
      top: `${bubble.y}%`,
      opacity: style.opacity,
      background: colors.bg,
      borderColor: colors.border,
      boxShadow: `${colors.glow}, ${colors.shadow}, inset 0 0 20px rgba(255, 255, 255, 0.3)`,
      zIndex: bubble.size * 10, // Larger bubbles appear on top
      transform: `scale(${baseScale})`, // just subtle pulsing
    };
  };

  // Create a new bubble
  const createBubble = useCallback((): Bubble => {
    const now = Date.now();
    const size = BUBBLE_CONFIG.sizeVariation[Math.floor(Math.random() * BUBBLE_CONFIG.sizeVariation.length)];
    
    // Determine type based on current battle state
    let type: 'light' | 'dark';
    if (lightPercentage > 70) {
      type = Math.random() < 0.7 ? 'light' : 'dark'; // More light bubbles when light is winning
    } else if (darkPercentage > 70) {
      type = Math.random() < 0.7 ? 'dark' : 'light'; // More dark bubbles when dark is winning
    } else {
      type = Math.random() < 0.5 ? 'light' : 'dark'; // Balanced
    }

    return {
      id: `bubble-${nextIdRef.current++}-${now}`,
      type,
      x: Math.random() * 90 + 5, // 5% to 95%
      y: Math.random() * 80 + 10, // 10% to 90%
      size,
      vx: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
      vy: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
      createdAt: now,
      depth: size, // Higher size = higher depth (closer to user)
    };
  }, [lightPercentage, darkPercentage]);

  // Handle bubble click
  const handleBubbleClick = useCallback(async (bubble: Bubble, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Check click cooldown or if already popping
    if (clickCooldowns.has(bubble.id) || poppingBubbles.has(bubble.id)) return;

    // Add cooldown
    setClickCooldowns(prev => new Set(prev).add(bubble.id));
    setTimeout(() => {
      setClickCooldowns(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.id);
        return newSet;
      });
    }, BUBBLE_CONFIG.clickCooldown);

    // Calculate points based on bubble size (smaller = more points)
    const points = BUBBLE_CONFIG.pointValues[bubble.size as keyof typeof BUBBLE_CONFIG.pointValues];

    // Start pop animation and remove bubble immediately
    setPoppingBubbles(prev => new Set(prev).add(bubble.id));
    setBubbles(prev => prev.filter(b => b.id !== bubble.id));

    // Execute the appropriate action with ALL points at once
    try {
      if (bubble.type === 'light') {
        // Call with all points at once for immediate optimistic update
        await onLightClick(points);
      } else {
        await onDarkClick(points);
      }
    } catch (error) {
      console.error('Bubble click action failed:', error);
    }

    // Clean up popping state after particle animation
    setTimeout(() => {
      setPoppingBubbles(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.id);
        return newSet;
      });
    }, 400); // Just for particle cleanup
  }, [onLightClick, onDarkClick, clickCooldowns, poppingBubbles]);

  // Animation loop for bubble movement
  useEffect(() => {
    if (!isActive) return;

    const animate = (currentTime: number) => {
      // Calculate delta time for smooth movement regardless of FPS
      const deltaTime = lastFrameTime.current ? (currentTime - lastFrameTime.current) / 16.67 : 1; // Normalize to 60fps
      lastFrameTime.current = currentTime;
      
      setBubbles(prev => {
        const now = Date.now();
        
        return prev
          .map(bubble => {
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
          // Remove age-based filtering - bubbles only removed when clicked
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  // Initialize bubbles once when component mounts
  useEffect(() => {
    if (!isActive) return;

    // Only set initial bubbles if we don't have any
    setBubbles(prev => {
      if (prev.length === 0) {
        return Array.from({ length: BUBBLE_CONFIG.initialBubbles }, () => createBubble());
      }
      return prev;
    });
  }, [isActive]); // Remove createBubble dependency

  // Separate effect for ongoing bubble spawning
  useEffect(() => {
    if (!isActive) return;

    const spawnBubble = () => {
      setBubbles(prev => {
        // Don't spawn if we're at max, but always try to maintain minimum
        if (prev.length >= BUBBLE_CONFIG.maxBubbles && prev.length >= BUBBLE_CONFIG.minBubbles) {
          return prev;
        }
        
        // Force spawn if below minimum (even if at max)
        const shouldSpawn = prev.length < BUBBLE_CONFIG.minBubbles || 
                           (prev.length < BUBBLE_CONFIG.maxBubbles);
        
        if (!shouldSpawn) return prev;
        
        // Create bubble inline to avoid dependency issues
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

        const newBubble = {
          id: `bubble-${nextIdRef.current++}-${now}`,
          type,
          x: Math.random() * 90 + 5,
          y: Math.random() * 80 + 10,
          size,
          vx: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
          vy: (Math.random() - 0.5) * BUBBLE_CONFIG.baseSpeed,
          createdAt: now,
          depth: size,
        };
        
        return [...prev, newBubble];
      });
    };

    // Ongoing spawning
    const spawnInterval = setInterval(spawnBubble, BUBBLE_CONFIG.spawnInterval);

    return () => clearInterval(spawnInterval);
  }, [isActive, lightPercentage, darkPercentage]); // Only depend on these stable values

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {bubbles.map(bubble => (
        <div
          key={bubble.id}
          className="absolute rounded-full border-3 cursor-pointer pointer-events-auto
                     transition-transform duration-200 hover:scale-105 active:scale-90
                     select-none shadow-lg"
          style={getBubbleStyle(bubble)}
          onClick={(e) => handleBubbleClick(bubble, e)}
          onMouseDown={(e) => e.preventDefault()} // Prevent text selection
          title={`Click to fight for ${bubble.type} theme!`}
          role="button"
          tabIndex={0}
          aria-label={`${bubble.type} theme bubble - click to support ${bubble.type} side`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBubbleClick(bubble, e as any);
            }
          }}
        >
          {/* Bubble content */}
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none">
            <div className="flex flex-col items-center">
              <span className={`opacity-90 drop-shadow-lg ${
                bubble.size === 1 ? 'text-2xl' : // size 1: text-2xl (24px)
                bubble.size === 2 ? 'text-3xl' : // size 2: text-3xl (30px) 
                bubble.size === 3 ? 'text-4xl' : // size 3: text-4xl (36px)
                'text-5xl'                       // size 4: text-5xl (48px)
              }`}>
                {bubble.type === 'light' ? '☀️' : '🌙'}
              </span>
              {/* Point value indicator with better contrast */}
              <span className={`font-bold mt-1 drop-shadow-md ${
                bubble.size === 1 ? 'text-sm' :   // size 1: text-sm (14px)
                bubble.size === 2 ? 'text-base' : // size 2: text-base (16px)
                bubble.size === 3 ? 'text-lg' :   // size 3: text-lg (18px)
                'text-xl'                         // size 4: text-xl (20px)
              } ${
                bubble.type === 'light' 
                  ? 'text-orange-900 opacity-90' // Dark text on light bubbles
                  : 'text-white opacity-75'      // Light text on dark bubbles
              }`}>
                +{BUBBLE_CONFIG.pointValues[bubble.size as keyof typeof BUBBLE_CONFIG.pointValues]}
              </span>
            </div>
          </div>

          {/* Highlight effect with better visibility - scaled with bubble size */}
          <div className={`absolute rounded-full pointer-events-none ${
            bubble.size === 1 ? 'top-2 left-2 w-4 h-4' :   // size 1: 16px highlight
            bubble.size === 2 ? 'top-3 left-3 w-5 h-5' :   // size 2: 20px highlight
            bubble.size === 3 ? 'top-4 left-4 w-6 h-6' :   // size 3: 24px highlight
            'top-5 left-5 w-7 h-7'                         // size 4: 28px highlight
          } ${
            bubble.type === 'light'
              ? 'bg-white opacity-70 shadow-md' // More visible on light bubbles
              : 'bg-white opacity-50'           // Standard for dark bubbles
          }`} />
          
        </div>
      ))}

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm text-center">
          <p className="font-semibold">Pop bubbles to fight for your theme!</p>
          <p className="text-xs opacity-80">
            ☀ Light bubbles vs 🌙 Dark bubbles
          </p>
        </div>
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        {bubbles.length} bubbles floating. 
        {bubbles.filter(b => b.type === 'light').length} light bubbles and {' '}
        {bubbles.filter(b => b.type === 'dark').length} dark bubbles available.
      </div>
    </div>
  );
};

export default FloatingBubbles;

