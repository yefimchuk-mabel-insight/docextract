import type { ExtractedDocument, Invoice, Sample } from "./types";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  health: () => fetch("/api/health").then((r) => json<{ provider: string }>(r)),
  samples: () => fetch("/api/samples").then((r) => json<Sample[]>(r)),
  extractSample: (name: string) =>
    fetch(`/api/extract?sample=${encodeURIComponent(name)}`, { method: "POST" }).then((r) => json<ExtractedDocument>(r)),
  extractFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/extract", { method: "POST", body: form }).then((r) => json<ExtractedDocument>(r));
  },
  save: (id: string, data: Invoice) =>
    fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<ExtractedDocument>(r)),
  approve: (id: string) =>
    fetch(`/api/documents/${id}/approve`, { method: "POST" }).then((r) => json<ExtractedDocument>(r)),
  exportUrl: (id: string, format: "json" | "csv") => `/api/documents/${id}/export.${format}`,
};
