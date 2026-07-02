import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Conventional electron-vite layout: src/main/index.ts, src/preload/index.ts,
// src/renderer/index.html. externalizeDepsPlugin keeps node deps (chokidar) external
// to the main/preload bundles rather than bundling them.
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // A sandboxed preload (sandbox: true) must be CommonJS; emit .cjs so Node treats
    // it as CJS even though the package is type: module.
    build: {
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {},
});
