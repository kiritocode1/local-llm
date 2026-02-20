/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/streamdown/dist/**/*.js",
    "./node_modules/@streamdown/code/dist/**/*.js",
    "./node_modules/@streamdown/mermaid/dist/**/*.js",
    "./node_modules/@streamdown/math/dist/**/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
