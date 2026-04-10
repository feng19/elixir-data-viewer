import type { Tree, SyntaxNode } from "@lezer/common";

/**
 * Represents a resolved inspect target — the range to highlight and copy.
 */
export interface InspectTarget {
  /** Absolute character offset — start in source code */
  from: number;
  /** Absolute character offset — end in source code */
  to: number;
  /** The text to copy when clicked */
  copyText: string;
  /** Whether this is a structural node that may span multiple lines */
  isStructure: boolean;
}

/**
 * Structural node types whose brackets trigger whole-structure inspection.
 */
const STRUCTURAL_TYPES = new Set(["Map", "List", "Tuple", "Bitstring"]);

/**
 * Bracket token names that, when hovered, should highlight their parent structure.
 */
const BRACKET_TOKENS = new Set(["{", "}", "[", "]", "<<", ">>"]);

/**
 * Leaf value node types that are directly inspectable.
 */
const LEAF_TYPES = new Set([
  "String",
  "Atom",
  "Integer",
  "Float",
  "Boolean",
  "Nil",
  "Char",
  "Charlist",
  "Sigil",
]);

/**
 * Node types whose content should bubble up to the parent for inspection.
 * e.g. QuotedContent inside String → inspect the whole String.
 */
const BUBBLE_UP_TYPES = new Set(["QuotedContent"]);

/**
 * Resolve what should be inspected (highlighted + copyable) at a given offset.
 *
 * Logic:
 * 1. Bracket tokens (`{`, `}`, `[`, `]`, `<<`, `>>`) whose parent is a
 *    structural node → inspect the whole structure
 * 2. Direct structural nodes (e.g. `%` resolves to `Map`) → inspect whole structure
 * 3. Leaf values (`String`, `Atom`, `Integer`, etc.) → inspect the leaf
 * 4. Inner content nodes (`QuotedContent`) → bubble up to parent leaf
 * 5. `Keyword` nodes (pair keys like `name:`) → inspect the keyword
 * 6. Otherwise → null (no inspection target)
 */
export function resolveInspectTarget(
  tree: Tree,
  code: string,
  offset: number
): InspectTarget | null {
  if (offset < 0 || offset >= code.length) return null;

  const node = tree.resolveInner(offset, 1);
  if (!node) return null;

  return classifyNode(node, code);
}

/**
 * Classify a node and return the appropriate InspectTarget.
 */
function classifyNode(node: SyntaxNode, code: string): InspectTarget | null {
  const name = node.type.name;

  // 1. Bracket tokens → inspect parent structure
  if (BRACKET_TOKENS.has(name)) {
    const parent = node.parent;
    if (parent && STRUCTURAL_TYPES.has(parent.type.name)) {
      return {
        from: parent.from,
        to: parent.to,
        copyText: code.slice(parent.from, parent.to),
        isStructure: true,
      };
    }
  }

  // 2. Direct structural node (e.g. `%` at offset 0 resolves to `Map`)
  if (STRUCTURAL_TYPES.has(name)) {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: true,
    };
  }

  // 3. Bubble-up types (QuotedContent → String)
  if (BUBBLE_UP_TYPES.has(name)) {
    const parent = node.parent;
    if (parent && LEAF_TYPES.has(parent.type.name)) {
      return {
        from: parent.from,
        to: parent.to,
        copyText: code.slice(parent.from, parent.to),
        isStructure: false,
      };
    }
  }

  // 4. Leaf value types
  if (LEAF_TYPES.has(name)) {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
    };
  }

  // 5. Keyword node (pair key like `name:`)
  if (name === "Keyword") {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
    };
  }

  // 6. Pair node — inspect the whole key-value pair
  if (name === "Pair") {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
    };
  }

  return null;
}
