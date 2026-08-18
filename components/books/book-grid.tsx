"use client";

/** Shared library grid: fetches, tracks progress, and starts playback. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BookTile } from "@/components/books/book-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/components/player/player-provider";
import { ListBooks } from "@/lib/api";
import { getProgress } from "@/lib/reader-api";
import type { BookCoverResponse } from "@/lib/definitions";

export function BookGrid({
  status,
  query = "",
  emptyMessage = "Nothing here yet.",
  refreshKey = 0,
}: {
  status: "all" | "public" | "private";
  query?: string;
  emptyMessage?: string;
  /** Bump to refetch in place (e.g. after an upload) without a page reload. */
  refreshKey?: number;
}) {
  const [books, setBooks] = useState<BookCoverResponse[] | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const player = usePlayer();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    setBooks(null);
    (async () => {
      const res = await ListBooks(status === "all" ? null : status);
      if (!active) return;
      if (res.status && typeof res.message !== "string") {
        const rows = res.message.results ?? [];
        setBooks(rows);
        // Progress is per-book; fetch in parallel and ignore failures so one
        // missing row never blanks the shelf.
        const entries = await Promise.all(
          rows.map(async (b) => {
            try {
              const p = await getProgress(b.id);
              return [b.id, (p.percent ?? 0) / 100] as const;
            } catch {
              return [b.id, 0] as const;
            }
          }),
        );
        if (active) setProgress(Object.fromEntries(entries));
      } else {
        setBooks([]);
      }
    })();
    return () => { active = false; };
  }, [status, refreshKey]);

  const handlePlay = useCallback(
    (book: BookCoverResponse) => {
      player.open(book.id, true);
      router.push(`/reader/${book.id}`);
    },
    [player, router],
  );

  if (books === null) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const filtered = query
    ? books.filter((b) =>
        `${b.title} ${b.author ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    : books;

  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {query ? `No books match “${query}”.` : emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
      {filtered.map((book) => (
        <BookTile
          key={book.id}
          book={book}
          progress={progress[book.id] ?? 0}
          onPlay={handlePlay}
        />
      ))}
    </div>
  );
}
