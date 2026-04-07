import { highlightTree } from "@lezer/highlight";
import { classHighlighter } from "@lezer/highlight";
import type { Tree } from "@lezer/common";

/**
 * A highlighted token span with positional info and CSS classes.
 */
export interface HighlightToken {
  from: number;
  to: number;
  classes: string;
}

/**
 * Walk the Lezer syntax tree and emit highlight tokens using
 * the built-in classHighlighter which maps tags to "tok-*" CSS classes.
 */
export function highlight(code: string, tree: Tree): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  highlightTree(tree, classHighlighter, (from, to, classes) => {
    tokens.push({ from, to, classes });
  });

  return tokens;
}

/**
 * Given a line's start/end offsets within the full code, extract the
 * tokens that overlap this line and adjust their offsets to be line-relative.
 */
export function getLineTokens(
  tokens: HighlightToken[],
  lineStart: number,
  lineEnd: number
): HighlightToken[] {
  const result: HighlightToken[] = [];

  for (const tok of tokens) {
    if (tok.to <= lineStart || tok.from >= lineEnd) continue;

    result.push({
      from: Math.max(tok.from, lineStart) - lineStart,
      to: Math.min(tok.to, lineEnd) - lineStart,
      classes: tok.classes,
    });
  }

  return result;
}
