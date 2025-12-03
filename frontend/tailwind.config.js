/** type {import('tailwindcss').Config} */

export default {
    content: [
        "./index.html",
        "./src/**/*.{vue, js, ts, jsx, tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'medical-blue': "#0d47c1",
                'alert-red': "#ed1b24",
                'elena': "#23408e"
            },
            animation: {
                'pulse-fast': 'pulse 2s cubic-bezier(.0.4, 0, 0.6, 1) infinite'
            }
        },
    },
    plugins: [],
}