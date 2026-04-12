/**
 * Landing page build configuration.
 *
 * Produces a static site in dist-landing/ that can be deployed to GitHub Pages.
 * All dependencies (lezer-elixir, @lezer/*) are bundled into the output.
 *
 * Usage:
 *   npm run build:landing
 *   npm run dev:landing    # dev server for landing page
 */
import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "landing"),
  build: {
    outDir: resolve(__dirname, "dist-landing"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "landing/index.html"),
    },
    // Bundle everything — no externals
    minify: "esbuild",
  },
  resolve: {
    alias: {
      // Ensure imports from ../src/ resolve correctly
      "@": resolve(__dirname, "src"),
    },
  },
});
