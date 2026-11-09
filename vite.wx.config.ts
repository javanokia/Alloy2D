import { defineConfig } from 'vite';

/**
 * 微信小游戏专用构建配置 (对应文章 7.2 节：单独维护构建配置，输出小游戏单文件 IIFE 产物)
 */
export default defineConfig({
  define: {
    __PLATFORM__: JSON.stringify('wx'),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-wx',
    emptyOutDir: true,
    target: 'es2019',
    lib: {
      entry: 'src/wx-entry.ts',
      name: 'HybridMiniGameEngine',
      formats: ['iife'],
      fileName: () => 'engine-bundle.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
