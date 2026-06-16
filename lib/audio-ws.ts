/**
 * Reader audio WebSocket client + Web Audio playback queue.
 *
 * Protocol invariant: each `segment_meta` (text) frame is immediately followed
 * by exactly one binary audio frame for that segment. We decode binary frames
 * with the Web Audio API and schedule them back-to-back for near-gapless
 * playback. Speed = `playbackRate` on the source nodes (instant, no re-bill).
 */

import { WS_BASE } from "./client";
import { getWsTicket } from "./reader-api";
import type { ClientAction, ServerFrame, SegmentKind } from "./reader-types";

const LOOKAHEAD_SEC = 0.3;

interface Scheduled {
  src: AudioBufferSourceNode;
  index: number;
  startAt: number;
  endAt: number;
}

interface PendingMeta {
  segment_index: number;
  chapter_index: number;
  page: number | null;
  text: string;
  kind: SegmentKind;
  duration_ms: number;
}

export interface ReaderClientHandlers {
  onReady?: (frame: Extract<ServerFrame, { type: "ready" }>) => void;
  onSegment?: (meta: PendingMeta) => void;
  onCurrentSegment?: (index: number) => void;
  onProgress?: (segmentIndex: number) => void;
  onEnded?: () => void;
  onError?: (code: string, detail: string) => void;
  onStateChange?: (state: "connecting" | "open" | "closed") => void;
}

export class ReaderAudioClient {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private speed = 1;

  private buffers: { index: number; buffer: AudioBuffer }[] = [];
  private scheduled: Scheduled[] = [];
  private pendingMeta: PendingMeta | null = null;
  private nextStartAt = 0;
  private raf: number | null = null;
  private currentIndex = -1;
  private reconnectAttempts = 0;
  private manualClose = false;

  constructor(
    private bookId: number,
    private handlers: ReaderClientHandlers = {},
  ) {}

  // -- lifecycle --------------------------------------------------------
  async connect(): Promise<void> {
    this.manualClose = false;
    this.handlers.onStateChange?.("connecting");
    const { ticket } = await getWsTicket();
    const url = `${WS_BASE}/ws/reader/${this.bookId}/?ticket=${encodeURIComponent(ticket)}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.handlers.onStateChange?.("open");
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onclose = () => {
      this.handlers.onStateChange?.("closed");
      if (!this.manualClose) this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
    this.reconnectAttempts += 1;
    setTimeout(async () => {
      if (this.manualClose) return;
      try {
        await this.connect();
        // Server persisted our position; resume from it.
        this.send({ action: "resume" });
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.nextStartAt = this.ctx.currentTime;
    }
    return this.ctx;
  }

  // -- inbound frames ---------------------------------------------------
  private async onMessage(ev: MessageEvent) {
    if (typeof ev.data === "string") {
      const frame = JSON.parse(ev.data) as ServerFrame;
      switch (frame.type) {
        case "ready":
          this.handlers.onReady?.(frame);
          break;
        case "segment_meta":
          this.pendingMeta = frame;
          this.handlers.onSegment?.(frame);
          break;
        case "progress_saved":
          this.handlers.onProgress?.(frame.segment_index);
          break;
        case "ended":
          this.handlers.onEnded?.();
          break;
        case "error":
          this.handlers.onError?.(frame.code, frame.detail);
          break;
        default:
          break;
      }
      return;
    }
    // Binary audio frame for the preceding segment_meta.
    const meta = this.pendingMeta;
    this.pendingMeta = null;
    if (!meta) return;
    try {
      const ctx = this.ensureContext();
      const buffer = await ctx.decodeAudioData(ev.data as ArrayBuffer);
      this.buffers.push({ index: meta.segment_index, buffer });
      this.startSchedulerLoop();
    } catch {
      // Undecodable frame: skip without breaking the stream.
    }
  }

  // -- scheduling -------------------------------------------------------
  private startSchedulerLoop() {
    if (this.raf != null) return;
    const tick = () => {
      this.pump();
      this.reportCurrent();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || !this.gain) return;
    if (this.nextStartAt < ctx.currentTime) this.nextStartAt = ctx.currentTime;
    while (this.buffers.length && this.nextStartAt - ctx.currentTime < LOOKAHEAD_SEC) {
      const { index, buffer } = this.buffers.shift()!;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = this.speed;
      src.connect(this.gain);
      const startAt = Math.max(this.nextStartAt, ctx.currentTime + 0.02);
      src.start(startAt);
      const endAt = startAt + buffer.duration / this.speed;
      this.nextStartAt = endAt;
      const entry: Scheduled = { src, index, startAt, endAt };
      this.scheduled.push(entry);
      src.onended = () => {
        this.scheduled = this.scheduled.filter((s) => s !== entry);
      };
    }
  }

  private reportCurrent() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const cur = this.scheduled.find((s) => now >= s.startAt && now < s.endAt);
    if (cur && cur.index !== this.currentIndex) {
      this.currentIndex = cur.index;
      this.handlers.onCurrentSegment?.(cur.index);
    }
  }

  // -- outbound actions -------------------------------------------------
  private send(action: ClientAction) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(action));
    }
  }

  async play(segmentIndex: number, voice?: string) {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    this.flush();
    this.send({ action: "play", segment_index: segmentIndex, voice });
  }

  async resume() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
    this.send({ action: "resume" });
  }

  pause() {
    this.send({ action: "pause" });
    this.flush();
    this.ctx?.suspend();
  }

  seek(segmentIndex: number) {
    this.flush();
    this.send({ action: "seek", segment_index: segmentIndex });
  }

  nextChapter() {
    this.flush();
    this.send({ action: "next_chapter" });
  }
  prevChapter() {
    this.flush();
    this.send({ action: "prev_chapter" });
  }

  setVoice(voice: string) {
    this.flush();
    this.send({ action: "set_voice", voice });
  }

  /** Instant client-side speed change; also informs the server (ack only). */
  setSpeed(speed: number) {
    this.speed = speed;
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      // Live-adjust the currently sounding source; reschedule the rest.
      const playing = this.scheduled.find((s) => now >= s.startAt && now < s.endAt);
      const future = this.scheduled.filter((s) => s.startAt > now);
      future.forEach((s) => {
        try { s.src.stop(); } catch { /* already stopped */ }
      });
      this.scheduled = playing ? [playing] : [];
      if (playing) {
        playing.src.playbackRate.value = speed;
        const remaining = (playing.endAt - now) * (playing.src.playbackRate.value / speed);
        playing.endAt = now + remaining;
        this.nextStartAt = playing.endAt;
      } else {
        this.nextStartAt = now;
      }
    }
    this.send({ action: "set_speed", speed });
  }

  private flush() {
    this.scheduled.forEach((s) => {
      try { s.src.stop(); } catch { /* already stopped */ }
    });
    this.scheduled = [];
    this.buffers = [];
    this.pendingMeta = null;
    this.currentIndex = -1;
    if (this.ctx) this.nextStartAt = this.ctx.currentTime;
  }

  close() {
    this.manualClose = true;
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.flush();
    this.send({ action: "stop" });
    this.ws?.close();
    this.ctx?.close();
    this.ctx = null;
  }
}
