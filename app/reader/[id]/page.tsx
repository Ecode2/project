"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { AudiobookPlayer } from "@/components/reader/audiobook-player";
import { NowPlaying } from "@/components/reader/now-playing";
import { ReaderView } from "@/components/reader/reader-view";
import { getBook, getReaderSettings } from "@/lib/reader-api";
import type { Book, ReaderSettings } from "@/lib/reader-types";

const DEFAULT_SETTINGS: ReaderSettings = {
  // Empty means "let the server pick its configured TTS_DEFAULT_VOICE".
  // Hardcoding a voice name here pins the client to one provider (the old
  // value was a Google voice that the NVIDIA/Riva backend cannot synthesize).
  voice_name: "",
  language_code: "en-US",
  speaking_rate: 1,
  pitch: 0,
  speed: 1,
  theme: "light",
  font_family: "Georgia",
  font_size: 18,
  auto_scroll: true,
  skip_back_seconds: 15,
  skip_forward_seconds: 30,
};

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}>
      <ReaderPageInner />
    </Suspense>
  );
}

function ReaderPageInner() {
  const params = useParams();
  const search = useSearchParams();
  const bookId = Number(params.id);
  const mode = search.get("mode"); // "listen" | "read" | null

  const [book, setBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getBook(bookId), getReaderSettings().catch(() => DEFAULT_SETTINGS)])
      .then(([b, s]) => {
        if (!active) return;
        setBook(b);
        setSettings({ ...DEFAULT_SETTINGS, ...s });
      })
      .catch((e) => active && setError(String(e)));
    return () => { active = false; };
  }, [bookId]);

  if (error) return <div className="p-8 text-center text-sm text-destructive">{error}</div>;
  if (!book) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  if (book.book_type === "audiobook") {
    return <AudiobookPlayer book={book} settings={settings} />;
  }
  if (mode === "listen") {
    return <NowPlaying book={book} settings={settings} />;
  }
  return <ReaderView book={book} settings={settings} />;
}
