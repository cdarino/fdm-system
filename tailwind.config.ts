import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

// We might not be able to use this reliably as we use hex codes.
// So please use the default approach: which is to just directly use the colorMix() 
// css function instead.
const colorMixPlugin = plugin(({ addUtilities }) => {
  const tokens = ["primary", "secondary", "destructive", "success", "muted", "accent"];
  const steps = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90];
  const utils: Record<string, Record<string, string>> = {};

  for (const token of tokens) {
    for (const step of steps) {
      utils[`.bg-${token}-${step}`] = {
        "background-color": `color-mix(in srgb, var(--${token}) ${step}%, white)`,
      };
      utils[`.text-${token}-${step}`] = {
        color: `color-mix(in srgb, var(--${token}) ${step}%, white)`,
      };
      utils[`.border-${token}-${step}`] = {
        "border-color": `color-mix(in srgb, var(--${token}) ${step}%, white)`,
      };
    }
  }

  addUtilities(utils);
});

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        // Legible text/icon colours for the pale accent surfaces — see the
        // note in globals.css for why only the blue one flips with the theme.
        "accent-blue": {
          foreground: "var(--accent-blue-foreground)",
        },
        "accent-gold": {
          foreground: "var(--accent-gold-foreground)",
        },
        // Warm list-row interaction surfaces. See the note in globals.css for
        // why these exist instead of reusing the cool --muted grey.
        row: {
          hover: "var(--row-hover)",
          active: "var(--row-active)",
          accent: "var(--row-accent)",
          "accent-foreground": "var(--row-accent-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate, colorMixPlugin],
} satisfies Config;

