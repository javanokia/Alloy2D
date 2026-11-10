import { defaultClientConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 开发态直接引用引擎源码 (支持 HMR)；构建时使用引擎 dist 产物，与发布形态一致
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
