/**
 * Hybrid auth HTTP client.
 *
 * - Access token lives ONLY in memory (never localStorage → not XSS-exposed).
 * - Refresh token lives in an httpOnly cookie (Domain=.ecode2.com) the browser
 *   sends automatically because every request uses `credentials: "include"`.
 * - On 401 we transparently call /auth/refresh/ (rotates the cookie) once and
 *   retry the original request.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE ||
  API_BASE.replace(/^http/, "ws");

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

/** Exchange the refresh cookie for a fresh access token. Deduped. */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data.access ?? null;
      return Boolean(accessToken);
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface ApiError extends Error {
  status: number;
  body?: unknown;
}

async function parse(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

/** Core fetch with bearer header, credentials, and one silent-refresh retry. */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: authHeaders(init.headers),
  });

  if (res.status === 401 && retry) {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch<T>(path, init, false);
  }

  if (!res.ok) {
    const body = await parse(res).catch(() => undefined);
    const err = new Error(
      typeof body === "object" && body && "detail" in body
        ? String((body as Record<string, unknown>).detail)
        : `Request failed (${res.status})`,
    ) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return parse(res) as Promise<T>;
}

export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path);

export const apiSend = <T = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
) =>
  apiFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Multipart upload (no JSON content-type; browser sets the boundary). */
export const apiUpload = <T = unknown>(path: string, form: FormData) =>
  apiFetch<T>(path, { method: "POST", body: form });
