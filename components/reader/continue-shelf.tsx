"use client";

/** "Continue listening": horizontally scrolling shelf of in-progress books. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { usePlayer } from "@/components/player/player-provider";
import { ListBooks } from "@/lib/api";
import { getProgress } from "@/lib/reader-api";
import type { BookCoverResponse } from "@/lib/definitions";

interface Item { book: BookCoverResponse; percent: number }

export function ContinueShelf() {
  const [items, setItems] = useState<Item[]>([]);
  const player = usePlayer();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await ListBooks(null);
      if (!active || !res.status || typeof res.message === "string") return;
      const rows = await Promise.all(
        (res.message.results ?? []).map(async (book) => {
          try {
            const p = await getProgress(book.id);
            return { book, percent: p.percent ?? 0 };
          } catch {
            return { book, percent: 0 };
          }
        }),
      );
      if (!active) return;
      setItems(
        rows.filter((i) => i.percent > 0 && i.percent < 100)
            .sort((a, b) => b.percent - a.percent),
      );
    })();
    return () => { active = false; };
  }, []);

  if (items.length === 0) return null;

  const resume = (book: BookCoverResponse) => {
    player.open(book.id, true);
    router.push(`/reader/${book.id}`);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Continue</h2>
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {items.map(({ book, percent }) => (
          <button
            key={book.id}
            type="button"
            onClick={() => resume(book)}
            className="group w-[9.5rem] shrink-0 text-left"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-lg shadow-black/30 ring-1 ring-border/50">
              {book.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.cover_url} alt={book.title}
                  className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  {book.title}
                </div>
              )}
              <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-active:scale-95">
                <Play className="h-4 w-4 translate-x-[1px]" />
              </span>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-medium">{book.title}</p>
            <p className="text-xs text-muted-foreground">{Math.round(percent)}%</p>
          </button>
        ))}
      </div>
    </section>
  );
}
