/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        parchment: "#f5f5f7",
        ink: {
          DEFAULT: "#1d1d1f",
          muted: "#86868b",
          subtle: "#6e6e73",
          secondary: "#333333"
        },
        primary: {
          DEFAULT: "#0066cc",
          focus: "#0071e3",
          dark: "#2997ff"
        },
        hairline: "#e0e0e0",
        surface: {
          pearl: "#fafafc",
          chip: "rgba(210, 210, 215, 0.64)",
          tile1: "#272729",
          tile2: "#2a2a2c"
        },
        emergency: {
          DEFAULT: "#ff3b30",
          dark: "#d70015",
          light: "#ff453a"
        },
        safe: {
          DEFAULT: "#34c759",
          dark: "#248a3d"
        },
        caution: {
          DEFAULT: "#ff9500",
          dark: "#c97500"
        }
      },
      fontFamily: {
        sans: [
          '"SF Pro Text"',
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif"
        ],
        display: [
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif"
        ]
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
        pill: "9999px"
      },
      boxShadow: {
        apple: "0 4px 24px -1px rgba(0, 0, 0, 0.08)",
        floating: "0 12px 32px -4px rgba(0, 0, 0, 0.12)",
        drawer: "0 -8px 30px rgba(0, 0, 0, 0.08)"
      }
    },
  },
  plugins: [],
}
