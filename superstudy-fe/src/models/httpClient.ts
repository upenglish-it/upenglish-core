/// <reference types="vite/client" />
const BASE_URL = import.meta.env.VITE_BASE_URL;


export interface ApiResponseI<T> {
  status: number;
  success: string;
  message: string;
  data: T;
}

const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};
async function parseResponse<T>(res: Response): Promise<ApiResponseI<T>> {
  return res.json();
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
  return parseResponse<T>(res);
}
export const api = {
  get: <T>(url: string, query?: Record<string, unknown>) => {
    const search = query
      ? "?" +
        new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return request<T>(`${url}${search}`, { method: "GET" });
  },
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
