import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'cl-dark': '#0a0a0a',
        'cl-darker': '#050505',
        'cl-card': '#111111',
        'cl-border': '#1a1a1a',
        'cl-orange': '#ff6b35',
        'cl-orange-dark': '#e55a2b',
        'cl-red': '#dc2626',
        'cl-green': '#22c55e',
        'cl-yellow': '#eab308',
        'cl-blue': '#3b82f6',
        'cl-gray': '#6b7280',
        'cl-text': '#e5e5e5',
        'cl-muted': '#9ca3af',
      },
    },
  },
  plugins: [],
}
export default config
