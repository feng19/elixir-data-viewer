import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
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
 * Custom tag highlighter that emits tok-* CSS classes matching
 * the Elixir semantic token types from lezer-elixir's styleTags.
 *
 * Using tagHighlighter instead of classHighlighter gives us precise
 * control: classHighlighter collapses many distinct tags into the
 * same class (e.g. tags.function(tags.variableName) → "tok-variableName",
 * tags.null → "tok-keyword", tags.escape → "tok-string2").
 */
const elixirHighlighter = tagHighlighter([
  // Atoms and keyword keys (:foo, key:)
  { tag: tags.atom, class: "tok-atom" },
  // Module aliases (MyModule)
  { tag: tags.namespace, class: "tok-namespace" },
  // Booleans: true, false
  { tag: tags.bool, class: "tok-bool" },
  // nil
  { tag: tags.null, class: "tok-null" },
  // Integer literals
  { tag: tags.integer, class: "tok-number" },
  // Float literals
  { tag: tags.float, class: "tok-number" },
  // Character literals (?a)
  { tag: tags.character, class: "tok-character" },
  // Variable names (identifiers)
  { tag: tags.variableName, class: "tok-variableName" },
  // Function calls: Call/Identifier, PipeOperator/Right/Identifier
  { tag: tags.function(tags.variableName), class: "tok-function" },
  // Function definitions: def foo, defp bar
  {
    tag: tags.definition(tags.function(tags.variableName)),
    class: "tok-definition",
  },
  // Special identifiers: __MODULE__, __DIR__, etc.
  { tag: tags.special(tags.variableName), class: "tok-special" },
  // Strings and charlists
  { tag: tags.string, class: "tok-string" },
  // Sigils (~r/.../, ~w[...])
  { tag: tags.special(tags.string), class: "tok-string" },
  // Escape sequences (\n, \t, etc.)
  { tag: tags.escape, class: "tok-escape" },
  // Keywords: do, end, fn, def, defmodule, when, not, etc.
  { tag: tags.keyword, class: "tok-keyword" },
  // Operators: +, -, |>, ++, --, etc.
  { tag: tags.operator, class: "tok-operator" },
  // Line comments (#...)
  { tag: tags.lineComment, class: "tok-comment" },
  // Underscored identifiers (_foo) — mapped to tags.comment by lezer-elixir
  { tag: tags.comment, class: "tok-underscore" },
  // Parentheses: (, )
  { tag: tags.paren, class: "tok-punctuation" },
  // Square brackets: [, ]
  { tag: tags.squareBracket, class: "tok-punctuation" },
  // Braces and percent: %, {, }
  { tag: tags.brace, class: "tok-punctuation" },
  // Interpolation braces: #{, }
  { tag: tags.special(tags.brace), class: "tok-punctuation" },
  // Separators: comma, semicolon
  { tag: tags.separator, class: "tok-separator" },
  // Angle brackets: <<, >>
  { tag: tags.angleBracket, class: "tok-angleBracket" },
  // Module attributes: @attr
  { tag: tags.attributeName, class: "tok-attributeName" },
  // Doc strings: @doc, @moduledoc, @typedoc
  { tag: tags.docString, class: "tok-docString" },
]);

/**
 * Walk the Lezer syntax tree and emit highlight tokens using
 * a custom tagHighlighter that maps Elixir tags to tok-* CSS classes.
 */
export function highlight(code: string, tree: Tree): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  highlightTree(tree, elixirHighlighter, (from, to, classes) => {
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
