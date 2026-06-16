export type BookType = "document" | "audiobook";
export type SegmentKind = "heading" | "paragraph" | "list_item" | "quote" | "caption";
export type Theme = "light" | "sepia" | "dark" | "night";

export interface BookFile {
  id: number;
  fmt: string;
  url: string | null;
  order: number;
  track_title: string;
  duration_ms: number | null;
  size_bytes: number | null;
}

export interface Book {
  id: number;
  title: string;
  description: string | null;
  user: string;
  author: string | null;
  production_year: number | null;
  status: string;
  book_type: BookType;
  language_code: string;
  cover_url: string | null;
  total_page: number | null;
  total_segments: number | null;
  duration_estimate_ms: number | null;
  files: BookFile[];
  updated_at: string;
  created_at: string;
}

export interface TocEntry {
  index: number;
  title: string;
  level: number;
  start_segment: number;
  page: number | null;
}

export interface AudioChapter {
  index: number;
  title: string;
  start_ms: number;
  end_ms: number | null;
  book_file: number | null;
}

export interface Segment {
  index: number;
  kind: SegmentKind;
  level: number | null;
  text: string;
  chapter_index: number;
  page: number | null;
  char_count: number;
}

export interface TocResponse {
  book_id: number;
  book_type: BookType;
  fmt: string;
  total_segments: number;
  duration_estimate_ms: number;
  toc: TocEntry[] | AudioChapter[];
}

export interface ReadingProgress {
  book: number;
  segment_index: number;
  char_offset: number;
  chapter_index: number;
  page: number | null;
  percent: number;
  audio_ms: number;
  updated_at?: string;
}

export interface Bookmark {
  id: number;
  book: number;
  segment_index: number;
  audio_ms: number | null;
  label: string;
  note: string;
  color: string;
  created_at: string;
}

export interface ReaderSettings {
  voice_name: string;
  language_code: string;
  speaking_rate: number;
  pitch: number;
  speed: number;
  theme: Theme;
  font_family: string;
  font_size: number;
  auto_scroll: boolean;
  skip_back_seconds: number;
  skip_forward_seconds: number;
}

export interface Voice {
  name: string;
  language_codes: string[];
  ssml_gender: string;
  natural_sample_rate_hertz?: number;
}

/** Server → client WS frames. */
export type ServerFrame =
  | { type: "ready"; book_type: BookType; total_segments?: number; toc: TocEntry[] | AudioChapter[]; voice?: string; tracks?: BookFile[]; resume: ReadingProgress }
  | { type: "segment_meta"; segment_index: number; chapter_index: number; page: number | null; text: string; kind: SegmentKind; duration_ms: number }
  | { type: "progress_saved"; segment_index: number }
  | { type: "paused"; segment_index: number }
  | { type: "stopped"; segment_index: number }
  | { type: "ended"; segment_index: number }
  | { type: "voice_changed"; voice: string }
  | { type: "speed_ack"; speed: number }
  | { type: "error"; code: string; detail: string };

/** Client → server WS actions. */
export type ClientAction =
  | { action: "play"; segment_index: number; voice?: string }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "seek"; segment_index: number }
  | { action: "set_voice"; voice: string }
  | { action: "set_speed"; speed: number }
  | { action: "next_chapter" }
  | { action: "prev_chapter" }
  | { action: "stop" }
  | { action: "save_progress"; segment_index: number; audio_ms?: number; chapter_index?: number };
