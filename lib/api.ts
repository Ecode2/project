import {
  AllBookPage, ApiResponse, BookCoverResponse, BookFileInfo, BookListResponse,
  LibraryStats, LoginInfo, OneBookPage, RegisterInfo, UserInfo, FormSchemaData,
  ACCEPTED_EXTENSIONS, AUDIO_MAX_BYTES, DOCUMENT_MAX_BYTES,
  extensionOf, isAudioExtension,
} from "@/lib/definitions";
import api from "@/lib/axiosInstance";
import {
  API_BASE, getAccessToken, refreshAccessToken, setAccessToken,
} from "@/lib/client";

/**
 * Hybrid auth: access token kept in memory (never localStorage), refresh token
 * in an httpOnly cookie. `checkToken` performs the silent refresh on app load.
 */

export async function checkToken() {
  const ok = await refreshAccessToken();
  return ok
    ? { status: true, message: "Session restored" }
    : { status: false, message: "Not authenticated" };
}

export const userInfo = async () => {
  try {
    const response = await api.get(`/auth/profile/`);
    if (response.status !== 200) return { status: false, message: "Unauthorised access, Relogin" };
    return { status: true, message: response.data as UserInfo };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const login = async (userInfo: LoginInfo) => {
  if (!userInfo?.email) return { status: false, message: "Email Required" };
  if (!userInfo?.password) return { status: false, message: "Password Required" };
  try {
    const response = await api.post(`/auth/login/`, {
      username: userInfo.email,
      password: userInfo.password,
    });
    if (response.status !== 200) return { status: false, message: response.data };
    setAccessToken(response.data.access ?? null);
    return { status: true, message: "SignIn successful" };
  } catch {
    return { status: false, message: "Invalid credentials" };
  }
};

export const register = async (userInfo: RegisterInfo) => {
  if (!userInfo?.username) return { status: false, message: "Username Required" };
  if (!userInfo?.email) return { status: false, message: "Email Required" };
  if (!userInfo?.password) return { status: false, message: "Password Required" };
  try {
    const response = await api.post(`/auth/register/`, {
      username: userInfo.username,
      email: userInfo.email,
      password: userInfo.password,
    });
    if (response.status !== 201) return { status: false, message: "Something went wrong" };
    // Auto-login to obtain the access token + refresh cookie.
    return login({ email: userInfo.email, password: userInfo.password });
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const logout = async () => {
  try {
    await api.post(`/auth/logout/`, {});
  } catch {
    /* ignore */
  } finally {
    setAccessToken(null);
  }
  return { status: true, message: "Logged out" };
};

export const ListBooks = async (visibility: "public" | "private" | null) => {
  try {
    let url = "/books/";
    if (visibility === "public") url += "?status=public";
    else if (visibility === "private") url += "?status=private";
    const response = await api.get(url);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as BookListResponse };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const GetBookInfo = async (id: string) => {
  try {
    const response = await api.get(`/books/${id}/`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as BookCoverResponse };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export async function UpdateBookInfo(id: string, updates: Partial<BookCoverResponse>): Promise<ApiResponse> {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.patch(`/books/${id}/`, updates);
    if (response.status !== 200) return { status: false, message: "Failed to update book" };
    return { status: true, message: response.data as BookCoverResponse };
  } catch {
    return { status: false, message: "Failed to update book" };
  }
}

export async function DeleteBookInfo(id: string): Promise<ApiResponse> {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.delete(`/books/${id}/`);
    if (response.status !== 204) return { status: false, message: "Failed to delete book" };
    return { status: true, message: "Book deleted successfully" };
  } catch {
    return { status: false, message: "Failed to delete book" };
  }
}

export const GetOnePage = async (id: string, page: number) => {
  try {
    const response = await api.get(`/books/${id}/read-page/?page=${page}`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as OneBookPage };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const GetAllPage = async (id: string, _page?: number) => {
  try {
    const response = await api.get(`/books/${id}/pages/`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as AllBookPage };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const GetLibraryStats = async () => {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.get(`/api/stats/`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as LibraryStats };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

/** Files attached to a book. The book detail response already embeds these,
 *  but after an upload/delete we re-fetch just the file list. */
export const ListBookFiles = async (bookId: string) => {
  try {
    const response = await api.get(`/files/?book=${bookId}`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    // The endpoint is paginated; callers only care about the rows.
    const data = response.data;
    const results: BookFileInfo[] = Array.isArray(data) ? data : data.results ?? [];
    return { status: true, message: results };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const UploadBookFile = async (bookId: string, file: File, order = 0) => {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  const ext = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return { status: false, message: `Unsupported file type: .${ext}` };
  }
  const limit = isAudioExtension(ext) ? AUDIO_MAX_BYTES : DOCUMENT_MAX_BYTES;
  if (file.size > limit) {
    return {
      status: false,
      message: isAudioExtension(ext)
        ? "Audio file shouldn't be larger than 500MB."
        : "Document shouldn't be larger than 50MB.",
    };
  }
  try {
    const fileData = new FormData();
    fileData.append("book", bookId);
    fileData.append("file", file);
    fileData.append("order", String(order));
    const response = await api.post(`/files/`, fileData);
    if (response.status !== 201) return { status: false, message: "Failed to upload file" };
    return { status: true, message: response.data as BookFileInfo };
  } catch (error: any) {
    // Surface the backend's validation message (size/format) when present.
    const detail = error?.response?.data;
    const msg =
      (typeof detail === "object" && detail && (detail.file?.[0] ?? detail.detail)) ||
      "Failed to upload file";
    return { status: false, message: String(msg) };
  }
};

export const DeleteBookFile = async (fileId: string): Promise<ApiResponse> => {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.delete(`/files/${fileId}/`);
    if (response.status !== 204) return { status: false, message: "Failed to delete file" };
    return { status: true, message: "File deleted" };
  } catch {
    return { status: false, message: "Failed to delete file" };
  }
};

export const CreateBook = async (formData: FormSchemaData) => {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };

  const status = formData.isPublic ? "public" : "private";
  try {
    // Step 1: create the book.
    const bookResponse = await api.post(`/books/`, {
      title: formData.title,
      description: formData.description,
      author: formData.author,
      production_year: formData.publication_year,
      status,
    });
    if (bookResponse.status !== 201) return { status: false, message: "Failed to create book" };
    const book = bookResponse.data;

    // Step 2: upload the file(s). Supports a single file or a FileList.
    //
    // The book row already exists at this point, so a failed upload used to
    // leave an empty book behind -- it showed up in the library, opened to a
    // blank reader, and crashed the WebSocket with "no readable file". Roll it
    // back so a failed upload leaves no trace.
    const files: File[] = formData.book?.length ? Array.from(formData.book) : [formData.book];
    try {
      for (let i = 0; i < files.length; i += 1) {
        const fileData = new FormData();
        fileData.append("book", book.id);
        fileData.append("file", files[i] as Blob);
        fileData.append("order", String(i));
        const fileResponse = await api.post(`/files/`, fileData);
        if (fileResponse.status !== 201) throw new Error("Failed to upload file");
      }
    } catch (uploadError: any) {
      await api.delete(`/books/${book.id}/`).catch(() => {});
      // Surface the server's own message (size/format) when it sent one.
      const detail = uploadError?.response?.data;
      const msg =
        (typeof detail === "object" && detail && (detail.file?.[0] ?? detail.detail)) ||
        (uploadError?.response?.status === 413
          ? "That file is too large for the server to accept."
          : null) ||
        "Failed to upload the book file. The book was not saved.";
      return { status: false, message: String(msg) };
    }
    return { status: true, message: { book } };
  } catch (error) {
    console.error("CreateBook error:", error);
    return { status: false, message: "Something went wrong" };
  }
};

export { API_BASE };
