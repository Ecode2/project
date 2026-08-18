import { apiFetch, apiGet, apiSend, apiUpload } from "./client";
import type {
  Book,
  Bookmark,
  ReaderSettings,
  ReadingProgress,
  Segment,
  TocResponse,
  Voice,
} from "./reader-types";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const listBooks = (status?: "public" | "private") =>
  apiGet<Paginated<Book>>(`/books/${status ? `?status=${status}` : ""}`);

export const getBook = (id: string) => apiGet<Book>(`/books/${id}/`);

export const getToc = (id: string) => apiGet<TocResponse>(`/books/${id}/toc/`);

export const getSegments = (id: string, start = 0, count = 100) =>
  apiGet<{ start: number; count: number; total: number; segments: Segment[] }>(
    `/books/${id}/segments/?start=${start}&count=${count}`,
  );

export const getProgress = (id: string) =>
  apiGet<ReadingProgress>(`/books/${id}/progress/`);

export const putProgress = (id: string, body: Partial<ReadingProgress>) =>
  apiSend<ReadingProgress>(`/books/${id}/progress/`, "PUT", body);

export const listBookmarks = (id: string) =>
  apiGet<Bookmark[]>(`/books/${id}/bookmarks/`);

export const addBookmark = (id: string, body: Partial<Bookmark>) =>
  apiSend<Bookmark>(`/books/${id}/bookmarks/`, "POST", body);

export const deleteBookmark = (id: string, bookmarkId: string) =>
  apiSend<void>(`/books/${id}/bookmarks/${bookmarkId}/`, "DELETE");

/**
 * Report wall-clock milliseconds actually spent playing since the last call.
 * `keepalive` lets the final flush survive a page being closed (unlike a plain
 * fetch, and unlike sendBeacon it can still carry the Authorization header).
 */
export const reportListening = (id: string, ms: number, keepalive = false) =>
  apiFetch<{ ms: number }>(`/books/${id}/listening/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ms: Math.round(ms) }),
    keepalive,
  });

export const getReaderSettings = () =>
  apiGet<ReaderSettings>(`/api/reader-settings/`);

export const putReaderSettings = (body: Partial<ReaderSettings>) =>
  apiSend<ReaderSettings>(`/api/reader-settings/`, "PUT", body);

export const listVoices = (language?: string) =>
  apiGet<Voice[]>(`/api/voices/${language ? `?language=${language}` : ""}`);

/** One-time, short-lived ticket to authenticate the audio WebSocket. */
export const getWsTicket = () =>
  apiSend<{ ticket: string; expires_in: number }>(`/auth/ws-ticket/`, "POST");

export const createBook = (body: Partial<Book>) =>
  apiSend<Book>(`/books/`, "POST", body);

export const uploadFile = (form: FormData) => apiUpload<unknown>(`/files/`, form);
