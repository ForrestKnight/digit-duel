import React, { useEffect, useState } from 'react';

interface VictoryScreenProps {
  winner: 'light' | 'dark';
  finalScore: number;
  onPlayAgain: () => Promise<void>;
  onClose: () => void;
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
  onPlayAgain,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
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

  const handlePlayAgain = async () => {
    setIsPlaying(true);
    try {
      await onPlayAgain();
    } finally {
      setIsPlaying(false);
    }
  };

  const isLightWinner = winner === 'light';
  
  const victoryConfig = {
    light: {
      title: 'Light Reigns Supreme!',
      subtitle: '☀️ Brightness has conquered the interface ☀️',
      bgGradient: 'from-yellow-400 via-orange-400 to-yellow-300',
      textColor: 'text-gray-800',
      buttonBg: 'from-yellow-500 to-orange-500',
      buttonHover: 'from-yellow-400 to-orange-400',
      particleColor: 'bg-yellow-300',
      celebration: '🎉',
      message: 'The forces of clarity and brightness have triumphed!',
    },
    dark: {
      title: 'Darkness Has Fallen!',
      subtitle: '🌙 Mystery has claimed the interface 🌙',
      bgGradient: 'from-purple-900 via-indigo-900 to-gray-900',
      textColor: 'text-white',
      buttonBg: 'from-purple-600 to-indigo-700',
      buttonHover: 'from-purple-500 to-indigo-600',
      particleColor: 'bg-purple-400',
      celebration: '🎊',
      message: 'The forces of mystery and depth have prevailed!',
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
          relative max-w-2xl mx-4 p-8 rounded-2xl shadow-2xl
          bg-gradient-to-br ${config.bgGradient}
          animate-slide-up
          border-4 ${isLightWinner ? 'border-yellow-300' : 'border-purple-500'}
        `}
        role="dialog"
        aria-labelledby="victory-title"
        aria-describedby="victory-description"
      >
        {/* Celebration Particles */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className={`
                absolute w-2 h-2 ${config.particleColor} rounded-full
                animate-bounce opacity-70
              `}
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: '2s',
              }}
            />
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
          <div className="mb-6">
            <div className="text-8xl animate-bounce mb-4">
              {config.celebration}
            </div>
            <div className="text-6xl mb-4 animate-pulse">
              {isLightWinner ? '☀️' : '🌙'}
            </div>
          </div>

          {/* Victory Title */}
          <h1 
            id="victory-title"
            className="text-4xl md:text-5xl font-bold mb-4 animate-glow"
          >
            {config.title}
          </h1>

          {/* Victory Subtitle */}
          <p className="text-xl md:text-2xl mb-6 font-semibold">
            {config.subtitle}
          </p>

          {/* Victory Message */}
          <p 
            id="victory-description"
            className="text-lg mb-6 opacity-90"
          >
            {config.message}
          </p>

          {/* Final Score */}
          <div className="mb-8 p-4 rounded-xl bg-black/20 backdrop-blur-sm">
            <div className="text-sm font-medium mb-2">Final Score</div>
            <div className="text-3xl font-bold">
              {finalScore > 0 ? '+' : ''}{finalScore}
            </div>
            <div className="text-sm opacity-75 mt-1">
              {Math.abs(finalScore)} points {isLightWinner ? 'toward light' : 'toward darkness'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Play Again Button */}
            <button
              onClick={handlePlayAgain}
              disabled={isPlaying}
              className={`
                px-8 py-4 rounded-xl font-bold text-lg text-white
                bg-gradient-to-r ${config.buttonBg}
                hover:bg-gradient-to-r hover:${config.buttonHover}
                transform-gpu hover:scale-105 active:scale-95
                transition-all duration-300 ease-out
                focus:outline-none focus:ring-4 focus:ring-white/50
                shadow-lg hover:shadow-xl
                ${isPlaying ? 'cursor-wait opacity-75' : 'cursor-pointer'}
              `}
              aria-label="Start a new battle"
            >
              {isPlaying ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                  <span>Resetting Battle...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Battle Again</span>
                </div>
              )}
            </button>

            {/* Continue Watching Button */}
            <button
              onClick={onClose}
              className={`
                px-6 py-4 rounded-xl font-semibold
                border-2 ${isLightWinner ? 'border-gray-700 text-gray-700 hover:bg-gray-700' : 'border-white text-white hover:bg-white'}
                hover:text-white ${isLightWinner ? '' : 'hover:text-gray-900'}
                transition-all duration-300 ease-out
                transform-gpu hover:scale-105 active:scale-95
                focus:outline-none focus:ring-4 focus:ring-white/50
              `}
              aria-label="Continue watching the battle"
            >
              Continue Watching
            </button>
          </div>

          {/* Victory Stats */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold">Victory Threshold</div>
                <div className="opacity-75">±100 points</div>
              </div>
              <div>
                <div className="font-semibold">Theme Dominance</div>
                <div className="opacity-75">
                  {isLightWinner ? 'Light' : 'Dark'} reigns supreme
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

