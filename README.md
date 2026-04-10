# Elixir Data Viewer

A read-only web viewer for Elixir data structures with syntax highlighting, code folding, line numbers, and a VS Code Dark+ theme.

Built with vanilla TypeScript + DOM — no CodeMirror, no React — powered by [`lezer-elixir`](https://github.com/nicklayb/lezer-elixir) for accurate parsing.

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

# Build for production
npm run build

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
└── vite.config.ts
```

## License

MIT
