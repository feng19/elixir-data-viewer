import { parseElixir } from "./parser";
import { highlight, getLineTokens, type HighlightToken } from "./highlighter";
import { detectFoldRegions, buildFoldMap } from "./fold";
import { FoldState } from "./state";
import { SearchState, type SearchMatch } from "./search";
import { resolveInspectTarget, type InspectTarget, type InspectType } from "./inspect";
import { preprocessInspectLiterals, type InspectLiteral } from "./preprocess";
import type { Tree } from "@lezer/common";

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
 * Event object passed to the onInspect callback when the user clicks
 * an inspectable value (string, atom, number, structure, etc.).
 */
export interface InspectEvent {
  /** The semantic type of the inspected node (e.g. "String", "Atom", "Map") */
  type: InspectType;
  /** The text that would be copied to clipboard */
  copyText: string;
  /** The full InspectTarget with offset information */
  target: InspectTarget;
  /** The DOM element that was clicked */
  element: HTMLElement;
  /** The original MouseEvent from the click */
  mouseEvent: MouseEvent;
  /** Call this to prevent the default copy-to-clipboard + toast behavior */
  preventDefault(): void;
}

/**
 * Configuration options for ElixirDataViewer.
 */
export interface ElixirDataViewerOptions {
  /** Toolbar button visibility. All default to true. */
  toolbar?: ToolbarOptions;
  /**
   * Default fold level. Regions deeper than this level are automatically
   * folded when setContent() is called.
   * E.g. 3 = show first 3 levels expanded, fold level 4+.
   * 0 or undefined = no auto-folding (all expanded).
   */
  defaultFoldLevel?: number;
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
  private innerEl: HTMLElement;
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
  private tree: Tree | null = null;
  private foldState: FoldState = new FoldState();
  private defaultFoldLevel: number = 0;
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

  // Inspect state
  private currentInspect: InspectTarget | null = null;
  private inspectCallback: ((event: InspectEvent) => void) | null = null;

  // Pre-processed inspect literals (#Reference<...>, #PID<...>, etc.)
  private inspectLiterals: InspectLiteral[] = [];

  constructor(container: HTMLElement, options?: ElixirDataViewerOptions) {
    this.container = container;
    this.container.classList.add("edv-container");

    // Resolve options
    this.defaultFoldLevel = options?.defaultFoldLevel ?? 0;

    // Resolve toolbar options with defaults
    const tb = options?.toolbar ?? {};
    this.toolbarConfig = {
      foldAll: tb.foldAll !== false,
      unfoldAll: tb.unfoldAll !== false,
      wordWrap: tb.wordWrap !== false,
      copy: tb.copy !== false,
      search: tb.search !== false,
    };

    // Build toolbar (positioned absolutely, does not scroll)
    this.buildToolbar();

    // Build search bar (sits above the scrollable area)
    this.buildSearchBar();

    // Inner wrapper handles scrolling
    this.innerEl = document.createElement("div");
    this.innerEl.classList.add("edv-inner");
    this.container.appendChild(this.innerEl);

    this.scrollEl = document.createElement("div");
    this.scrollEl.classList.add("edv-scroll");
    this.innerEl.appendChild(this.scrollEl);

    // Inspect: hover and click event delegation on scroll container
    this.scrollEl.addEventListener("mouseover", (e) => this.handleInspectHover(e));
    this.scrollEl.addEventListener("mouseout", (e) => this.handleInspectOut(e));
    this.scrollEl.addEventListener("click", (e) => this.handleInspectClick(e));

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
   * Fold all regions deeper than the given level.
   * Level 1 = top-level structures. foldToLevel(3) expands levels 1–3, folds 4+.
   * foldToLevel(0) unfolds all.
   */
  foldToLevel(level: number): void {
    this.foldState.foldToLevel(level);
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

    // Pre-process: replace inspect literals (#Reference<...>, #PID<...>, etc.)
    // with same-length atoms so lezer-elixir doesn't treat them as comments
    const { modifiedCode, inspectLiterals } = preprocessInspectLiterals(code);
    this.inspectLiterals = inspectLiterals;

    // Parse and analyze — use modified code for correct parsing
    const tree = parseElixir(modifiedCode);
    this.tree = tree;
    this.tokens = highlight(modifiedCode, tree);

    // Post-process: fix token CSS classes for inspect literal ranges
    this.fixInspectLiteralTokenClasses();

    const regions = detectFoldRegions(modifiedCode, tree);
    const regionMap = buildFoldMap(regions);
    this.foldState.setRegions(regions, regionMap);

    // Apply default fold level if configured
    if (this.defaultFoldLevel > 0) {
      this.foldState.foldToLevel(this.defaultFoldLevel);
    }

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
   * Post-process highlight tokens: replace CSS classes for spans that fall
   * within pre-processed inspect literal ranges (e.g. #Reference<...>)
   * so they render with the inspect-literal style instead of atom style.
   */
  private fixInspectLiteralTokenClasses(): void {
    if (this.inspectLiterals.length === 0) return;

    for (const lit of this.inspectLiterals) {
      for (const tok of this.tokens) {
        // Token is fully within the inspect literal range
        if (tok.from >= lit.from && tok.to <= lit.to) {
          tok.classes = "tok-inspect-literal";
        }
      }
    }
  }

  /**
   * Check if an offset falls within a pre-processed inspect literal and
   * return the literal if so, or null.
   */
  private findInspectLiteral(from: number, to: number): InspectLiteral | null {
    for (const lit of this.inspectLiterals) {
      if (from >= lit.from && to <= lit.to) {
        return lit;
      }
    }
    return null;
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
      this.renderTokenizedText(codeEl, lineText, lineTokens, lineStart);
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
    lineTokens: HighlightToken[],
    lineStart?: number
  ): void {
    const absStart = lineStart ?? 0;

    if (lineTokens.length === 0) {
      // Wrap in a span with data-from/data-to for inspect targeting
      const span = document.createElement("span");
      span.dataset.from = String(absStart);
      span.dataset.to = String(absStart + lineText.length);
      span.textContent = lineText;
      codeEl.appendChild(span);
      return;
    }

    let pos = 0;
    for (const tok of lineTokens) {
      if (tok.from > pos) {
        const span = document.createElement("span");
        span.dataset.from = String(absStart + pos);
        span.dataset.to = String(absStart + tok.from);
        span.textContent = lineText.slice(pos, tok.from);
        codeEl.appendChild(span);
      }

      const span = document.createElement("span");
      span.className = tok.classes;
      span.dataset.from = String(absStart + tok.from);
      span.dataset.to = String(absStart + tok.to);
      span.textContent = lineText.slice(tok.from, tok.to);
      codeEl.appendChild(span);

      pos = tok.to;
    }

    if (pos < lineText.length) {
      const span = document.createElement("span");
      span.dataset.from = String(absStart + pos);
      span.dataset.to = String(absStart + lineText.length);
      span.textContent = lineText.slice(pos);
      codeEl.appendChild(span);
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

    // Render segments — all wrapped in spans with data-from/data-to for inspect
    const lineStart = this.lineOffsets[lineIdx];
    for (const seg of segments) {
      const text = lineText.slice(seg.from, seg.to);
      const absFrom = lineStart + seg.from;
      const absTo = lineStart + seg.to;

      if (seg.isMatch) {
        const mark = document.createElement("mark");
        mark.classList.add("edv-search-match");
        if (seg.isCurrent) {
          mark.classList.add("edv-search-current");
        }
        mark.dataset.from = String(absFrom);
        mark.dataset.to = String(absTo);

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
        span.dataset.from = String(absFrom);
        span.dataset.to = String(absTo);
        span.textContent = text;
        codeEl.appendChild(span);
      } else {
        const span = document.createElement("span");
        span.dataset.from = String(absFrom);
        span.dataset.to = String(absTo);
        span.textContent = text;
        codeEl.appendChild(span);
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
        const span = document.createElement("span");
        span.dataset.from = String(lineStart + pos);
        span.dataset.to = String(lineStart + tok.from);
        span.textContent = lineText.slice(pos, tok.from);
        codeEl.appendChild(span);
      }

      const span = document.createElement("span");
      span.className = tok.classes;
      span.dataset.from = String(lineStart + tok.from);
      span.dataset.to = String(lineStart + tok.to);
      span.textContent = lineText.slice(tok.from, tok.to);
      codeEl.appendChild(span);

      pos = tok.to;
    }

    if (pos < lineText.length) {
      const span = document.createElement("span");
      span.dataset.from = String(lineStart + pos);
      span.dataset.to = String(lineStart + lineText.length);
      span.textContent = lineText.slice(pos);
      codeEl.appendChild(span);
    }

    // Add the fold ellipsis — carries the full structure range for inspect
    const ellipsis = document.createElement("span");
    ellipsis.classList.add("edv-fold-ellipsis");
    const foldedLines = region.endLine - region.startLine;
    if (region.itemCount > 0) {
      ellipsis.textContent = `${region.itemCount} items`;
      ellipsis.title = `${region.itemCount} items, ${foldedLines} lines folded`;
    } else {
      // For multi-line strings ("""/'''), the content lines exclude the delimiter lines
      const isMultilineString = region.openText === '"""' || region.openText === "'''";
      const displayLines = isMultilineString ? foldedLines - 1 : foldedLines;
      ellipsis.textContent = `${displayLines} lines`;
      ellipsis.title = `${displayLines} lines folded`;
    }
    ellipsis.dataset.from = String(region.startOffset);
    ellipsis.dataset.to = String(region.endOffset);
    ellipsis.addEventListener("click", (e) => {
      e.stopPropagation();
      this.foldState.toggle(lineIdx);
      this.render();
    });
    codeEl.appendChild(ellipsis);

    // Add the closing bracket — carries offset for the close bracket
    const closeSpan = document.createElement("span");
    closeSpan.classList.add("tok-punctuation");
    closeSpan.dataset.from = String(region.endOffset - region.closeText.length);
    closeSpan.dataset.to = String(region.endOffset);
    closeSpan.textContent = region.closeText;
    codeEl.appendChild(closeSpan);
  }

  // ─── Inspect (Hover + Click-to-Copy) ──────────────────────────────────

  /**
   * Handle mouseover on spans to resolve inspect target and apply highlight.
   */
  private handleInspectHover(e: Event): void {
    const target = (e as MouseEvent).target as HTMLElement;
    if (!target || !this.tree) return;

    // Find the nearest element with data-from
    const el = target.closest<HTMLElement>("[data-from]");
    if (!el) {
      this.clearInspectHighlight();
      return;
    }

    const from = parseInt(el.dataset.from!, 10);
    if (isNaN(from)) return;

    // Resolve what to inspect at this offset
    const inspectTarget = resolveInspectTarget(this.tree, this.code, from);
    if (!inspectTarget) {
      this.clearInspectHighlight();
      return;
    }

    // Override type for pre-processed inspect literals (#Reference<...>, etc.)
    const lit = this.findInspectLiteral(inspectTarget.from, inspectTarget.to);
    if (lit) {
      inspectTarget.type = "InspectLiteral";
    }

    // Check if target changed (avoid redundant DOM work)
    if (
      this.currentInspect &&
      this.currentInspect.from === inspectTarget.from &&
      this.currentInspect.to === inspectTarget.to
    ) {
      return;
    }

    this.clearInspectHighlight();
    this.currentInspect = inspectTarget;
    this.applyInspectHighlight(inspectTarget);
  }

  /**
   * Handle mouseout — clear highlight when leaving the scroll area.
   */
  private handleInspectOut(e: Event): void {
    const mouseEvent = e as MouseEvent;
    const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;

    // Only clear if we're leaving the scroll container entirely
    if (relatedTarget && this.scrollEl.contains(relatedTarget)) {
      return;
    }

    this.clearInspectHighlight();
  }

  /**
   * Register a callback invoked when the user clicks an inspectable value.
   * The callback receives an InspectEvent with type, copyText, DOM element,
   * and a preventDefault() method to suppress the default copy behavior.
   *
   * Pass `null` to unregister the callback and restore default behavior.
   */
  onInspect(callback: ((event: InspectEvent) => void) | null): void {
    this.inspectCallback = callback;
  }

  /**
   * Handle click on an inspected token — copy to clipboard (unless prevented by callback).
   */
  private handleInspectClick(e: Event): void {
    if (!this.currentInspect) return;

    const target = (e as MouseEvent).target as HTMLElement;
    if (!target) return;

    // Don't interfere with fold toggle clicks
    const el = target.closest<HTMLElement>(".edv-fold-indicator, .edv-fold-ellipsis");
    if (el && !el.dataset.from) return;

    // Check we're clicking on something with data-from (an inspectable element)
    const inspectEl = target.closest<HTMLElement>("[data-from]");
    if (!inspectEl) return;

    const copyText = this.currentInspect.copyText;

    // Build the InspectEvent and call the callback if registered
    let defaultPrevented = false;
    if (this.inspectCallback) {
      const inspectEvent: InspectEvent = {
        type: this.currentInspect.type,
        copyText,
        target: this.currentInspect,
        element: inspectEl,
        mouseEvent: e as MouseEvent,
        preventDefault() {
          defaultPrevented = true;
        },
      };
      this.inspectCallback(inspectEvent);
    }

    // Visual feedback: flash the highlighted elements (always, even if prevented)
    this.flashInspectHighlight();

    // Only copy + toast if not prevented
    if (!defaultPrevented) {
      this.copyToClipboard(copyText);
      this.showInspectToast(e as MouseEvent);
    }
  }

  /**
   * Apply highlight CSS classes to all spans within the inspect target range.
   */
  private applyInspectHighlight(target: InspectTarget): void {
    if (target.isStructure) {
      // Highlight all lines that overlap with the structure range
      const startLine = this.offsetToLine(target.from);
      const endLine = this.offsetToLine(target.to - 1);

      const lineEls = this.scrollEl.querySelectorAll<HTMLElement>(".edv-line");
      for (const lineEl of lineEls) {
        const lineIdx = parseInt(lineEl.dataset.line!, 10);
        if (isNaN(lineIdx)) continue;
        if (lineIdx >= startLine && lineIdx <= endLine) {
          lineEl.classList.add("edv-inspect-line");
        }
      }

      // Also highlight the bracket spans specifically
      this.highlightSpansInRange(target.from, target.to, "edv-inspect-bracket");
    } else {
      // Highlight just the specific token spans
      this.highlightSpansInRange(target.from, target.to, "edv-inspect-token");
    }
  }

  /**
   * Add a CSS class to all spans whose data-from/data-to overlap the given range.
   */
  private highlightSpansInRange(from: number, to: number, className: string): void {
    const spans = this.scrollEl.querySelectorAll<HTMLElement>("[data-from]");
    for (const span of spans) {
      const spanFrom = parseInt(span.dataset.from!, 10);
      const spanTo = parseInt(span.dataset.to!, 10);
      if (isNaN(spanFrom) || isNaN(spanTo)) continue;

      // Check overlap
      if (spanFrom < to && spanTo > from) {
        span.classList.add(className);
      }
    }
  }

  /**
   * Clear all inspect highlight classes.
   */
  private clearInspectHighlight(): void {
    if (!this.currentInspect) return;

    // Remove line highlights
    const lineEls = this.scrollEl.querySelectorAll<HTMLElement>(".edv-inspect-line");
    for (const el of lineEls) {
      el.classList.remove("edv-inspect-line");
    }

    // Remove token highlights
    const tokenEls = this.scrollEl.querySelectorAll<HTMLElement>(
      ".edv-inspect-token, .edv-inspect-bracket"
    );
    for (const el of tokenEls) {
      el.classList.remove("edv-inspect-token", "edv-inspect-bracket");
    }

    this.currentInspect = null;
  }

  /**
   * Flash animation on currently highlighted elements.
   */
  private flashInspectHighlight(): void {
    const els = this.scrollEl.querySelectorAll<HTMLElement>(
      ".edv-inspect-token, .edv-inspect-bracket"
    );
    for (const el of els) {
      el.classList.add("edv-inspect-copied");
      el.addEventListener(
        "animationend",
        () => el.classList.remove("edv-inspect-copied"),
        { once: true }
      );
    }
  }

  /**
   * Show a small floating "Copied!" toast near the mouse click position.
   */
  private showInspectToast(e: MouseEvent): void {
    const toast = document.createElement("div");
    toast.classList.add("edv-copied-toast");
    toast.textContent = "Copied!";
    toast.style.left = `${e.clientX + 8}px`;
    toast.style.top = `${e.clientY - 24}px`;
    document.body.appendChild(toast);

    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }

  /**
   * Copy text to clipboard with fallback.
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  /**
   * Convert an absolute character offset to a 0-indexed line number.
   */
  private offsetToLine(offset: number): number {
    let lo = 0;
    let hi = this.lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineOffsets[mid] <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }
}
