"use client";

/**
 * Cover-first book tile. Art does the talking; text is secondary and clipped,
 * matching how a native library shelf reads on a phone.
 */

import Link from "next/link";
import { Headphones, Play } from "lucide-react";

import type { BookCoverResponse } from "@/lib/definitions";
import { cn } from "@/lib/utils";

export function BookTile({
  book,
  progress = 0,
  onPlay,
}: {
  book: BookCoverResponse;
  /** 0..1 */
  progress?: number;
  onPlay?: (book: BookCoverResponse) => void;
}) {
  const cover = book.cover_url ?? null;

  return (
    <div className="group relative">
      <Link href={`/books/${book.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-lg shadow-black/30 ring-1 ring-border/50">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-secondary to-card p-3 text-center">
              <span className="line-clamp-4 text-xs font-medium text-muted-foreground">
                {book.title}
              </span>
            </div>
          )}

          {book.book_type === "audiobook" && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-background/80 p-1 backdrop-blur">
              <Headphones className="h-3 w-3" />
            </span>
          )}

          {progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      {onPlay && (
        <button
          type="button"
          aria-label={`Play ${book.title}`}
          onClick={() => onPlay(book)}
          className={cn(
            "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground opacity-0 shadow-lg transition",
            "group-hover:opacity-100 focus-visible:opacity-100 active:scale-95",
            // Touch devices have no hover, so keep it visible there.
            "[@media(hover:none)]:opacity-100",
          )}
        >
          <Play className="h-4 w-4 translate-x-[1px]" />
        </button>
      )}

      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-sm font-medium leading-tight">{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.author || "Unknown author"}
        </p>
      </div>
    </div>
  );
}
