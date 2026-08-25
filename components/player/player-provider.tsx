"use client";

/**
 * App-wide playback state.
 *
 * Playback has to outlive any single route: the mini-player keeps playing while
 * you browse the library, which is impossible if the WebSocket client or the
 * <audio> element is owned by a page component.
 *
 * Two very different sources are unified behind one interface:
 *   - "tts"   documents narrated segment-by-segment over the reader WebSocket
 *   - "audio" native audiobooks played from files by an <audio> element
 * Screens talk in intents (toggle, skip, next chapter); the provider maps those
 * onto whichever source is live.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

import { ReaderAudioClient, releaseAudioSession, unlockAudio } from "@/lib/audio-ws";
import {
  getBook, getProgress, getToc, putProgress, reportListening,
} from "@/lib/reader-api";
import type {
  AudioChapter, Book, BookFile, TocEntry,
} from "@/lib/reader-types";

export type PlayerKind = "tts" | "audio";

export interface PlayerState {
  book: Book | null;
  kind: PlayerKind | null;
  connection: "connecting" | "open" | "closed";
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Transient, non-fatal message (e.g. a paragraph was skipped). */
  notice: string | null;
  /** Narration needs an account; reading the text does not. */
  authRequired: boolean;

  /** Narrated documents: position is a segment index. */
  segmentIndex: number;
  totalSegments: number;
  currentText: string;
  chapterIndex: number;
  toc: TocEntry[] | AudioChapter[];
  voice: string;

  /** Native audiobooks: position is seconds within the current track. */
  trackIndex: number;
  tracks: BookFile[];
  positionSec: number;
  durationSec: number;

  speed: number;
}

const INITIAL: PlayerState = {
  book: null, kind: null, connection: "closed", playing: false, loading: false,
  error: null, notice: null, authRequired: false, segmentIndex: 0, totalSegments: 0, currentText: "", chapterIndex: 0,
  toc: [], voice: "", trackIndex: 0, tracks: [], positionSec: 0, durationSec: 0,
  speed: 1,
};

interface PlayerApi extends PlayerState {
  /** Load a book and begin a session (no-op if already open). */
  open: (bookOrId: Book | string, autoplay?: boolean) => Promise<void>;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seekSegment: (index: number) => void;
  seekSeconds: (sec: number) => void;
  skipSeconds: (delta: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  selectTrack: (index: number) => void;
  setSpeed: (speed: number) => void;
  setVoice: (voice: string) => void;
  close: () => void;
  /** Fraction 0..1 for progress bars, whichever source is live. */
  progress: number;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(INITIAL);
  const clientRef = useRef<ReaderAudioClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const openIdRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  // Measured listening time. `playSinceRef` is a monotonic timestamp captured
  // when playback started; accumulating elapsed spans (rather than counting
  // timer ticks) stays accurate even when a backgrounded tab is throttled.
  const playSinceRef = useRef<number | null>(null);
  const pendingMsRef = useRef(0);
  const listeningBookRef = useRef<string | null>(null);

  const patch = useCallback(
    (p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  // -- measured listening time -----------------------------------------
  /** Fold any in-progress span into the pending total. */
  const harvest = useCallback(() => {
    if (playSinceRef.current != null) {
      pendingMsRef.current += performance.now() - playSinceRef.current;
      playSinceRef.current = null;
    }
  }, []);

  /** Send whatever has accumulated. Deltas below a second aren't worth a request. */
  const flushListening = useCallback((keepalive = false) => {
    harvest();
    const bookId = listeningBookRef.current;
    const ms = Math.round(pendingMsRef.current);
    if (!bookId || ms < 1000) return;
    pendingMsRef.current = 0;
    reportListening(bookId, ms, keepalive).catch((err: { status?: number }) => {
      // An anonymous reader has nowhere to record time, so retrying would
      // accumulate forever and re-POST every 30s. Only re-queue on failures
      // that could plausibly succeed later (network, 5xx).
      if (err?.status === 401 || err?.status === 403) return;
      pendingMsRef.current += ms;
    });
  }, [harvest]);

  // -- teardown ---------------------------------------------------------
  const teardown = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    openIdRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  // -- opening a book ---------------------------------------------------
  const open = useCallback(
    async (bookOrId: Book | string, autoplay = false) => {
      const id = typeof bookOrId === "string" ? bookOrId : bookOrId.id;
      // Claim the AudioContext while the tap that triggered this is still on
      // the stack. Everything below awaits (book, progress, ws ticket), and by
      // then iOS Safari no longer counts us as user-initiated.
      if (autoplay) unlockAudio();
      if (openIdRef.current === id) {
        if (autoplay) playRef.current?.();
        return;
      }
      teardown();
      openIdRef.current = id;
      patch({ ...INITIAL, loading: true, book: null });

      let book: Book;
      try {
        book = typeof bookOrId === "string" ? await getBook(bookOrId) : bookOrId;
      } catch (e) {
        patch({ loading: false, error: String(e) });
        return;
      }
      // A different book may have been opened while this one was loading.
      if (openIdRef.current !== id) return;

      const tracks = [...(book.files ?? [])].sort((a, b) => a.order - b.order);
      const isAudio = book.book_type === "audiobook" && tracks.length > 0;

      // Resume where the reader left off, on whichever axis applies.
      let resumeSegment = 0;
      let resumeTrack = 0;
      let resumeMs = 0;
      try {
        const p = await getProgress(id);
        resumeSegment = p.segment_index ?? 0;
        resumeTrack = Math.min(Math.max(0, p.segment_index ?? 0), Math.max(0, tracks.length - 1));
        resumeMs = p.audio_ms ?? 0;
      } catch {
        /* no saved progress yet */
      }
      if (openIdRef.current !== id) return;

      if (isAudio) {
        patch({
          book, kind: "audio", tracks, trackIndex: resumeTrack, loading: false,
          connection: "open", toc: [],
        });
        pendingSeekRef.current = resumeMs / 1000;
        // The <audio> element is created by the effect below once tracks land.
        if (autoplay) patch({ playing: true });
        return;
      }

      patch({ book, kind: "tts", tracks: [], loading: false, segmentIndex: resumeSegment });

      // Chapters/length come over REST as well as from the WebSocket's `ready`
      // frame. Reading a public book works without an account, but listening
      // does not, so the reader must not depend on the socket for structure.
      getToc(id)
        .then((t) => {
          if (openIdRef.current !== id) return;
          setState((s) => ({
            ...s,
            toc: s.toc.length ? s.toc : t.toc,
            totalSegments: s.totalSegments || t.total_segments || 0,
          }));
        })
        .catch(() => {});

      const client = new ReaderAudioClient(id, {
        onStateChange: (connection) => patch({ connection }),
        onReady: (frame) =>
          patch({
            toc: frame.toc,
            totalSegments: frame.total_segments ?? frame.toc.length,
            voice: frame.voice ?? "",
            segmentIndex: frame.resume.segment_index,
            chapterIndex: frame.resume.chapter_index,
          }),
        onSegment: (meta) =>
          patch({ currentText: meta.text, chapterIndex: meta.chapter_index }),
        onCurrentSegment: (segmentIndex) => patch({ segmentIndex }),
        onEnded: () => patch({ playing: false }),
        // Non-fatal: the stream carries on with the next paragraph, so surface
        // it as a transient notice rather than an error that stops playback.
        onSegmentSkipped: (segmentIndex) =>
          patch({ notice: `Skipped a passage that couldn't be narrated (${segmentIndex}).` }),
        onError: (_code, detail) => patch({ error: detail }),
      });
      clientRef.current = client;
      client.setSpeed(state.speed || 1);
      try {
        await client.connect();
        if (autoplay) {
          client.play(resumeSegment);
          patch({ playing: true });
        }
      } catch (e) {
        // Listening requires an account (the ws-ticket endpoint is gated), so
        // a 401/403 here is an expected state for a signed-out reader, not a
        // failure to shout about. Reading continues to work.
        const status = (e as { status?: number })?.status;
        if (status === 401 || status === 403) {
          patch({ authRequired: true, connection: "closed", playing: false });
        } else {
          patch({ error: String(e), connection: "closed" });
        }
      }
    },
    // `state.speed` is read once at connect time; re-creating this callback on
    // every speed change would needlessly churn the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, teardown],
  );

  // -- native audiobook element ----------------------------------------
  const currentTrack = state.tracks[state.trackIndex];

  useEffect(() => {
    if (state.kind !== "audio" || !currentTrack?.url) return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.preload = "metadata";
      audioRef.current = el;
      el.addEventListener("timeupdate", () =>
        patch({ positionSec: el!.currentTime }));
      el.addEventListener("play", () => patch({ playing: true }));
      el.addEventListener("pause", () => patch({ playing: false }));
      el.addEventListener("loadedmetadata", () => {
        patch({ durationSec: el!.duration });
        // Applying a restored position before metadata exists is discarded.
        if (pendingSeekRef.current != null) {
          const target = pendingSeekRef.current;
          if (isFinite(el!.duration) && target < el!.duration) el!.currentTime = target;
          pendingSeekRef.current = null;
        }
      });
      el.addEventListener("ended", () => {
        setState((s) => {
          const next = s.trackIndex + 1;
          if (next < s.tracks.length) return { ...s, trackIndex: next };
          return { ...s, playing: false };
        });
      });
    }
    if (el.src !== currentTrack.url) el.src = currentTrack.url;
    el.playbackRate = state.speed;
    if (state.playing) el.play().catch(() => patch({ playing: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, currentTrack?.url, state.trackIndex]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = state.speed;
  }, [state.speed]);

  // -- transport --------------------------------------------------------
  const saveProgress = useCallback(() => {
    const { book, kind, segmentIndex, trackIndex } = state;
    if (!book) return;
    const body = kind === "audio"
      ? {
          segment_index: trackIndex,
          chapter_index: trackIndex,
          audio_ms: Math.round((audioRef.current?.currentTime ?? 0) * 1000),
        }
      : { segment_index: segmentIndex };
    putProgress(book.id, body).catch(() => {});
  }, [state]);

  const play = useCallback(() => {
    // Synchronous, before anything async: see unlockAudio().
    unlockAudio();
    if (state.kind === "audio") {
      audioRef.current?.play().catch(() => {});
      patch({ playing: true });
      return;
    }
    clientRef.current?.play(state.segmentIndex);
    patch({ playing: true });
  }, [state.kind, state.segmentIndex, patch]);

  const playRef = useRef(play);
  useEffect(() => { playRef.current = play; }, [play]);

  const pause = useCallback(() => {
    if (state.kind === "audio") audioRef.current?.pause();
    else clientRef.current?.pause();
    patch({ playing: false });
    saveProgress();
    flushListening();
  }, [state.kind, patch, saveProgress, flushListening]);

  const toggle = useCallback(() => {
    if (state.playing) pause();
    else play();
  }, [state.playing, play, pause]);

  const seekSegment = useCallback((index: number) => {
    unlockAudio();
    clientRef.current?.seek(index);
    patch({ segmentIndex: index, playing: true });
  }, [patch]);

  const seekSeconds = useCallback((sec: number) => {
    if (audioRef.current) audioRef.current.currentTime = sec;
    patch({ positionSec: sec });
  }, [patch]);

  /** Seconds are the user-facing unit even for segment-addressed narration. */
  const skipSeconds = useCallback((delta: number) => {
    unlockAudio();
    setState((s) => {
      if (s.kind === "audio") {
        const el = audioRef.current;
        if (el) {
          el.currentTime = Math.max(0, Math.min(el.currentTime + delta, el.duration || 0));
        }
        return s;
      }
      const durationMs = s.book?.duration_estimate_ms || 0;
      const avgSec = durationMs > 0 && s.totalSegments
        ? durationMs / 1000 / s.totalSegments
        : 0;
      const steps = avgSec > 0 ? Math.max(1, Math.round(Math.abs(delta) / avgSec)) : 1;
      const target = Math.max(
        0, Math.min(s.segmentIndex + (delta < 0 ? -steps : steps), Math.max(0, s.totalSegments - 1)),
      );
      clientRef.current?.seek(target);
      return { ...s, segmentIndex: target, playing: true };
    });
  }, []);

  const nextChapter = useCallback(() => {
    unlockAudio();
    if (state.kind === "audio") {
      setState((s) => ({ ...s, trackIndex: Math.min(s.trackIndex + 1, s.tracks.length - 1) }));
      return;
    }
    clientRef.current?.nextChapter();
    patch({ playing: true });
  }, [state.kind, patch]);

  const prevChapter = useCallback(() => {
    unlockAudio();
    if (state.kind === "audio") {
      setState((s) => ({ ...s, trackIndex: Math.max(0, s.trackIndex - 1) }));
      return;
    }
    clientRef.current?.prevChapter();
    patch({ playing: true });
  }, [state.kind, patch]);

  const selectTrack = useCallback((index: number) => {
    unlockAudio();
    setState((s) => ({
      ...s,
      trackIndex: Math.max(0, Math.min(index, s.tracks.length - 1)),
      playing: true,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    clientRef.current?.setSpeed(speed);
    patch({ speed });
  }, [patch]);

  const setVoice = useCallback((voice: string) => {
    clientRef.current?.setVoice(voice);
    patch({ voice });
  }, [patch]);

  const close = useCallback(() => {
    saveProgress();
    flushListening();
    teardown();
    // Hand the iOS audio session back so the ringer behaves normally again.
    releaseAudioSession();
    setState(INITIAL);
  }, [saveProgress, flushListening, teardown]);

  // Persist position periodically so a closed tab doesn't lose the place.
  useEffect(() => {
    if (!state.playing || !state.book) return;
    const t = setInterval(saveProgress, 15000);
    return () => clearInterval(t);
  }, [state.playing, state.book, saveProgress]);

  // Run the listening clock strictly while audio is actually playing.
  useEffect(() => {
    listeningBookRef.current = state.book?.id ?? null;
    if (state.playing && state.book) {
      if (playSinceRef.current == null) playSinceRef.current = performance.now();
    } else {
      harvest();
      flushListening();
    }
  }, [state.playing, state.book, harvest, flushListening]);

  useEffect(() => {
    if (!state.playing) return;
    const t = setInterval(() => flushListening(), 30000);
    return () => clearInterval(t);
  }, [state.playing, flushListening]);

  // A closed tab or a backgrounded phone must not silently drop the tail.
  useEffect(() => {
    const onHide = () => flushListening(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushListening(true);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushListening]);

  const progress = useMemo(() => {
    if (state.kind === "audio") {
      return state.durationSec > 0 ? state.positionSec / state.durationSec : 0;
    }
    return state.totalSegments > 0 ? state.segmentIndex / state.totalSegments : 0;
  }, [state.kind, state.positionSec, state.durationSec, state.segmentIndex, state.totalSegments]);

  const value: PlayerApi = {
    ...state, open, toggle, play, pause, seekSegment, seekSeconds, skipSeconds,
    nextChapter, prevChapter, selectTrack, setSpeed, setVoice, close, progress,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
