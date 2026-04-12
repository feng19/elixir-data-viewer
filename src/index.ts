/**
 * Elixir Data Viewer — A read-only web viewer for Elixir data structures
 * with syntax highlighting, code folding, and line numbers.
 *
 * @example
 * ```ts
 * import { ElixirDataViewer } from "elixir-data-viewer";
 * import "elixir-data-viewer/style.css";
 *
 * const viewer = new ElixirDataViewer(document.getElementById("container")!);
 * viewer.setContent('%{name: "Alice", age: 30}');
 * ```
 */

import "./styles/theme.css";

export { ElixirDataViewer } from "./renderer";
export type { ElixirDataViewerOptions, ToolbarOptions, InspectEvent } from "./renderer";
export { parseElixir } from "./parser";
export { highlight, getLineTokens } from "./highlighter";
export type { HighlightToken } from "./highlighter";
export { detectFoldRegions, buildFoldMap } from "./fold";
export type { FoldRegion } from "./fold";
export { FoldState } from "./state";
export { SearchState } from "./search";
export type { SearchMatch } from "./search";
export { FilterState } from "./filter";
export type { KeyRange } from "./filter";
export { resolveInspectTarget } from "./inspect";
export type { InspectTarget, InspectType } from "./inspect";
export { preprocessInspectLiterals } from "./preprocess";
export type { InspectLiteral, PreprocessResult } from "./preprocess";
