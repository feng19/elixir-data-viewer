import type { Tree, SyntaxNode } from "@lezer/common";

/**
 * Represents a foldable region in the code.
 */
export interface FoldRegion {
  /** 0-indexed line where the fold starts */
  startLine: number;
  /** 0-indexed line where the fold ends */
  endLine: number;
  /** Character offset in the source where the opening bracket is */
  startOffset: number;
  /** Character offset in the source where the closing bracket is */
  endOffset: number;
  /** The opening bracket text, e.g. "[", "%{", "{" */
  openText: string;
  /** The closing bracket text, e.g. "]", "}", ">>" */
  closeText: string;
  /** Number of direct child items in the structure (e.g. list elements, map pairs). -1 if not applicable. */
  itemCount: number;
}

/** Node types that can be folded, with their bracket pairs */
const FOLDABLE_NODES: Record<string, { open: string; close: string }> = {
  List: { open: "[", close: "]" },
  Tuple: { open: "{", close: "}" },
  Map: { open: "%{", close: "}" },
  Bitstring: { open: "<<", close: ">>" },
  AnonymousFunction: { open: "fn", close: "end" },
  String: { open: '"""', close: '"""' },
  Charlist: { open: "'''", close: "'''" },
};

/** Node types whose direct children should be counted as items */
const COUNTABLE_NODES = new Set(["List", "Tuple", "Map", "MapContent", "Keywords", "Bitstring"]);

/** Node types that are punctuation/delimiters to skip when counting */
const SKIP_NODES = new Set([",", "[", "]", "{", "}", "<<", ">>", "%", "|", "=>", ":"]);

/**
 * Count the number of direct child items in a foldable node.
 * For List/Tuple/Bitstring: counts non-punctuation children.
 * For Map: digs into MapContent → Keywords to count key-value pairs.
 * Returns -1 for non-countable node types.
 */
function countItems(node: SyntaxNode): number {
  const name = node.type.name;
  if (!COUNTABLE_NODES.has(name)) return -1;

  let count = 0;
  let child = node.firstChild;
  while (child) {
    const childName = child.type.name;

    // Skip punctuation/delimiters and operators
    if (SKIP_NODES.has(childName)) {
      child = child.nextSibling;
      continue;
    }

    // Dig into wrapper/container nodes (MapContent, Keywords, Struct)
    if (childName === "MapContent" || childName === "Keywords") {
      return countItems(child);
    }

    // Skip struct name node (e.g. %URI{...} → Struct node)
    if (childName === "Struct") {
      child = child.nextSibling;
      continue;
    }

    count++;
    child = child.nextSibling;
  }

  return count;
}

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
 * Recursively walk the syntax tree to find all foldable regions.
 */
function walkTree(
  node: SyntaxNode,
  code: string,
  lineOffsets: number[],
  regions: FoldRegion[]
): void {
  const config = FOLDABLE_NODES[node.type.name];

  if (config) {
    const startLine = offsetToLine(lineOffsets, node.from);
    const endLine = offsetToLine(lineOffsets, node.to - 1);

    // Only foldable if it spans multiple lines
    if (endLine > startLine) {
      // For Map, the open bracket is "%{" which starts 1 char before "{"
      let openText = config.open;
      let startOffset = node.from;

      // For multi-line strings, detect the actual delimiters
      if (node.type.name === "String" || node.type.name === "Charlist") {
        const slice = code.slice(node.from, Math.min(node.from + 3, node.to));
        if (slice === '"""' || slice === "'''") {
          openText = slice;
        } else {
          // Single-line string delimiter on multiple lines - still foldable
          openText = slice[0] || config.open;
        }
      }

      regions.push({
        startLine,
        endLine,
        startOffset,
        endOffset: node.to,
        openText,
        closeText: config.close,
        itemCount: countItems(node),
      });
    }
  }

  // Walk children
  let child = node.firstChild;
  while (child) {
    walkTree(child, code, lineOffsets, regions);
    child = child.nextSibling;
  }
}

/**
 * Detect all foldable regions in the given Elixir code.
 */
export function detectFoldRegions(
  code: string,
  tree: Tree
): FoldRegion[] {
  const lineOffsets = buildLineOffsets(code);
  const regions: FoldRegion[] = [];

  walkTree(tree.topNode, code, lineOffsets, regions);

  // Sort by startLine, then by startOffset (outer regions first for nesting)
  regions.sort((a, b) => a.startLine - b.startLine || a.startOffset - b.startOffset);

  return regions;
}

/**
 * Build a map from startLine to its FoldRegion for quick lookup.
 */
export function buildFoldMap(regions: FoldRegion[]): Map<number, FoldRegion> {
  const map = new Map<number, FoldRegion>();
  for (const r of regions) {
    // If multiple regions start on the same line, keep the outermost (first encountered)
    if (!map.has(r.startLine)) {
      map.set(r.startLine, r);
    }
  }
  return map;
}
