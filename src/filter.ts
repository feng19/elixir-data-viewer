import type { Tree, SyntaxNode } from "@lezer/common";

/**
 * Represents a key-value pair's line range in the source.
 */
export interface KeyRange {
  /** The key name (e.g. "socket", "name") */
  key: string;
  /** 0-indexed first line of the key-value pair */
  startLine: number;
  /** 0-indexed last line of the key-value pair (inclusive) */
  endLine: number;
  /** Nesting depth (1 = direct child of root structure) */
  depth: number;
}

/**
 * Manages the filter state for the viewer — which keys are hidden.
 *
 * Walks the Lezer syntax tree to detect all key-value pair ranges,
 * then hides lines belonging to filtered keys during rendering.
 */
export class FilterState {
  /** Keys to filter out (hide) */
  private filteredKeys: Set<string> = new Set();

  /** All detected key-value ranges from the parsed content */
  private keyRanges: KeyRange[] = [];

  /** Pre-computed set of hidden line indices (rebuilt when filter changes) */
  private hiddenLines: Set<number> = new Set();

  /**
   * Detect all key-value ranges from the syntax tree and source code.
   * Called when content changes via setContent().
   */
  detectKeys(tree: Tree, code: string): void {
    const lineOffsets = buildLineOffsets(code);
    this.keyRanges = [];
    walkForKeys(tree.topNode, code, lineOffsets, this.keyRanges, 0);
    this.rebuildHiddenLines();
  }

  /**
   * Set the keys to filter out (replaces existing filter).
   */
  setKeys(keys: string[]): void {
    this.filteredKeys = new Set(keys);
    this.rebuildHiddenLines();
  }

  /**
   * Add a single key to the filter.
   */
  addKey(key: string): void {
    this.filteredKeys.add(key);
    this.rebuildHiddenLines();
  }

  /**
   * Remove a single key from the filter.
   */
  removeKey(key: string): void {
    this.filteredKeys.delete(key);
    this.rebuildHiddenLines();
  }

  /**
   * Check if a key is currently being filtered.
   */
  hasKey(key: string): boolean {
    return this.filteredKeys.has(key);
  }

  /**
   * Get all currently filtered keys.
   */
  getKeys(): string[] {
    return Array.from(this.filteredKeys);
  }

  /**
   * Get all available keys detected in the content.
   * Returns unique key names sorted alphabetically.
   */
  getAvailableKeys(): string[] {
    const keys = new Set<string>();
    for (const range of this.keyRanges) {
      keys.add(range.key);
    }
    return Array.from(keys).sort();
  }

  /**
   * Clear all filters (show all keys).
   */
  clear(): void {
    this.filteredKeys.clear();
    this.hiddenLines.clear();
  }

  /**
   * Check if a specific line should be hidden due to filtering.
   */
  isLineFiltered(lineIdx: number): boolean {
    return this.hiddenLines.has(lineIdx);
  }

  /**
   * Check if any filter is active.
   */
  isActive(): boolean {
    return this.filteredKeys.size > 0;
  }

  /**
   * Get the total number of filtered keys.
   */
  getFilteredCount(): number {
    return this.filteredKeys.size;
  }

  /**
   * Rebuild the set of hidden line indices based on current filtered keys.
   */
  private rebuildHiddenLines(): void {
    this.hiddenLines.clear();
    if (this.filteredKeys.size === 0) return;

    for (const range of this.keyRanges) {
      if (this.filteredKeys.has(range.key)) {
        for (let line = range.startLine; line <= range.endLine; line++) {
          this.hiddenLines.add(line);
        }
      }
    }
  }
}

// ─── Tree Walking ────────────────────────────────────────────────────────

/**
 * Build a line offset table: lineOffsets[i] = character offset of line i's start.
 */
function buildLineOffsets(code: string): number[] {
  const offsets = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Given a character offset, find the 0-indexed line number.
 */
function offsetToLine(offsets: number[], offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Recursively walk the syntax tree to find all key-value pairs and record
 * their key names and line ranges.
 *
 * Handles:
 * - Keyword-style pairs: `name: "Alice"` (Pair → Keyword + Value)
 * - Arrow-style pairs: `"a" => 1` (Pair → Key + => + Value)
 * - Both in Maps (%{...}), keyword lists ([foo: ...]), and Structs (%S{...})
 */
function walkForKeys(
  node: SyntaxNode,
  code: string,
  lineOffsets: number[],
  ranges: KeyRange[],
  depth: number
): void {
  const name = node.type.name;

  if (name === "Pair") {
    const keyName = extractKeyName(node, code);
    if (keyName !== null) {
      const startLine = offsetToLine(lineOffsets, node.from);
      const endLine = offsetToLine(lineOffsets, node.to - 1);
      ranges.push({
        key: keyName,
        startLine,
        endLine,
        depth,
      });
    }
  }

  // Increase depth when entering container nodes
  const isContainer =
    name === "Map" ||
    name === "List" ||
    name === "Tuple" ||
    name === "MapContent" ||
    name === "Keywords";

  const childDepth = isContainer ? depth + 1 : depth;

  // Walk children
  let child = node.firstChild;
  while (child) {
    walkForKeys(child, code, lineOffsets, ranges, childDepth);
    child = child.nextSibling;
  }
}

/**
 * Extract the key name from a Pair node.
 *
 * For keyword-style (`name: value`):
 *   First child is a `Keyword` node with text like `name:` → returns `"name"`
 *
 * For arrow-style (`key => value`):
 *   First child is the key node (Atom, String, Integer, etc.)
 *   → returns the cleaned text (strips `:` from atoms, `"` from strings)
 */
function extractKeyName(pairNode: SyntaxNode, code: string): string | null {
  const firstChild = pairNode.firstChild;
  if (!firstChild) return null;

  const childName = firstChild.type.name;
  const rawText = code.slice(firstChild.from, firstChild.to);

  if (childName === "Keyword") {
    // Keyword style: `name:` → strip trailing `:` and whitespace
    return rawText.replace(/:\s*$/, "");
  }

  if (childName === "Atom") {
    // Atom key: `:name` → strip leading `:`
    return rawText.replace(/^:/, "");
  }

  if (childName === "String") {
    // String key: `"name"` → strip surrounding quotes
    return rawText.replace(/^"/, "").replace(/"$/, "");
  }

  // For other types (Integer, Boolean, etc.), use raw text
  if (rawText.length > 0) {
    return rawText;
  }

  return null;
}
