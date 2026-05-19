import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080d',
          900: '#0a0a12',
          850: '#0e0e18',
          800: '#111119',
          700: '#171723',
          600: '#1c1c2b',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,0.25), 0 10px 60px -10px rgba(124,58,237,0.45)',
        'glow-sm': '0 0 30px -8px rgba(124,58,237,0.5)',
        'glow-cyan': '0 0 30px -8px rgba(34,211,238,0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
