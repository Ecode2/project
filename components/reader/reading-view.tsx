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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft, BookOpen, ChevronLeft, Headphones, LogIn, Minus, Pause, Play, Plus, Type,
} from "lucide-react";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/components/player/player-provider";
import {
  getSegments, putProgress, putProgressKeepalive, putReaderSettings,
} from "@/lib/reader-api";
import {
  FONTS, MAX_SIZE, MIN_SIZE, THEMES, loadPrefs, savePrefs,
  type Prefs, type ThemeKey,
} from "./reader-theme";
import type { ReaderSettings, Segment, TocEntry } from "@/lib/reader-types";
import { cn } from "@/lib/utils";

const PAGE = 150;

export function ReadingView({
  settings,
  onSwitchToListen,
  onSwitchToPages,
}: {
  settings: ReaderSettings;
  onSwitchToListen: () => void;
  /** Present when the book is an EPUB/PDF that can be shown as real pages. */
  onSwitchToPages?: () => void;
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
    savePrefs(next);
    // Best-effort sync so the choice follows the reader across devices.
    putReaderSettings({
      theme: next.theme,
      font_size: next.fontSize,
      font_family: next.fontStack,
    }).catch(() => {});
  }, []);

  // The first loaded window is centred on the saved position, so the reader
  // opens on the sentence they stopped at rather than the top of the book (or
  // the start of the chapter). Earlier text loads as they scroll up.
  const playerRef = useRef(player);
  playerRef.current = player;
  const pendingScrollRef = useRef<number | null>(null);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const restoredRef = useRef(false);
  const lastSavedRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const fetchWindow = useCallback(
    async (start: number, count: number) => {
      if (!bookId) return null;
      try {
        return await getSegments(bookId, start, count);
      } catch {
        return null;
      }
    },
    [bookId],
  );

  const loadMore = useCallback(async () => {
    if (!bookId || inFlightRef.current || segments.length === 0) return;
    inFlightRef.current = true;
    setLoading(true);
    const next = segments[segments.length - 1].index + 1;
    const res = await fetchWindow(next, PAGE);
    if (res) {
      setSegments((prev) => {
        // Merge by index: a retry or overlapping window must never duplicate.
        const seen = new Set(prev.map((x) => x.index));
        return [...prev, ...res.segments.filter((x) => !seen.has(x.index))];
      });
      setTotal(res.total);
    }
    inFlightRef.current = false;
    setLoading(false);
  }, [bookId, segments, fetchWindow]);

  const loadBefore = useCallback(async () => {
    if (!bookId || inFlightRef.current || segments.length === 0) return;
    const first = segments[0].index;
    if (first <= 0) return;
    inFlightRef.current = true;
    const start = Math.max(0, first - PAGE);
    const res = await fetchWindow(start, first - start);
    const el = scrollerRef.current;
    if (res && el) {
      prependRef.current = { height: el.scrollHeight, top: el.scrollTop };
      setSegments((prev) => {
        const seen = new Set(prev.map((x) => x.index));
        return [...res.segments.filter((x) => !seen.has(x.index)), ...prev];
      });
    }
    inFlightRef.current = false;
  }, [bookId, segments, fetchWindow]);

  // Open (or switch) a book: load a window around the saved position.
  useEffect(() => {
    if (!bookId || loadedForRef.current === bookId) return;
    loadedForRef.current = bookId;
    restoredRef.current = false;
    lastSavedRef.current = null;
    setSegments([]);
    setTotal(0);
    inFlightRef.current = true;
    setLoading(true);
    const resume = playerRef.current.segmentIndex || 0;
    fetchWindow(Math.max(0, resume - 40), PAGE).then((res) => {
      inFlightRef.current = false;
      setLoading(false);
      if (!res) return;
      pendingScrollRef.current = resume;
      setSegments(res.segments);
      setTotal(res.total);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // After segments render: restore the saved spot, or keep the viewport steady
  // when text was prepended above it.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (prependRef.current) {
      const { height, top } = prependRef.current;
      el.scrollTop = top + (el.scrollHeight - height);
      prependRef.current = null;
      return;
    }
    if (pendingScrollRef.current !== null) {
      const target = el.querySelector<HTMLElement>(
        `[data-i="${pendingScrollRef.current}"]`,
      );
      if (target) {
        target.scrollIntoView({ block: "start" });
        pendingScrollRef.current = null;
        // Let the scroll event this triggers pass before we start saving.
        requestAnimationFrame(() => { restoredRef.current = true; });
      }
    }
  }, [segments]);

  // Follow the narration.
  useEffect(() => {
    if (!player.playing) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [player.segmentIndex, player.playing]);

  // -- saving where the reader is ---------------------------------------
  const chapterFor = useCallback((index: number) => {
    const toc = (playerRef.current.toc as TocEntry[]) ?? [];
    let ch = 0;
    for (const c of toc) {
      if ((c.start_segment ?? 0) <= index) ch = c.index;
      else break;
    }
    return ch;
  }, []);

  const flushSave = useCallback((keepalive = false) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const idx = lastSavedRef.current;
    const id = playerRef.current.book?.id;
    if (idx === null || !id || pendingSaveRef.current !== idx) return;
    pendingSaveRef.current = null;
    const body = { segment_index: idx, chapter_index: chapterFor(idx) };
    (keepalive ? putProgressKeepalive(id, body) : putProgress(id, body)).catch(() => {});
  }, [chapterFor]);
  const pendingSaveRef = useRef<number | null>(null);

  const reportPosition = useCallback((index: number) => {
    // While narrating, the player owns the position (and saves it itself).
    if (playerRef.current.playing) return;
    if (lastSavedRef.current === index) return;
    lastSavedRef.current = index;
    pendingSaveRef.current = index;
    playerRef.current.setReadingPosition(index);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(false), 1500);
  }, [flushSave]);

  // Final flush when the tab is hidden/closed or the view unmounts.
  useEffect(() => {
    const onHide = () => flushSave(true);
    const onVis = () => { if (document.visibilityState === "hidden") flushSave(true); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      flushSave(true);
    };
  }, [flushSave]);

  // Index of the first paragraph whose bottom is below the top bar.
  const topVisibleIndex = useCallback((): number | null => {
    const el = scrollerRef.current;
    const nodes = el?.querySelectorAll<HTMLElement>("[data-i]");
    if (!el || !nodes || nodes.length === 0) return null;
    const line = el.getBoundingClientRect().top + 80;
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid].getBoundingClientRect().bottom > line) hi = mid;
      else lo = mid + 1;
    }
    return Number(nodes[lo].dataset.i);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!loading) {
      if (el.scrollTop < 900) loadBefore();
      if (segments.length < total && el.scrollTop + el.clientHeight >= el.scrollHeight - 1200) {
        loadMore();
      }
    }
    if (!restoredRef.current || rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const idx = topVisibleIndex();
      if (idx !== null) reportPosition(idx);
    });
  }, [loading, segments.length, total, loadMore, loadBefore, topVisibleIndex, reportPosition]);

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
          {onSwitchToPages && (
            <button type="button" aria-label="Page view" onClick={onSwitchToPages}
              className="flex h-11 w-11 items-center justify-center" style={{ color: theme.fg }}>
              <BookOpen className="h-5 w-5" />
            </button>
          )}
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
                  data-i={seg.index}
                  ref={active ? activeRef : undefined}
                  onClick={(e) => {
                    // Seeking is a deliberate action; don't also toggle chrome.
                    e.stopPropagation();
                    player.seekSegment(seg.index);
                  }}
                  className={cn(
                    "-mx-2 scroll-mt-20 cursor-pointer rounded-md px-2 transition-colors",
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
                player.authRequired ? router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`) : player.toggle()}
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
