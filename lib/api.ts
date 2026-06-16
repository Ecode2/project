import {
  AllBookPage, ApiResponse, BookCoverResponse, BookListResponse,
  LoginInfo, OneBookPage, RegisterInfo, UserInfo, FormSchemaData,
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

export const GetBookInfo = async (id: number) => {
  try {
    const response = await api.get(`/books/${id}/`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as BookCoverResponse };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export async function UpdateBookInfo(id: number, updates: Partial<BookCoverResponse>): Promise<ApiResponse> {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.patch(`/books/${id}/`, updates);
    if (response.status !== 200) return { status: false, message: "Failed to update book" };
    return { status: true, message: response.data as BookCoverResponse };
  } catch {
    return { status: false, message: "Failed to update book" };
  }
}

export async function DeleteBookInfo(id: number): Promise<ApiResponse> {
  if (!getAccessToken()) return { status: false, message: "Authentication required" };
  try {
    const response = await api.delete(`/books/${id}/`);
    if (response.status !== 204) return { status: false, message: "Failed to delete book" };
    return { status: true, message: "Book deleted successfully" };
  } catch {
    return { status: false, message: "Failed to delete book" };
  }
}

export const GetOnePage = async (id: number, page: number) => {
  try {
    const response = await api.get(`/books/${id}/read-page/?page=${page}`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as OneBookPage };
  } catch {
    return { status: false, message: "Something went wrong" };
  }
};

export const GetAllPage = async (id: number, _page?: number) => {
  try {
    const response = await api.get(`/books/${id}/pages/`);
    if (response.status !== 200) return { status: false, message: "Something went wrong" };
    return { status: true, message: response.data as AllBookPage };
  } catch {
    return { status: false, message: "Something went wrong" };
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
    const files: File[] = formData.book?.length ? Array.from(formData.book) : [formData.book];
    for (let i = 0; i < files.length; i += 1) {
      const fileData = new FormData();
      fileData.append("book", book.id);
      fileData.append("file", files[i] as Blob);
      fileData.append("order", String(i));
      const fileResponse = await api.post(`/files/`, fileData);
      if (fileResponse.status !== 201) return { status: false, message: "Failed to upload file" };
    }
    return { status: true, message: { book } };
  } catch (error) {
    console.error("CreateBook error:", error);
    return { status: false, message: "Something went wrong" };
  }
};

export { API_BASE };
