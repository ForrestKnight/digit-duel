import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Bubble {
  id: string;
  type: 'light' | 'dark';
  x: number; // percentage
  y: number; // percentage
  size: number; // 1-4 (depth levels)
  vx: number; // velocity x
  vy: number; // velocity y
  createdAt: number;
  depth: number; // z-index for layering
}

interface FloatingBubblesProps {
  onLightClick: () => Promise<void>;
  onDarkClick: () => Promise<void>;
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
  const animationRef = useRef<number>();
  const nextIdRef = useRef(0);

  // Bubble generation configuration
  const BUBBLE_CONFIG = {
    maxBubbles: 25,
    spawnInterval: 800, // ms between spawns
    bubbileLifetime: 15000, // 15 seconds
    baseSpeed: 0.02, // percentage per frame
    sizeVariation: [1, 2, 3, 4], // depth levels
    clickCooldown: 200, // ms between clicks for same user
  };

  // Generate bubble size and visual properties based on depth
  const getBubbleStyle = (bubble: Bubble) => {
    const depthStyles = {
      1: { size: '12px', opacity: 0.3, blur: 3 }, // far background
      2: { size: '18px', opacity: 0.5, blur: 2 }, // mid background  
      3: { size: '28px', opacity: 0.7, blur: 1 }, // near foreground
      4: { size: '40px', opacity: 0.9, blur: 0 }, // foreground
    };

    const style = depthStyles[bubble.size as keyof typeof depthStyles];
    const themeColors = {
      light: {
        bg: 'radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, rgba(245, 158, 11, 0.6) 70%, rgba(217, 119, 6, 0.4) 100%)',
        border: '#fbbf24',
        glow: '0 0 15px rgba(251, 191, 36, 0.6)',
      },
      dark: {
        bg: 'radial-gradient(circle, rgba(147, 51, 234, 0.8) 0%, rgba(126, 34, 206, 0.6) 70%, rgba(107, 33, 168, 0.4) 100%)',
        border: '#9333ea',
        glow: '0 0 15px rgba(147, 51, 234, 0.6)',
      },
    };

    const colors = themeColors[bubble.type];

    return {
      width: style.size,
      height: style.size,
      left: `${bubble.x}%`,
      top: `${bubble.y}%`,
      opacity: style.opacity,
      background: colors.bg,
      borderColor: colors.border,
      boxShadow: `${colors.glow}, inset 0 0 20px rgba(255, 255, 255, 0.3)`,
      filter: style.blur > 0 ? `blur(${style.blur}px)` : 'none',
      zIndex: bubble.depth + 10,
      transform: `scale(${1 + Math.sin(Date.now() * 0.002 + bubble.id.charCodeAt(0)) * 0.1})`, // gentle pulsing
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

    // Check click cooldown
    if (clickCooldowns.has(bubble.id)) return;

    // Add cooldown
    setClickCooldowns(prev => new Set(prev).add(bubble.id));
    setTimeout(() => {
      setClickCooldowns(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.id);
        return newSet;
      });
    }, BUBBLE_CONFIG.clickCooldown);

    // Remove the clicked bubble immediately
    setBubbles(prev => prev.filter(b => b.id !== bubble.id));

    // Execute the appropriate action
    try {
      if (bubble.type === 'light') {
        await onLightClick();
      } else {
        await onDarkClick();
      }
    } catch (error) {
      console.error('Bubble click action failed:', error);
    }
  }, [onLightClick, onDarkClick, clickCooldowns]);

  // Animation loop for bubble movement
  useEffect(() => {
    if (!isActive) return;

    const animate = () => {
      setBubbles(prev => {
        const now = Date.now();
        
        return prev
          .map(bubble => {
            // Update position
            let newX = bubble.x + bubble.vx;
            let newY = bubble.y + bubble.vy;
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
          })
          .filter(bubble => now - bubble.createdAt < BUBBLE_CONFIG.bubbileLifetime); // Remove old bubbles
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

  // Bubble spawning
  useEffect(() => {
    if (!isActive) return;

    const spawnBubble = () => {
      setBubbles(prev => {
        if (prev.length >= BUBBLE_CONFIG.maxBubbles) return prev;
        return [...prev, createBubble()];
      });
    };

    // Initial bubbles
    const initialBubbles = Array.from({ length: 8 }, () => createBubble());
    setBubbles(initialBubbles);

    // Ongoing spawning
    const spawnInterval = setInterval(spawnBubble, BUBBLE_CONFIG.spawnInterval);

    return () => clearInterval(spawnInterval);
  }, [createBubble, isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {bubbles.map(bubble => (
        <div
          key={bubble.id}
          className="absolute rounded-full border-2 cursor-pointer pointer-events-auto
                     transition-transform duration-150 hover:scale-110 active:scale-95
                     select-none"
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
            <span className="text-xs opacity-80">
              {bubble.type === 'light' ? '☀' : '🌙'}
            </span>
          </div>

          {/* Highlight effect */}
          <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full opacity-40 pointer-events-none" />
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

