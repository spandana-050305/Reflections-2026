/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#FFF6F9', // Very Light Pink  — background
          100: '#FFF0F5', // Pale Rose        — alternate background
          200: '#FFD6E4', // Soft Pink        — card highlight
          300: '#FFB3CB', // Blush Pink       — light accent / focus rings
          400: '#FF5C97', // Rose Pink        — secondary interactive
          500: '#FF0A6C', // Rotaract Pink    — primary
          600: '#E60063', // Dark Pink        — primary hover
          700: '#C70057', // Deep Magenta     — primary active
          800: '#7A5164', // Dusty Rose       — secondary text
          900: '#4B1E33', // Dark Plum        — primary text
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(75 30 51 / 0.04), 0 1px 3px 0 rgb(75 30 51 / 0.06)',
        'card-hover': '0 12px 32px -8px rgb(255 10 108 / 0.20), 0 4px 12px -4px rgb(75 30 51 / 0.08)',
        glow: '0 10px 30px -10px rgb(255 10 108 / 0.42)',
        'glow-lg': '0 20px 50px -12px rgb(255 10 108 / 0.48)',
        'inner-glow': 'inset 0 1px 0 0 rgb(255 255 255 / 0.6)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-20px) translateX(10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
