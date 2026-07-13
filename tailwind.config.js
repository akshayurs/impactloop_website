/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05060A',
        ink2: '#0A0C16',
        ink3: '#11132040',
        aurora: {
          violet: '#7C5CFF',
          indigo: '#4D7CFF',
          blue: '#3BA0FF',
          cyan: '#22D3EE',
          magenta: '#E879F9',
          pink: '#F472B6',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
}
