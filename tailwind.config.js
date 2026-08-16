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
        // Complementary hue alongside the warm accent — secondary emphasis
        // (badges, info callouts, alternate chart series) so the whole app
        // isn't monochrome-accent. Same muted, low-saturation "Golden Hour"
        // treatment as the rest of the palette, just shifted to teal/sage.
        highlight: {
          DEFAULT: '#4F7A72',
          hover: '#3D6058',
          soft: '#CBE0DA',
        },
        success: '#6B7A4F',
        danger: '#B84B3D',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
      },
      // Warm-tinted elevation instead of Tailwind's default cool-gray shadow
      // — the dashboard previously had zero shadow usage anywhere (flat
      // borders-only cards), see theme_brand.md.
      boxShadow: {
        soft: '0 1px 3px 0 rgb(46 38 32 / 0.06), 0 1px 2px -1px rgb(46 38 32 / 0.06)',
        medium: '0 4px 16px -2px rgb(46 38 32 / 0.12), 0 2px 6px -2px rgb(46 38 32 / 0.08)',
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
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        kenburns: 'kenburns 18s ease-in-out infinite alternate',
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 7s ease-in-out infinite',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in': 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
