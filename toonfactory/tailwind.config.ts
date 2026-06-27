import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#11182e",
        panel2: "#161f3a",
        brand: {
          DEFAULT: "#7c5cff",
          soft: "#a78bff",
        },
        accent: "#22d3ee",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#fb7185",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.25), 0 12px 40px -12px rgba(124,92,255,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
