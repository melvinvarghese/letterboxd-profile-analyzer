import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        header: "var(--color-header)",
        backdrop: "var(--color-backdrop)",
        poster: "var(--color-poster)",
        surface: "var(--color-surface)",
        raised: "var(--color-raised)",
        line: "var(--color-border)",
        primary: "var(--color-text-primary)",
        body: "var(--color-text-body)",
        secondary: "var(--color-text-secondary)",
        muted: "var(--color-text-muted)",
        subtle: "var(--color-text-subtle)",
        "primary-green": "var(--color-primary-green)",
        "button-green": "var(--color-button-green)",
        "button-hover": "var(--color-button-hover)",
        "button-active": "var(--color-button-active)",
        link: "var(--color-link)",
        "link-hover": "var(--color-link-hover)",
        "error-border": "var(--color-error-border)",
        "error-surface": "var(--color-error-surface)",
        "error-text": "var(--color-error-text)",
        "error-icon": "var(--color-error-icon)",
        "warning-border": "var(--color-warning-border)",
        "warning-surface": "var(--color-warning-surface)",
        "warning-text": "var(--color-warning-text)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
