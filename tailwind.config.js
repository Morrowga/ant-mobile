/** Coffee palette — the dashboard's real design tokens, reused verbatim. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#f4f4f4",     // background
        latte: "#d8c7b8",     // accents / secondary surfaces
        "latte-deep": "#bfa287", // latte darkened to ~64% lightness — buttons need more weight
        espresso: "#6c4b36",  // dark surfaces, headers
        ink: "#2b2a2a",       // body text
        copper: "#a8672f",    // sparing accent: links, small highlights
        paper: "#ffffff",
        line: "#e4ddd6",      // hairline borders derived from latte
        faint: "#8a8580",     // muted text on cream
      },
      fontFamily: {
        display: ["SpaceGrotesk_600SemiBold"],
        displaybold: ["SpaceGrotesk_700Bold"],
        sans: ["IBMPlexSans_400Regular"],
        sansmed: ["IBMPlexSans_500Medium"],
        sansbold: ["IBMPlexSans_600SemiBold"],
      },
    },
  },
  plugins: [],
};
