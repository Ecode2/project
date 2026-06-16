"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AArrowDown, AArrowUp, Headphones, List, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSegments, getToc, putProgress, putReaderSettings } from "@/lib/reader-api";
import type { Book, ReaderSettings, Segment, Theme, TocEntry } from "@/lib/reader-types";

const THEMES: Theme[] = ["light", "sepia", "dark", "night"];
const FONTS = ["Georgia", "Iowan", "Charter", "system-ui", "Palatino"];
const PAGE = 100;

export function ReaderView({ book, settings }: { book: Book; settings: ReaderSettings }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [total, setTotal] = useState(book.total_segments || 0);
  const [theme, setTheme] = useState<Theme>(settings.theme || "light");
  const [fontSize, setFontSize] = useState(settings.font_size || 18);
  const [fontFamily, setFontFamily] = useState(settings.font_family || "Georgia");
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    if (total && segments.length >= total) return;
    loadingRef.current = true;
    try {
      const res = await getSegments(book.id, segments.length, PAGE);
      setTotal(res.total);
      setSegments((prev) => [...prev, ...res.segments]);
    } finally {
      loadingRef.current = false;
    }
  }, [book.id, segments.length, total]);

  useEffect(() => {
    getToc(book.id).then((r) => setToc(r.toc as TocEntry[])).catch(() => {});
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const persistSettings = (patch: Partial<ReaderSettings>) => {
    putReaderSettings(patch).catch(() => {});
  };

  const jumpTo = (startSegment: number) => {
    const el = document.getElementById(`seg-${startSegment}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Load forward until the target is present.
      loadMore();
    }
    putProgress(book.id, { segment_index: startSegment }).catch(() => {});
  };

  return (
    <div className="reader-surface min-h-screen" data-theme={theme}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-[var(--reader-bg)]/80 px-4 py-3 backdrop-blur">
        <Link href={`/books/${book.id}`}>
          <Button variant="ghost" size="sm">Back</Button>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => {
            const v = Math.max(14, fontSize - 1); setFontSize(v); persistSettings({ font_size: v });
          }} aria-label="Smaller text"><AArrowDown className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => {
            const v = Math.min(28, fontSize + 1); setFontSize(v); persistSettings({ font_size: v });
          }} aria-label="Larger text"><AArrowUp className="h-5 w-5" /></Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme & font"><Palette className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Appearance</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button key={t} onClick={() => { setTheme(t); persistSettings({ theme: t }); }}
                      className="reader-surface flex-1 rounded-xl border p-3 text-sm capitalize" data-theme={t}
                      style={{ background: "var(--reader-bg)", color: "var(--reader-fg)" }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((f) => (
                    <Button key={f} variant={f === fontFamily ? "default" : "outline"}
                      onClick={() => { setFontFamily(f); persistSettings({ font_family: f }); }}
                      style={{ fontFamily: f }}>{f}</Button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Chapters"><List className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader><SheetTitle>Chapters</SheetTitle></SheetHeader>
              <ScrollArea className="h-[55vh] py-2">
                <div className="flex flex-col gap-1">
                  {toc.map((c) => (
                    <Button key={c.index} variant="ghost" className="justify-start text-left"
                      onClick={() => jumpTo(c.start_segment)}>{c.title}</Button>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Link href={`/reader/${book.id}?mode=listen`}>
            <Button variant="ghost" size="icon" aria-label="Listen"><Headphones className="h-5 w-5" /></Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="mx-auto max-w-2xl px-6 py-10"
        style={{ fontFamily, fontSize: `${fontSize}px` }}>
        {segments.map((s) => {
          const Tag = s.kind === "heading" ? "h2" : "p";
          return (
            <Tag key={s.index} id={`seg-${s.index}`}
              className={`reader-segment mb-5 ${s.kind === "heading" ? "reader-heading mt-8 text-2xl" : ""} ${s.kind === "quote" ? "border-l-4 pl-4 italic" : ""}`}>
              {s.text}
            </Tag>
          );
        })}
        <div ref={sentinelRef} className="h-16" />
      </article>
    </div>
  );
}
