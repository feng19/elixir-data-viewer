/**
 * Standalone build configuration for producing a single ESM JS file
 * with all dependencies bundled and CSS injected into the JS.
 *
 * Usage:
 *   npm run build:standalone
 *
 * Output:
 *   dist/elixir-data-viewer.js  (single ESM file, ready for Phoenix vendor/)
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
      entry: resolve(__dirname, "src/standalone.ts"),
      formats: ["es"],
      fileName: () => "elixir-data-viewer.js",
    },
    rollupOptions: {
      // Bundle ALL dependencies into the output (no externals)
      external: [],
      output: {
        globals: {},
      },
    },
    // Inline all CSS into JS via the plugin above
    cssCodeSplit: false,
    minify: "esbuild",
  },
});
