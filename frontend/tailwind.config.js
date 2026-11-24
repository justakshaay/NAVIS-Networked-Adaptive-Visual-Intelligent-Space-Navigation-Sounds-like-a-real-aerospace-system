/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          950: '#080A0D',
          900: '#0F1217',
          850: '#161B22',
          800: '#21262D',
          700: '#30363D',
          600: '#484F58',
          500: '#6E7681',
          400: '#8B949E',
          300: '#B1BAC4',
          200: '#C9D1D9',
          100: '#E6EDF3',
        },
        ctrl: {
          base: '#080A0D',
          panel: '#0F1217',
          elevated: '#161B22',
          border: '#21262D',
          borderLight: '#30363D',
          text: '#E6EDF3',
          muted: '#8B949E',
          nominal: '#2EA043',
          warning: '#D29922',
          critical: '#F85149',
          accent: '#58A6FF',
          purple: '#BC8CFF',
        },
        mars: {
          base: '#140E0A',
          dust: '#26120B',
          rock: '#8C4318',
          crater: '#0A0503',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
        md: '3px',
        lg: '4px',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
        panel: '0 4px 12px 0 rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
