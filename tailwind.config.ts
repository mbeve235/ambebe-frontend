import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "hsl(var(--bg))",
        primary: "hsl(var(--primary))",
        success: "hsl(var(--success))",
        text: "hsl(var(--text))",
        surface: "hsl(var(--surface))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))"
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      boxShadow: {
        glow: "0 10px 30px -12px rgba(37, 99, 235, 0.35)",
        soft: "0 8px 24px -16px rgba(15, 23, 42, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
