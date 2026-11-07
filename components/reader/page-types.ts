import type { MutableRefObject } from "react";
import type { Locator, Prefs } from "./reader-theme";

/** Where a page surface currently is, reported to the shell for saving. */
export interface SurfaceLocation {
  locator: Locator;
  /** 0..100, or -1 while the surface cannot know yet (EPUB pagination pending). */
  percent: number;
  /** Short human label for the footer ("Chapter 3", "Page 12 of 340"). */
  label: string;
  /** 1-based PDF page, when applicable. */
  page?: number;
}

export interface TocItem {
  label: string;
  /** EPUB href or PDF page number. */
  target: string | number;
  depth: number;
}

/** Commands the shell can issue to whichever surface is mounted. */
export interface SurfaceHandle {
  next(): void;
  prev(): void;
  goto(target: string | number): void;
}

export interface SurfaceProps {
  url: string;
  initialLocator: Locator | null;
  /** Fallback when no exact locator exists (e.g. progress made in the text view). */
  initialPercent: number;
  prefs: Prefs;
  onLocation(loc: SurfaceLocation): void;
  /** A tap on the middle of the page (toggles the chrome). */
  onTap(): void;
  onToc(items: TocItem[]): void;
  onError(message: string): void;
  onReady(): void;
  handleRef: MutableRefObject<SurfaceHandle | null>;
}
