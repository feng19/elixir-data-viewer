# Elixir Data Viewer

A read-only web viewer for Elixir data structures with syntax highlighting, code folding, line numbers, and a Tokyo Night theme.

Built with vanilla TypeScript + DOM — no CodeMirror, no React — powered by [`lezer-elixir`](https://github.com/livebook-dev/lezer-elixir) for accurate parsing.

## Features

- **Syntax Highlighting** — Accurate Elixir syntax coloring via `lezer-elixir` parser, matching Tokyo Night theme
- **Code Folding** — Collapse/expand maps, lists, tuples, keyword lists, bitstrings, and multi-line strings
- **Line Numbers** — Gutter with line numbers and fold indicators
- **Floating Toolbar** — Per-viewer toolbar (appears on hover) with:
  - ⊟ Fold All
  - ⊞ Unfold All
  - ↩ Word Wrap toggle
  - ⎘ Copy to clipboard
  - ⧩ Filter by key
- **Key Filtering** — Hide specific key-value pairs by key name (e.g. filter out `socket`, `secret_key_base`)
- **Multiple Viewers** — Support multiple independent viewer instances on the same page
- **Configurable Toolbar** — Show/hide individual toolbar buttons via options or HTML `data-*` attributes
- **Word Wrap** — Toggle word wrap for long lines
- **Zero Dependencies** — Only peer dependencies on `lezer-elixir` and `@lezer/common`/`@lezer/highlight`

## Supported Elixir Types

Maps (`%{}`), Lists (`[]`), Tuples (`{}`), Keyword Lists, Atoms (`:ok`), Strings (`"..."`), Integers, Floats, Booleans, `nil`, Charlists, Bitstrings (`<<>>`), Sigils, Heredoc strings, Character literals (`?A`)

## Installation

```bash
npm install elixir-data-viewer
```

## Quick Start

### As an npm Package

```typescript
import { ElixirDataViewer } from "elixir-data-viewer";
import "elixir-data-viewer/style.css";

const container = document.getElementById("viewer")!;
const viewer = new ElixirDataViewer(container);
viewer.setContent(`%{name: "Alice", age: 30, roles: [:admin, :user]}`);
```

### With HTML Inline Data

Add `.edv-viewer` elements with `<script type="text/elixir-data">` blocks:

```html
<div class="edv-viewer">
  <script type="text/elixir-data">
%{
  name: "Alice",
  age: 30,
  roles: [:admin, :user]
}
  </script>
</div>

<script type="module">
  import { ElixirDataViewer } from "elixir-data-viewer";
  import "elixir-data-viewer/style.css";

  document.querySelectorAll(".edv-viewer").forEach((el) => {
    const script = el.querySelector('script[type="text/elixir-data"]');
    if (!script) return;
    const data = script.textContent?.trim() ?? "";
    script.remove();
    const viewer = new ElixirDataViewer(el);
    viewer.setContent(data);
  });
</script>
```

### Standalone / Phoenix (Single ESM File)

Build a single JS file with all dependencies and CSS bundled in:

```bash
npm run build:standalone
```

This produces `dist/elixir-data-viewer.js` (~55 kB gzipped) — a single ESM file that:
- Bundles all dependencies (`lezer-elixir`, `@lezer/common`, `@lezer/highlight`)
- Injects CSS automatically via `<style>` tag (no separate CSS file needed)
- Exports `ElixirDataViewer` as the default export, plus all named exports

#### Phoenix Integration

1. Copy the built file into your Phoenix project:

```bash
cp dist/elixir-data-viewer.js your_phoenix_app/assets/vendor/
```

2. Import it in your `assets/js/app.js`:

```javascript
import ElixirDataViewer from "../vendor/elixir-data-viewer"
```

3. Create a LiveView Hook:

```javascript
let Hooks = {};

Hooks.ElixirDataViewer = {
  mounted() {
    const viewer = new ElixirDataViewer(this.el);
    viewer.setContent(this.el.dataset.content || this.el.innerText);
    this.viewer = viewer;

    // Optional: handle LiveView updates
    this.handleEvent("update-viewer", ({ content }) => {
      this.viewer.setContent(content);
    });
  },
  updated() {
    this.viewer.setContent(this.el.dataset.content || this.el.innerText);
  },
};

// Pass hooks to LiveSocket
let liveSocket = new LiveSocket("/live", Socket, {
  hooks: Hooks,
  // ...
});
```

4. Use in your LiveView template:

```heex
<div id="data-viewer" phx-hook="ElixirDataViewer" data-content={inspect(@data, pretty: true)}>
</div>
```

## API Reference

### `ElixirDataViewer`

The main viewer class.

```typescript
const viewer = new ElixirDataViewer(container: HTMLElement, options?: ElixirDataViewerOptions);
```

#### Constructor Options

```typescript
interface ElixirDataViewerOptions {
  toolbar?: {
    foldAll?: boolean;    // Show "Fold All" button (default: true)
    unfoldAll?: boolean;  // Show "Unfold All" button (default: true)
    wordWrap?: boolean;   // Show "Word Wrap" toggle (default: true)
    copy?: boolean;       // Show "Copy" button (default: true)
    search?: boolean;     // Show "Search" button (default: true)
    filter?: boolean;     // Show "Filter" button (default: true)
  };
  /** Default fold level — regions deeper than this are auto-folded on setContent().
   *  E.g. 3 = show first 3 levels expanded, fold level 4+.
   *  0 or undefined = no auto-folding (all expanded). */
  defaultFoldLevel?: number;
  /** Whether word wrap is enabled by default. Default: false */
  defaultWordWrap?: boolean;
  /** Keys to filter out by default when setContent() is called */
  defaultFilterKeys?: string[];
}
```

**Examples:**

```typescript
// All toolbar buttons visible (default)
new ElixirDataViewer(container);

// Hide the copy button
new ElixirDataViewer(container, { toolbar: { copy: false } });

// No toolbar at all
new ElixirDataViewer(container, {
  toolbar: { foldAll: false, unfoldAll: false, wordWrap: false, copy: false, search: false, filter: false }
});

// Auto-fold: show only top 3 levels, fold level 4+
new ElixirDataViewer(container, { defaultFoldLevel: 3 });

// Enable word wrap by default
new ElixirDataViewer(container, { defaultWordWrap: true });

// Filter out specific keys by default
new ElixirDataViewer(container, { defaultFilterKeys: ["socket", "secret_key_base"] });
```

#### HTML Data Attributes

When using auto-discovery, toolbar buttons and fold level can be configured via `data-*` attributes:

```html
<!-- Hide copy and fold-all buttons -->
<div class="edv-viewer" data-toolbar-copy="false" data-toolbar-fold-all="false">
  <script type="text/elixir-data">...</script>
</div>

<!-- Auto-fold: show only top 3 levels -->
<div class="edv-viewer" data-fold-level="3">
  <script type="text/elixir-data">...</script>
</div>

<!-- Filter out specific keys by default -->
<div class="edv-viewer" data-filter-keys="socket,secret_key_base">
  <script type="text/elixir-data">...</script>
</div>
```

Available attributes: `data-toolbar-fold-all`, `data-toolbar-unfold-all`, `data-toolbar-word-wrap`, `data-toolbar-copy`, `data-toolbar-search`, `data-toolbar-filter`, `data-fold-level`, `data-filter-keys`

#### Methods

| Method | Description |
|--------|-------------|
| `setContent(code: string): void` | Set the Elixir data content and render |
| `getContent(): string` | Get the raw Elixir data string |
| `foldAll(): void` | Collapse all foldable regions |
| `unfoldAll(): void` | Expand all folded regions |
| `foldToLevel(level: number): void` | Fold regions deeper than `level` (1 = top-level). `foldToLevel(3)` shows levels 1–3, folds 4+. `foldToLevel(0)` unfolds all. |
| `toggleWordWrap(): void` | Toggle word wrap mode |
| `isWordWrap(): boolean` | Get current word wrap state |
| `copyContent(): Promise<void>` | Copy raw content to clipboard |
| `onRender(callback: () => void): void` | Set a callback after each render |
| `onInspect(callback: ((event: InspectEvent) => void) \| null): void` | Set a callback when a value is clicked (see below) |
| `setFilterKeys(keys: string[]): void` | Set keys to filter out (replaces existing). Re-renders. |
| `addFilterKey(key: string): void` | Add a single key to filter. Re-renders. |
| `removeFilterKey(key: string): void` | Remove a single key from filter. Re-renders. |
| `getFilterKeys(): string[]` | Get currently filtered key names |
| `getAvailableKeys(): string[]` | Get all key names detected in current content |
| `clearFilter(): void` | Remove all key filters. Re-renders. |
| `openFilter(): void` | Open the filter bar UI |
| `closeFilter(): void` | Close the filter bar UI |
| `toggleFilter(): void` | Toggle filter bar visibility |

#### `onInspect` — Custom Click Handling

Register a callback that fires when the user clicks an inspectable value (string, atom, number, structure, etc.). The callback receives an `InspectEvent` with the value's type, text, DOM element reference, and a `preventDefault()` method to suppress the default copy-to-clipboard behavior.

```typescript
interface InspectEvent {
  type: InspectType;        // "String" | "Atom" | "Integer" | "Map" | ...
  copyText: string;         // The text that would be copied
  target: InspectTarget;    // Full target with from/to offsets
  element: HTMLElement;     // The clicked DOM element
  mouseEvent: MouseEvent;   // The original click event
  preventDefault(): void;   // Call to suppress default copy + toast
}
```

**Example: Log to console, suppress copy for strings**

```typescript
viewer.onInspect((event) => {
  console.log(`Clicked ${event.type}: ${event.copyText}`);

  if (event.type === "String") {
    event.preventDefault();
    // Custom handling — e.g. open a modal
  }
  // Other types still get the default copy behavior
});
```

**Example: Render string content as Markdown in a modal**

```typescript
viewer.onInspect((event) => {
  if (event.type === "String") {
    event.preventDefault();
    const content = event.copyText.slice(1, -1); // strip quotes
    showMarkdownModal(content, event.element);
  }
});
```

**Unregister the callback:**

```typescript
viewer.onInspect(null); // Restore default copy behavior
```

#### Key Filtering — Hide Keys by Name

Filter out specific key-value pairs from the rendered view. The data is not modified — only the visual rendering skips the lines belonging to filtered keys.

**Example: Programmatic filtering via API**

```typescript
const viewer = new ElixirDataViewer(container);
viewer.setContent(`%{
  name: "Alice",
  socket: #Port<0.80>,
  secret: "s3cr3t"
}`);

// Hide "socket" and "secret" keys
viewer.setFilterKeys(["socket", "secret"]);

// Add one more key to hide
viewer.addFilterKey("pid");

// Remove a key from the filter
viewer.removeFilterKey("secret");

// Get all keys detected in the content
console.log(viewer.getAvailableKeys());
// → ["name", "secret", "socket"]

// Clear all filters
viewer.clearFilter();
```

**Example: Default filter keys via options**

```typescript
new ElixirDataViewer(container, {
  defaultFilterKeys: ["socket", "secret_key_base"]
});
```

**Example: Filter via HTML data attribute**

```html
<div class="edv-viewer" data-filter-keys="socket,secret_key_base">
  <script type="text/elixir-data">...</script>
</div>
```

### Lower-Level Exports

For advanced use, the parser, highlighter, fold, and filter modules are also exported:

```typescript
import {
  parseElixir,          // Parse Elixir code → Lezer Tree
  highlight,            // Tree → HighlightToken[]
  getLineTokens,        // Filter tokens for a specific line
  detectFoldRegions,    // Tree → FoldRegion[]
  buildFoldMap,         // FoldRegion[] → Map<number, FoldRegion>
  FoldState,            // Fold state manager
  FilterState,          // Filter state manager
} from "elixir-data-viewer";
```

## Theming

The viewer uses CSS classes for all styling. Import the default Tokyo Night theme:

```typescript
import "elixir-data-viewer/style.css";
```

Key CSS classes you can override:

| Class | Description |
|-------|-------------|
| `.edv-container` | Main viewer container |
| `.edv-line` | A single line row |
| `.edv-gutter` | Line number + fold gutter |
| `.edv-code` | Code content area |
| `.edv-toolbar` | Floating toolbar |
| `.edv-toolbar-btn` | Toolbar button |
| `.tok-atom`, `.tok-string`, etc. | Syntax token colors |

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production (library: ES + CJS)
npm run build

# Build standalone IIFE (single file with all deps + CSS)
npm run build:standalone

# Preview production build
npm run preview
```

The dev server starts at `http://localhost:5173` with the demo page showing multiple viewer instances.

## Project Structure

```
├── index.html              # Demo page with multiple viewers
├── src/
│   ├── main.ts             # Demo entry — auto-discovers .edv-viewer elements
│   ├── index.ts            # Library entry — public exports
│   ├── standalone.ts       # Standalone entry — default export for Phoenix/vendor
│   ├── renderer.ts         # ElixirDataViewer class with toolbar
│   ├── parser.ts           # lezer-elixir parser wrapper
│   ├── highlighter.ts      # Syntax tree → highlighted tokens
│   ├── fold.ts             # Fold region detection
│   ├── state.ts            # Fold state management
│   └── styles/
│       └── theme.css       # Tokyo Night theme
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts              # Library build config (ES + CJS)
└── vite.config.standalone.ts   # Standalone ESM build config (single file)
```

## License

MIT
