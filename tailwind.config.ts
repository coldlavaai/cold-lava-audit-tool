import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'cl-bg': '#030305',
        'cl-surface': '#1D1D1F',
        'cl-card': '#111111',
        'cl-border': '#1a1a1a',
        'cl-cyan': '#06B6D4',
        'cl-cyan-light': '#22D3EE',
        'cl-cyan-glow': '#00D4FF',
        'cl-gold': '#C9A962',
        'cl-red': '#dc2626',
        'cl-green': '#22c55e',
        'cl-yellow': '#eab308',
        'cl-text': '#FFFFFF',
        'cl-text-secondary': '#E5E7EB',
        'cl-muted': '#86868B',
      },
    },
  },
  plugins: [],
}
export default config
