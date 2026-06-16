"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headphones, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProgress, listBooks } from "@/lib/reader-api";
import type { Book } from "@/lib/reader-types";

interface ResumeItem {
  book: Book;
  percent: number;
}

/** A "Continue" shelf driven by per-user ReadingProgress. */
export function ContinueShelf() {
  const [items, setItems] = useState<ResumeItem[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { results } = await listBooks();
        const withProgress = await Promise.all(
          results.slice(0, 12).map(async (book) => {
            try {
              const p = await getProgress(book.id);
              return { book, percent: p.percent };
            } catch {
              return { book, percent: 0 };
            }
          }),
        );
        if (!active) return;
        setItems(
          withProgress
            .filter((i) => i.percent > 0 && i.percent < 100)
            .sort((a, b) => b.percent - a.percent),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => { active = false; };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Continue</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map(({ book, percent }) => (
          <div key={book.id} className="w-40 shrink-0 space-y-2">
            <Link href={`/reader/${book.id}${book.book_type === "audiobook" ? "" : "?mode=listen"}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-md">
                {book.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                    {book.title.slice(0, 1)}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                  <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </Link>
            <p className="truncate text-sm font-medium">{book.title}</p>
            <div className="flex gap-1">
              <Link href={`/reader/${book.id}?mode=listen`} className="flex-1">
                <Button size="sm" variant="secondary" className="w-full"><Headphones className="mr-1 h-3.5 w-3.5" /> Listen</Button>
              </Link>
              <Link href={`/reader/${book.id}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full"><BookOpen className="mr-1 h-3.5 w-3.5" /> Read</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
