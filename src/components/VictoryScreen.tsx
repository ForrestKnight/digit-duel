import React, { useEffect, useState } from 'react';

interface VictoryScreenProps {
  winner: 'light' | 'dark' | null;
  finalScore: number;
  onClose: () => void;
  lightWins: number;
  darkWins: number;
  countdown: number | null;
}

/**
 * Victory screen component that displays celebration animations and options.
 * 
 * Features:
 * - Themed victory celebrations based on winner
 * - Particle effects and animations
 * - Final score display
 * - Play again functionality
 * - Accessibility support
 */
export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  winner,
  finalScore,
  onClose,
  lightWins,
  darkWins,
  countdown,
}) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  // Generate celebration particles
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, [winner]);


  // Handle null/undefined winner gracefully
  if (!winner) {
    return null; // Don't render anything if winner is not determined yet
  }
  
  const isLightWinner = winner === 'light';
  
  const victoryConfig = {
    light: {
      title: 'Light Mode Wins',
      subtitle: '🌅 another victory for the day shift',
      bgGradient: 'from-gray-50 via-white to-gray-100',
      textColor: 'text-gray-800',
      buttonBg: 'from-gray-500 to-gray-600',
      buttonHover: 'from-gray-400 to-gray-500',
      particleColor: 'bg-gray-300',
      celebration: '☕',
      message: 'guess those morning coffee coding sessions paid off',
    },
    dark: {
      title: 'Dark Mode Wins',
      subtitle: '🌌 the night shift strikes again',
      bgGradient: 'from-[#1e1e2e] via-[#2d2d4a] to-[#3a3a5c]',
      textColor: 'text-[#f8f8f2]',
      buttonBg: 'from-[#6272a4] to-[#44475a]',
      buttonHover: 'from-[#50fa7b] to-[#6272a4]',
      particleColor: 'bg-[#6c71c4]',
      celebration: '🍕',
      message: 'another late night coding session well spent',
    },
  };

  const config = victoryConfig[winner];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Victory Modal */}
      <div
        className={`
          relative max-w-2xl mx-4 p-8 rounded-lg shadow-2xl
          ${isLightWinner 
            ? 'bg-gradient-to-br from-gray-50 via-white to-gray-100 border border-gray-300'
            : 'border border-[#6272a4]'
          }
          animate-slide-up font-mono
        `}
        style={{
          backgroundColor: isLightWinner ? undefined : '#282a36',
        }}
        role="dialog"
        aria-labelledby="victory-title"
        aria-describedby="victory-description"
      >
        {/* Code Particles */}
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          {particles.slice(0, 15).map((particle) => (
            <div
              key={particle.id}
              className={`
                absolute text-xs opacity-30 animate-pulse
                ${isLightWinner ? 'text-gray-400' : 'text-[#6272a4]'}
              `}
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: '3s',
              }}
            >
              {['{ }', '( )', '[ ]', '=>', '/*', '*/', '&&', '||'][particle.id % 8]}
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`
            absolute top-4 right-4 p-2 rounded-full
            ${config.textColor} hover:bg-black/10
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-white/50
          `}
          aria-label="Close victory screen"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Victory Content */}
        <div className={`text-center ${config.textColor} relative z-10`}>
          {/* Victory Animation */}
          <div className="mb-8">
            <div className="text-6xl mb-4">
              {config.celebration}
            </div>
            <div className="text-4xl mb-2">
              {isLightWinner ? '🌅' : '🌌'}
            </div>
          </div>

          {/* Victory Title */}
          <h1 
            id="victory-title"
            className="text-3xl md:text-4xl font-bold mb-3"
          >
            {config.title}
          </h1>

          {/* Victory Subtitle */}
          <p className="text-base md:text-lg mb-2 opacity-80">
            {config.subtitle}
          </p>

          {/* Victory Message */}
          <p 
            id="victory-description"
            className="text-sm mb-6 opacity-70 italic"
          >
            {config.message}
          </p>

          {/* Final Score */}
          <div className={`mb-6 p-4 rounded border ${
            isLightWinner 
              ? 'bg-white/50 border-gray-300' 
              : 'bg-[#44475a]/50 border-[#6272a4]'
          }`}>
            <div className="text-xs opacity-75 mb-2">final_score</div>
            <div className="text-2xl font-bold">
              {finalScore > 0 ? '+' : ''}{finalScore}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {Math.abs(finalScore)} commits to {isLightWinner ? 'light_mode' : 'dark_mode'}
            </div>
          </div>

          {/* Battle Score */}
          <div className={`mb-6 p-4 rounded border ${
            isLightWinner 
              ? 'bg-white/50 border-gray-300' 
              : 'bg-[#44475a]/50 border-[#6272a4]'
          }`}>
            <div className="text-xs opacity-75 mb-3">// battle_stats</div>
            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-lg mb-1">🌅</div>
                <div className={`text-xl font-bold ${
                  isLightWinner ? 'text-gray-800' : 'text-[#f8f8f2]'
                }`}>{lightWins}</div>
                <div className="text-xs opacity-60">light_wins</div>
              </div>
              <div className="text-center">
                <div className="text-lg mb-1">🌌</div>
                <div className={`text-xl font-bold ${
                  isLightWinner ? 'text-gray-800' : 'text-[#50fa7b]'
                }`}>{darkWins}</div>
                <div className="text-xs opacity-60">dark_wins</div>
              </div>
            </div>
          </div>

          {/* Next Battle Countdown */}
          {countdown !== null && (
            <div className={`mb-6 p-4 rounded border text-center ${
              isLightWinner 
                ? 'bg-gray-100/80 border-gray-400' 
                : 'bg-[#282a36]/80 border-[#6272a4]'
            }`}>
              <div className="text-xs opacity-75 mb-2">// next_battle_in</div>
              <div className="text-4xl font-bold mb-1 font-mono">{countdown}</div>
              <div className="text-xs opacity-60">seconds</div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded border font-mono text-sm
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${
                  isLightWinner
                    ? 'border-gray-400 text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
                    : 'border-[#6272a4] text-[#f8f8f2] hover:bg-[#44475a] focus:ring-[#6272a4]'
                }
              `}
              aria-label="Continue watching the battle"
            >
              continue_watching()
            </button>
          </div>

          {/* Victory Stats */}
          <div className={`mt-6 pt-4 border-t ${
            isLightWinner ? 'border-gray-300' : 'border-[#6272a4]'
          }`}>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="opacity-75">threshold:</div>
                <div className="font-mono">±200</div>
              </div>
              <div>
                <div className="opacity-75">winner:</div>
                <div className="font-mono">
                  {isLightWinner ? 'light_mode' : 'dark_mode'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accessibility Enhancement */}
        <div className="sr-only" aria-live="assertive">
          {winner === 'light' ? 'Light' : 'Dark'} theme has won the battle with a final score of {finalScore}!
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen;

