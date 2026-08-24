"use client";

/**
 * Reading surface, modelled on the iOS Books app.
 *
 * The page is a *paper* surface, not app chrome: it owns its own background and
 * text colour (White / Sepia / Gray / Night) and deliberately escapes the dark
 * shell, because reading comfort depends on the whole viewport, not a panel.
 *
 * Chrome (top and bottom bars) hides on tap so only the text remains, and
 * reappears on the next tap — the central interaction of Books.
 *
 * The view also stays bound to the player: while narration plays, the spoken
 * paragraph is highlighted and scrolled into view, and tapping any paragraph
 * seeks playback there. It never opens its own reader session.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft, ChevronLeft, Headphones, LogIn, Minus, Pause, Play, Plus, Type,
} from "lucide-react";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/components/player/player-provider";
import { getSegments, putReaderSettings } from "@/lib/reader-api";
import type { ReaderSettings, Segment, TocEntry } from "@/lib/reader-types";
import { cn } from "@/lib/utils";

const PAGE = 150;

/**
 * Apple Books' four reading themes. The keys deliberately match the backend's
 * THEME_CHOICES (light/sepia/dark/night) so a choice round-trips through
 * ReaderSettings; only the label follows Books' naming.
 */
const THEMES = {
  light: { label: "White", bg: "#FFFFFF", fg: "#16161A", muted: "#8A8A8E" },
  sepia: { label: "Sepia", bg: "#FBF0D9", fg: "#3B3128", muted: "#8C7B62" },
  dark:  { label: "Gray",  bg: "#3A3A3C", fg: "#E6E6E8", muted: "#A0A0A6" },
  night: { label: "Night", bg: "#000000", fg: "#B9B9BE", muted: "#6E6E76" },
} as const;

type ThemeKey = keyof typeof THEMES;

const FONTS = [
  { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { label: "Palatino", stack: '"Palatino Linotype", Palatino, Georgia, serif' },
  { label: "New York", stack: 'ui-serif, "New York", Georgia, serif' },
  { label: "System", stack: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: "Helvetica", stack: 'Helvetica, "Helvetica Neue", Arial, sans-serif' },
];

const MIN_SIZE = 14;
const MAX_SIZE = 30;
const PREFS_KEY = "bookverse.reading-prefs";

interface Prefs {
  theme: ThemeKey;
  fontStack: string;
  fontSize: number;
}

function loadPrefs(fallback: Prefs): Prefs {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function ReadingView({
  settings,
  onSwitchToListen,
}: {
  settings: ReaderSettings;
  onSwitchToListen: () => void;
}) {
  const player = usePlayer();
  const router = useRouter();

  const [prefs, setPrefs] = useState<Prefs>(() =>
    loadPrefs({
      theme: (Object.keys(THEMES) as ThemeKey[]).includes(settings.theme as ThemeKey)
        ? (settings.theme as ThemeKey)
        : "sepia",
      fontStack: FONTS[0].stack,
      fontSize: settings.font_size || 19,
    }),
  );
  const [chromeVisible, setChromeVisible] = useState(true);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const bookId = player.book?.id;
  const theme = THEMES[prefs.theme];

  // Synchronous guards. React StrictMode invokes effects twice in development,
  // and `loading` state is not updated by the time the second invocation runs,
  // so a state-based guard let two identical fetches through -- appending the
  // same segments twice and producing duplicate React keys.
  const inFlightRef = useRef(false);
  const loadedForRef = useRef<string | null>(null);
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* private mode: in-memory only */
    }
    // Best-effort sync so the choice follows the reader across devices.
    putReaderSettings({
      theme: next.theme,
      font_size: next.fontSize,
      font_family: next.fontStack,
    }).catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    if (!bookId || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const start = segments.length;
      const res = await getSegments(bookId, start, PAGE);
      setSegments((prev) => {
        // Merge by index: a retry or overlapping window must never duplicate.
        const seen = new Set(prev.map((s) => s.index));
        return [...prev, ...res.segments.filter((s) => !seen.has(s.index))];
      });
      setTotal(res.total);
    } catch {
      /* keep whatever we already have */
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [bookId, segments.length]);

  // Reset and load the first window when the book changes.
  useEffect(() => {
    if (!bookId || loadedForRef.current === bookId) return;
    loadedForRef.current = bookId;
    setSegments([]);
    setTotal(0);
    inFlightRef.current = false;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Follow the narration.
  useEffect(() => {
    if (!player.playing) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [player.segmentIndex, player.playing]);

  // Auto-load the next window as the reader nears the end of what is loaded.
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || loading || segments.length >= total) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1200) loadMore();
  }, [loading, segments.length, total, loadMore]);

  const chapters = (player.toc as TocEntry[]) ?? [];
  const currentChapter = chapters[player.chapterIndex];

  const readingProgress = useMemo(() => {
    if (!player.totalSegments) return 0;
    return Math.round((player.segmentIndex / player.totalSegments) * 100);
  }, [player.segmentIndex, player.totalSegments]);

  if (!player.book) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {player.loading ? "Opening…" : "Nothing is open."}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      {/* Top bar */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-center justify-between px-2 pt-safe",
          "transition-all duration-300",
          chromeVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        )}
        style={{ backgroundColor: theme.bg }}
      >
        <button
          type="button"
          onClick={() => router.push(`/books/${player.book!.id}`)}
          aria-label="Back to book"
          className="flex h-11 w-11 items-center justify-center"
          style={{ color: theme.fg }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <p className="truncate px-2 text-xs" style={{ color: theme.muted }}>
          {currentChapter?.title || player.book.title}
        </p>

        <div className="flex items-center">
          {/* Contents */}
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" aria-label="Contents"
                className="flex h-11 w-11 items-center justify-center" style={{ color: theme.fg }}>
                <AlignLeft className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh]">
              <SheetHeader><SheetTitle>Contents</SheetTitle></SheetHeader>
              <ScrollArea className="h-[60vh] py-2">
                <div className="flex flex-col pr-3">
                  {chapters.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">
                      No chapters detected.
                    </p>
                  )}
                  {chapters.map((c) => (
                    <button
                      key={c.index}
                      type="button"
                      onClick={() => {
                        player.seekSegment(c.start_segment);
                        setChromeVisible(false);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        c.index === player.chapterIndex
                          ? "bg-primary/15 font-medium text-primary"
                          : "hover:bg-secondary",
                      )}
                      style={{ paddingLeft: `${0.75 + (c.level ?? 0) * 0.75}rem` }}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Appearance (Aa) */}
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" aria-label="Appearance"
                className="flex h-11 w-11 items-center justify-center" style={{ color: theme.fg }}>
                <Type className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Appearance</SheetTitle></SheetHeader>

              <div className="space-y-6 py-5">
                {/* Font size */}
                <div className="flex items-center gap-4">
                  <button
                    type="button" aria-label="Smaller text"
                    onClick={() => persist({
                      ...prefs, fontSize: Math.max(MIN_SIZE, prefs.fontSize - 1),
                    })}
                    className="flex h-11 flex-1 items-center justify-center rounded-xl bg-secondary"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm tabular-nums text-muted-foreground">
                    {prefs.fontSize}
                  </span>
                  <button
                    type="button" aria-label="Larger text"
                    onClick={() => persist({
                      ...prefs, fontSize: Math.min(MAX_SIZE, prefs.fontSize + 1),
                    })}
                    className="flex h-11 flex-1 items-center justify-center rounded-xl bg-secondary"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {/* Themes */}
                <div className="flex items-center justify-between gap-3">
                  {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={THEMES[key].label}
                      onClick={() => persist({ ...prefs, theme: key })}
                      className={cn(
                        "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 text-[11px] transition",
                        prefs.theme === key ? "border-primary" : "border-transparent",
                      )}
                      style={{ backgroundColor: THEMES[key].bg, color: THEMES[key].fg }}
                    >
                      <span className="text-base font-serif">Aa</span>
                      {THEMES[key].label}
                    </button>
                  ))}
                </div>

                {/* Typeface */}
                <div className="space-y-1">
                  {FONTS.map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => persist({ ...prefs, fontStack: f.stack })}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                        prefs.fontStack === f.stack ? "bg-secondary" : "hover:bg-secondary/60",
                      )}
                    >
                      <span style={{ fontFamily: f.stack }}>{f.label}</span>
                      {prefs.fontStack === f.stack && (
                        <span className="text-xs text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* The page itself. Tapping bare text toggles chrome, as in Books. */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={() => setChromeVisible((v) => !v)}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto max-w-[38rem] px-6 pb-32 pt-20">
          {segments.length === 0 && loading && (
            <p className="py-20 text-center text-sm" style={{ color: theme.muted }}>
              Loading…
            </p>
          )}

          <article
            style={{
              fontFamily: prefs.fontStack,
              fontSize: prefs.fontSize,
              lineHeight: 1.62,
            }}
          >
            {segments.map((seg) => {
              const active = seg.index === player.segmentIndex;
              const heading = seg.kind === "heading";
              return (
                <p
                  key={seg.index}
                  ref={active ? activeRef : undefined}
                  onClick={(e) => {
                    // Seeking is a deliberate action; don't also toggle chrome.
                    e.stopPropagation();
                    player.seekSegment(seg.index);
                  }}
                  className={cn(
                    "-mx-2 cursor-pointer rounded-md px-2 transition-colors",
                    heading ? "mb-3 mt-8 font-semibold" : "mb-4",
                    active && player.playing && "bg-primary/15",
                  )}
                  style={heading ? { fontSize: prefs.fontSize * 1.35 } : undefined}
                >
                  {seg.text}
                </p>
              );
            })}
          </article>

          {loading && segments.length > 0 && (
            <p className="py-6 text-center text-xs" style={{ color: theme.muted }}>
              Loading more…
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar: progress + jump back to listening. */}
      <footer
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-5 pb-safe transition-all duration-300",
          chromeVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-[11px] tabular-nums" style={{ color: theme.muted }}>
            {readingProgress}% · {player.segmentIndex + 1} of {player.totalSegments || "…"}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              // Narration needs an account; send them to sign in rather than
              // pressing a button that can only fail.
              onClick={() =>
                player.authRequired ? router.push("/auth") : player.toggle()}
              aria-label={
                player.authRequired
                  ? "Sign in to listen"
                  : player.playing ? "Pause narration" : "Play narration"
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              {player.authRequired
                ? <LogIn className="h-4 w-4" />
                : player.playing
                  ? <Pause className="h-4 w-4" />
                  : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <button
              type="button"
              onClick={onSwitchToListen}
              aria-label="Switch to listening"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ color: theme.fg }}
            >
              <Headphones className="h-5 w-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
