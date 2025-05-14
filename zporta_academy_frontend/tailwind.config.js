/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',            // ← add this line to enable class-based toggling :contentReference[oaicite:0]{index=0}
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './public/index.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
