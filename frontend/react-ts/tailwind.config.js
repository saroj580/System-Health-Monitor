/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-base':     '#07090f',
        'bg-surface':  '#0d1117',
        'bg-elevated': '#131b29',
        // Accents
        cpu:  '#00d4ff',
        ram:  '#a855f7',
        disk: '#10b981',
        net:  '#f59e0b',
        // Status
        success: '#22c55e',
        danger:  '#f43f5e',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Cascadia Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '16px',
        xl: '20px',
      },
      keyframes: {
        'spin-ring': { to: { transform: 'rotate(360deg)' } },
        'pulse-dot': {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.4', transform: 'scale(0.75)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'gauge-fill': {
          from: { strokeDashoffset: 'var(--gauge-circumference)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'spin-ring':   'spin-ring 0.9s linear infinite',
        'pulse-dot':   'pulse-dot 2s ease infinite',
        'pulse-fast':  'pulse-dot 0.8s ease infinite',
        'fade-in':     'fade-in 0.4s cubic-bezier(0.4,0,0.2,1) both',
        'fade-in-sm':  'fade-in 0.25s cubic-bezier(0.4,0,0.2,1) both',
        'gauge-fill':  'gauge-fill 0.9s cubic-bezier(0.4,0,0.2,1) both',
        shimmer:       'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
