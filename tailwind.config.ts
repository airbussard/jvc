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
        // Midnight-Palette (Primärfarbe - vcockpit.de)
        primary: {
          50: '#e6eef5',
          100: '#ccdcea',
          200: '#99b9d5',
          300: '#6696c0',
          400: '#3373ab',
          500: '#001a3f',
          600: '#001636',
          700: '#00122d',
          800: '#000e24',
          900: '#000a1b',
          950: '#000612',
        },
        // Picton Blue-Palette (Sekundärfarbe - vcockpit.de)
        secondary: {
          50: '#e8f7fd',
          100: '#d1effb',
          200: '#a3dff7',
          300: '#75cff3',
          400: '#47bfef',
          500: '#34bcee',
          600: '#2a9bc6',
          700: '#207a9e',
          800: '#165976',
          900: '#0c384e',
          950: '#061c27',
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
        'glow': '0 0 20px rgba(52, 188, 238, 0.3)',
        'glow-primary': '0 0 20px rgba(0, 26, 63, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'main-gradient': 'linear-gradient(135deg, #000a1b 0%, #001a3f 50%, #0c384e 100%)',
        'main-gradient-light': 'linear-gradient(135deg, #001a3f 0%, #1a5a8f 50%, #34bcee 100%)',
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
