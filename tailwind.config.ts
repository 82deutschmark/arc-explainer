import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./client/index.html", 
    "./client/src/**/*.{js,jsx,ts,tsx}",
    // Include any other potential templates that might use Tailwind classes
    "./client/**/*.{html,js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        worm: ["Fredoka", "Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },

        worm: {
          bg: "var(--worm-bg)",
          card: "var(--worm-card)",
          border: "var(--worm-border)",
          ink: "var(--worm-ink)",
          muted: "var(--worm-muted)",
          "ink-strong": "var(--worm-ink-strong)",
          track: "var(--worm-track)",
          highlight: "var(--worm-highlight-bg)",
          green: "var(--worm-green)",
          "green-hover": "var(--worm-green-hover)",
          red: "var(--worm-red)",
          "green-ink": "var(--worm-green-ink)",
          blue: "var(--worm-blue)",
          "blue-hover": "var(--worm-blue-hover)",
          orange: "var(--worm-orange)",
          "orange-hover": "var(--worm-orange-hover)",
          "board-bg": "var(--worm-board-bg)",
          "board-frame": "var(--worm-board-frame)",

          "header-bg": "var(--worm-header-bg)",
          "header-accent": "var(--worm-header-accent)",
          "header-link": "var(--worm-header-link)",
          "header-ink": "var(--worm-header-ink)",

          "metric-rating": "var(--worm-metric-rating)",
          "metric-sigma": "var(--worm-metric-sigma)",
          "metric-games": "var(--worm-metric-games)",
          "metric-wins": "var(--worm-metric-wins)",
          "metric-losses": "var(--worm-metric-losses)",
          "metric-ties": "var(--worm-metric-ties)",
          "metric-apples": "var(--worm-metric-apples)",
          "metric-winrate": "var(--worm-metric-winrate)",
          "metric-cost": "var(--worm-metric-cost)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("daisyui")
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake", "emerald", "corporate", "retro", "cyberpunk"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
} satisfies Config;
