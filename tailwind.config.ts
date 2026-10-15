import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1E2A44', 2: '#2B3A5C' },
        ok: '#22C55E', bad: '#EF4444', warn: '#F59E0B',
        bg: '#F5F6F8', line: '#E5E7EB', mut: '#6B7280',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
