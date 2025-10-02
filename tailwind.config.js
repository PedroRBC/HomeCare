/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,ts,tsx}", "./src/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        heading: "Inter_700Bold",
        subtitle: "Inter_500Medium",
        body: "Inter_400Regular",
      },
    },
  },
  plugins: [],
};
