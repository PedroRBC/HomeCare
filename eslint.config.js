const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", "web-build/*", ".expo/*", "android/*", "ios/*", "coverage/*", "reports/*"],
  },
  {
    // Config files run in Node
    files: ["*.config.{js,mjs,cjs,ts}", "babel.config.js", "metro.config.js", "scripts/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      "react/display-name": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
]);
