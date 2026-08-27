/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Two·Four design tokens, ported from the landing prototype.
            // The indigo/stone scales stay available for auth, chat and admin.
            colors: {
                paper: { DEFAULT: "#E7ECE6", 2: "#F3F6F1" },
                ink: { DEFAULT: "#16233B", soft: "#4A5568" },
                guilloche: "#7C6BA8",
                ok: "#2F6B4F",
                bad: "#A33556",
            },
            borderColor: {
                rule: "rgba(22,35,59,.16)",
                "rule-soft": "rgba(22,35,59,.08)",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
                display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
                body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
                mono: ["Inter", "system-ui", "-apple-system", "sans-serif"],
            },
        },
    },
    plugins: [],
}