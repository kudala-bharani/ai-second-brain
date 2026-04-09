/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        surface: {
          900: '#0f0f18',
          800: '#16161f',
          700: '#1c1c28',
          600: '#232333',
          500: '#2a2a3d',
          400: '#33334a',
          300: '#44445a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'brand-gradient':  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'card-gradient':   'linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)',
      },
      boxShadow: {
        'glow':        '0 0 20px rgba(99, 102, 241, 0.25)',
        'glow-lg':     '0 0 40px rgba(99, 102, 241, 0.30)',
        'card':        '0 4px 24px rgba(0, 0, 0, 0.40)',
        'card-hover':  '0 8px 32px rgba(0, 0, 0, 0.55)',
        'inner-brand': 'inset 0 1px 0 rgba(99, 102, 241, 0.20)',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':     'shimmer 1.5s infinite',
        'spin-slow':   'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e2e8f0',
            a: { color: '#818cf8' },
            strong: { color: '#f1f5f9' },
            code: { color: '#a5b4fc' },
          },
        },
      },
    },
  },
  plugins: [],
};
