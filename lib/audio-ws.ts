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

/**
 * One AudioContext for the whole app.
 *
 * iOS Safari only lets an AudioContext start (or resume) while a user gesture
 * is still on the stack. Creating it lazily inside play() meant it was reached
 * several `await`s after the tap -- past the gesture -- so Safari kept it
 * suspended and nothing was audible. Installed PWAs get relaxed autoplay rules,
 * which is why the same build played there and not in the browser.
 *
 * `unlockAudio()` must therefore be called *synchronously* from the event
 * handler, before any awaiting. It is cheap and idempotent.
 */
let sharedCtx: AudioContext | null = null;

/* -------------------------------------------------------------------------
 * iOS audio session
 *
 * WebKit gives a bare AudioContext the *ambient* audio session category. An
 * ambient session is silenced by the iPhone's Ring/Silent switch, does not
 * play in the background, and yields to other apps. Media elements that are
 * actually playing media get the *playback* category instead, which ignores
 * the Ring/Silent switch -- that is how Apple Books and Spotify keep playing
 * with the switch flipped.
 *
 * Our TTS never touches an <audio> element: segments are decoded and
 * scheduled through Web Audio, so iOS keeps us on ambient and the hardware
 * switch mutes the speaker. Headphones bypass the switch entirely, which is
 * why the exact same build is audible on EarPods and silent on the speaker.
 * Android and desktop have no equivalent switch, so they were never affected.
 *
 * `navigator.audioSession` (Safari 16.4+) is the supported way to ask for the
 * playback category. Older iOS gets the silent-loop fallback below.
 * ---------------------------------------------------------------------- */
type AudioSessionType =
  | "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: AudioSessionType };
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports itself as a Mac; the touch check separates it.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

/** A half second of 8-bit silence, built in memory so no asset is needed. */
function silentWavUrl(): string {
  const rate = 8000;
  const frames = rate / 2;
  const bytes = new Uint8Array(44 + frames);
  const view = new DataView(bytes.buffer);
  const ascii = (off: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(off + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + frames, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, frames, true);
  bytes.fill(128, 44); // 0x80 is silence for unsigned 8-bit PCM
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

let keepAlive: HTMLAudioElement | null = null;

/**
 * Ask iOS for the playback audio session, so the Ring/Silent switch stops
 * muting us and audio comes out of the speaker as well as headphones.
 * Idempotent and safe to call on every gesture.
 */
function claimPlaybackSession(): void {
  const session = (navigator as NavigatorWithAudioSession).audioSession;
  if (session) {
    try {
      session.type = "playback";
      return;
    } catch {
      /* fall through to the legacy path */
    }
  }
  if (!isIOS() || keepAlive) return;
  // iOS < 16.4 has no audioSession API. Playing a silent looping media
  // element promotes the page's session to playback for as long as it runs.
  // Best-effort: it must start inside the same user gesture.
  const el = new Audio(silentWavUrl());
  el.loop = true;
  el.volume = 0;
  // Keeps iOS from treating this as a video and taking over the screen.
  el.setAttribute("playsinline", "");
  keepAlive = el;
  void el.play().catch(() => {
    keepAlive = null;
  });
}

/** Drop the playback session when the player is closed, so other apps and
 *  the ringer get their normal behaviour back. */
export function releaseAudioSession(): void {
  const session = (navigator as NavigatorWithAudioSession).audioSession;
  if (session) {
    try { session.type = "auto"; } catch { /* not settable */ }
  }
  if (keepAlive) {
    try { keepAlive.pause(); } catch { /* already stopped */ }
    URL.revokeObjectURL(keepAlive.src);
    keepAlive = null;
  }
}

export function unlockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  // Claim the session before the context exists: WebKit picks a category when
  // the context is first started, so asking afterwards can come too late.
  claimPlaybackSession();
  if (!sharedCtx) sharedCtx = new Ctx();
  // resume() returns a promise, but it must be *called* inside the gesture;
  // awaiting it is not required and would push us past the gesture.
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

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
  /** A paragraph was dropped but the stream continues. */
  onSegmentSkipped?: (segmentIndex: number, reason: string) => void;
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
    private bookId: string,
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
    // Reuses the shared context so a session started by unlockAudio() inside
    // the user gesture is the same one we schedule audio on.
    const ctx = unlockAudio();
    if (!ctx) throw new Error("Web Audio is unavailable in this browser.");
    if (this.ctx !== ctx || !this.gain) {
      this.ctx = ctx;
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
      this.nextStartAt = ctx.currentTime;
    }
    return ctx;
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
        case "segment_skipped":
          this.handlers.onSegmentSkipped?.(frame.segment_index, frame.reason);
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
    // Only detach this session's gain node. The AudioContext is shared and
    // must survive: close() is irreversible, and re-creating one later would
    // land outside a user gesture, leaving iOS permanently silent.
    try { this.gain?.disconnect(); } catch { /* already detached */ }
    this.gain = null;
    this.ctx = null;
  }
}
