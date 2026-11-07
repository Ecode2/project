"use client";

/**
 * The book as a book: the real EPUB / PDF pages, pictures and all.
 *
 * This shell owns the chrome (bars, contents, appearance) and where the reader
 * is saved; the two surfaces own rendering. Position is saved as the exact
 * in-format locator (EPUB CFI / PDF page+offset) and also mapped onto the
 * canonical segment index, so switching to the text view or to narration
 * continues from the same place.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft, ChevronLeft, ChevronRight, Headphones, Loader2, Minus, Plus, Type,
  FileText,
} from "lucide-react";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/components/player/player-provider";
import { getProgress, putProgress, putProgressKeepalive, putReaderSettings } from "@/lib/reader-api";
import type { ReaderSettings, ReadingProgress } from "@/lib/reader-types";
import { cn } from "@/lib/utils";

import { EpubSurface } from "./epub-surface";
import { PdfSurface } from "./pdf-surface";
import type { SurfaceHandle, SurfaceLocation, TocItem } from "./page-types";
import {
  FONTS, MAX_SIZE, MIN_SIZE, THEMES, loadPrefs, savePrefs,
  type Locator, type Prefs, type ThemeKey,
} from "./reader-theme";

export function pageFileFor(files: { fmt: string; url: string | null }[] | undefined) {
  return files?.find((f) => (f.fmt === "epub" || f.fmt === "pdf") && f.url) ?? null;
}

export function PageView({
  settings,
  onSwitchToText,
  onSwitchToListen,
}: {
  settings: ReaderSettings;
  onSwitchToText: () => void;
  onSwitchToListen: () => void;
}) {
  const player = usePlayer();
  const router = useRouter();
  const book = player.book;
  const file = pageFileFor(book?.files);

  const [prefs, setPrefs] = useState<Prefs>(() =>
    loadPrefs({
      theme: (Object.keys(THEMES) as ThemeKey[]).includes(settings.theme as ThemeKey)
        ? (settings.theme as ThemeKey)
        : "sepia",
      fontStack: FONTS[0].stack,
      fontSize: settings.font_size || 19,
    }),
  );
  const theme = THEMES[prefs.theme];

  const [chromeVisible, setChromeVisible] = useState(true);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loc, setLoc] = useState<SurfaceLocation | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState<ReadingProgress | null | undefined>(undefined);
  const handleRef = useRef<SurfaceHandle | null>(null);

  const persistPrefs = useCallback((next: Prefs) => {
    setPrefs(next);
    savePrefs(next);
    putReaderSettings({
      theme: next.theme, font_size: next.fontSize, font_family: next.fontStack,
    }).catch(() => {});
  }, []);

  // Where did the reader stop? Fetched once, before the surface mounts.
  useEffect(() => {
    if (!book) return;
    let active = true;
    setInitial(undefined);
    getProgress(book.id)
      .then((p) => active && setInitial(p))
      .catch(() => active && setInitial(null)); // signed out / no progress yet
    return () => { active = false; };
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- saving -----------------------------------------------------------
  const pendingRef = useRef<{ id: string; body: Partial<ReadingProgress> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((keepalive = false) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    (keepalive ? putProgressKeepalive(p.id, p.body) : putProgress(p.id, p.body)).catch(() => {});
  }, []);

  const onLocation = useCallback((l: SurfaceLocation) => {
    setLoc(l);
    if (!book) return;
    const total = player.totalSegments || book.total_segments || 0;
    const body: Partial<ReadingProgress> = { locator: l.locator as unknown as Record<string, unknown> };
    if (l.page) body.page = l.page;
    if (l.percent >= 0) {
      body.percent = l.percent;
      if (total > 0) {
        // Map onto the canonical anchor so text view / narration continue here.
        const seg = Math.min(total - 1, Math.floor((l.percent / 100) * total));
        body.segment_index = seg;
        player.setReadingPosition(seg);
      }
    }
    pendingRef.current = { id: book.id, body };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(false), 1500);
  }, [book, player, flush]);

  useEffect(() => {
    const onHide = () => flush(true);
    const onVis = () => { if (document.visibilityState === "hidden") flush(true); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      flush(true);
    };
  }, [flush]);

  const leave = (to: () => void) => { flush(false); to(); };

  if (!book) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {player.loading ? "Opening…" : "Nothing is open."}
      </div>
    );
  }

  const isEpub = file?.fmt === "epub";
  const locator = (initial?.locator && "type" in initial.locator
    ? (initial.locator as unknown as Locator)
    : null);
  const surfaceProps = file && initial !== undefined ? {
    url: file.url as string,
    initialLocator: locator,
    initialPercent: initial?.percent ?? 0,
    prefs,
    onLocation,
    onTap: () => setChromeVisible((v) => !v),
    onToc: setToc,
    onError: setError,
    onReady: () => setReady(true),
    handleRef,
  } : null;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex items-center justify-between px-2 pt-safe transition-all duration-300",
          chromeVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        )}
        style={{ backgroundColor: theme.bg }}
      >
        <button type="button" aria-label="Back to book" className="flex h-11 w-11 items-center justify-center"
          onClick={() => leave(() => router.push(`/books/${book.id}`))} style={{ color: theme.fg }}>
          <ChevronLeft className="h-6 w-6" />
        </button>

        <p className="truncate px-2 text-xs" style={{ color: theme.muted }}>
          {loc?.label || book.title}
        </p>

        <div className="flex items-center">
          <button type="button" aria-label="Text view" className="flex h-11 w-11 items-center justify-center"
            onClick={() => leave(onSwitchToText)} style={{ color: theme.fg }}>
            <FileText className="h-5 w-5" />
          </button>

          <Sheet>
            <SheetTrigger asChild>
              <button type="button" aria-label="Contents" className="flex h-11 w-11 items-center justify-center"
                style={{ color: theme.fg }}>
                <AlignLeft className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh]">
              <SheetHeader><SheetTitle>Contents</SheetTitle></SheetHeader>
              <ScrollArea className="h-[60vh] py-2">
                <div className="flex flex-col pr-3">
                  {toc.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">No chapters detected.</p>
                  )}
                  {toc.map((c, i) => (
                    <button
                      key={`${i}-${c.target}`}
                      type="button"
                      onClick={() => { handleRef.current?.goto(c.target); setChromeVisible(false); }}
                      className="rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                      style={{ paddingLeft: `${0.75 + c.depth * 0.9}rem` }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <button type="button" aria-label="Appearance" className="flex h-11 w-11 items-center justify-center"
                style={{ color: theme.fg }}>
                <Type className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Appearance</SheetTitle></SheetHeader>
              <div className="space-y-6 py-5">
                {isEpub && (
                  <div className="flex items-center gap-4">
                    <button type="button" aria-label="Smaller text"
                      onClick={() => persistPrefs({ ...prefs, fontSize: Math.max(MIN_SIZE, prefs.fontSize - 1) })}
                      className="flex h-11 flex-1 items-center justify-center rounded-xl bg-secondary">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-sm tabular-nums text-muted-foreground">{prefs.fontSize}</span>
                    <button type="button" aria-label="Larger text"
                      onClick={() => persistPrefs({ ...prefs, fontSize: Math.min(MAX_SIZE, prefs.fontSize + 1) })}
                      className="flex h-11 flex-1 items-center justify-center rounded-xl bg-secondary">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                    <button key={key} type="button" aria-label={THEMES[key].label}
                      onClick={() => persistPrefs({ ...prefs, theme: key })}
                      className={cn(
                        "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 text-[11px] transition",
                        prefs.theme === key ? "border-primary" : "border-transparent",
                      )}
                      style={{ backgroundColor: THEMES[key].bg, color: THEMES[key].fg }}>
                      <span className="font-serif text-base">Aa</span>
                      {THEMES[key].label}
                    </button>
                  ))}
                </div>

                {isEpub && (
                  <div className="space-y-1">
                    {FONTS.map((f) => (
                      <button key={f.label} type="button"
                        onClick={() => persistPrefs({ ...prefs, fontStack: f.stack })}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                          prefs.fontStack === f.stack ? "bg-secondary" : "hover:bg-secondary/60",
                        )}>
                        <span style={{ fontFamily: f.stack }}>{f.label}</span>
                        {prefs.fontStack === f.stack && <span className="text-xs text-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 px-0 pb-0 pt-0">
        {surfaceProps && !error && (
          <div className={cn("h-full w-full", isEpub && "px-4 pb-16 pt-14 sm:px-10")}>
            {isEpub ? <EpubSurface {...surfaceProps} /> : <PdfSurface {...surfaceProps} />}
          </div>
        )}

        {!ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ color: theme.muted }}>
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm" style={{ color: theme.muted }}>{error}</p>
            <button type="button" onClick={() => leave(onSwitchToText)}
              className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">
              Open the text view instead
            </button>
          </div>
        )}
      </div>

      <footer
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-5 pb-safe transition-all duration-300",
          chromeVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-[11px] tabular-nums" style={{ color: theme.muted }}>
            {loc && loc.percent >= 0 ? `${Math.round(loc.percent)}%` : "…"}
            {loc?.page ? ` · ${loc.label}` : ""}
          </span>
          <div className="flex items-center gap-1">
            {isEpub && (
              <>
                <button type="button" aria-label="Previous page" onClick={() => handleRef.current?.prev()}
                  className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: theme.fg }}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Next page" onClick={() => handleRef.current?.next()}
                  className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: theme.fg }}>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <button type="button" aria-label="Switch to listening" onClick={() => leave(onSwitchToListen)}
              className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: theme.fg }}>
              <Headphones className="h-5 w-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
