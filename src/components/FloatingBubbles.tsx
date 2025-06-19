import React, { useCallback, useMemo, useState } from 'react';
import { useBubbles } from '../hooks/useBubbles';

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
 * - Realtime synchronization across all clients
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
  // Generate a unique game session ID for global synchronization
  const gameSessionId = useMemo(() => {
    return `global-game-session`; // Use global session for all players
  }, []);

  // Use the realtime bubbles hook
  const { bubbles, popBubble: realtimePopBubble, bubbleConfig } = useBubbles(
    gameSessionId,
    lightPercentage,
    darkPercentage,
    isActive
  );

  // Local state for click cooldowns and animations
  const [clickCooldowns, setClickCooldowns] = useState<Set<string>>(new Set());
  const [poppingBubbles, setPoppingBubbles] = useState<Set<string>>(new Set());

  // Generate bubble size and visual properties
  const getBubbleStyle = useCallback((bubble: { bubbleId: string; type: 'light' | 'dark'; x: number; y: number; size: number }) => {
    const sizeStyles = {
      1: { size: '80px', opacity: 0.8 }, // small
      2: { size: '110px', opacity: 0.85 }, // medium-small
      3: { size: '140px', opacity: 0.9 }, // medium-large
      4: { size: '170px', opacity: 0.95 }, // large
    };

    const style = sizeStyles[bubble.size as keyof typeof sizeStyles];
    const themeColors: Record<'light' | 'dark', { bg: string; border: string; glow: string; shadow: string }> = {
      light: {
        bg: 'radial-gradient(circle, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.85) 70%, rgba(217, 119, 6, 0.75) 100%)',
        border: '#d97706',
        glow: '0 0 15px rgba(217, 119, 6, 0.8)',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      dark: {
        bg: 'radial-gradient(circle, rgba(147, 51, 234, 0.8) 0%, rgba(126, 34, 206, 0.6) 70%, rgba(107, 33, 168, 0.4) 100%)',
        border: '#9333ea',
        glow: '0 0 15px rgba(147, 51, 234, 0.6)',
        shadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      },
    };

    const colors = themeColors[bubble.type];

    // Simple pulsing animation
    const baseScale = 1 + Math.sin(Date.now() * 0.003 + bubble.bubbleId.charCodeAt(0)) * 0.03;

    return {
      width: style.size,
      height: style.size,
      left: `${bubble.x}%`,
      top: `${bubble.y}%`,
      opacity: style.opacity,
      background: colors.bg,
      borderColor: colors.border,
      boxShadow: `${colors.glow}, ${colors.shadow}, inset 0 0 20px rgba(255, 255, 255, 0.3)`,
      zIndex: bubble.size * 10,
      transform: `scale(${baseScale})`,
    };
  }, []);

  // Handle bubble click with realtime synchronization
  const handleBubbleClick = useCallback(async (bubble: any, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Check click cooldown or if already popping
    if (clickCooldowns.has(bubble.bubbleId) || poppingBubbles.has(bubble.bubbleId)) return;

    // Add cooldown
    setClickCooldowns(prev => new Set(prev).add(bubble.bubbleId));
    setTimeout(() => {
      setClickCooldowns(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.bubbleId);
        return newSet;
      });
    }, 100); // Click cooldown

    // Calculate points based on bubble size (smaller = more points)
    const points = bubbleConfig.pointValues[bubble.size as keyof typeof bubbleConfig.pointValues];

    // Start pop animation
    setPoppingBubbles(prev => new Set(prev).add(bubble.bubbleId));

    // Execute all actions in parallel for immediate response
    try {
      // Pop the bubble in realtime (this will sync across all clients)
      const popPromise = realtimePopBubble(bubble.bubbleId);
      
      // Execute the appropriate action with points immediately
      const actionPromise = bubble.type === 'light' 
        ? onLightClick(points)
        : onDarkClick(points);
      
      // Wait for both to complete
      await Promise.all([popPromise, actionPromise]);
      
    } catch (error) {
      console.error('Bubble click action failed:', error);
      
      // Remove from popping state on error
      setPoppingBubbles(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.bubbleId);
        return newSet;
      });
    }

    // Clean up popping state after a short delay
    setTimeout(() => {
      setPoppingBubbles(prev => {
        const newSet = new Set(prev);
        newSet.delete(bubble.bubbleId);
        return newSet;
      });
    }, 200); // Shorter cleanup delay
  }, [onLightClick, onDarkClick, clickCooldowns, poppingBubbles, realtimePopBubble, bubbleConfig]);

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
          onMouseDown={(e) => e.preventDefault()}
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
                bubble.size === 1 ? 'text-2xl' :
                bubble.size === 2 ? 'text-3xl' :
                bubble.size === 3 ? 'text-4xl' :
                'text-5xl'
              }`}>
                {bubble.type === 'light' ? '☀️' : '🌙'}
              </span>
              {/* Point value indicator */}
              <span className={`font-bold mt-1 drop-shadow-md ${
                bubble.size === 1 ? 'text-sm' :
                bubble.size === 2 ? 'text-base' :
                bubble.size === 3 ? 'text-lg' :
                'text-xl'
              } ${
                bubble.type === 'light' 
                  ? 'text-orange-900 opacity-90'
                  : 'text-white opacity-75'
              }`}>
                +{bubbleConfig.pointValues[bubble.size as keyof typeof bubbleConfig.pointValues]}
              </span>
            </div>
          </div>

          {/* Highlight effect */}
          <div className={`absolute rounded-full pointer-events-none ${
            bubble.size === 1 ? 'top-2 left-2 w-4 h-4' :
            bubble.size === 2 ? 'top-3 left-3 w-5 h-5' :
            bubble.size === 3 ? 'top-4 left-4 w-6 h-6' :
            'top-5 left-5 w-7 h-7'
          } ${
            bubble.type === 'light'
              ? 'bg-white opacity-70 shadow-md'
              : 'bg-white opacity-50'
          }`} />
        </div>
      ))}

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm text-center">
          <p className="font-semibold">Pop bubbles to fight for your theme!</p>
          <p className="text-xs opacity-80">
            ☀ Light bubbles vs 🌙 Dark bubbles • Realtime synchronized across all players
          </p>
        </div>
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        {bubbles.length} bubbles floating. 
        {bubbles.filter(b => b.type === 'light').length} light bubbles and{' '}
        {bubbles.filter(b => b.type === 'dark').length} dark bubbles available.
      </div>
    </div>
  );
};

export default FloatingBubbles;

