/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172522",
        mint: "#c8f082",
        forest: "#163d35",
        muted: "#6b7771",
        canvas: "#f7f8f5",
      },
      fontFamily: {
        sans: ["Manrope", "Arial", "sans-serif"],
        display: ["Manrope", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
