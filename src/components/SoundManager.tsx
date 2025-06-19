import React, { useEffect, useRef, useState } from 'react';

interface SoundManagerProps {
  counterValue: number;
  previousValue: number;
  hasWinner: 'light' | 'dark' | null;
}

/**
 * Sound manager component that provides audio feedback for the theme battle.
 * 
 * Features:
 * - Action sound effects
 * - Victory celebrations
 * - Ambient theme-based audio
 * - Volume control
 * - Accessibility considerations
 */
export const SoundManager: React.FC<SoundManagerProps> = ({
  counterValue,
  previousValue,
  hasWinner,
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const lastActionRef = useRef<number>(0);

  // Create audio context and oscillators for procedural sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context on first user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    return () => document.removeEventListener('click', initAudio);
  }, []);

  // Play sound effect using Web Audio API
  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!isEnabled || !audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  };

  // Play light theme sound (brighter, higher frequencies)
  const playLightSound = () => {
    playTone(523.25, 0.2, 'sine'); // C5
    setTimeout(() => playTone(659.25, 0.15, 'sine'), 100); // E5
  };

  // Play dark theme sound (deeper, lower frequencies)
  const playDarkSound = () => {
    playTone(220, 0.3, 'sawtooth'); // A3
    setTimeout(() => playTone(174.61, 0.2, 'triangle'), 150); // F3
  };

  // Play victory fanfare
  const playVictorySound = (winner: 'light' | 'dark') => {
    if (winner === 'light') {
      // Light victory: ascending bright tones
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.5, 'sine'), i * 200);
      });
    } else {
      // Dark victory: mysterious chord progression
      const notes = [220, 261.63, 311.13, 415.3]; // A3, C4, Eb4, Ab4
      notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.6, 'triangle'), i * 250);
      });
    }
  };

  // Play reset sound
  const playResetSound = () => {
    playTone(440, 0.1, 'square'); // A4
    setTimeout(() => playTone(440, 0.1, 'square'), 200);
  };

  // Handle counter value changes
  useEffect(() => {
    if (counterValue === previousValue) return;

    const now = Date.now();
    if (now - lastActionRef.current < 100) return; // Debounce rapid changes
    lastActionRef.current = now;

    if (counterValue > previousValue) {
      playLightSound();
    } else if (counterValue < previousValue) {
      playDarkSound();
    } else if (counterValue === 0 && previousValue !== 0) {
      playResetSound();
    }
  }, [counterValue, previousValue, isEnabled]);

  // Handle victory
  useEffect(() => {
    if (hasWinner) {
      playVictorySound(hasWinner);
    }
  }, [hasWinner, isEnabled]);

  return (
    <div className="fixed top-4 right-4 z-30">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-600 p-3 space-y-2">
        {/* Sound Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${isEnabled 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
              }
              focus:outline-none focus:ring-2 focus:ring-white/50
            `}
            aria-label={`${isEnabled ? 'Disable' : 'Enable'} sound effects`}
            title={`${isEnabled ? 'Disable' : 'Enable'} sound effects`}
          >
            {isEnabled ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 6l-4 4H5a1 1 0 00-1 1v2a1 1 0 001 1h3l4 4v-12z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          <span className="text-xs text-gray-300 font-medium">
            {isEnabled ? 'Audio On' : 'Audio Off'}
          </span>
        </div>

        {/* Volume Control */}
        {isEnabled && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              aria-label="Audio volume control"
            />
            <div className="text-xs text-gray-400 text-center">
              {Math.round(volume * 100)}%
            </div>
          </div>
        )}

        {/* Sound Legend */}
        {isEnabled && (
          <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-600">
            <div className="flex items-center gap-1">
              <span>☀️</span>
              <span>Light: Bright tones</span>
            </div>
            <div className="flex items-center gap-1">
              <span>🌙</span>
              <span>Dark: Deep tones</span>
            </div>
          </div>
        )}
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        Audio feedback is {isEnabled ? 'enabled' : 'disabled'}.
        {isEnabled && `Volume is set to ${Math.round(volume * 100)} percent.`}
      </div>
    </div>
  );
};

export default SoundManager;

