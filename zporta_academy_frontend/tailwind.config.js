module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      cursor: {
        nwse: 'nwse-resize', // This customizes and allows 'cursor-nwse' to be used
      },
      // Extend other properties as required here
      minHeight: {
        '200': '200px', // Setting a minimum height
      },
      maxHeight: {
        '300': '300px', // Setting a maximum height
      },
      minWidth: {
        '120': '120px', // Setting a minimum width for elements
      }
    },
  },
  variants: {
    extend: {
      backgroundColor: ['hover', 'focus', 'active'], // Extending responsive states
      borderColor: ['focus', 'active'],
      textColor: ['hover', 'focus', 'active'],
      ringWidth: ['focus', 'active'],
      ringColor: ['focus', 'active'],
    },
  },
  plugins: [],
}