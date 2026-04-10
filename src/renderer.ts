import { parseElixir } from "./parser";
import { highlight, getLineTokens, type HighlightToken } from "./highlighter";
import { detectFoldRegions, buildFoldMap } from "./fold";
import { FoldState } from "./state";

/**
 * Toolbar button visibility options.
 * All buttons default to `true` (visible).
 */
export interface ToolbarOptions {
  /** Show "Fold All" button. Default: true */
  foldAll?: boolean;
  /** Show "Unfold All" button. Default: true */
  unfoldAll?: boolean;
  /** Show "Word Wrap" toggle button. Default: true */
  wordWrap?: boolean;
  /** Show "Copy" button. Default: true */
  copy?: boolean;
}

/**
 * Configuration options for ElixirDataViewer.
 */
export interface ElixirDataViewerOptions {
  /** Toolbar button visibility. All default to true. */
  toolbar?: ToolbarOptions;
}

/** Resolved toolbar config with defaults applied */
interface ResolvedToolbar {
  foldAll: boolean;
  unfoldAll: boolean;
  wordWrap: boolean;
  copy: boolean;
}

/**
 * ElixirDataViewer — A read-only Elixir data viewer with syntax highlighting,
 * line numbers, code folding, and a floating toolbar.
 */
export class ElixirDataViewer {
  private container: HTMLElement;
  private scrollEl: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private wrapBtn: HTMLButtonElement | null = null;
  private code: string = "";
  private lines: string[] = [];
  private lineOffsets: number[] = [];
  private tokens: HighlightToken[] = [];
  private foldState: FoldState = new FoldState();
  private onRenderCallback: (() => void) | null = null;
  private wordWrap: boolean = false;
  private toolbarConfig: ResolvedToolbar;

  constructor(container: HTMLElement, options?: ElixirDataViewerOptions) {
    this.container = container;
    this.container.classList.add("edv-container");

    // Resolve toolbar options with defaults
    const tb = options?.toolbar ?? {};
    this.toolbarConfig = {
      foldAll: tb.foldAll !== false,
      unfoldAll: tb.unfoldAll !== false,
      wordWrap: tb.wordWrap !== false,
      copy: tb.copy !== false,
    };

    // Build toolbar if any button is enabled
    this.buildToolbar();

    this.scrollEl = document.createElement("div");
    this.scrollEl.classList.add("edv-scroll");
    this.container.appendChild(this.scrollEl);
  }

  /**
   * Build the floating toolbar DOM and append to the container.
   */
  private buildToolbar(): void {
    const cfg = this.toolbarConfig;
    const hasAnyButton = cfg.foldAll || cfg.unfoldAll || cfg.wordWrap || cfg.copy;
    if (!hasAnyButton) return;

    this.toolbarEl = document.createElement("div");
    this.toolbarEl.classList.add("edv-toolbar");

    if (cfg.foldAll) {
      const btn = this.createToolbarButton("⊟", "Fold All", () => this.foldAll());
      this.toolbarEl.appendChild(btn);
    }

    if (cfg.unfoldAll) {
      const btn = this.createToolbarButton("⊞", "Unfold All", () => this.unfoldAll());
      this.toolbarEl.appendChild(btn);
    }

    if (cfg.wordWrap) {
      this.wrapBtn = this.createToolbarButton("↩", "Word Wrap (Alt+Z)", () => {
        this.toggleWordWrap();
      });
      this.toolbarEl.appendChild(this.wrapBtn);
    }

    if (cfg.copy) {
      const btn = this.createToolbarButton("⎘", "Copy", () => this.copyContent());
      this.toolbarEl.appendChild(btn);
    }

    this.container.appendChild(this.toolbarEl);
  }

  /**
   * Create a toolbar button element.
   */
  private createToolbarButton(
    icon: string,
    title: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.classList.add("edv-toolbar-btn");
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  /**
   * Toggle word wrap mode for long lines.
   */
  toggleWordWrap(): void {
    this.wordWrap = !this.wordWrap;
    this.container.classList.toggle("edv-word-wrap", this.wordWrap);
    if (this.wrapBtn) {
      this.wrapBtn.classList.toggle("edv-toolbar-btn--active", this.wordWrap);
    }
  }

  /**
   * Get current word wrap state.
   */
  isWordWrap(): boolean {
    return this.wordWrap;
  }

  /**
   * Fold all foldable regions.
   */
  foldAll(): void {
    this.foldState.foldAll();
    this.render();
  }

  /**
   * Unfold all folded regions.
   */
  unfoldAll(): void {
    this.foldState.unfoldAll();
    this.render();
  }

  /**
   * Get the raw Elixir data content.
   */
  getContent(): string {
    return this.code;
  }

  /**
   * Copy the raw Elixir data content to the clipboard.
   * Returns a promise that resolves when copying is complete.
   */
  async copyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
    } catch {
      // Fallback for non-HTTPS or older browsers
      const textarea = document.createElement("textarea");
      textarea.value = this.code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  /**
   * Set the Elixir data content and render it.
   */
  setContent(code: string): void {
    this.code = code;
    this.lines = code.split("\n");
    this.buildLineOffsets();

    // Parse and analyze
    const tree = parseElixir(code);
    this.tokens = highlight(code, tree);
    const regions = detectFoldRegions(code, tree);
    const regionMap = buildFoldMap(regions);
    this.foldState.setRegions(regions, regionMap);

    this.render();
  }

  /**
   * Set a callback to be called after each render (for testing/animation).
   */
  onRender(callback: () => void): void {
    this.onRenderCallback = callback;
  }

  /**
   * Build line offset table for mapping offsets to line-relative positions.
   */
  private buildLineOffsets(): void {
    this.lineOffsets = [0];
    for (let i = 0; i < this.code.length; i++) {
      if (this.code[i] === "\n") {
        this.lineOffsets.push(i + 1);
      }
    }
  }

  /**
   * Full re-render of the viewer.
   */
  private render(): void {
    this.scrollEl.innerHTML = "";

    const lineCount = this.lines.length;
    const gutterWidth = String(lineCount).length;

    let lineIdx = 0;
    while (lineIdx < lineCount) {
      const hidden = this.foldState.isLineHidden(lineIdx);
      if (hidden) {
        // This line is hidden by a fold — skip it
        lineIdx++;
        continue;
      }

      const isFoldable = this.foldState.isFoldable(lineIdx);
      const isFolded = this.foldState.isFolded(lineIdx);
      const region = this.foldState.getRegion(lineIdx);

      const lineEl = this.createLineElement(
        lineIdx,
        gutterWidth,
        isFoldable,
        isFolded,
        region
      );
      this.scrollEl.appendChild(lineEl);

      lineIdx++;
    }

    this.onRenderCallback?.();
  }

  /**
   * Create a single line element with gutter and code content.
   */
  private createLineElement(
    lineIdx: number,
    gutterWidth: number,
    isFoldable: boolean,
    isFolded: boolean,
    region: ReturnType<FoldState["getRegion"]>
  ): HTMLElement {
    const lineEl = document.createElement("div");
    lineEl.classList.add("edv-line");
    lineEl.dataset.line = String(lineIdx);

    // Gutter
    const gutterEl = document.createElement("div");
    gutterEl.classList.add("edv-gutter");

    // Line number (left side)
    const lineNumEl = document.createElement("span");
    lineNumEl.classList.add("edv-line-number");
    lineNumEl.textContent = String(lineIdx + 1).padStart(gutterWidth, " ");
    gutterEl.appendChild(lineNumEl);

    // Fold indicator (right side, adjacent to code)
    const foldEl = document.createElement("span");
    foldEl.classList.add("edv-fold-indicator");
    if (isFoldable) {
      foldEl.classList.add("edv-foldable");
      foldEl.textContent = isFolded ? "\u25B6" : "\u25BC";
      foldEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.foldState.toggle(lineIdx);
        this.render();
      });
    }
    gutterEl.appendChild(foldEl);

    lineEl.appendChild(gutterEl);

    // Code content
    const codeEl = document.createElement("div");
    codeEl.classList.add("edv-code");

    if (isFolded && region) {
      // Render the fold summary: opening line content + … + closing bracket
      this.renderFoldedLine(codeEl, lineIdx, region);
    } else {
      // Render normal highlighted line
      this.renderHighlightedLine(codeEl, lineIdx);
    }

    lineEl.appendChild(codeEl);

    return lineEl;
  }

  /**
   * Render a normal highlighted line.
   */
  private renderHighlightedLine(codeEl: HTMLElement, lineIdx: number): void {
    const lineText = this.lines[lineIdx];
    const lineStart = this.lineOffsets[lineIdx];
    const lineEnd = lineStart + lineText.length;

    const lineTokens = getLineTokens(this.tokens, lineStart, lineEnd);

    if (lineTokens.length === 0) {
      // No tokens — render as plain text (preserving whitespace)
      codeEl.textContent = lineText || "\n";
      if (!lineText) {
        // Empty line needs a non-breaking space to maintain height
        codeEl.innerHTML = "&nbsp;";
      }
      return;
    }

    // Fill gaps between tokens with unstyled spans
    let pos = 0;
    for (const tok of lineTokens) {
      if (tok.from > pos) {
        // Gap before this token — plain text
        const textNode = document.createTextNode(
          lineText.slice(pos, tok.from)
        );
        codeEl.appendChild(textNode);
      }

      const span = document.createElement("span");
      span.className = tok.classes;
      span.textContent = lineText.slice(tok.from, tok.to);
      codeEl.appendChild(span);

      pos = tok.to;
    }

    // Remaining text after last token
    if (pos < lineText.length) {
      const textNode = document.createTextNode(lineText.slice(pos));
      codeEl.appendChild(textNode);
    }

    // Empty line
    if (lineText.length === 0) {
      codeEl.innerHTML = "&nbsp;";
    }
  }

  /**
   * Render a folded line: shows the opening line content followed by … and closing bracket.
   */
  private renderFoldedLine(
    codeEl: HTMLElement,
    lineIdx: number,
    region: NonNullable<ReturnType<FoldState["getRegion"]>>
  ): void {
    // First, render the tokens of the opening line as normal
    const lineText = this.lines[lineIdx];
    const lineStart = this.lineOffsets[lineIdx];
    const lineEnd = lineStart + lineText.length;

    const lineTokens = getLineTokens(this.tokens, lineStart, lineEnd);

    let pos = 0;
    for (const tok of lineTokens) {
      if (tok.from > pos) {
        const textNode = document.createTextNode(
          lineText.slice(pos, tok.from)
        );
        codeEl.appendChild(textNode);
      }

      const span = document.createElement("span");
      span.className = tok.classes;
      span.textContent = lineText.slice(tok.from, tok.to);
      codeEl.appendChild(span);

      pos = tok.to;
    }

    if (pos < lineText.length) {
      const textNode = document.createTextNode(lineText.slice(pos));
      codeEl.appendChild(textNode);
    }

    // Add the fold ellipsis
    const ellipsis = document.createElement("span");
    ellipsis.classList.add("edv-fold-ellipsis");
    ellipsis.textContent = "…";
    ellipsis.title = `${region.endLine - region.startLine} lines folded`;
    ellipsis.addEventListener("click", (e) => {
      e.stopPropagation();
      this.foldState.toggle(lineIdx);
      this.render();
    });
    codeEl.appendChild(ellipsis);

    // Add the closing bracket
    const closeSpan = document.createElement("span");
    closeSpan.classList.add("tok-punctuation");
    closeSpan.textContent = region.closeText;
    codeEl.appendChild(closeSpan);
  }
}
