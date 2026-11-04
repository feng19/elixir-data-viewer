# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The primary user is a developer embedding the viewer; the people who then read the rendered data are a second audience.

- **Phoenix developers** building debug and admin UIs, who show `inspect/2` output (assigns, socket state, configs) in LiveView.
- **Support and ops staff** who read records and payloads inside internal tools. They never edit them.
- **JS developers** rendering Elixir terms from APIs or logs, often without an Elixir background.
- **Docs and blog authors** publishing Elixir data snippets on web pages.
- **Tool integrations**: xtrace and Livebook Kino use it.

## Product Purpose
A read-only web viewer for Elixir data structures. It parses Elixir terms and renders them with syntax highlighting, code folding, line numbers, search, key filtering and copy. Success means an embedder can drop it into a page or LiveView hook and have readers explore large, nested Elixir data quickly, without the data being changed.

## Positioning
- **Data-aware, not just colored.** It parses terms with `lezer-elixir`, so it can fold maps, lists, tuples, keyword lists, bitstrings and multi-line strings. It can hide keys by name (for example secrets) and search the content.
- **Tiny and framework-free.** It is vanilla TypeScript and DOM, ships as a single ESM file (about 55 kB gzipped) and drops into a Phoenix LiveView hook.
- A general code highlighter cannot truthfully claim both together.

## Operating Context
- Delivered as an npm package (`elixir-data-viewer` plus `style.css`), as a standalone single-file ESM build with CSS injected, and via HTML auto-discovery of `.edv-viewer` elements holding `<script type="text/elixir-data">`.
- Typically fed `inspect(data, pretty: true)` output from Elixir.
- Several independent viewer instances can share a page.
- A landing and demo site lives in `landing/` and deploys through GitHub Pages and Cloudflare Pages.

## Capabilities and Constraints
- Supported types: maps, lists, tuples, keyword lists, atoms, strings, integers, floats, booleans, `nil`, charlists, bitstrings, sigils, heredocs, character literals.
- Per-viewer floating toolbar with fold all, unfold all, word wrap, copy, search and filter. Each button can be turned off through options or `data-*` attributes.
- Options include `defaultFoldLevel`, `defaultWordWrap` and `defaultFilterKeys`. Public methods include `setContent`, `getContent`, `getFilteredContent`, `foldAll`, `unfoldAll` and `foldToLevel`.
- **Strictly read-only.** No editing, ever.
- **The public API, `edv-*` CSS classes and `data-*` attributes must stay stable.** Embedders depend on them.
- **Large data must stay fast.** Big `inspect` dumps with thousands of lines must remain responsive.
- Peer dependencies: `lezer-elixir`, `@lezer/common`, `@lezer/highlight`.

## Brand Commitments
- The name is "Elixir Data Viewer", published under the author's GitHub account (feng19).
- No binding visual commitments were stated. The current Tokyo Night look was not confirmed as binding.

## Evidence on Hand
- Working package, README with API documentation, and a landing page with a live demo (`landing/`).
- Named integrations: xtrace and Livebook Kino. No testimonials, usage numbers or benchmarks are on hand, so none should be invented.

## Product Principles
1. **Read, never write.** Every feature serves understanding data, and nothing edits it.
2. **Structure over decoration.** Interactions (fold, filter, search) exploit the data's structure, not just its coloring.
3. **Drop-in and light.** Staying framework-free and small outweighs adding features that need dependencies.
4. **Stable contract.** Embedders' markup, classes and options keep working across releases.
5. **Fast at any size.** Performance on large dumps takes priority over embellishment.

## Accessibility & Inclusion
No product-specific requirement was established. Because the viewer is embedded in other people's apps, keyboard operability of toolbar and fold controls and legible contrast are sensible defaults to confirm later.
