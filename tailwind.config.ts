import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        indigo: {
          DEFAULT: "#0F1B3D",
          light: "#182B5E",
        },
        gold: {
          DEFAULT: "#E3B23C",
          dark: "#B8871F",
        },
        leaf: "#1FAA6D",
        line: "#D8DCE4",
        paper: "#FBFBFA",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "10px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
