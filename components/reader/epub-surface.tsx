"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Renders the real EPUB — its own layout, CSS and images — in paginated form,
 * via epub.js. Position is an EPUB CFI, which names the exact spot in the text,
 * so reopening lands on the page you stopped at rather than the chapter start.
 */

import { useEffect, useRef } from "react";

import type { SurfaceProps, TocItem } from "./page-types";
import { THEMES, type Prefs } from "./reader-theme";

let themeSeq = 0;

function applyTheme(rendition: any, prefs: Prefs) {
  if (!rendition) return;
  const t = THEMES[prefs.theme];
  const text = `${t.fg} !important`;
  const name = `bv-${++themeSeq}`;
  rendition.themes.register(name, {
    body: {
      color: text,
      background: "transparent !important",
      "font-family": `${prefs.fontStack} !important`,
      "line-height": "1.6 !important",
    },
    "p, li, blockquote, h1, h2, h3, h4, h5, h6, span, div, td, th, dd, dt, em, strong, i, b": {
      color: text,
    },
    a: { color: `${t.fg} !important`, "text-decoration": "underline" },
    // Pictures keep their place in the flow but must never overflow the page.
    "img, svg, image, video": {
      "max-width": "100% !important",
      "max-height": "88vh !important",
      height: "auto",
      "object-fit": "contain",
    },
  });
  rendition.themes.select(name);
  rendition.themes.fontSize(`${prefs.fontSize}px`);
}

function flattenToc(items: any[], depth = 0, out: TocItem[] = []): TocItem[] {
  for (const it of items ?? []) {
    out.push({ label: String(it.label ?? "").trim() || "Untitled", target: it.href, depth });
    if (it.subitems?.length) flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}

export function EpubSurface(props: SurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let cancelled = false;
    let book: any = null;
    let rendition: any = null;
    let removeKeys: (() => void) | null = null;

    (async () => {
      try {
        const [{ default: ePub }, res] = await Promise.all([
          import("epubjs"),
          fetch(propsRef.current.url),
        ]);
        if (!res.ok) throw new Error(`Could not download the book (${res.status}).`);
        const data = await res.arrayBuffer();
        if (cancelled || !hostRef.current) return;

        book = (ePub as any)(data);
        rendition = book.renderTo(hostRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        applyTheme(rendition, propsRef.current.prefs);

        propsRef.current.handleRef.current = {
          next: () => rendition?.next(),
          prev: () => rendition?.prev(),
          goto: (t) => rendition?.display(String(t)),
        };

        let locationsReady = false;
        let current: any = null;

        const emit = () => {
          if (!current) return;
          const cfi: string = current.start.cfi;
          let percent = -1;
          if (locationsReady) {
            const f = book.locations.percentageFromCfi(cfi);
            if (typeof f === "number" && !Number.isNaN(f)) percent = Math.round(f * 1000) / 10;
          }
          let label = "";
          try {
            label = String(book.navigation.get(current.start.href)?.label ?? "").trim();
          } catch {
            /* untitled spine item */
          }
          propsRef.current.onLocation({
            locator: { type: "epub", cfi },
            percent,
            label: label || (percent >= 0 ? `${Math.round(percent)}%` : ""),
          });
        };

        rendition.on("relocated", (loc: any) => {
          current = loc;
          emit();
        });

        // -- input -----------------------------------------------------
        rendition.on("click", (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("a")) return; // let links navigate
          const w = (e.view as Window | null)?.innerWidth || hostRef.current!.clientWidth;
          const x = e.clientX / w;
          if (x < 0.25) rendition.prev();
          else if (x > 0.75) rendition.next();
          else propsRef.current.onTap();
        });
        let touchX = 0;
        rendition.on("touchstart", (e: TouchEvent) => { touchX = e.changedTouches[0].screenX; });
        rendition.on("touchend", (e: TouchEvent) => {
          const dx = e.changedTouches[0].screenX - touchX;
          if (Math.abs(dx) > 50) (dx < 0 ? rendition.next() : rendition.prev());
        });
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight" || e.key === " ") rendition.next();
          else if (e.key === "ArrowLeft") rendition.prev();
        };
        rendition.on("keydown", onKey);
        window.addEventListener("keydown", onKey);
        removeKeys = () => window.removeEventListener("keydown", onKey);

        // -- contents --------------------------------------------------
        book.loaded.navigation
          .then((nav: any) => !cancelled && propsRef.current.onToc(flattenToc(nav.toc)))
          .catch(() => {});

        // -- opening position ------------------------------------------
        const { initialLocator, initialPercent } = propsRef.current;
        const cfi = initialLocator?.type === "epub" ? initialLocator.cfi : undefined;

        const locationsPromise = book.ready
          .then(() => book.locations.generate(1600))
          .then(() => { locationsReady = true; });

        if (cfi) {
          await rendition.display(cfi);
        } else if (initialPercent > 0) {
          // Progress made elsewhere (text view / another device): translate the
          // percentage into a spot once the book has been paginated.
          await locationsPromise.catch(() => {});
          const target = locationsReady
            ? book.locations.cfiFromPercentage(Math.min(0.999, initialPercent / 100))
            : undefined;
          await rendition.display(target);
        } else {
          await rendition.display();
        }
        if (cancelled) return;
        propsRef.current.onReady();

        locationsPromise.then(() => { if (!cancelled) emit(); }).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          propsRef.current.onError(err instanceof Error ? err.message : "Could not open this EPUB.");
        }
      }
    })();

    return () => {
      cancelled = true;
      removeKeys?.();
      propsRef.current.handleRef.current = null;
      try { rendition?.destroy(); } catch { /* already gone */ }
      try { book?.destroy(); } catch { /* already gone */ }
      renditionRef.current = null;
    };
    // The book is opened once per mount; appearance changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.url]);

  useEffect(() => {
    applyTheme(renditionRef.current, props.prefs);
  }, [props.prefs]);

  return <div ref={hostRef} className="h-full w-full" />;
}
