/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2E50',
          blue: '#0A2E50',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          blue: '#3B82F6',
        },
        accent: {
          red: '#FF6B6B',
        },
        neutral: {
          dark: '#333333',
        },
        data: {
          teal: '#5EEAD2',
          'purple-teal': '#B9A9E9',
          purple: '#A78BFA',
          yellow: '#FDE047',
          green: '#4ADE80',
          'light-blue': '#93C5FD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
        montserrat: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['1rem', { lineHeight: '1.5' }],
        'lg': ['1.125rem', { lineHeight: '1.4' }],
        'xl': ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
      },
    },
  },
  plugins: [],
}
