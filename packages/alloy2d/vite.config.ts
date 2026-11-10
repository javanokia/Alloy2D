/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * 引擎库构建：输出 dist/index.js (ESM)，类型声明由 tsc --emitDeclarationOnly 生成
 * 运行时依赖与 React 均外置，由游戏工程统一打包，避免出现多份 pixi.js / react 实例
 */
const externals = ['pixi.js', 'react', 'react-dom', 'zustand', 'stats.js'];

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: (id) => externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
