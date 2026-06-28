const TOKEN_KEY = "docvault_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Document {
  id: number;
  original_filename: string;
  mime_type: string;
  file_type: "pdf" | "image";
  size_bytes: number;
  ai_summary: string | null;
  tags: string[];
  is_favorite: boolean;
  share_token: string | null;
  created_at: string;
}

export interface DocumentStats {
  totalDocuments: number;
  totalFavorites: number;
  totalSizeBytes: number;
}

export type SortOption = "date" | "name" | "size";

interface ListParams {
  search?: string;
  tag?: string;
  favorite?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

interface ListResponse {
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Uses XMLHttpRequest rather than fetch for the actual S3 PUT, purely
 * because fetch still has no cross-browser-reliable upload progress
 * event - XHR's `upload.onprogress` does. Everything else in this
 * client uses fetch; this is the one deliberate exception.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError("Upload to storage failed", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Upload to storage failed", 0));

    xhr.send(file);
  });
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listDocuments: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.tag) qs.set("tag", params.tag);
    if (params.favorite) qs.set("favorite", "true");
    if (params.sort) qs.set("sort", params.sort);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    return request<ListResponse>(`/documents?${qs.toString()}`);
  },

  getStats: () => request<DocumentStats>("/documents/stats"),

  /**
   * Full upload flow for one file: presigned URL -> PUT to S3 (with
   * progress) -> record metadata. `onProgress` is optional so callers
   * that don't care about a progress bar can ignore it.
   */
  uploadDocument: async (file: File, onProgress?: (percent: number) => void): Promise<Document> => {
    const { uploadUrl, key } = await request<{ uploadUrl: string; key: string }>(
      `/documents/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(
        file.type
      )}`
    );

    await putWithProgress(uploadUrl, file, onProgress);

    const { document } = await request<{ document: Document }>("/documents", {
      method: "POST",
      body: JSON.stringify({
        originalFilename: file.name,
        s3Key: key,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });

    return document;
  },

  updateDocument: (id: number, body: { tags?: string[]; isFavorite?: boolean; originalFilename?: string }) =>
    request<{ document: Document }>(`/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteDocument: (id: number) => request<void>(`/documents/${id}`, { method: "DELETE" }),

  getDownloadUrl: (id: number) =>
    request<{ downloadUrl: string }>(`/documents/${id}/download-url`),

  getDocument: (id: number) =>
    request<{ document: Document }>(`/documents/${id}`),

  summarize: (id: number) =>
    request<{ document: Document }>(`/documents/${id}/summarize`, { method: "POST" }),

  chat: (id: number, question: string, history: Array<{ role: "user" | "assistant"; content: string }>) =>
    request<{ answer: string }>(`/documents/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),

  createShareLink: (id: number) =>
    request<{ document: Document }>(`/documents/${id}/share`, { method: "POST" }),

  revokeShareLink: (id: number) => request<void>(`/documents/${id}/share`, { method: "DELETE" }),

  getSharedDocument: (token: string) =>
    request<{
      document: { id: number; originalFilename: string; mimeType: string; fileType: string; aiSummary: string | null };
      downloadUrl: string;
    }>(`/share/${token}`),
};
