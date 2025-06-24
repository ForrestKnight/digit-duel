import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSecureCounter } from '../hooks/useCounter';
import { FloatingBubbles } from './FloatingBubbles';
import { VictoryScreen } from './VictoryScreen';

/**
 * Victory thresholds for theme battle
 */
const VICTORY_THRESHOLDS = {
  LIGHT_WINS: 200,  // Light theme wins when counter >= 200
  DARK_WINS: -200,  // Dark theme wins when counter <= -200
  TOTAL_RANGE: 200, // Total range for percentage calculations
};

/**
 * Main theme battle component that orchestrates the Light vs Dark duel.
 * 
 * Features:
 * - Dynamic split-screen interface that responds to counter value
 * - Real-time theme balance visualization
 * - Victory conditions and celebration screens
 * - Immersive sound effects and animations
 * - Accessibility-compliant design
 */
export const ThemeBattle: React.FC = () => {
  const {
    counter,
    error,
    increment,
    decrement,
    reset,
    refresh,
  } = useSecureCounter();

  // Convex persistent game statistics
  const gameStats = useQuery(api.gameStats.getGameStats);
  const recordVictory = useMutation(api.gameStats.recordVictory);
  
  const [hasWinner, setHasWinner] = useState<'light' | 'dark' | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isProcessingVictory, setIsProcessingVictory] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const victoryProcessedRef = useRef<Set<string>>(new Set());
  
  // Get persistent win counts from Convex (will auto-initialize on first victory)
  const lightWins = gameStats?.lightWins ?? 0;
  const darkWins = gameStats?.darkWins ?? 0;

  // Calculate theme balance percentage (-100 to +100) - OPTIMISTIC
  const counterValue = counter?.value ?? 0;
  const balancePercentage = Math.max(-100, Math.min(100, 
    (counterValue / VICTORY_THRESHOLDS.TOTAL_RANGE) * 100
  ));

  // Calculate split percentages for each side (0-100% each) - OPTIMISTIC
  const lightPercentage = Math.max(0, Math.min(100, 50 + balancePercentage / 2));
  const darkPercentage = 100 - lightPercentage;

  // Handle automatic next battle
  const handleNextBattle = useCallback(async () => {
    try {
      await reset();
      setHasWinner(null);
      setShowVictory(false);
      setCountdown(null);
      setIsProcessingVictory(false);
      // Clear victory cache to allow for new victories
      victoryProcessedRef.current.clear();
    } catch (error) {
      console.error('Failed to start next battle:', error);
    }
  }, [reset]);

  // Start countdown to next battle
  const startCountdown = useCallback(() => {
    setCountdown(10);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          // Time's up - start next battle
          clearInterval(countdownIntervalRef.current!);
          handleNextBattle();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleNextBattle]);

  // Record victory in persistent storage with race condition protection
  const handleVictory = useCallback(async (winner: 'light' | 'dark', currentValue: number) => {
    // Prevent multiple victory processing for the same game state
    const victoryKey = `${winner}-${Math.sign(currentValue)}`;
    
    // Check if we're already processing a victory or have already processed this exact victory
    if (isProcessingVictory || victoryProcessedRef.current.has(victoryKey)) {
      console.log('Victory already being processed or completed:', victoryKey);
      return;
    }
    
    // Mark as processing and add to processed set
    setIsProcessingVictory(true);
    victoryProcessedRef.current.add(victoryKey);
    
    try {
      console.log('Recording victory for:', winner, 'at value:', currentValue);
      await recordVictory({ winner });
      setHasWinner(winner);
      setShowVictory(true);
      startCountdown();
    } catch (error) {
      console.error('Failed to record victory:', error);
      // Still show victory screen even if recording fails
      setHasWinner(winner);
      setShowVictory(true);
      startCountdown();
    } finally {
      // Keep processing flag for a bit to prevent rapid re-triggers
      setTimeout(() => {
        setIsProcessingVictory(false);
      }, 1000);
    }
  }, [recordVictory, startCountdown, isProcessingVictory]);

  // Check for victory conditions with debouncing
  useEffect(() => {
    if (!counter || isProcessingVictory || hasWinner) return;

    const value = counter.value;
    
    if (value >= VICTORY_THRESHOLDS.LIGHT_WINS) {
      handleVictory('light', value);
    } else if (value <= VICTORY_THRESHOLDS.DARK_WINS) {
      handleVictory('dark', value);
    }
  }, [counter?.value, hasWinner, isProcessingVictory]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Enhanced increment for light theme (with points)
const fightForLight = useCallback(async () => {
    try {
      await increment();
    } catch (error) {
      console.error('Failed to fight for light:', error);
    }
  }, [increment]);

  // Enhanced decrement for dark theme (with points)
const fightForDark = useCallback(async () => {
    try {
      await decrement();
    } catch (error) {
      console.error('Failed to fight for dark:', error);
    }
  }, [decrement]);

  // Test function for 10 light clicks
  const testLight10 = useCallback(async () => {
    try {
      // Execute all 10 increments simultaneously
      const promises = Array.from({ length: 10 }, () => increment());
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to perform test light clicks:', error);
    }
  }, [increment]);

  // Test function for 10 dark clicks
  const testDark10 = useCallback(async () => {
    try {
      // Execute all 10 decrements simultaneously
      const promises = Array.from({ length: 10 }, () => decrement());
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to perform test dark clicks:', error);
    }
  }, [decrement]);

  // Loading state
  if (!counter && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-gray-100 to-gray-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-lg font-medium text-gray-600">Preparing the battlefield...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !counter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-red-100 to-red-900">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-800">Battle Connection Lost</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reconnect to Battle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* Split Screen Container */}
      <div className="absolute inset-0 flex">
        {/* Light Theme Side */}
        <div
          className="relative transition-all ease-out bg-gradient-to-br from-gray-50 via-white to-gray-100"
          style={{ width: `${lightPercentage}%` }}
        >
          {/* Light Theme Background Effects */}
          <div className="absolute inset-0">
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }} />
            
            {/* Floating code particles */}
            <div className="absolute top-1/4 left-1/3 text-xs text-gray-400 opacity-60 animate-pulse" style={{ animationDelay: '0.5s' }}>{'{ }'}</div>
            <div className="absolute top-1/2 right-1/4 text-xs text-gray-400 opacity-60 animate-pulse" style={{ animationDelay: '1.5s' }}>{'</>'}</div>
            <div className="absolute bottom-1/4 left-1/2 text-xs text-gray-400 opacity-60 animate-pulse" style={{ animationDelay: '2s' }}>{'[]'}</div>
          </div>

          {/* Light Theme Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">🌅</div>
              <h2 className="text-3xl font-mono font-bold text-gray-800 mb-2">Light Mode</h2>
              <p className="text-gray-600 font-mono text-sm">for those who code in daylight</p>
            </div>
            
            {/* Theme stats */}
            <div className="bg-white/40 backdrop-blur-sm rounded border border-gray-200 p-3 text-center font-mono">
              <div className="text-xs text-gray-500 mb-1">territory</div>
              <div className="text-2xl font-bold text-gray-800">{lightPercentage.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">
                {balancePercentage > 0 ? 'expanding' : 'holding'}
              </div>
            </div>
          </div>
        </div>

        {/* Dark Theme Side - Andromeda */}
        <div
          className="relative transition-all ease-out"
          style={{ 
            width: `${darkPercentage}%`,
            background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d4a 50%, #3a3a5c 100%)'
          }}
        >
          {/* Dark Theme Background Effects */}
          <div className="absolute inset-0">
            {/* Code-like grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `
                linear-gradient(rgba(108,113,196,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(108,113,196,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px'
            }} />
            
            {/* Floating code particles */}
            <div className="absolute top-1/4 left-1/3 text-sm opacity-60 animate-pulse" style={{ animationDelay: '0.5s', color: '#6c71c4' }}>{'( )'}</div>
            <div className="absolute top-1/2 right-1/4 text-sm opacity-60 animate-pulse" style={{ animationDelay: '1.5s', color: '#f92672' }}>{'=>'}</div>
            <div className="absolute bottom-1/4 left-1/2 text-sm opacity-60 animate-pulse" style={{ animationDelay: '2s', color: '#a6e22e' }}>{'/*'}</div>
          </div>

          {/* Dark Theme Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">🌌</div>
              <h2 className="text-3xl font-mono font-bold mb-2" style={{ color: '#f8f8f2' }}>Dark Mode</h2>
              <p className="font-mono text-sm" style={{ color: '#75715e' }}>for the night shift developers</p>
            </div>
            
            {/* Theme stats */}
            <div className="backdrop-blur-sm rounded border p-3 text-center font-mono" style={{ 
              backgroundColor: 'rgba(40, 42, 54, 0.8)',
              borderColor: '#6272a4'
            }}>
              <div className="text-xs mb-1" style={{ color: '#6272a4' }}>territory</div>
              <div className="text-2xl font-bold" style={{ color: '#50fa7b' }}>{darkPercentage.toFixed(1)}%</div>
              <div className="text-xs" style={{ color: '#6272a4' }}>
                {balancePercentage < 0 ? 'expanding' : 'holding'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bubbles System */}
      <FloatingBubbles
        onLightClick={fightForLight}
        onDarkClick={fightForDark}
        isActive={!showVictory}
        lightPercentage={lightPercentage}
        darkPercentage={darkPercentage}
      />

      {/* Dividing Line - OPTIMISTIC */}
      <div
        className="absolute top-0 bottom-0 w-2 bg-gradient-to-b from-yellow-400 via-gray-500 to-purple-400 shadow-lg transition-all ease-out z-10"
        style={{ 
          left: `${lightPercentage}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(147, 51, 234, 0.3), 0 0 60px rgba(234, 179, 8, 0.3)'
        }}
      >
        {/* Divider effects */}
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-yellow-300 to-purple-300 opacity-50" />
        
        {/* Current score indicator */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                     bg-white rounded-full px-3 py-1 text-xs font-bold text-gray-800 shadow-lg"
        >
          {counterValue}
        </div>
      </div>

      {/* Victory Screen Overlay */}
      {showVictory && hasWinner && (
        <VictoryScreen
          winner={hasWinner}
          finalScore={counterValue}
          onClose={() => setShowVictory(false)}
          lightWins={lightWins}
          darkWins={darkWins}
          countdown={countdown}
        />
      )}

      {/* Score Display */}
      <div className="absolute top-4 left-4 z-20 bg-black/80 backdrop-blur-sm rounded border border-gray-600 p-4 text-white font-mono">
        <div className="text-xs opacity-75 mb-3 text-center">// battle_stats</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>🌅</span>
              <span className="text-gray-300 text-sm">light_wins</span>
            </span>
            <span className="font-bold text-lg">{lightWins}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>🌌</span>
              <span className="text-gray-300 text-sm">dark_wins</span>
            </span>
            <span className="font-bold text-lg">{darkWins}</span>
          </div>
        </div>
        {countdown && (
          <div className="mt-3 pt-3 border-t border-gray-600 text-center">
            <div className="text-xs opacity-75 mb-1">next_battle_in</div>
            <div className="font-bold text-xl">{countdown}s</div>
          </div>
        )}
      </div>

      {/* Test Controls Panel */}
      <div className="absolute top-4 right-4 z-20 bg-black/80 backdrop-blur-sm rounded border border-gray-600 p-4 text-white font-mono">
        <div className="text-xs opacity-75 mb-3 text-center">// debug_controls</div>
        <div className="space-y-2">
          <button
            onClick={testLight10}
            className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white font-mono rounded border border-gray-500 transition-colors text-xs"
            title="Add 10 points for Light mode (testing)"
          >
            🌅 light += 10
          </button>
          <button
            onClick={testDark10}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-mono rounded border border-gray-500 transition-colors text-xs"
            title="Add 10 points for Dark mode (testing)"
          >
            🌌 dark += 10
          </button>
        </div>
        <div className="text-xs opacity-60 mt-2 text-center">dev_mode_only</div>
      </div>

      {/* Accessibility Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {hasWinner && `${hasWinner === 'light' ? 'Light' : 'Dark'} theme has won the battle!`}
        Current balance: {counterValue > 0 ? 'Light' : counterValue < 0 ? 'Dark' : 'Neutral'} theme leading
      </div>
    </div>
  );
};

export default ThemeBattle;

