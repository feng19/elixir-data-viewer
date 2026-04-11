import type { Tree, SyntaxNode } from "@lezer/common";

/**
 * The semantic type of an inspected node.
 */
export type InspectType =
  | "String"
  | "Atom"
  | "Alias"
  | "Integer"
  | "Float"
  | "Boolean"
  | "Nil"
  | "Char"
  | "Charlist"
  | "Sigil"
  | "Keyword"
  | "Pair"
  | "Map"
  | "List"
  | "Tuple"
  | "Bitstring"
  | "Range"
  | "InspectLiteral";

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
  /** The semantic type of the inspected node */
  type: InspectType;
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
  "Alias",
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
        type: parent.type.name as InspectType,
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
      type: name as InspectType,
    };
  }

  // 3. Range expressions (1..10, 1..10//2, 10..1//-2)
  const rangeTarget = findRangeAncestor(node, code);
  if (rangeTarget) return rangeTarget;

  // 4. Bubble-up types (QuotedContent → String)
  if (BUBBLE_UP_TYPES.has(name)) {
    const parent = node.parent;
    if (parent && LEAF_TYPES.has(parent.type.name)) {
      return {
        from: parent.from,
        to: parent.to,
        copyText: code.slice(parent.from, parent.to),
        isStructure: false,
        type: parent.type.name as InspectType,
      };
    }
  }

  // 5. Leaf value types
  if (LEAF_TYPES.has(name)) {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
      type: name as InspectType,
    };
  }

  // 6. Keyword node (pair key like `name:`)
  if (name === "Keyword") {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
      type: "Keyword",
    };
  }

  // 7. Pair node — inspect the whole key-value pair
  if (name === "Pair") {
    return {
      from: node.from,
      to: node.to,
      copyText: code.slice(node.from, node.to),
      isStructure: false,
      type: "Pair",
    };
  }

  return null;
}

/**
 * Check if a BinaryOperator node is a range (has `..` operator child).
 */
function isRangeOperator(node: SyntaxNode, code: string): boolean {
  if (node.type.name !== "BinaryOperator") return false;
  let child = node.firstChild;
  while (child) {
    if (
      child.type.name === "Operator" &&
      code.slice(child.from, child.to) === ".."
    ) {
      return true;
    }
    child = child.nextSibling;
  }
  return false;
}

/**
 * Check if a BinaryOperator node is a step range (has `//` operator and a range child).
 * e.g. `1..10//2` parses as BinaryOperator(BinaryOperator(1..10), //, 2)
 */
function isStepRange(node: SyntaxNode, code: string): boolean {
  if (node.type.name !== "BinaryOperator") return false;
  let hasStepOp = false;
  let hasRangeChild = false;
  let child = node.firstChild;
  while (child) {
    if (
      child.type.name === "Operator" &&
      code.slice(child.from, child.to) === "//"
    ) {
      hasStepOp = true;
    }
    if (isRangeOperator(child, code)) {
      hasRangeChild = true;
    }
    child = child.nextSibling;
  }
  return hasStepOp && hasRangeChild;
}

/**
 * Walk up the tree from `node` to find an ancestor that is a range expression.
 * Returns an InspectTarget for the outermost range (step range if present,
 * otherwise simple range).
 */
function findRangeAncestor(
  node: SyntaxNode,
  code: string
): InspectTarget | null {
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.type.name === "BinaryOperator") {
      // Check step range first (outermost form: 1..10//2)
      if (isStepRange(current, code)) {
        return {
          from: current.from,
          to: current.to,
          copyText: code.slice(current.from, current.to),
          isStructure: false,
          type: "Range",
        };
      }
      // Simple range (1..10) — but check if parent is a step range
      if (isRangeOperator(current, code)) {
        if (current.parent && isStepRange(current.parent, code)) {
          return {
            from: current.parent.from,
            to: current.parent.to,
            copyText: code.slice(current.parent.from, current.parent.to),
            isStructure: false,
            type: "Range",
          };
        }
        return {
          from: current.from,
          to: current.to,
          copyText: code.slice(current.from, current.to),
          isStructure: false,
          type: "Range",
        };
      }
    }
    current = current.parent;
  }
  return null;
}
