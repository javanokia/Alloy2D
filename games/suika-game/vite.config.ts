import { defaultClientConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve:
    command === 'serve'
      ? { conditions: ['@alloy2d/source', ...defaultClientConditions] }
      : undefined,
  define: {
    __PLATFORM__: JSON.stringify(process.env.CROSS_PLATFORM || 'web'),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
}));
