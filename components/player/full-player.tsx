"use client";

/**
 * Immersive now-playing screen. Reads everything from the global player, so
 * dismissing it leaves playback running behind the mini-player.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark as BookmarkIcon, ChevronDown, ChevronFirst, ChevronLast, Gauge,
  Headphones, List, LogIn, Mic2, Moon, Pause, Play, RotateCcw, RotateCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMediaSession } from "@/hooks/use-media-session";
import { usePlayer } from "@/components/player/player-provider";
import { useUser } from "@/hooks/use-auth";
import { addBookmark, listVoices } from "@/lib/reader-api";
import type { AudioChapter, ReaderSettings, TocEntry, Voice } from "@/lib/reader-types";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEP_PRESETS = [5, 10, 15, 30, 60];

function clock(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return h ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function FullPlayer({ settings }: { settings: ReaderSettings }) {
  const player = usePlayer();
  const router = useRouter();
  const { toast } = useToast();
  // Bookmarks are per-user; a signed-out reader of a public book has nowhere
  // to save one, so don't offer an action that can only fail.
  const currentUser = useUser();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState(settings.language_code || "en-US");
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);

  const skipBack = settings.skip_back_seconds ?? 15;
  const skipFwd = settings.skip_forward_seconds ?? 30;
  const isAudio = player.kind === "audio";

  // Elapsed/remaining: real clock for audiobooks, estimated for narration.
  const { elapsed, total } = useMemo(() => {
    if (isAudio) return { elapsed: player.positionSec, total: player.durationSec };
    const totalSec = (player.book?.duration_estimate_ms || 0) / 1000;
    return { elapsed: totalSec * player.progress, total: totalSec };
  }, [isAudio, player.positionSec, player.durationSec, player.book, player.progress]);

  useEffect(() => {
    if (sleepLeft == null) return;
    if (sleepLeft <= 0) {
      player.pause();
      setSleepLeft(null);
      toast({ title: "Sleep timer", description: "Playback paused." });
      return;
    }
    const t = setTimeout(() => setSleepLeft((v) => (v == null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [sleepLeft, player, toast]);

  useMediaSession({
    title: player.book?.title ?? "",
    artist: player.book?.author || undefined,
    artwork: player.book?.cover_url ?? null,
    playing: player.playing,
    onPlay: player.play,
    onPause: player.pause,
    onPreviousChapter: player.prevChapter,
    onNextChapter: player.nextChapter,
    onSeekBackward: () => player.skipSeconds(-skipBack),
    onSeekForward: () => player.skipSeconds(skipFwd),
  });

  async function openVoices() {
    if (voices.length || loadingVoices) return;
    setLoadingVoices(true);
    try {
      setVoices(await listVoices());
    } catch {
      toast({ title: "Voices unavailable", variant: "destructive" });
    } finally {
      setLoadingVoices(false);
    }
  }

  const languages = useMemo(
    () => Array.from(new Set(voices.flatMap((v) => v.language_codes))).sort(),
    [voices],
  );
  const speakerGroups = useMemo(() => {
    const map = new Map<string, Voice[]>();
    voices
      .filter((v) => v.language_codes.includes(voiceLanguage))
      .forEach((v) => {
        const key = v.speaker || v.name;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(v);
      });
    Array.from(map.values()).forEach((list: Voice[]) =>
      list.sort((a: Voice, b: Voice) =>
        (a.emotion === "Default" ? "" : a.emotion ?? "").localeCompare(
          b.emotion === "Default" ? "" : b.emotion ?? "",
        ),
      ),
    );
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [voices, voiceLanguage]);

  const chapters = player.toc as (TocEntry | AudioChapter)[];

  async function bookmark() {
    if (!player.book) return;
    try {
      await addBookmark(player.book.id, {
        segment_index: isAudio ? player.trackIndex : player.segmentIndex,
        audio_ms: isAudio ? Math.round(player.positionSec * 1000) : undefined,
        label: `Chapter ${player.chapterIndex + 1}`,
      });
      toast({ title: "Bookmark added" });
    } catch {
      toast({ title: "Could not add bookmark", variant: "destructive" });
    }
  }

  if (!player.book) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {player.loading ? "Loading…" : "Nothing is playing."}
      </div>
    );
  }

  const book = player.book;

  if (player.authRequired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-8 text-center pt-safe">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Headphones className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Sign in to listen</h2>
          <p className="text-sm text-muted-foreground">
            Narration is available to signed-in readers. You can keep reading
            {book.title ? ` “${book.title}”` : " this book"} without an account.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button className="h-11 rounded-full" onClick={() => router.push("/auth")}>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </Button>
          <Button variant="ghost" className="h-11 rounded-full"
            onClick={() => router.push(`/reader/${book.id}?mode=read`)}>
            Read instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-secondary/40 via-background to-background pt-safe">
      {/* Dismiss back to wherever the user came from; audio keeps playing. */}
      <div className="flex items-center justify-between px-5 py-3">
        <Button variant="ghost" size="icon" aria-label="Close player"
          onClick={() => router.back()}>
          <ChevronDown className="h-6 w-6" />
        </Button>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {isAudio ? "Audiobook" : "Narrating"}
        </p>
        <div className="w-10" />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 pb-10">
        {/* Artwork */}
        <div className="mt-2 aspect-square w-full max-w-[17rem] overflow-hidden rounded-3xl bg-muted shadow-2xl shadow-black/50">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-muted-foreground">
              {book.title.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="w-full text-center">
          <h1 className="text-xl font-semibold leading-tight">{book.title}</h1>
          {book.author && (
            <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
          )}
          <p className="mt-4 min-h-[3.25rem] text-balance text-sm leading-relaxed text-muted-foreground">
            {isAudio
              ? player.tracks[player.trackIndex]?.track_title ?? ""
              : player.currentText ||
                (player.connection === "open" ? "Ready to play" : "Connecting…")}
          </p>
        </div>

        {/* Scrubber */}
        <div className="w-full">
          <Slider
            value={[isAudio ? player.positionSec : player.segmentIndex]}
            max={isAudio
              ? Math.max(1, player.durationSec)
              : Math.max(1, player.totalSegments - 1)}
            step={1}
            onValueCommit={([v]) =>
              isAudio ? player.seekSeconds(v) : player.seekSegment(v)}
          />
          <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{clock(elapsed)}</span>
            <span>-{clock(Math.max(0, total - elapsed))}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="icon" onClick={player.prevChapter}
            aria-label={isAudio ? "Previous track" : "Previous chapter"}>
            <ChevronFirst className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Back ${skipBack}s`}
            onClick={() => player.skipSeconds(-skipBack)}>
            <RotateCcw className="h-6 w-6" />
          </Button>
          <Button size="icon" onClick={player.toggle}
            aria-label={player.playing ? "Pause" : "Play"}
            className="h-[4.5rem] w-[4.5rem] rounded-full shadow-lg shadow-primary/25">
            {player.playing
              ? <Pause className="h-8 w-8" />
              : <Play className="h-8 w-8 translate-x-[2px]" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Forward ${skipFwd}s`}
            onClick={() => player.skipSeconds(skipFwd)}>
            <RotateCw className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={player.nextChapter}
            aria-label={isAudio ? "Next track" : "Next chapter"}>
            <ChevronLast className="h-6 w-6" />
          </Button>
        </div>

        {/* Secondary controls */}
        <div className="mt-2 flex w-full items-start justify-around">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex h-auto flex-col gap-1 py-2 text-[11px]">
                <Gauge className="h-5 w-5" /> {player.speed}×
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Playback speed</SheetTitle></SheetHeader>
              <div className="grid grid-cols-4 gap-2 py-4">
                {SPEEDS.map((s) => (
                  <Button key={s} variant={s === player.speed ? "default" : "outline"}
                    onClick={() => player.setSpeed(s)}>{s}×</Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {!isAudio && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" onClick={openVoices}
                  className="flex h-auto flex-col gap-1 py-2 text-[11px]">
                  <Mic2 className="h-5 w-5" /> Voice
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh]">
                <SheetHeader><SheetTitle>Narrator</SheetTitle></SheetHeader>
                {languages.length > 1 && (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 pt-3">
                    {languages.map((code) => (
                      <Button key={code} size="sm" className="shrink-0"
                        variant={code === voiceLanguage ? "default" : "outline"}
                        onClick={() => setVoiceLanguage(code)}>
                        {code}
                      </Button>
                    ))}
                  </div>
                )}
                <ScrollArea className="h-[50vh] py-2">
                  <div className="flex flex-col gap-4 pr-3">
                    {loadingVoices && (
                      <p className="text-sm text-muted-foreground">Loading voices…</p>
                    )}
                    {!loadingVoices && speakerGroups.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No voices available for {voiceLanguage}.
                      </p>
                    )}
                    {speakerGroups.map(([speaker, variants]) => (
                      <div key={speaker} className="space-y-2">
                        <p className="text-sm font-medium">{speaker}</p>
                        <div className="flex flex-wrap gap-2">
                          {variants.map((v) => (
                            <Button key={v.name} size="sm"
                              variant={v.name === player.voice ? "default" : "outline"}
                              onClick={() => player.setVoice(v.name)}>
                              {v.emotion && v.emotion !== "Default" ? v.emotion : "Default"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex h-auto flex-col gap-1 py-2 text-[11px]">
                <Moon className="h-5 w-5" />
                {sleepLeft != null ? clock(sleepLeft) : "Sleep"}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Sleep timer</SheetTitle></SheetHeader>
              <div className="grid grid-cols-3 gap-2 py-4">
                {SLEEP_PRESETS.map((m) => (
                  <Button key={m} variant="outline" onClick={() => setSleepLeft(m * 60)}>
                    {m} min
                  </Button>
                ))}
                <Button variant="outline" onClick={() => setSleepLeft(null)}>Off</Button>
              </div>
            </SheetContent>
          </Sheet>

          {currentUser && (
            <Button variant="ghost" size="sm" onClick={bookmark}
              className="flex h-auto flex-col gap-1 py-2 text-[11px]">
              <BookmarkIcon className="h-5 w-5" /> Mark
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex h-auto flex-col gap-1 py-2 text-[11px]">
                <List className="h-5 w-5" /> Chapters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh]">
              <SheetHeader><SheetTitle>Chapters</SheetTitle></SheetHeader>
              <ScrollArea className="h-[55vh] py-2">
                <div className="flex flex-col gap-1 pr-3">
                  {isAudio
                    ? player.tracks.map((t, i) => (
                        <Button key={t.id} className="justify-start text-left"
                          variant={i === player.trackIndex ? "default" : "ghost"}
                          onClick={() => player.selectTrack(i)}>
                          {t.track_title || `Track ${i + 1}`}
                        </Button>
                      ))
                    : (chapters as TocEntry[]).map((c) => (
                        <Button key={c.index} className="justify-start text-left"
                          variant={c.index === player.chapterIndex ? "default" : "ghost"}
                          onClick={() => player.seekSegment(c.start_segment)}>
                          {c.title}
                        </Button>
                      ))}
                  {chapters.length === 0 && !isAudio && (
                    <p className="text-sm text-muted-foreground">No chapters detected.</p>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {player.error && (
          <p className="text-center text-sm text-destructive">{player.error}</p>
        )}
        {!player.error && player.notice && (
          <p className="text-center text-xs text-muted-foreground">{player.notice}</p>
        )}
      </div>
    </div>
  );
}
