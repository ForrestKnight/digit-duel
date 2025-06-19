import React, { useState, useEffect, useCallback } from 'react';
import { useSecureCounter } from '../hooks/useCounter';
import { BattleControls } from './BattleControls';
import { VictoryScreen } from './VictoryScreen';
import { ThemeIndicator } from './ThemeIndicator';
import { SoundManager } from './SoundManager';

/**
 * Victory thresholds for theme battle
 */
const VICTORY_THRESHOLDS = {
  LIGHT_WINS: 100,  // Light theme wins when counter >= 100
  DARK_WINS: -100,  // Dark theme wins when counter <= -100
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
    isLoading,
    error,
    increment,
    decrement,
    reset,
    refresh,
  } = useSecureCounter();

  const [hasWinner, setHasWinner] = useState<'light' | 'dark' | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [previousValue, setPreviousValue] = useState<number>(0);

  // Calculate theme balance percentage (-100 to +100)
  const counterValue = counter?.value ?? 0;
  const balancePercentage = Math.max(-100, Math.min(100, 
    (counterValue / VICTORY_THRESHOLDS.TOTAL_RANGE) * 100
  ));

  // Calculate split percentages for each side (0-100% each)
  const lightPercentage = Math.max(0, Math.min(100, 50 + balancePercentage / 2));
  const darkPercentage = 100 - lightPercentage;

  // Check for victory conditions
  useEffect(() => {
    if (!counter) return;

    const value = counter.value;
    
    if (value >= VICTORY_THRESHOLDS.LIGHT_WINS && hasWinner !== 'light') {
      setHasWinner('light');
      setShowVictory(true);
    } else if (value <= VICTORY_THRESHOLDS.DARK_WINS && hasWinner !== 'dark') {
      setHasWinner('dark');
      setShowVictory(true);
    } else if (value > VICTORY_THRESHOLDS.DARK_WINS && value < VICTORY_THRESHOLDS.LIGHT_WINS) {
      setHasWinner(null);
    }

    setPreviousValue(value);
  }, [counter?.value, hasWinner]);

  // Handle play again
  const handlePlayAgain = useCallback(async () => {
    try {
      await reset();
      setHasWinner(null);
      setShowVictory(false);
    } catch (error) {
      console.error('Failed to reset game:', error);
    }
  }, [reset]);

  // Enhanced increment for light theme
  const fightForLight = useCallback(async () => {
    try {
      await increment();
    } catch (error) {
      console.error('Failed to fight for light:', error);
    }
  }, [increment]);

  // Enhanced decrement for dark theme
  const fightForDark = useCallback(async () => {
    try {
      await decrement();
    } catch (error) {
      console.error('Failed to fight for dark:', error);
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
      {/* Sound Manager */}
      <SoundManager 
        counterValue={counterValue}
        previousValue={previousValue}
        hasWinner={hasWinner}
      />

      {/* Split Screen Container */}
      <div className="absolute inset-0 flex">
        {/* Light Theme Side */}
        <div
          className="relative transition-all duration-700 ease-out bg-gradient-to-br from-yellow-50 via-white to-blue-50"
          style={{ width: `${lightPercentage}%` }}
        >
          {/* Light Theme Background Effects */}
          <div className="absolute inset-0">
            {/* Animated light rays */}
            <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-yellow-200 to-transparent opacity-30 animate-pulse" />
            <div className="absolute top-0 right-1/4 w-1 h-full bg-gradient-to-b from-blue-200 to-transparent opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Floating light particles */}
            <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-yellow-300 rounded-full animate-bounce opacity-60" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-blue-300 rounded-full animate-bounce opacity-60" style={{ animationDelay: '1.5s' }} />
            <div className="absolute bottom-1/4 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-bounce opacity-80" style={{ animationDelay: '2s' }} />
          </div>

          {/* Light Theme Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4 animate-bounce">☀️</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Light Reigns</h2>
              <p className="text-gray-600">Bringing clarity and brightness</p>
            </div>
            
            <ThemeIndicator
              theme="light"
              percentage={lightPercentage}
              isWinning={balancePercentage > 0}
              className="mb-4"
            />
          </div>
        </div>

        {/* Dark Theme Side */}
        <div
          className="relative transition-all duration-700 ease-out bg-gradient-to-bl from-gray-900 via-purple-900 to-black"
          style={{ width: `${darkPercentage}%` }}
        >
          {/* Dark Theme Background Effects */}
          <div className="absolute inset-0">
            {/* Animated dark energy */}
            <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-purple-500 to-transparent opacity-40 animate-pulse" />
            <div className="absolute top-0 right-1/4 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Floating dark particles */}
            <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce opacity-60" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-indigo-400 rounded-full animate-bounce opacity-60" style={{ animationDelay: '1.5s' }} />
            <div className="absolute bottom-1/4 left-1/2 w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce opacity-80" style={{ animationDelay: '2s' }} />
          </div>

          {/* Dark Theme Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4 animate-bounce">🌙</div>
              <h2 className="text-3xl font-bold text-white mb-2">Dark Dominates</h2>
              <p className="text-gray-300">Embracing mystery and depth</p>
            </div>
            
            <ThemeIndicator
              theme="dark"
              percentage={darkPercentage}
              isWinning={balancePercentage < 0}
              className="mb-4"
            />
          </div>
        </div>
      </div>

      {/* Battle Controls - Fixed at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <BattleControls
          onFightForLight={fightForLight}
          onFightForDark={fightForDark}
          onReset={reset}
          isLoading={isLoading}
          counterValue={counterValue}
          lightPercentage={lightPercentage}
          darkPercentage={darkPercentage}
          error={error}
        />
      </div>

      {/* Dividing Line */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 via-gray-500 to-purple-400 shadow-lg transition-all duration-700 ease-out z-10"
        style={{ 
          left: `${lightPercentage}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(147, 51, 234, 0.3), 0 0 60px rgba(234, 179, 8, 0.3)'
        }}
      >
        {/* Divider effects */}
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-yellow-300 to-purple-300 opacity-50" />
      </div>

      {/* Victory Screen Overlay */}
      {showVictory && (
        <VictoryScreen
          winner={hasWinner!}
          onPlayAgain={handlePlayAgain}
          finalScore={counterValue}
          onClose={() => setShowVictory(false)}
        />
      )}

      {/* Accessibility Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {hasWinner && `${hasWinner === 'light' ? 'Light' : 'Dark'} theme has won the battle!`}
        Current balance: {counterValue > 0 ? 'Light' : counterValue < 0 ? 'Dark' : 'Neutral'} theme leading
      </div>
    </div>
  );
};

export default ThemeBattle;

