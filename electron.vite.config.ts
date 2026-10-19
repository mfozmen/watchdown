import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// externalizeDepsPlugin keeps node deps (chokidar) out of the main/preload bundles.
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
