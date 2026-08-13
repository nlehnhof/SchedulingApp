/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // "Gather" brand palette — see theme_brand.md ("Golden Hour") in the project root
      // for the full rationale. These sit alongside Tailwind's stock palette rather than
      // replacing it, so anything not yet migrated still renders (just off-brand).
      colors: {
        background: '#FDF9F4',
        surface: '#FFFDFB',
        border: '#EFE3D2',
        'text-primary': '#2E2620',
        'text-secondary': '#7A6F60',
        accent: {
          DEFAULT: '#C4693A',
          hover: '#A8552C',
          soft: '#E3C9A0',
        },
        success: '#6B7A4F',
        danger: '#B84B3D',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        kenburns: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-18px)' },
        },
      },
      animation: {
        kenburns: 'kenburns 18s ease-in-out infinite alternate',
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
