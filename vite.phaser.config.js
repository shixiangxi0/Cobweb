import { defineConfig } from 'vite';

export default defineConfig({
  root: 'clients/phaser',
  base: './',
  resolve: {
    alias: {
      // Allow clients/phaser/main.js to import from games/
      '/games': './games',
    },
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  build: {
    outDir: '../../dist-phaser',
    emptyOutDir: true,
  },
});
