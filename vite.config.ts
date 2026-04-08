import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ElixirDataViewer",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      // Externalize peer dependencies
      external: [
        "lezer-elixir",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
      ],
      output: {
        globals: {
          "lezer-elixir": "lezerElixir",
          "@lezer/common": "lezerCommon",
          "@lezer/highlight": "lezerHighlight",
          "@lezer/lr": "lezerLr",
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "style.css";
          return assetInfo.name ?? "asset";
        },
      },
    },
  },
});
