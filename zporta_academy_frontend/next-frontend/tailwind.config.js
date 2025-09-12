/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/styles/**/*.{js,jsx,ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [
    require('@tailwindcss/aspect-ratio') // you use aspect-* classes
  ],
};
