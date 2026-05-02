import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/templates/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg:   { DEFAULT: "var(--bg)", 2: "var(--bg2)", 3: "var(--bg3)" },
        surf: "var(--surf)",
        text: { DEFAULT: "var(--text)", 2: "var(--text2)", 3: "var(--text3)" },
        bdr:  { DEFAULT: "var(--border)", 2: "var(--border2)" },
        gold:    { DEFAULT: "#FF9F0A", dark: "#D4800A" },
        success: "#30D158",
        danger:  "#FF3B30",
        info:    "#0A84FF",
      },
      keyframes: {
        fadeUp:  { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-up":  "fadeUp 0.4s ease both",
        "fade-in":  "fadeIn 0.3s ease both",
        "slide-up": "slideUp 0.35s ease both",
      },
    },
  },
  plugins: [],
};
export default config;
