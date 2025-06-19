import React from 'react';

interface ThemeIndicatorProps {
  theme: 'light' | 'dark';
  percentage: number;
  isWinning: boolean;
  className?: string;
}

/**
 * Theme indicator component that shows the current dominance level of a theme.
 * 
 * Features:
 * - Visual progress indicator
 * - Winning status display
 * - Themed styling
 * - Accessibility support
 */
export const ThemeIndicator: React.FC<ThemeIndicatorProps> = ({
  theme,
  percentage,
  isWinning,
  className = '',
}) => {
  const isLight = theme === 'light';
  
  const themeConfig = {
    light: {
      bgColor: 'bg-yellow-200',
      fillColor: 'from-yellow-400 to-orange-500',
      textColor: 'text-gray-800',
      borderColor: 'border-yellow-400',
      icon: '☀️',
      label: 'Light Dominance',
    },
    dark: {
      bgColor: 'bg-gray-700',
      fillColor: 'from-purple-600 to-indigo-700',
      textColor: 'text-white',
      borderColor: 'border-purple-500',
      icon: '🌙',
      label: 'Dark Dominance',
    },
  };

  const config = themeConfig[theme];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Theme Label */}
      <div className={`flex items-center justify-center gap-2 ${config.textColor}`}>
        <span className="text-xl">{config.icon}</span>
        <span className="font-semibold">{config.label}</span>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className={`h-4 ${config.bgColor} rounded-full border-2 ${config.borderColor} overflow-hidden`}>
          <div
            className={`h-full bg-gradient-to-r ${config.fillColor} transition-all duration-700 ease-out`}
            style={{ width: `${percentage}%` }}
          >
            {/* Animated shine effect */}
            <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>
        
        {/* Percentage Label */}
        <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold ${config.textColor}`}>
          {percentage.toFixed(1)}%
        </div>
      </div>

      {/* Status Display */}
      <div className={`text-center text-sm ${config.textColor}`}>
        {isWinning ? (
          <div className="flex items-center justify-center gap-1 animate-bounce">
            <span className="text-green-500">⚡</span>
            <span className="font-semibold">Advancing!</span>
          </div>
        ) : (
          <div className="opacity-75">
            {percentage < 40 ? 'Under pressure' : percentage > 60 ? 'Strong position' : 'Holding ground'}
          </div>
        )}
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        {theme} theme at {percentage.toFixed(1)}% dominance, currently {isWinning ? 'winning' : 'defending'}
      </div>
    </div>
  );
};

export default ThemeIndicator;

