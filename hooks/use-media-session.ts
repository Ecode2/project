import { useEffect } from "react";

interface MediaSessionConfig {
  title: string;
  artist?: string;
  artwork?: string | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
}

/**
 * Wire navigator.mediaSession for BookPlayer-style lockscreen / notification
 * controls. NOTE: true background audio on iOS Safari is limited for web apps;
 * Media Session improves the experience but cannot fully match a native app.
 */
export function useMediaSession(config: MediaSessionConfig) {
  const {
    title, artist, artwork, playing,
    onPlay, onPause, onPreviousChapter, onNextChapter,
    onSeekBackward, onSeekForward,
  } = config;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: artist || "Bookverse",
      album: "Bookverse",
      artwork: artwork
        ? [{ src: artwork, sizes: "512x512", type: "image/png" }]
        : [],
    });
  }, [title, artist, artwork]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", onPlay);
    ms.setActionHandler("pause", onPause);
    ms.setActionHandler("previoustrack", onPreviousChapter);
    ms.setActionHandler("nexttrack", onNextChapter);
    ms.setActionHandler("seekbackward", onSeekBackward);
    ms.setActionHandler("seekforward", onSeekForward);
    try {
      ms.playbackState = playing ? "playing" : "paused";
    } catch { /* not supported */ }
    return () => {
      (["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward"] as const)
        .forEach((a) => ms.setActionHandler(a, null));
    };
  }, [playing, onPlay, onPause, onPreviousChapter, onNextChapter, onSeekBackward, onSeekForward]);
}
