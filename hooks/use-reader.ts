"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ReaderAudioClient } from "@/lib/audio-ws";
import { putProgress } from "@/lib/reader-api";
import type {
  AudioChapter,
  BookType,
  ReadingProgress,
  TocEntry,
} from "@/lib/reader-types";

export interface ReaderState {
  connection: "connecting" | "open" | "closed";
  bookType: BookType;
  toc: TocEntry[] | AudioChapter[];
  totalSegments: number;
  currentIndex: number;
  currentText: string;
  currentChapter: number;
  playing: boolean;
  speed: number;
  voice: string;
  error: string | null;
}

const INITIAL: ReaderState = {
  connection: "connecting",
  bookType: "document",
  toc: [],
  totalSegments: 0,
  currentIndex: 0,
  currentText: "",
  currentChapter: 0,
  playing: false,
  speed: 1,
  voice: "",
  error: null,
};

export function useReader(bookId: number, initialSpeed = 1) {
  const [state, setState] = useState<ReaderState>({ ...INITIAL, speed: initialSpeed });
  const clientRef = useRef<ReaderAudioClient | null>(null);
  const patch = useCallback(
    (p: Partial<ReaderState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  useEffect(() => {
    const client = new ReaderAudioClient(bookId, {
      onStateChange: (connection) => patch({ connection }),
      onReady: (frame) =>
        patch({
          bookType: frame.book_type,
          toc: frame.toc,
          totalSegments: frame.total_segments ?? frame.toc.length,
          voice: frame.voice ?? "",
          currentIndex: frame.resume.segment_index,
          currentChapter: frame.resume.chapter_index,
        }),
      onSegment: (meta) =>
        patch({ currentText: meta.text, currentChapter: meta.chapter_index }),
      onCurrentSegment: (currentIndex) => patch({ currentIndex }),
      onEnded: () => patch({ playing: false }),
      onError: (_code, detail) => patch({ error: detail }),
    });
    client.setSpeed(initialSpeed);
    clientRef.current = client;
    client.connect().catch((e) => patch({ error: String(e), connection: "closed" }));

    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const play = useCallback((index?: number) => {
    const i = index ?? state.currentIndex;
    clientRef.current?.play(i, state.voice || undefined);
    patch({ playing: true, currentIndex: i });
  }, [state.currentIndex, state.voice, patch]);

  const pause = useCallback(() => {
    clientRef.current?.pause();
    patch({ playing: false });
    putProgress(bookId, { segment_index: state.currentIndex } as Partial<ReadingProgress>).catch(() => {});
  }, [bookId, state.currentIndex, patch]);

  const toggle = useCallback(() => {
    if (state.playing) pause();
    else play();
  }, [state.playing, play, pause]);

  const seek = useCallback((index: number) => {
    clientRef.current?.seek(index);
    patch({ currentIndex: index, playing: true });
  }, [patch]);

  const skip = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(state.currentIndex + delta, state.totalSegments - 1));
    seek(target);
  }, [state.currentIndex, state.totalSegments, seek]);

  const nextChapter = useCallback(() => {
    clientRef.current?.nextChapter();
    patch({ playing: true });
  }, [patch]);

  const prevChapter = useCallback(() => {
    clientRef.current?.prevChapter();
    patch({ playing: true });
  }, [patch]);

  const setSpeed = useCallback((speed: number) => {
    clientRef.current?.setSpeed(speed);
    patch({ speed });
  }, [patch]);

  const setVoice = useCallback((voice: string) => {
    clientRef.current?.setVoice(voice);
    patch({ voice });
  }, [patch]);

  return { state, play, pause, toggle, seek, skip, nextChapter, prevChapter, setSpeed, setVoice };
}
