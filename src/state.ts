import type { FoldRegion } from "./fold";

/**
 * Manages the fold state for the viewer — which lines are folded.
 */
export class FoldState {
  /** Set of startLine indices that are currently folded */
  private foldedLines: Set<number> = new Set();

  /** Map from startLine to FoldRegion */
  private regionMap: Map<number, FoldRegion> = new Map();

  /** All fold regions sorted by startLine */
  private regions: FoldRegion[] = [];

  /**
   * Update the fold regions (called when content changes).
   * Clears all fold state.
   */
  setRegions(regions: FoldRegion[], regionMap: Map<number, FoldRegion>): void {
    this.regions = regions;
    this.regionMap = regionMap;
    this.foldedLines.clear();
  }

  /**
   * Toggle a fold at the given startLine.
   */
  toggle(startLine: number): void {
    if (this.foldedLines.has(startLine)) {
      this.foldedLines.delete(startLine);
    } else {
      if (this.regionMap.has(startLine)) {
        this.foldedLines.add(startLine);
      }
    }
  }

  /**
   * Check if a given startLine is folded.
   */
  isFolded(startLine: number): boolean {
    return this.foldedLines.has(startLine);
  }

  /**
   * Get the FoldRegion for a startLine, if any.
   */
  getRegion(startLine: number): FoldRegion | undefined {
    return this.regionMap.get(startLine);
  }

  /**
   * Check if a given line is hidden due to being inside a folded region.
   * Returns the folded parent region if hidden, or undefined.
   */
  isLineHidden(line: number): FoldRegion | undefined {
    for (const startLine of this.foldedLines) {
      const region = this.regionMap.get(startLine);
      if (region && line > region.startLine && line <= region.endLine) {
        return region;
      }
    }
    return undefined;
  }

  /**
   * Check if a line has a fold indicator (is the start of a foldable region).
   */
  isFoldable(line: number): boolean {
    return this.regionMap.has(line);
  }

  /**
   * Get all regions.
   */
  getRegions(): FoldRegion[] {
    return this.regions;
  }

  /**
   * Fold all regions.
   */
  foldAll(): void {
    for (const region of this.regions) {
      this.foldedLines.add(region.startLine);
    }
  }

  /**
   * Unfold all regions.
   */
  unfoldAll(): void {
    this.foldedLines.clear();
  }

  /**
   * Fold all regions whose nesting depth exceeds maxLevel.
   * Level 1 = outermost structures. foldToLevel(3) shows levels 1–3 expanded,
   * level 4+ folded. foldToLevel(0) or negative values unfold all.
   */
  foldToLevel(maxLevel: number): void {
    this.foldedLines.clear();
    if (maxLevel <= 0) return; // 0 or negative = unfold all
    for (const region of this.regions) {
      if (region.depth > maxLevel) {
        this.foldedLines.add(region.startLine);
      }
    }
  }

  /**
   * Reveal a specific line by unfolding any region that hides it.
   * This ensures the line becomes visible in the rendered output.
   */
  revealLine(line: number): void {
    for (const startLine of this.foldedLines) {
      const region = this.regionMap.get(startLine);
      if (region && line > region.startLine && line <= region.endLine) {
        this.foldedLines.delete(startLine);
      }
    }
  }
}
