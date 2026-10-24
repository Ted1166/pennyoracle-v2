/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        aubergine: {
          DEFAULT: '#12101B',
          950: '#0D0B14',
          900: '#12101B',
          800: '#1A1726',
          700: '#231F33',
          600: '#2E2943',
          500: '#403A59',
        },
        copper: {
          300: '#EDBB91',
          400: '#E3A26D',
          500: '#CC8043',
          600: '#B5652E',
          700: '#8F4D22',
        },
        gold: {
          300: '#D9C48E',
          400: '#C4AB6C',
          500: '#A38A4F',
        },
        verify: {
          300: '#7FE0D2',
          400: '#47C9B8',
          500: '#2FA596',
        },
        cream: '#F1E8DC',
        mist: '#A89FBB',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        ui: ['Sora', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        coin: '0 0 0 1px rgba(227,162,109,0.35), 0 12px 40px -12px rgba(181,101,46,0.55)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -28px rgba(0,0,0,0.8)',
      },
      keyframes: {
        think: {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        think: 'think 1.3s ease-in-out infinite',
        glow: 'glow 2.6s ease-in-out infinite',
        rise: 'rise 0.45s ease-out both',
      },
    },
  },
  plugins: [],
}
