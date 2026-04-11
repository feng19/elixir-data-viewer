/**
 * Standalone entry point for Phoenix / vendor usage.
 *
 * Produces an ESM module with a default export of ElixirDataViewer,
 * plus all named exports from the library.  CSS is injected
 * automatically via the vite-plugin-css-injected-by-js plugin.
 *
 * Usage in Phoenix app.js:
 *   import ElixirDataViewer from "../vendor/elixir-data-viewer"
 */

export * from "./index";
export { ElixirDataViewer as default } from "./renderer";
