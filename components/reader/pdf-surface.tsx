"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Renders the actual PDF pages (pdf.js) in a continuous scroll. Only pages
 * near the viewport hold a canvas, so a 600-page PDF doesn't exhaust memory.
 * Position is {page, offset}: the page number plus how far down it you are.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { SurfaceProps, TocItem } from "./page-types";
import { THEMES } from "./reader-theme";

// Dark themes recolour the page bitmap; pictures are inverted with it, which is
// the usual trade-off for night reading.
const FILTERS = {
  light: "none",
  sepia: "sepia(0.35) brightness(0.97)",
  dark: "invert(0.86) hue-rotate(180deg)",
  night: "invert(0.92) hue-rotate(180deg) brightness(0.85)",
} as const;

export function PdfSurface(props: SurfaceProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(1.414);
  const pdfRef = useRef<any>(null);
  const restoredRef = useRef(false);

  // -- load the document ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ url: propsRef.current.url });
        const pdf = await task.promise;
        if (cancelled) { pdf.destroy(); return; }
        pdfRef.current = pdf;
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setAspect(vp.height / vp.width);
        setNumPages(pdf.numPages);
        loadOutline(pdf).then((items) => !cancelled && propsRef.current.onToc(items)).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          propsRef.current.onError(err instanceof Error ? err.message : "Could not open this PDF.");
        }
      }
    })();
    return () => {
      cancelled = true;
      try { task?.destroy(); } catch { /* ignore */ }
      pdfRef.current = null;
    };
  }, [props.url]);

  // -- render pages lazily ----------------------------------------------
  useEffect(() => {
    const scroller = scrollerRef.current;
    const column = columnRef.current;
    const pdf = pdfRef.current;
    if (!scroller || !column || !pdf || numPages === 0) return;

    const live = new Map<number, { canvas: HTMLCanvasElement; task: any }>();
    const wanted = new Set<number>();
    let dead = false;

    const drop = (n: number) => {
      const entry = live.get(n);
      if (!entry) return;
      try { entry.task?.cancel(); } catch { /* finished */ }
      entry.canvas.remove();
      entry.canvas.width = 0; // release the bitmap
      live.delete(n);
    };

    const draw = async (n: number) => {
      if (live.has(n) || dead) return;
      const slot = column.children[n - 1] as HTMLElement | undefined;
      if (!slot) return;
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:100%;height:100%;display:block";
      const entry = { canvas, task: null as any };
      live.set(n, entry);
      try {
        const page = await pdf.getPage(n);
        if (dead || !wanted.has(n)) { live.delete(n); return; }
        const base = page.getViewport({ scale: 1 });
        slot.style.aspectRatio = `${base.width} / ${base.height}`;
        const scale = (slot.clientWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        entry.task = page.render({ canvasContext: canvas.getContext("2d")!, viewport });
        await entry.task.promise;
        if (dead || !wanted.has(n)) { drop(n); return; }
        slot.appendChild(canvas);
      } catch {
        live.delete(n); // cancelled or failed; it will be retried when visible again
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) { wanted.add(n); draw(n); }
          else { wanted.delete(n); drop(n); }
        }
      },
      { root: scroller, rootMargin: "120% 0px" },
    );
    Array.from(column.children).forEach((c) => io.observe(c));

    return () => {
      dead = true;
      io.disconnect();
      Array.from(live.keys()).forEach(drop);
    };
  }, [numPages, props.url]);

  // -- opening position -------------------------------------------------
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const column = columnRef.current;
    if (!scroller || !column || numPages === 0 || restoredRef.current) return;

    const { initialLocator, initialPercent } = propsRef.current;
    let page = 1;
    let offset = 0;
    if (initialLocator?.type === "pdf") {
      page = Math.min(Math.max(1, initialLocator.page), numPages);
      offset = initialLocator.offset;
    } else if (initialPercent > 0) {
      const pos = (initialPercent / 100) * numPages;
      page = Math.min(numPages, Math.floor(pos) + 1);
      offset = pos - Math.floor(pos);
    }
    scrollToPage(page, offset);
    requestAnimationFrame(() => {
      restoredRef.current = true;
      propsRef.current.onReady();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  function scrollToPage(page: number, offset = 0) {
    const scroller = scrollerRef.current;
    const slot = columnRef.current?.children[page - 1] as HTMLElement | undefined;
    if (!scroller || !slot) return;
    const delta = slot.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += delta + offset * slot.getBoundingClientRect().height;
  }

  // -- shell commands ---------------------------------------------------
  useEffect(() => {
    props.handleRef.current = {
      next: () => scrollerRef.current?.scrollBy({ top: scrollerRef.current.clientHeight * 0.9, behavior: "smooth" }),
      prev: () => scrollerRef.current?.scrollBy({ top: -scrollerRef.current.clientHeight * 0.9, behavior: "smooth" }),
      goto: (t) => scrollToPage(Number(t), 0),
    };
    return () => { props.handleRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  // -- report position --------------------------------------------------
  const rafRef = useRef<number | null>(null);
  function onScroll() {
    if (!restoredRef.current || rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const scroller = scrollerRef.current;
      const column = columnRef.current;
      if (!scroller || !column || numPages === 0) return;
      const line = scroller.getBoundingClientRect().top + 60;
      let lo = 0;
      let hi = numPages - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((column.children[mid] as HTMLElement).getBoundingClientRect().bottom > line) hi = mid;
        else lo = mid + 1;
      }
      const rect = (column.children[lo] as HTMLElement).getBoundingClientRect();
      const offset = Math.min(1, Math.max(0, (line - rect.top) / Math.max(1, rect.height)));
      const page = lo + 1;
      propsRef.current.onLocation({
        locator: { type: "pdf", page, offset: Math.round(offset * 1000) / 1000 },
        percent: Math.round(((page - 1 + offset) / numPages) * 1000) / 10,
        label: `Page ${page} of ${numPages}`,
        page,
      });
    });
  }

  const theme = THEMES[props.prefs.theme];
  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      onClick={() => propsRef.current.onTap()}
      className="h-full w-full overflow-y-auto overscroll-contain"
      style={{ backgroundColor: theme.bg }}
    >
      <div ref={columnRef} className="mx-auto flex max-w-[56rem] flex-col gap-3 px-2 pb-28 pt-16">
        {Array.from({ length: numPages }, (_, i) => (
          <div
            key={i}
            data-page={i + 1}
            className="w-full overflow-hidden rounded-sm shadow-sm"
            style={{
              aspectRatio: `1 / ${aspect}`,
              backgroundColor: "#fff",
              filter: FILTERS[props.prefs.theme],
            }}
          />
        ))}
      </div>
    </div>
  );
}

async function loadOutline(pdf: any): Promise<TocItem[]> {
  const outline = await pdf.getOutline();
  if (!outline) return [];
  const out: TocItem[] = [];
  const walk = async (items: any[], depth: number) => {
    for (const it of items) {
      try {
        const dest = typeof it.dest === "string" ? await pdf.getDestination(it.dest) : it.dest;
        if (dest) {
          const page = (await pdf.getPageIndex(dest[0])) + 1;
          out.push({ label: String(it.title ?? "").trim() || "Untitled", target: page, depth });
        }
      } catch {
        /* unresolvable destination: skip the entry */
      }
      if (it.items?.length && depth < 2) await walk(it.items, depth + 1);
    }
  };
  await walk(outline, 0);
  return out;
}
