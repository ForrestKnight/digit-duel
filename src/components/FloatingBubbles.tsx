import React, { useCallback, useMemo, useState } from 'react';
import { useBubbles } from '../hooks/useBubbles';

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
        bg: 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(248, 249, 250, 0.8) 70%, rgba(233, 236, 239, 0.7) 100%)',
        border: '#6c757d',
        glow: '0 0 12px rgba(108, 117, 125, 0.4)',
        shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      dark: {
        bg: 'radial-gradient(circle, rgba(40, 42, 54, 0.9) 0%, rgba(68, 71, 90, 0.8) 70%, rgba(98, 114, 164, 0.7) 100%)',
        border: '#6272a4',
        glow: '0 0 12px rgba(98, 114, 164, 0.6)',
        shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
    };

    const colors = themeColors[bubble.type];

    // Create unique animation parameters for each bubble based on its ID
    const bubbleHash = bubble.bubbleId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Generate unique animation duration and delay for each bubble
    const animationDuration = 2 + (bubbleHash % 1000) / 500; // 2s to 4s duration
    const animationDelay = -(bubbleHash % 2000) / 1000; // 0s to -2s delay (negative for immediate start)
    
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
      animation: `floatUp ${animationDuration}s ease-in-out infinite`,
      animationDelay: `${animationDelay}s`,
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

    // Start pop animation
    setPoppingBubbles(prev => new Set(prev).add(bubble.bubbleId));

    // Execute all actions in parallel for immediate response
    try {
      // Pop the bubble in realtime (this will sync across all clients)
      const popPromise = realtimePopBubble(bubble.bubbleId);
      
      // Execute the appropriate action immediately
      const actionPromise = bubble.type === 'light' 
        ? onLightClick()
        : onDarkClick();
      
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
          title={`Click to support ${bubble.type} mode`}
          role="button"
          tabIndex={0}
          aria-label={`${bubble.type} mode bubble - click to add a point`}
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
                bubble.size === 1 ? 'text-xl' :
                bubble.size === 2 ? 'text-2xl' :
                bubble.size === 3 ? 'text-3xl' :
                'text-4xl'
              }`}>
                {bubble.type === 'light' ? '🌅' : '🌌'}
              </span>
              {/* Point value indicator */}
              <span className={`font-mono font-bold mt-1 drop-shadow-md ${
                bubble.size === 1 ? 'text-xs' :
                bubble.size === 2 ? 'text-sm' :
                bubble.size === 3 ? 'text-base' :
                'text-lg'
              } ${
                bubble.type === 'light' 
                  ? 'text-gray-700 opacity-80'
                  : 'text-[#f8f8f2] opacity-85'
              }`}>
                +1
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
        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded font-mono text-sm text-center">
          <p className="font-medium">click bubbles = add points</p>
          <p className="text-xs opacity-75 mt-1">
            🌅 light_mode vs 🌌 dark_mode • real-time sync
          </p>
        </div>
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        {bubbles.length} interactive bubbles available. 
        {bubbles.filter(b => b.type === 'light').length} light mode and{' '}
        {bubbles.filter(b => b.type === 'dark').length} dark mode bubbles ready to click.
      </div>
    </div>
  );
};

export default FloatingBubbles;

