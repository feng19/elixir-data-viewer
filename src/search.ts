/**
 * Search functionality for ElixirDataViewer.
 * Manages text search, match tracking, and navigation.
 */

/**
 * Represents a single search match in the code.
 */
export interface SearchMatch {
  /** 0-indexed line number */
  line: number;
  /** Column offset within the line (0-based) */
  from: number;
  /** Column end offset within the line (0-based, exclusive) */
  to: number;
}

/**
 * Manages search state: query, matches, current index.
 */
export class SearchState {
  private query: string = "";
  private caseSensitive: boolean = false;
  private matches: SearchMatch[] = [];
  private currentIndex: number = -1;

  /**
   * Perform a search across all lines.
   * Returns true if matches changed.
   */
  search(lines: string[], query: string, caseSensitive: boolean): boolean {
    this.query = query;
    this.caseSensitive = caseSensitive;
    this.matches = [];
    this.currentIndex = -1;

    if (!query) return true;

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = caseSensitive ? lines[lineIdx] : lines[lineIdx].toLowerCase();
      let col = 0;
      while (col <= lineText.length - searchQuery.length) {
        const idx = lineText.indexOf(searchQuery, col);
        if (idx === -1) break;
        this.matches.push({
          line: lineIdx,
          from: idx,
          to: idx + searchQuery.length,
        });
        col = idx + 1; // allow overlapping matches
      }
    }

    if (this.matches.length > 0) {
      this.currentIndex = 0;
    }

    return true;
  }

  /**
   * Clear search state.
   */
  clear(): void {
    this.query = "";
    this.matches = [];
    this.currentIndex = -1;
  }

  /**
   * Get the current search query.
   */
  getQuery(): string {
    return this.query;
  }

  /**
   * Get whether case-sensitive mode is active.
   */
  isCaseSensitive(): boolean {
    return this.caseSensitive;
  }

  /**
   * Get all matches.
   */
  getMatches(): readonly SearchMatch[] {
    return this.matches;
  }

  /**
   * Get matches for a specific line.
   */
  getLineMatches(lineIdx: number): SearchMatch[] {
    return this.matches.filter((m) => m.line === lineIdx);
  }

  /**
   * Get the current match index (0-based), or -1 if no matches.
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get the current match, or undefined if none.
   */
  getCurrentMatch(): SearchMatch | undefined {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) {
      return undefined;
    }
    return this.matches[this.currentIndex];
  }

  /**
   * Get total number of matches.
   */
  getMatchCount(): number {
    return this.matches.length;
  }

  /**
   * Move to the next match. Wraps around.
   */
  next(): SearchMatch | undefined {
    if (this.matches.length === 0) return undefined;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    return this.matches[this.currentIndex];
  }

  /**
   * Move to the previous match. Wraps around.
   */
  prev(): SearchMatch | undefined {
    if (this.matches.length === 0) return undefined;
    this.currentIndex =
      (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    return this.matches[this.currentIndex];
  }

  /**
   * Set the current match to the nearest one at or after the given line.
   * Used when opening search to start from the visible area.
   */
  setCurrentToLine(lineIdx: number): void {
    if (this.matches.length === 0) return;
    for (let i = 0; i < this.matches.length; i++) {
      if (this.matches[i].line >= lineIdx) {
        this.currentIndex = i;
        return;
      }
    }
    // Wrap to start
    this.currentIndex = 0;
  }

  /**
   * Check if a match at the given line/from is the current match.
   */
  isCurrentMatch(lineIdx: number, from: number): boolean {
    const current = this.getCurrentMatch();
    if (!current) return false;
    return current.line === lineIdx && current.from === from;
  }

  /**
   * Has active search query.
   */
  isActive(): boolean {
    return this.query.length > 0;
  }
}
