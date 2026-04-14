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
        sand: "#f6efe4",
        ink: "#1f2937",
        coral: "#ff7a59",
        ocean: "#0f766e",
        wheat: "#e9d8b4",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.12)",
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top right, rgba(255,122,89,0.18), transparent 28%), radial-gradient(circle at left center, rgba(15,118,110,0.18), transparent 26%)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
