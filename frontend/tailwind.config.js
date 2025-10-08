/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        beige: {
          light: '#F5F0E8',
          DEFAULT: '#E8DCC4',
          dark: '#D4C4A8',
        },
        gold: {
          light: '#C4A77D',
          DEFAULT: '#A0826D',
          dark: '#8B7355',
        },
      },
    },
  },
  plugins: [],
}
