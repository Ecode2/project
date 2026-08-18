"use client";

/**
 * Persistent playback bar, docked above the tab bar.
 *
 * Hidden on the full player route so the two never stack, and hidden entirely
 * when nothing is loaded.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play, X } from "lucide-react";

import { usePlayer } from "@/components/player/player-provider";
import { cn } from "@/lib/utils";

export function MiniPlayer() {
  const player = usePlayer();
  const pathname = usePathname();

  const onFullPlayer = pathname?.startsWith("/reader/");
  if (!player.book || onFullPlayer) return null;

  const subtitle =
    player.kind === "audio"
      ? player.tracks[player.trackIndex]?.track_title || `Track ${player.trackIndex + 1}`
      : player.currentText || player.book.author || "";

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-2 pb-1">
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-lg shadow-black/40 backdrop-blur-xl">
        <Link
          href={`/reader/${player.book.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
            {player.book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.book.cover_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {player.book.title.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {player.book.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.playing ? "Pause" : "Play"}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground transition active:scale-95",
          )}
        >
          {player.playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>
        <button
          type="button"
          onClick={player.close}
          aria-label="Close player"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thin progress hairline, like the native player. */}
      <div className="mx-auto mt-1 h-0.5 max-w-2xl overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, player.progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
