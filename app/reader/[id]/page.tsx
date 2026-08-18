"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";

import { FullPlayer } from "@/components/player/full-player";
import { ReadingView } from "@/components/reader/reading-view";
import { usePlayer } from "@/components/player/player-provider";
import { getReaderSettings } from "@/lib/reader-api";
import type { ReaderSettings } from "@/lib/reader-types";

const DEFAULT_SETTINGS: ReaderSettings = {
  // Empty voice means "use the server's configured TTS_DEFAULT_VOICE"; naming
  // a voice here would pin the client to one provider's scheme.
  voice_name: "",
  language_code: "en-US",
  speaking_rate: 1,
  pitch: 0,
  speed: 1,
  theme: "dark",
  font_family: "Georgia",
  font_size: 18,
  auto_scroll: true,
  skip_back_seconds: 15,
  skip_forward_seconds: 30,
};

function ReaderInner() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const player = usePlayer();
  const search = useSearchParams();
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  // `?mode=read` opens straight into the book, so "Read" on the detail screen
  // lands on the page rather than the player.
  const [mode, setMode] = useState<"listen" | "read">(
    search.get("mode") === "read" ? "read" : "listen",
  );

  // Opening is idempotent: arriving here from the mini-player must not restart
  // a session that is already playing.
  useEffect(() => {
    if (id) player.open(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let active = true;
    getReaderSettings()
      .then((s) => active && setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // The reading view is a full-bleed paper surface that owns the viewport, so
  // it renders alone rather than alongside the player chrome.
  if (mode === "read") {
    return (
      <ReadingView settings={settings} onSwitchToListen={() => setMode("listen")} />
    );
  }

  return (
    <div className="relative">
      <FullPlayer settings={settings} />

      {/* Only narrated documents have a text side to switch to. */}
      {player.kind === "tts" && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
          <button
            type="button"
            onClick={() => setMode("read")}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-5 py-2 text-xs shadow-lg backdrop-blur-xl transition active:scale-95"
          >
            <BookOpen className="h-3.5 w-3.5" /> Read along
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    }>
      <ReaderInner />
    </Suspense>
  );
}
