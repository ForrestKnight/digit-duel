import React, { useState } from 'react';

interface BattleControlsProps {
  onFightForLight: () => Promise<void>;
  onFightForDark: () => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
  counterValue: number;
  lightPercentage: number;
  darkPercentage: number;
  error: string | null;
}

/**
 * Battle controls component with themed buttons for the Light vs Dark theme battle.
 * 
 * Features:
 * - Themed buttons that respond to the current balance
 * - Visual feedback for actions
 * - Accessibility support
 * - Loading and error states
 */
export const BattleControls: React.FC<BattleControlsProps> = ({
  onFightForLight,
  onFightForDark,
  onReset,
  isLoading,
  counterValue,
  lightPercentage,
  darkPercentage,
  error,
}) => {
  const [lastAction, setLastAction] = useState<'light' | 'dark' | 'reset' | null>(null);

  const handleLightAction = async () => {
    console.log('🌟 Light click received at:', new Date().toISOString());
    setLastAction('light');
    try {
      console.log('🌟 Calling onFightForLight...');
      await onFightForLight();
      console.log('🌟 onFightForLight completed');
    } catch (error) {
      console.error('🌟 Light action error:', error);
    } finally {
      setTimeout(() => setLastAction(null), 300);
    }
  };

  const handleDarkAction = async () => {
    console.log('🌙 Dark click received at:', new Date().toISOString());
    setLastAction('dark');
    try {
      console.log('🌙 Calling onFightForDark...');
      await onFightForDark();
      console.log('🌙 onFightForDark completed');
    } catch (error) {
      console.error('🌙 Dark action error:', error);
    } finally {
      setTimeout(() => setLastAction(null), 300);
    }
  };

  const handleReset = async () => {
    setLastAction('reset');
    try {
      await onReset();
    } finally {
      setTimeout(() => setLastAction(null), 300);
    }
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/80 border border-red-600 rounded-lg text-red-200 text-center animate-slide-up">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Battle Stats */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="text-yellow-400 font-bold">☀️ {lightPercentage.toFixed(1)}%</div>
            <div className="text-2xl font-bold text-gray-300">{counterValue}</div>
            <div className="text-purple-400 font-bold">{darkPercentage.toFixed(1)}% 🌙</div>
          </div>
          <div className="text-xs text-gray-400">
            {Math.abs(counterValue) < 50 ? 'Balanced battlefield' : 
             counterValue > 0 ? 'Light forces advancing' : 'Dark forces advancing'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {/* Fight for Light Button */}
          <button
            onClick={handleLightAction}
            disabled={false}
            className={`
              group relative px-8 py-4 rounded-xl font-bold text-lg
              transition-all duration-300 ease-out
              transform-gpu hover:scale-105 active:scale-95
              focus:outline-none focus:ring-4 focus:ring-yellow-400/50
              ${lastAction === 'light' ? 'animate-success-flash' : ''}
              ${isLoading ? 'opacity-75 cursor-wait' : 'cursor-pointer'}
              bg-gradient-to-r from-yellow-400 to-orange-500
              hover:from-yellow-300 hover:to-orange-400
              text-white shadow-lg hover:shadow-xl
              border-2 border-yellow-400
            `}
            aria-label="Fight for light theme - adds 1 to counter"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300 animate-glow" />
            
            {/* Button content */}
            <div className="relative flex items-center gap-3">
              <span className="text-2xl">☀️</span>
              <div className="flex flex-col items-start">
                <span className="text-lg">Fight for Light</span>
                <span className="text-xs opacity-80">+1 to brightness</span>
              </div>
              <span className="text-xl font-bold">+1</span>
            </div>

            {/* Loading indicator */}
            {isLoading && lastAction === 'light' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            disabled={false}
            className={`
              relative px-6 py-4 rounded-xl font-semibold
              transition-all duration-300 ease-out
              transform-gpu hover:scale-105 active:scale-95
              focus:outline-none focus:ring-4 focus:ring-gray-400/50
              ${lastAction === 'reset' ? 'animate-pulse' : ''}
              ${isLoading ? 'opacity-75 cursor-wait' : 'cursor-pointer'}
              bg-gray-600 hover:bg-gray-500
              text-white border-2 border-gray-500
              hover:border-gray-400 shadow-lg
            `}
            aria-label="Reset battle to neutral state"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset</span>
            </div>

            {/* Loading indicator */}
            {isLoading && lastAction === 'reset' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>

          {/* Fight for Dark Button */}
          <button
            onClick={handleDarkAction}
            disabled={false}
            className={`
              group relative px-8 py-4 rounded-xl font-bold text-lg
              transition-all duration-300 ease-out
              transform-gpu hover:scale-105 active:scale-95
              focus:outline-none focus:ring-4 focus:ring-purple-400/50
              ${lastAction === 'dark' ? 'animate-success-flash' : ''}
              ${isLoading ? 'opacity-75 cursor-wait' : 'cursor-pointer'}
              bg-gradient-to-r from-purple-600 to-indigo-700
              hover:from-purple-500 hover:to-indigo-600
              text-white shadow-lg hover:shadow-xl
              border-2 border-purple-500
            `}
            aria-label="Fight for dark theme - subtracts 1 from counter"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 opacity-0 group-hover:opacity-20 transition-opacity duration-300 animate-glow" />
            
            {/* Button content */}
            <div className="relative flex items-center gap-3">
              <span className="text-xl font-bold">-1</span>
              <div className="flex flex-col items-start">
                <span className="text-lg">Fight for Dark</span>
                <span className="text-xs opacity-80">+1 to mystery</span>
              </div>
              <span className="text-2xl">🌙</span>
            </div>

            {/* Loading indicator */}
            {isLoading && lastAction === 'dark' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>
        </div>

        {/* Battle Progress Indicator */}
        <div className="mt-6">
          <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
            {/* Light progress */}
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${lightPercentage}%` }}
            />
            {/* Dark progress */}
            <div
              className="absolute right-0 top-0 h-full bg-gradient-to-l from-purple-600 to-indigo-700 transition-all duration-700 ease-out"
              style={{ width: `${darkPercentage}%` }}
            />
            {/* Center marker */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white transform -translate-x-0.5" />
          </div>
          
          {/* Progress labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Dark Victory (-100)</span>
            <span>Neutral (0)</span>
            <span>Light Victory (+100)</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Join the eternal battle between Light and Dark themes!</p>
          <p>First to reach ±100 claims victory over the interface</p>
        </div>
      </div>
    </div>
  );
};

export default BattleControls;

