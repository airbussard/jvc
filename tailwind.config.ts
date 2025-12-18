import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dunkelblau-Palette (Primärfarbe)
        primary: {
          50: '#e8f4fc',
          100: '#d1e9f9',
          200: '#a3d3f3',
          300: '#75bded',
          400: '#47a7e7',
          500: '#1e5a8f',
          600: '#1a4f7d',
          700: '#16446b',
          800: '#123959',
          900: '#0e2e47',
          950: '#0a1f30',
        },
        // Grün-Palette (Sekundärfarbe)
        secondary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Glassmorphism-spezifische Farben
        glass: {
          white: 'rgba(255, 255, 255, 0.15)',
          'white-light': 'rgba(255, 255, 255, 0.25)',
          'white-heavy': 'rgba(255, 255, 255, 0.35)',
          dark: 'rgba(0, 0, 0, 0.15)',
          'dark-light': 'rgba(0, 0, 0, 0.25)',
          'dark-heavy': 'rgba(0, 0, 0, 0.35)',
          border: 'rgba(255, 255, 255, 0.2)',
          'border-light': 'rgba(255, 255, 255, 0.3)',
        },
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.1)',
        'glass-lg': '0 8px 40px 0 rgba(31, 38, 135, 0.25)',
        'glass-inset': 'inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'glow': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-primary': '0 0 20px rgba(30, 90, 143, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'main-gradient': 'linear-gradient(135deg, #0e2e47 0%, #1e5a8f 50%, #064e3b 100%)',
        'main-gradient-light': 'linear-gradient(135deg, #1e5a8f 0%, #3387cf 50%, #10b981 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
export default config
