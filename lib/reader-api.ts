import { apiGet, apiSend, apiUpload } from "./client";
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

export const getBook = (id: number) => apiGet<Book>(`/books/${id}/`);

export const getToc = (id: number) => apiGet<TocResponse>(`/books/${id}/toc/`);

export const getSegments = (id: number, start = 0, count = 100) =>
  apiGet<{ start: number; count: number; total: number; segments: Segment[] }>(
    `/books/${id}/segments/?start=${start}&count=${count}`,
  );

export const getProgress = (id: number) =>
  apiGet<ReadingProgress>(`/books/${id}/progress/`);

export const putProgress = (id: number, body: Partial<ReadingProgress>) =>
  apiSend<ReadingProgress>(`/books/${id}/progress/`, "PUT", body);

export const listBookmarks = (id: number) =>
  apiGet<Bookmark[]>(`/books/${id}/bookmarks/`);

export const addBookmark = (id: number, body: Partial<Bookmark>) =>
  apiSend<Bookmark>(`/books/${id}/bookmarks/`, "POST", body);

export const deleteBookmark = (id: number, bookmarkId: number) =>
  apiSend<void>(`/books/${id}/bookmarks/${bookmarkId}/`, "DELETE");

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
