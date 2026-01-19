import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary - vcockpit Dunkelblau (überarbeitet für bessere Abstufung)
        primary: {
          50: '#e8f1f8',
          100: '#c5dced',
          200: '#9fc5e1',
          300: '#78add4',
          400: '#5b9bcb',
          500: '#3e89c2',
          600: '#2d6a9a',
          700: '#1e4b72',
          800: '#0f2c4a',
          900: '#001a3f',
          950: '#000a1b',
        },
        // Secondary - vcockpit Cyan
        secondary: {
          50: '#e6f7fb',
          100: '#c0ecf5',
          200: '#96e0ef',
          300: '#6bd4e9',
          400: '#4bcbe4',
          500: '#34bcee',
          600: '#2a9bc6',
          700: '#207a9e',
          800: '#165976',
          900: '#0c384e',
          950: '#061c27',
        },
        // Warme Neutrals (statt kaltem Grau)
        neutral: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(28, 25, 23, 0.05)',
        'sm': '0 1px 3px rgba(28, 25, 23, 0.08), 0 1px 2px rgba(28, 25, 23, 0.04)',
        'md': '0 4px 6px rgba(28, 25, 23, 0.06), 0 2px 4px rgba(28, 25, 23, 0.04)',
        'lg': '0 10px 15px rgba(28, 25, 23, 0.08), 0 4px 6px rgba(28, 25, 23, 0.04)',
        'xl': '0 20px 25px rgba(28, 25, 23, 0.1), 0 8px 10px rgba(28, 25, 23, 0.04)',
        // Legacy - für bestehenden Code
        'glass': '0 1px 3px rgba(28, 25, 23, 0.08), 0 1px 2px rgba(28, 25, 23, 0.04)',
        'glass-sm': '0 1px 2px rgba(28, 25, 23, 0.05)',
        'glass-lg': '0 10px 15px rgba(28, 25, 23, 0.08), 0 4px 6px rgba(28, 25, 23, 0.04)',
        'glow': '0 0 20px rgba(52, 188, 238, 0.2)',
        'glow-primary': '0 0 20px rgba(0, 26, 63, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'main-gradient': 'linear-gradient(135deg, #001a3f 0%, #0f2c4a 50%, #0c384e 100%)',
        'gradient-warm': 'linear-gradient(135deg, #fafaf9 0%, #fef3e2 50%, #fafaf9 100%)',
        'gradient-cool': 'linear-gradient(135deg, #e8f1f8 0%, #e6f7fb 100%)',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '2rem',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out forwards',
        'slide-up': 'slideUp 200ms ease-out forwards',
        'scale-in': 'scaleIn 200ms ease-out forwards',
        'slide-down': 'slideDown 200ms ease-out forwards',
        // Legacy
        'glass-in': 'slideUp 300ms ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
