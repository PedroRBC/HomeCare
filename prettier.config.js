module.exports = {
  printWidth: 100,
  tabWidth: 2,
  singleQuote: false,
  bracketSameLine: true,
  trailingComma: "all",

  plugins: [require.resolve("prettier-plugin-tailwindcss")],
  tailwindAttributes: ["className"],
};
