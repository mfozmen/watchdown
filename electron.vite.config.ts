import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Node deps (chokidar) stay unbundled: electron-builder ships them from package.json's dependencies.
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
