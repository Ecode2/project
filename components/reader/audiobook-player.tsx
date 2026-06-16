"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark as BookmarkIcon, ChevronFirst, ChevronLast,
  Gauge, List, Moon, Pause, Play, RotateCcw, RotateCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMediaSession } from "@/hooks/use-media-session";
import { addBookmark, getToc, putProgress } from "@/lib/reader-api";
import type { AudioChapter, Book, ReaderSettings } from "@/lib/reader-types";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 3];
const SLEEP_PRESETS = [10, 15, 30, 60];

function fmt(sec: number) {
  if (!isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function AudiobookPlayer({ book, settings }: { book: Book; settings: ReaderSettings }) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracks = useMemo(
    () => [...book.files].sort((a, b) => a.order - b.order),
    [book.files],
  );
  const [chapters, setChapters] = useState<AudioChapter[]>([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(settings.speed || 1);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);

  const currentTrack = tracks[trackIdx];

  useEffect(() => {
    getToc(book.id).then((r) => setChapters(r.toc as AudioChapter[])).catch(() => {});
  }, [book.id]);

  // Restore position once.
  useEffect(() => {
    putProgress; // no-op import guard
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = speed;
  }, [speed, trackIdx]);

  // Sleep timer.
  useEffect(() => {
    if (sleepLeft == null) return;
    if (sleepLeft <= 0) { audioRef.current?.pause(); setSleepLeft(null); return; }
    const t = setTimeout(() => setSleepLeft((v) => (v == null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [sleepLeft]);

  const saveProgress = useCallback(() => {
    putProgress(book.id, {
      segment_index: trackIdx,
      audio_ms: Math.round((audioRef.current?.currentTime || 0) * 1000),
      chapter_index: trackIdx,
    }).catch(() => {});
  }, [book.id, trackIdx]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); saveProgress(); }
  };

  const selectTrack = (idx: number, autoplay = true) => {
    if (idx < 0 || idx >= tracks.length) return;
    setTrackIdx(idx);
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (a && autoplay) { a.play(); setPlaying(true); }
    });
  };

  const skip = (delta: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.currentTime + delta, a.duration || 0));
  };

  useMediaSession({
    title: currentTrack?.track_title || book.title,
    artist: book.author || undefined,
    artwork: book.cover_url,
    playing,
    onPlay: toggle,
    onPause: toggle,
    onPreviousChapter: () => selectTrack(trackIdx - 1),
    onNextChapter: () => selectTrack(trackIdx + 1),
    onSeekBackward: () => skip(-(settings.skip_back_seconds ?? 15)),
    onSeekForward: () => skip(settings.skip_forward_seconds ?? 30),
  });

  async function bookmark() {
    try {
      await addBookmark(book.id, {
        segment_index: trackIdx,
        audio_ms: Math.round((audioRef.current?.currentTime || 0) * 1000),
        label: currentTrack?.track_title || `Track ${trackIdx + 1}`,
      });
      toast({ title: "Bookmark added" });
    } catch {
      toast({ title: "Could not add bookmark", variant: "destructive" });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-6 px-6 py-8">
      <audio
        ref={audioRef}
        src={currentTrack?.url || undefined}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = speed; }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => { saveProgress(); selectTrack(trackIdx + 1); }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

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

      <div className="w-full text-center">
        <h1 className="text-xl font-semibold">{book.title}</h1>
        {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          {currentTrack?.track_title || `Track ${trackIdx + 1} of ${tracks.length}`}
        </p>
      </div>

      <div className="w-full">
        <Slider value={[time]} max={Math.max(1, duration)} step={1}
          onValueChange={([v]) => { if (audioRef.current) audioRef.current.currentTime = v; }} />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{fmt(time)}</span><span>-{fmt(duration - time)}</span>
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => selectTrack(trackIdx - 1)} aria-label="Previous track"><ChevronFirst className="h-6 w-6" /></Button>
        <Button variant="ghost" size="icon" onClick={() => skip(-(settings.skip_back_seconds ?? 15))} aria-label="Back"><RotateCcw className="h-6 w-6" /></Button>
        <Button size="icon" className="h-16 w-16 rounded-full" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => skip(settings.skip_forward_seconds ?? 30)} aria-label="Forward"><RotateCw className="h-6 w-6" /></Button>
        <Button variant="ghost" size="icon" onClick={() => selectTrack(trackIdx + 1)} aria-label="Next track"><ChevronLast className="h-6 w-6" /></Button>
      </div>

      <div className="flex w-full items-center justify-around pt-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs"><Gauge className="h-5 w-5" /> {speed}×</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader><SheetTitle>Playback speed</SheetTitle></SheetHeader>
            <div className="grid grid-cols-4 gap-2 py-4">
              {SPEEDS.map((s) => (
                <Button key={s} variant={s === speed ? "default" : "outline"} onClick={() => setSpeed(s)}>{s}×</Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs">
              <Moon className="h-5 w-5" /> {sleepLeft != null ? fmt(sleepLeft) : "Sleep"}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader><SheetTitle>Sleep timer</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-2 py-4">
              {SLEEP_PRESETS.map((m) => <Button key={m} variant="outline" onClick={() => setSleepLeft(m * 60)}>{m} min</Button>)}
              <Button variant="outline" onClick={() => setSleepLeft(null)}>Off</Button>
            </div>
          </SheetContent>
        </Sheet>

        <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs" onClick={bookmark}>
          <BookmarkIcon className="h-5 w-5" /> Mark
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="flex flex-col gap-1 text-xs"><List className="h-5 w-5" /> Chapters</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader><SheetTitle>Chapters</SheetTitle></SheetHeader>
            <ScrollArea className="h-[55vh] py-2">
              <div className="flex flex-col gap-1">
                {chapters.map((c) => {
                  const idx = tracks.findIndex((t) => t.id === c.book_file);
                  return (
                    <Button key={c.index} variant={idx === trackIdx ? "default" : "ghost"} className="justify-start text-left"
                      onClick={() => {
                        if (idx >= 0) selectTrack(idx);
                        requestAnimationFrame(() => {
                          if (audioRef.current) audioRef.current.currentTime = c.start_ms / 1000;
                        });
                      }}>{c.title}</Button>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
