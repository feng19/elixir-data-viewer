import { parser } from "lezer-elixir";
import type { Tree } from "@lezer/common";

/**
 * Parse an Elixir data string into a Lezer syntax tree.
 */
export function parseElixir(code: string): Tree {
  return parser.parse(code);
}
