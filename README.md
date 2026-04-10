# Elixir Data Viewer

A read-only web viewer for Elixir data structures with syntax highlighting, code folding, line numbers, and a VS Code Dark+ theme.

Built with vanilla TypeScript + DOM — no CodeMirror, no React — powered by [`lezer-elixir`](https://github.com/livebook-dev/lezer-elixir) for accurate parsing.

## Features

- **Syntax Highlighting** — Accurate Elixir syntax coloring via `lezer-elixir` parser, matching VS Code Dark+ theme
- **Code Folding** — Collapse/expand maps, lists, tuples, keyword lists, bitstrings, and multi-line strings
- **Line Numbers** — Gutter with line numbers and fold indicators
- **Floating Toolbar** — Per-viewer toolbar (appears on hover) with:
  - ⊟ Fold All
  - ⊞ Unfold All
  - ↩ Word Wrap toggle
  - ⎘ Copy to clipboard
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

### Standalone / Phoenix (Single IIFE File)

Build a single JS file with all dependencies and CSS bundled in:

```bash
npm run build:standalone
```

This produces `dist/elixir-data-viewer.iife.js` (~55 kB gzipped) — a single file that:
- Bundles all dependencies (`lezer-elixir`, `@lezer/common`, `@lezer/highlight`)
- Injects CSS automatically via `<style>` tag (no separate CSS file needed)
- Exposes all exports on `window.ElixirDataViewer`

#### Phoenix Integration

1. Copy the built file into your Phoenix project:

```bash
cp dist/elixir-data-viewer.iife.js your_phoenix_app/assets/vendor/
```

2. Import it in your `assets/js/app.js`:

```javascript
import "../vendor/elixir-data-viewer.iife.js";
```

3. Create a LiveView Hook:

```javascript
let Hooks = {};

Hooks.ElixirDataViewer = {
  mounted() {
    const viewer = new window.ElixirDataViewer.ElixirDataViewer(this.el);
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

#### Without a Build System

You can also load the IIFE file directly via `<script>` tag:

```html
<script src="/vendor/elixir-data-viewer.iife.js"></script>
<script>
  const viewer = new ElixirDataViewer.ElixirDataViewer(
    document.getElementById("viewer")
  );
  viewer.setContent('%{name: "Alice", age: 30}');
</script>
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
  };
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
  toolbar: { foldAll: false, unfoldAll: false, wordWrap: false, copy: false }
});
```

#### HTML Data Attributes

When using auto-discovery, toolbar buttons can be configured via `data-toolbar-*` attributes:

```html
<!-- Hide copy and fold-all buttons -->
<div class="edv-viewer" data-toolbar-copy="false" data-toolbar-fold-all="false">
  <script type="text/elixir-data">...</script>
</div>
```

Available attributes: `data-toolbar-fold-all`, `data-toolbar-unfold-all`, `data-toolbar-word-wrap`, `data-toolbar-copy`

#### Methods

| Method | Description |
|--------|-------------|
| `setContent(code: string): void` | Set the Elixir data content and render |
| `getContent(): string` | Get the raw Elixir data string |
| `foldAll(): void` | Collapse all foldable regions |
| `unfoldAll(): void` | Expand all folded regions |
| `toggleWordWrap(): void` | Toggle word wrap mode |
| `isWordWrap(): boolean` | Get current word wrap state |
| `copyContent(): Promise<void>` | Copy raw content to clipboard |
| `onRender(callback: () => void): void` | Set a callback after each render |
| `onInspect(callback: ((event: InspectEvent) => void) \| null): void` | Set a callback when a value is clicked (see below) |

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

### Lower-Level Exports

For advanced use, the parser, highlighter, and fold modules are also exported:

```typescript
import {
  parseElixir,          // Parse Elixir code → Lezer Tree
  highlight,            // Tree → HighlightToken[]
  getLineTokens,        // Filter tokens for a specific line
  detectFoldRegions,    // Tree → FoldRegion[]
  buildFoldMap,         // FoldRegion[] → Map<number, FoldRegion>
  FoldState,            // Fold state manager
} from "elixir-data-viewer";
```

## Theming

The viewer uses CSS classes for all styling. Import the default VS Code Dark+ theme:

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
│   ├── renderer.ts         # ElixirDataViewer class with toolbar
│   ├── parser.ts           # lezer-elixir parser wrapper
│   ├── highlighter.ts      # Syntax tree → highlighted tokens
│   ├── fold.ts             # Fold region detection
│   ├── state.ts            # Fold state management
│   └── styles/
│       └── theme.css       # VS Code Dark+ theme
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts              # Library build config (ES + CJS)
└── vite.config.standalone.ts   # Standalone IIFE build config (single file)
```

## License

MIT
