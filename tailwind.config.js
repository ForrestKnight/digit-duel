/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 0.3s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-in',
        'success-flash': 'success-flash 0.6s ease-in-out',
        'error-flash': 'error-flash 0.6s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'success-flash': {
          '0%': { backgroundColor: 'rgb(34, 197, 94)' },
          '50%': { backgroundColor: 'rgb(22, 163, 74)' },
          '100%': { backgroundColor: 'rgb(34, 197, 94)' },
        },
        'error-flash': {
          '0%': { backgroundColor: 'rgb(239, 68, 68)' },
          '50%': { backgroundColor: 'rgb(220, 38, 38)' },
          '100%': { backgroundColor: 'rgb(239, 68, 68)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}

