/**
 * Reading appearance shared by the text view and the page (EPUB/PDF) view, so
 * a theme or font choice carries across both.
 *
 * Apple Books' four reading themes. The keys deliberately match the backend's
 * THEME_CHOICES (light/sepia/dark/night) so a choice round-trips through
 * ReaderSettings; only the label follows Books' naming.
 */
export const THEMES = {
  light: { label: "White", bg: "#FFFFFF", fg: "#16161A", muted: "#8A8A8E" },
  sepia: { label: "Sepia", bg: "#FBF0D9", fg: "#3B3128", muted: "#8C7B62" },
  dark:  { label: "Gray",  bg: "#3A3A3C", fg: "#E6E6E8", muted: "#A0A0A6" },
  night: { label: "Night", bg: "#000000", fg: "#B9B9BE", muted: "#6E6E76" },
} as const;

export type ThemeKey = keyof typeof THEMES;

export const FONTS = [
  { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { label: "Palatino", stack: '"Palatino Linotype", Palatino, Georgia, serif' },
  { label: "New York", stack: 'ui-serif, "New York", Georgia, serif' },
  { label: "System", stack: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: "Helvetica", stack: 'Helvetica, "Helvetica Neue", Arial, sans-serif' },
];

export const MIN_SIZE = 14;
export const MAX_SIZE = 30;
export const PREFS_KEY = "bookverse.reading-prefs";

export interface Prefs {
  theme: ThemeKey;
  fontStack: string;
  fontSize: number;
}

export function loadPrefs(fallback: Prefs): Prefs {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function savePrefs(next: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode: in-memory only */
  }
}

/** Where the reader stopped, in the format's own terms (see ReadingProgress.locator). */
export type Locator =
  | { type: "epub"; cfi: string }
  | { type: "pdf"; page: number; offset: number };
