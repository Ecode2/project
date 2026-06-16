"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark as BookmarkIcon,
  ChevronFirst,
  ChevronLast,
  List,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Gauge,
  Mic2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useReader } from "@/hooks/use-reader";
import { useMediaSession } from "@/hooks/use-media-session";
import { addBookmark, listVoices } from "@/lib/reader-api";
import type { Book, ReaderSettings, TocEntry, Voice } from "@/lib/reader-types";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEP_PRESETS = [5, 10, 15, 30, 60];

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = (h ? m % 60 : m).toString().padStart(h ? 2 : 1, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function NowPlaying({ book, settings }: { book: Book; settings: ReaderSettings }) {
  const { toast } = useToast();
  const reader = useReader(book.id, settings.speed || 1);
  const { state } = reader;
  const [voices, setVoices] = useState<Voice[]>([]);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);

  const skipBack = settings.skip_back_seconds ?? 15;
  const skipFwd = settings.skip_forward_seconds ?? 30;

  const total = state.totalSegments || book.total_segments || 1;
  const durationMs = book.duration_estimate_ms || 0;
  const elapsedMs = (state.currentIndex / Math.max(1, total)) * durationMs;

  // Sleep timer: counts down then pauses with a soft stop.
  useEffect(() => {
    if (sleepLeft == null) return;
    if (sleepLeft <= 0) {
      reader.pause();
      setSleepLeft(null);
      toast({ title: "Sleep timer", description: "Playback paused." });
      return;
    }
    const t = setTimeout(() => setSleepLeft((v) => (v == null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [sleepLeft, reader, toast]);

  useMediaSession({
    title: book.title,
    artist: book.author || undefined,
    artwork: book.cover_url,
    playing: state.playing,
    onPlay: () => reader.play(),
    onPause: () => reader.pause(),
    onPreviousChapter: reader.prevChapter,
    onNextChapter: reader.nextChapter,
    onSeekBackward: () => reader.skip(-1),
    onSeekForward: () => reader.skip(1),
  });

  const chapters = useMemo(() => state.toc as TocEntry[], [state.toc]);

  async function openVoices() {
    if (voices.length) return;
    try {
      setVoices(await listVoices(book.language_code));
    } catch {
      toast({ title: "Voices unavailable", variant: "destructive" });
    }
  }

  async function bookmark() {
    try {
      await addBookmark(book.id, {
        segment_index: state.currentIndex,
        label: chapters[state.currentChapter]?.title || `Segment ${state.currentIndex}`,
      });
      toast({ title: "Bookmark added" });
    } catch {
      toast({ title: "Could not add bookmark", variant: "destructive" });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-6 px-6 py-8">
      {/* Artwork */}
      <div className="aspect-square w-64 overflow-hidden rounded-3xl bg-muted shadow-2xl shadow-black/30">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground">
            {book.title.slice(0, 1)}
          </div>
        )}
      </div>

      {/* Title + current sentence */}
      <div className="w-full text-center">
        <h1 className="text-xl font-semibold leading-tight">{book.title}</h1>
        {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
        <p className="mt-4 min-h-[3.5rem] text-balance text-sm text-muted-foreground">
          {state.currentText || (state.connection === "open" ? "Ready to play" : "Connecting…")}
        </p>
      </div>

      {/* Scrubber */}
      <div className="w-full">
        <Slider
          value={[state.currentIndex]}
          max={Math.max(1, total - 1)}
          step={1}
          onValueCommit={([v]) => reader.seek(v)}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{fmt(elapsedMs)}</span>
          <span>-{fmt(Math.max(0, durationMs - elapsedMs))}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="flex w-full items-center justify-between">
        <Button variant="ghost" size="icon" onClick={reader.prevChapter} aria-label="Previous chapter">
          <ChevronFirst className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => reader.skip(-1)} aria-label={`Back ${skipBack}s`}>
          <RotateCcw className="h-6 w-6" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full"
          onClick={reader.toggle}
          aria-label={state.playing ? "Pause" : "Play"}
        >
          {state.playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => reader.skip(1)} aria-label={`Forward ${skipFwd}s`}>
          <RotateCw className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={reader.nextChapter} aria-label="Next chapter">
          <ChevronLast className="h-6 w-6" />
        </Button>
      </div>

      {/* Secondary controls */}
      <div className="flex w-full items-center justify-around pt-2">
        {/* Speed */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs">
              <Gauge className="h-5 w-5" /> {state.speed}×
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader><SheetTitle>Playback speed</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-2 py-4">
              {SPEEDS.map((s) => (
                <Button key={s} variant={s === state.speed ? "default" : "outline"}
                  onClick={() => reader.setSpeed(s)}>{s}×</Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Voice */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs" onClick={openVoices}>
              <Mic2 className="h-5 w-5" /> Voice
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader><SheetTitle>Voice</SheetTitle></SheetHeader>
            <ScrollArea className="h-[55vh] py-2">
              <div className="flex flex-col gap-1">
                {voices.length === 0 && <p className="p-2 text-sm text-muted-foreground">Loading…</p>}
                {voices.map((v) => (
                  <Button key={v.name} variant={v.name === state.voice ? "default" : "ghost"}
                    className="justify-start" onClick={() => reader.setVoice(v.name)}>
                    {v.name} · {v.ssml_gender.toLowerCase()}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Sleep timer */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs">
              <Moon className="h-5 w-5" /> {sleepLeft != null ? fmt(sleepLeft * 1000) : "Sleep"}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader><SheetTitle>Sleep timer</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-2 py-4">
              {SLEEP_PRESETS.map((m) => (
                <Button key={m} variant="outline" onClick={() => setSleepLeft(m * 60)}>{m} min</Button>
              ))}
              <Button variant="outline" onClick={() => setSleepLeft(null)}>Off</Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Bookmark */}
        <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs" onClick={bookmark}>
          <BookmarkIcon className="h-5 w-5" /> Mark
        </Button>

        {/* Chapters */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs">
              <List className="h-5 w-5" /> Chapters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader><SheetTitle>Chapters</SheetTitle></SheetHeader>
            <ScrollArea className="h-[55vh] py-2">
              <div className="flex flex-col gap-1">
                {chapters.map((c) => (
                  <Button key={c.index}
                    variant={c.index === state.currentChapter ? "default" : "ghost"}
                    className="justify-start text-left"
                    onClick={() => reader.seek((c as TocEntry).start_segment)}>
                    {c.title}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
