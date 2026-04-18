/// <reference types="vite/client" />
const BASE_URL = import.meta.env.VITE_BASE_URL;


export interface ApiResponseI<T> {
  status: number;
  success: string | boolean;
  message: string;
  data: T;
}

const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};
async function parseResponse<T>(res: Response): Promise<ApiResponseI<T>> {
  const text = await res.text();
  if (!text) return null as ApiResponseI<T>;
  return JSON.parse(text);
}
async function request<T>(url: string, options?: RequestInit): Promise<ApiResponseI<T>> {
  // NOTES: Add here for refreshing token logic if needed
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { ...defaultHeaders },
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    console.log("[request] error");
    throw await parseResponse<T>(res);
  }

  console.log("[request] returned");
  const payload = await parseResponse<T>(res);
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload.success === false || payload.success === "false")
  ) {
    console.log("[request] wrapped error");
    throw payload;
  }
  return payload;
}

function normalizeBody(body?: unknown) {
  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}
export const api = {
  get: <T>(url: string, query?: Record<string, unknown>) => {
    const params = query
      ? Object.entries(query)
          .filter(([, v]) => {
            if (v == null) return false;
            if (typeof v === "string") return v.trim() !== "";
            if (Array.isArray(v)) return v.length > 0;
            return true;
          })
          .map(([k, v]) => [k, String(v)] as [string, string])
      : [];
    const search = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
    return request<T>(`${url}${search}`, { method: "GET" });
  },
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string, body?: unknown) => {
    const normalizedBody = normalizeBody(body);
    return request<T>(url, {
      method: "DELETE",
      body: normalizedBody == null ? undefined : JSON.stringify(normalizedBody),
    });
  },
};
