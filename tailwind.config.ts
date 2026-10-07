import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B141A",
        indigo: { DEFAULT: "#075E54", light: "#128C7E" },
        gold: { DEFAULT: "#25D366", dark: "#1DAA57" },
        leaf: "#128C7E",
        line: "#D5E7DC",
        paper: "#F1FAF4",
      },
      fontFamily: {
        display: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Display", "SF Pro Text",
          "Helvetica Neue", "Segoe UI", "Roboto", "Arial", "sans-serif",
        ],
        body: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro Display",
          "Helvetica Neue", "Segoe UI", "Roboto", "Arial", "sans-serif",
        ],
      },
      borderRadius: { pill: "999px" },
    },
  },
  plugins: [],
};
export default config;
