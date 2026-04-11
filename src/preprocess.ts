/**
 * Pre-processing for Elixir inspect literals that would be misinterpreted
 * by the lezer-elixir parser as comments.
 *
 * Elixir's `Kernel.inspect/2` renders opaque data types as `#Type<...>`,
 * e.g. `#Reference<0.123.456.789>`, `#PID<0.100.0>`, `#Port<0.6>`.
 * Since `#` starts a line comment in Elixir, the parser consumes
 * everything from `#` to end-of-line as a Comment node, breaking
 * highlighting, structure detection, and inspect.
 *
 * Solution: replace each inspect literal with a same-length Elixir atom
 * (`:___...`) before parsing, so offsets remain 1:1 with the original.
 */

/**
 * A detected Elixir inspect literal in the original source.
 */
export interface InspectLiteral {
  /** Absolute character offset — start */
  from: number;
  /** Absolute character offset — end */
  to: number;
  /** The original text, e.g. `#Reference<0.2930644178.2773483521.184681>` */
  originalText: string;
}

/**
 * Result of pre-processing: the modified code and the list of literals found.
 */
export interface PreprocessResult {
  /** Code with inspect literals replaced by same-length atoms */
  modifiedCode: string;
  /** All inspect literals detected, with their original positions and text */
  inspectLiterals: InspectLiteral[];
}

/**
 * Regex matching Elixir inspect literals:
 * - `#` followed by an uppercase letter
 * - then word characters and dots (module names like `Ecto.Changeset`)
 * - then `<` ... `>` with no `>` or newline inside the angle brackets
 *
 * Examples:
 * - `#Reference<0.2930644178.2773483521.184681>`
 * - `#PID<0.100.0>`
 * - `#Port<0.6>`
 * - `#Function<12.128620087/0 in :erl_eval.expr/5>`
 * - `#Ecto.Changeset<action: nil, ...>`
 */
const INSPECT_LITERAL_RE = /#[A-Z][\w.]*<[^>\n]*>/g;

/**
 * Pre-process Elixir data code to replace inspect literals with same-length
 * atom placeholders. This ensures the lezer-elixir parser doesn't treat
 * `#Type<...>` patterns as line comments.
 *
 * The replacement atom is `:` followed by underscores to match the original
 * length exactly, preserving all character offsets for highlighting and
 * inspect resolution.
 */
export function preprocessInspectLiterals(code: string): PreprocessResult {
  const inspectLiterals: InspectLiteral[] = [];

  const modifiedCode = code.replace(
    INSPECT_LITERAL_RE,
    (match: string, offset: number) => {
      inspectLiterals.push({
        from: offset,
        to: offset + match.length,
        originalText: match,
      });
      // Replace with atom of same length: `:` + underscores
      return ":" + "_".repeat(match.length - 1);
    }
  );

  return { modifiedCode, inspectLiterals };
}
