import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#061127",
        navy: "#0c1f45",
        cyan: "#72ffd2",
        fog: "#9fb2d9",
      },
      boxShadow: {
        panel: "0 12px 45px rgba(3, 12, 31, 0.45)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(114,255,210,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(114,255,210,0.06) 1px, transparent 1px)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-sora)", "sans-serif"],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
