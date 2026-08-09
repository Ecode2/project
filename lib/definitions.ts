import * as z from "zod";

export type LoginInfo = {
    email : string,
    password : string
}

export type RegisterInfo = {
    username : string,
    email : string,
    password : string
}

export type UserInfo = {
    id: number,
    username: string,
    email: string
  }


/** A single uploaded file belonging to a book (documents or audiobook tracks). */
export interface BookFileInfo {
    id: number,
    book: number,
    file: string,
    url: string | null,
    fmt: string,
    size_bytes: number | null,
    checksum: string,
    order: number,
    track_title: string | null,
    duration_ms: number | null,
}

export interface BookCoverResponse {
    id: number,
    title: string,
    description: string | null,
    user: string,
    author: string | null,
    production_year: number | null,
    status: string,
    total_page: number | null,
    updated_at: string,
    created_at: string,
    // New in the audiobook reader: cover_url replaces the base64 book_cover.
    cover_url?: string | null,
    book_type?: "document" | "audiobook",
    total_segments?: number | null,
    duration_estimate_ms?: number | null,
    book_cover?: string,
    /** Serialized by the backend on retrieve; used to manage/replace files. */
    files?: BookFileInfo[],
}

/**
 * Aggregate reading stats (GET /api/stats/). Wall-clock reading time is not
 * recorded by the backend, so `estimated_listening_ms` is narration duration
 * weighted by progress -- an estimate, not a measurement.
 */
export type LibraryStats = {
    books_in_library: number,
    documents: number,
    audiobooks: number,
    books_started: number,
    books_completed: number,
    books_in_progress: number,
    estimated_listening_ms: number,
    bookmarks: number,
}

export type BookListResponse = {
    count: string,
    next: string | null,
    previous: string | null,
    results: BookCoverResponse[]
}

export type OneBookPage = {
    [pageNumber: string]: string;
}

export type AllBookPage = OneBookPage[]


export type ApiResponse = {
    status: boolean,
    message: any,
}

export interface AuthContextType {
    user: UserInfo | null,
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>, 
    register: (username: string, email: string, password: string) => Promise<void>, 
    logout: () => void
  }


// Accepted upload types, mirroring FORMAT_CHOICES in the backend's models.py.
export const DOCUMENT_EXTENSIONS = ["pdf", "epub", "docx", "txt"] as const;
export const AUDIO_EXTENSIONS = [
    "mp3", "m4a", "m4b", "aac", "ogg", "opus", "wav", "flac",
] as const;
export const ACCEPTED_EXTENSIONS: string[] = [
    ...DOCUMENT_EXTENSIONS, ...AUDIO_EXTENSIONS,
];

/** Ready-made value for an <input type="file"> accept attribute. */
export const FILE_ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",");

// Keep in step with DOCUMENT_MAX_BYTES / AUDIO_MAX_BYTES in the backend so the
// user is told before uploading rather than after a rejected request.
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 500 * 1024 * 1024;

export const extensionOf = (name: string) =>
    name.split(".").pop()?.toLowerCase() ?? "";

export const isAudioExtension = (ext: string) =>
    (AUDIO_EXTENSIONS as readonly string[]).includes(ext);

/**
 * The file field accepts a single File, a FileList or an array of Files, so
 * normalise before validating. (The previous schema only understood FileList,
 * which meant single-File uploads silently skipped every check.)
 */
export function toFileArray(value: unknown): File[] {
    if (!value) return [];
    if (value instanceof File) return [value];
    if (Array.isArray(value)) return value.filter((f): f is File => f instanceof File);
    if (typeof FileList !== "undefined" && value instanceof FileList) return Array.from(value);
    return [];
}

export const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    description: z.string().optional(),
    book: z
        .any()
        .refine((v) => toFileArray(v).length >= 1, "At least one file is required")
        .refine(
            (v) => toFileArray(v).every((f) => ACCEPTED_EXTENSIONS.includes(extensionOf(f.name))),
            `Unsupported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}`,
        )
        .refine(
            (v) => toFileArray(v).every((f) =>
                f.size <= (isAudioExtension(extensionOf(f.name)) ? AUDIO_MAX_BYTES : DOCUMENT_MAX_BYTES)
            ),
            "File too large (max 50MB for documents, 500MB for audio)",
        ),
    publication_year: z.string().optional(),
    isPublic: z.boolean().optional(),
});

export type FormSchemaData = z.infer<typeof formSchema>;

