import type { Config } from 'tailwindcss';
import { tailwindPreset } from './src/styles/tailwind-preset';

export default {
  presets: [tailwindPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
