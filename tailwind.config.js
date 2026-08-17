/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // "Gather" Nightshift palette — see .design/DESIGN.md section 2 for the full
      // rationale and contrast verification. Colors reference CSS variables through
      // the `<alpha-value>` pattern so opacity modifiers (e.g. `bg-lume/14`) work.
      colors: {
        void: 'rgb(var(--void-rgb) / <alpha-value>)',
        canvas: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          2: 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        },
        hairline: {
          DEFAULT: 'rgb(var(--hairline-rgb) / <alpha-value>)',
          2: 'rgb(var(--hairline-2-rgb) / <alpha-value>)',
        },
        edge: 'rgb(var(--edge-rgb) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
          2: 'rgb(var(--text-2-rgb) / <alpha-value>)',
          3: 'rgb(var(--text-3-rgb) / <alpha-value>)',
        },
        lume: {
          DEFAULT: 'rgb(var(--lume-rgb) / <alpha-value>)',
          bright: 'rgb(var(--lume-2-rgb) / <alpha-value>)',
          ink: 'rgb(var(--lume-ink-rgb) / <alpha-value>)',
        },
        jade: 'rgb(var(--jade-rgb) / <alpha-value>)',
        rose: 'rgb(var(--rose-rgb) / <alpha-value>)',
        ice: 'rgb(var(--ice-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '1.0', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['40px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['28px', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '500' }],
        body: ['15px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm': ['13.5px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.3', letterSpacing: '0.04em', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '1.2', fontWeight: '500' }],
        'data-xl': ['32px', { lineHeight: '1.0', fontWeight: '500' }],
        data: ['14px', { lineHeight: '1.2', fontWeight: '400' }],
        'data-sm': ['12px', { lineHeight: '1.2', fontWeight: '400' }],
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        lift1: '0 1px 2px 0 rgb(0 0 0 / 0.55)',
        lift2: '0 8px 24px -6px rgb(0 0 0 / 0.6), 0 2px 6px -2px rgb(0 0 0 / 0.45)',
        lift3: '0 24px 64px -12px rgb(0 0 0 / 0.7), 0 8px 20px -8px rgb(0 0 0 / 0.5)',
        glowSm: '0 0 0 1px rgb(var(--lume-rgb) / 0.28), 0 0 10px -2px rgb(var(--lume-rgb) / 0.32)',
        glow: '0 0 0 1px rgb(var(--lume-rgb) / 0.4), 0 0 22px -4px rgb(var(--lume-rgb) / 0.42)',
        glowLg: '0 0 0 1px rgb(var(--lume-rgb) / 0.5), 0 0 48px -8px rgb(var(--lume-rgb) / 0.5)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bloom: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in': 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        bloom: 'bloom 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
