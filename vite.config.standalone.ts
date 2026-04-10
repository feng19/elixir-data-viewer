/**
 * Standalone build configuration for producing a single IIFE JS file
 * with all dependencies bundled and CSS injected into the JS.
 *
 * Usage:
 *   npm run build:standalone
 *
 * Output:
 *   dist/elixir-data-viewer.iife.js  (single file, ready for Phoenix vendor/)
 */
import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  plugins: [
    cssInjectedByJsPlugin(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: false, // preserve existing lib build output
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ElixirDataViewer",
      formats: ["iife"],
      fileName: () => "elixir-data-viewer.iife.js",
    },
    rollupOptions: {
      // Bundle ALL dependencies into the output (no externals)
      external: [],
      output: {
        globals: {},
        // Extend the IIFE global rather than replacing window.ElixirDataViewer
        extend: true,
      },
    },
    // Inline all CSS into JS via the plugin above
    cssCodeSplit: false,
    minify: "esbuild",
  },
});
