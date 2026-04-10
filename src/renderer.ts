import { parseElixir } from "./parser";
import { highlight, getLineTokens, type HighlightToken } from "./highlighter";
import { detectFoldRegions, buildFoldMap } from "./fold";
import { FoldState } from "./state";
import { SearchState, type SearchMatch } from "./search";

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
  /** Show "Search" button. Default: true */
  search?: boolean;
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
  search: boolean;
}

/**
 * ElixirDataViewer — A read-only Elixir data viewer with syntax highlighting,
 * line numbers, code folding, search, and a floating toolbar.
 */
export class ElixirDataViewer {
  private container: HTMLElement;
  private scrollEl: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private wrapBtn: HTMLButtonElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private searchBtn: HTMLButtonElement | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private code: string = "";
  private lines: string[] = [];
  private lineOffsets: number[] = [];
  private tokens: HighlightToken[] = [];
  private foldState: FoldState = new FoldState();
  private searchState: SearchState = new SearchState();
  private onRenderCallback: (() => void) | null = null;
  private wordWrap: boolean = false;
  private toolbarConfig: ResolvedToolbar;

  // Search UI elements
  private searchBarEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private searchInfoEl: HTMLElement | null = null;
  private searchCaseBtn: HTMLButtonElement | null = null;
  private searchVisible: boolean = false;

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
      search: tb.search !== false,
    };

    // Build toolbar if any button is enabled
    this.buildToolbar();

    // Build search bar (hidden initially)
    this.buildSearchBar();

    this.scrollEl = document.createElement("div");
    this.scrollEl.classList.add("edv-scroll");
    this.container.appendChild(this.scrollEl);

    // Keyboard shortcut: Cmd/Ctrl+F to open search
    this.container.setAttribute("tabindex", "0");
    this.container.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  /**
   * Build the floating toolbar DOM and append to the container.
   */
  private buildToolbar(): void {
    const cfg = this.toolbarConfig;
    const hasAnyButton = cfg.foldAll || cfg.unfoldAll || cfg.wordWrap || cfg.copy || cfg.search;
    if (!hasAnyButton) return;

    this.toolbarEl = document.createElement("div");
    this.toolbarEl.classList.add("edv-toolbar");

    if (cfg.search) {
      this.searchBtn = this.createToolbarButton("⌕", "Search (Ctrl+F)", () =>
        this.toggleSearch()
      );
      this.toolbarEl.appendChild(this.searchBtn);
    }

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
      this.copyBtn = this.createToolbarButton("⎘", "Copy", () => this.copyContent());
      this.toolbarEl.appendChild(this.copyBtn);
    }

    this.container.appendChild(this.toolbarEl);
  }

  /**
   * Build the search bar DOM (hidden by default).
   */
  private buildSearchBar(): void {
    this.searchBarEl = document.createElement("div");
    this.searchBarEl.classList.add("edv-search-bar");

    // Search input wrapper
    const inputWrapper = document.createElement("div");
    inputWrapper.classList.add("edv-search-input-wrapper");

    this.searchInputEl = document.createElement("input");
    this.searchInputEl.type = "text";
    this.searchInputEl.classList.add("edv-search-input");
    this.searchInputEl.placeholder = "Search…";
    this.searchInputEl.addEventListener("input", () => this.onSearchInput());
    this.searchInputEl.addEventListener("keydown", (e) =>
      this.handleSearchKeyDown(e)
    );

    // Case sensitivity toggle
    this.searchCaseBtn = document.createElement("button");
    this.searchCaseBtn.classList.add("edv-search-case-btn");
    this.searchCaseBtn.textContent = "Aa";
    this.searchCaseBtn.title = "Match Case";
    this.searchCaseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCaseSensitive();
    });

    inputWrapper.appendChild(this.searchInputEl);
    inputWrapper.appendChild(this.searchCaseBtn);
    this.searchBarEl.appendChild(inputWrapper);

    // Match info (e.g. "3 of 12")
    this.searchInfoEl = document.createElement("span");
    this.searchInfoEl.classList.add("edv-search-info");
    this.searchBarEl.appendChild(this.searchInfoEl);

    // Navigation buttons
    const prevBtn = document.createElement("button");
    prevBtn.classList.add("edv-search-nav-btn");
    prevBtn.textContent = "↑";
    prevBtn.title = "Previous Match (Shift+Enter)";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.searchPrev();
    });
    this.searchBarEl.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.classList.add("edv-search-nav-btn");
    nextBtn.textContent = "↓";
    nextBtn.title = "Next Match (Enter)";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.searchNext();
    });
    this.searchBarEl.appendChild(nextBtn);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.classList.add("edv-search-nav-btn");
    closeBtn.textContent = "✕";
    closeBtn.title = "Close (Escape)";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeSearch();
    });
    this.searchBarEl.appendChild(closeBtn);

    this.container.appendChild(this.searchBarEl);
  }

  /**
   * Handle keyboard shortcuts on the container.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Cmd/Ctrl+F: toggle search
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      e.stopPropagation();
      this.openSearch();
    }

    // Escape: close search
    if (e.key === "Escape" && this.searchVisible) {
      e.preventDefault();
      this.closeSearch();
    }
  }

  /**
   * Handle keyboard events inside the search input.
   */
  private handleSearchKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        this.searchPrev();
      } else {
        this.searchNext();
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeSearch();
    }
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
   * Shows a "✓" feedback on the copy button for 2 seconds.
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
    this.showCopyFeedback();
  }

  /**
   * Show a brief "copied" feedback on the copy button.
   */
  private showCopyFeedback(): void {
    if (!this.copyBtn) return;

    // Clear any existing reset timer
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }

    const originalText = "⎘";
    this.copyBtn.textContent = "✓";
    this.copyBtn.classList.add("edv-toolbar-btn--active");
    this.copyBtn.title = "Copied!";

    this.copyResetTimer = setTimeout(() => {
      if (this.copyBtn) {
        this.copyBtn.textContent = originalText;
        this.copyBtn.classList.remove("edv-toolbar-btn--active");
        this.copyBtn.title = "Copy";
      }
      this.copyResetTimer = null;
    }, 2000);
  }

  // ─── Search API ───────────────────────────────────────────────────────

  /**
   * Open the search bar and focus the input.
   */
  openSearch(): void {
    this.searchVisible = true;
    this.searchBarEl?.classList.add("edv-search-bar--visible");
    if (this.searchBtn) {
      this.searchBtn.classList.add("edv-toolbar-btn--active");
    }
    // Focus and select existing text for easy re-search
    if (this.searchInputEl) {
      this.searchInputEl.focus();
      this.searchInputEl.select();
    }
  }

  /**
   * Close the search bar and clear highlights.
   */
  closeSearch(): void {
    this.searchVisible = false;
    this.searchBarEl?.classList.remove("edv-search-bar--visible");
    if (this.searchBtn) {
      this.searchBtn.classList.remove("edv-toolbar-btn--active");
    }
    this.searchState.clear();
    this.updateSearchInfo();
    this.render();
    // Return focus to the container
    this.container.focus();
  }

  /**
   * Toggle search bar visibility.
   */
  toggleSearch(): void {
    if (this.searchVisible) {
      this.closeSearch();
    } else {
      this.openSearch();
    }
  }

  /**
   * Navigate to the next search match.
   */
  searchNext(): void {
    const match = this.searchState.next();
    if (match) {
      this.revealAndScrollToMatch(match);
    }
    this.updateSearchInfo();
    this.render();
  }

  /**
   * Navigate to the previous search match.
   */
  searchPrev(): void {
    const match = this.searchState.prev();
    if (match) {
      this.revealAndScrollToMatch(match);
    }
    this.updateSearchInfo();
    this.render();
  }

  /**
   * Get the search state (for programmatic access / testing).
   */
  getSearchState(): SearchState {
    return this.searchState;
  }

  /**
   * Handle input in the search field.
   */
  private onSearchInput(): void {
    const query = this.searchInputEl?.value ?? "";
    this.searchState.search(
      this.lines,
      query,
      this.searchState.isCaseSensitive()
    );
    this.updateSearchInfo();

    // If there's a current match, reveal it
    const match = this.searchState.getCurrentMatch();
    if (match) {
      this.revealAndScrollToMatch(match);
    }

    this.render();
  }

  /**
   * Toggle case sensitivity and re-search.
   */
  private toggleCaseSensitive(): void {
    const newCase = !this.searchState.isCaseSensitive();
    this.searchCaseBtn?.classList.toggle("edv-search-case-btn--active", newCase);
    const query = this.searchInputEl?.value ?? "";
    this.searchState.search(this.lines, query, newCase);
    this.updateSearchInfo();

    const match = this.searchState.getCurrentMatch();
    if (match) {
      this.revealAndScrollToMatch(match);
    }

    this.render();
  }

  /**
   * Update the search info label (e.g. "3 of 12" or "No results").
   */
  private updateSearchInfo(): void {
    if (!this.searchInfoEl) return;

    const count = this.searchState.getMatchCount();
    const query = this.searchState.getQuery();

    if (!query) {
      this.searchInfoEl.textContent = "";
      this.searchInfoEl.classList.remove("edv-search-info--no-results");
    } else if (count === 0) {
      this.searchInfoEl.textContent = "No results";
      this.searchInfoEl.classList.add("edv-search-info--no-results");
    } else {
      const idx = this.searchState.getCurrentIndex() + 1;
      this.searchInfoEl.textContent = `${idx} of ${count}`;
      this.searchInfoEl.classList.remove("edv-search-info--no-results");
    }
  }

  /**
   * Ensure the line containing a match is visible (unfold if needed)
   * and scroll to it.
   */
  private revealAndScrollToMatch(match: SearchMatch): void {
    // Unfold any region hiding this line
    this.foldState.revealLine(match.line);
  }

  /**
   * After render, scroll to the current search match element.
   */
  private scrollToCurrentMatch(): void {
    const currentEl = this.scrollEl.querySelector(".edv-search-current");
    if (currentEl) {
      currentEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // ─── Content ──────────────────────────────────────────────────────────

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

    // Re-run search if active
    if (this.searchState.isActive()) {
      this.searchState.search(
        this.lines,
        this.searchState.getQuery(),
        this.searchState.isCaseSensitive()
      );
      this.updateSearchInfo();
    }

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

    // After DOM is built, scroll to current match if search is active
    if (this.searchState.isActive() && this.searchState.getCurrentMatch()) {
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => this.scrollToCurrentMatch());
    }
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

    // Highlight line if it contains a search match
    const lineMatches = this.searchState.getLineMatches(lineIdx);
    if (lineMatches.length > 0) {
      lineEl.classList.add("edv-line--has-match");
    }

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
   * Render a normal highlighted line, with search match highlighting.
   */
  private renderHighlightedLine(codeEl: HTMLElement, lineIdx: number): void {
    const lineText = this.lines[lineIdx];
    const lineStart = this.lineOffsets[lineIdx];
    const lineEnd = lineStart + lineText.length;

    const lineTokens = getLineTokens(this.tokens, lineStart, lineEnd);
    const searchMatches = this.searchState.getLineMatches(lineIdx);

    if (lineText.length === 0) {
      codeEl.innerHTML = "&nbsp;";
      return;
    }

    if (searchMatches.length === 0) {
      // No search matches — render as before
      this.renderTokenizedText(codeEl, lineText, lineTokens);
      return;
    }

    // We have search matches — need to split tokens at match boundaries
    // Build a character-level class map + search highlight info
    this.renderWithSearchHighlights(codeEl, lineText, lineTokens, searchMatches, lineIdx);
  }

  /**
   * Render tokenized text without search highlights.
   */
  private renderTokenizedText(
    codeEl: HTMLElement,
    lineText: string,
    lineTokens: HighlightToken[]
  ): void {
    if (lineTokens.length === 0) {
      codeEl.textContent = lineText;
      return;
    }

    let pos = 0;
    for (const tok of lineTokens) {
      if (tok.from > pos) {
        const textNode = document.createTextNode(lineText.slice(pos, tok.from));
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
  }

  /**
   * Render a line with both syntax tokens and search highlight overlays.
   * Search highlights take precedence visually (wrapping around tokens).
   */
  private renderWithSearchHighlights(
    codeEl: HTMLElement,
    lineText: string,
    lineTokens: HighlightToken[],
    searchMatches: SearchMatch[],
    lineIdx: number
  ): void {
    // Build a map: for each character position, what token class applies
    const charClasses: (string | null)[] = new Array(lineText.length).fill(null);
    for (const tok of lineTokens) {
      for (let i = tok.from; i < tok.to && i < lineText.length; i++) {
        charClasses[i] = tok.classes;
      }
    }

    // Build segments: ranges that share the same (tokenClass, isMatch, isCurrent) tuple
    interface Segment {
      from: number;
      to: number;
      tokenClass: string | null;
      isMatch: boolean;
      isCurrent: boolean;
    }

    const segments: Segment[] = [];

    // For each character, determine if it's part of a search match and which one
    const charMatch: (SearchMatch | null)[] = new Array(lineText.length).fill(null);
    for (const m of searchMatches) {
      for (let i = m.from; i < m.to && i < lineText.length; i++) {
        charMatch[i] = m;
      }
    }

    let segStart = 0;
    while (segStart < lineText.length) {
      const tc = charClasses[segStart];
      const m = charMatch[segStart];
      const isMatch = m !== null;
      const isCurrent = m ? this.searchState.isCurrentMatch(lineIdx, m.from) : false;

      let segEnd = segStart + 1;
      while (segEnd < lineText.length) {
        const nextTc = charClasses[segEnd];
        const nextM = charMatch[segEnd];
        const nextIsMatch = nextM !== null;
        const nextIsCurrent = nextM ? this.searchState.isCurrentMatch(lineIdx, nextM.from) : false;

        if (nextTc !== tc || nextIsMatch !== isMatch || nextIsCurrent !== isCurrent) break;
        segEnd++;
      }

      segments.push({ from: segStart, to: segEnd, tokenClass: tc, isMatch, isCurrent });
      segStart = segEnd;
    }

    // Render segments
    for (const seg of segments) {
      const text = lineText.slice(seg.from, seg.to);

      if (seg.isMatch) {
        const mark = document.createElement("mark");
        mark.classList.add("edv-search-match");
        if (seg.isCurrent) {
          mark.classList.add("edv-search-current");
        }

        if (seg.tokenClass) {
          const inner = document.createElement("span");
          inner.className = seg.tokenClass;
          inner.textContent = text;
          mark.appendChild(inner);
        } else {
          mark.textContent = text;
        }

        codeEl.appendChild(mark);
      } else if (seg.tokenClass) {
        const span = document.createElement("span");
        span.className = seg.tokenClass;
        span.textContent = text;
        codeEl.appendChild(span);
      } else {
        codeEl.appendChild(document.createTextNode(text));
      }
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
