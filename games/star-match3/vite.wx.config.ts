import { defineConfig } from 'vite';

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
