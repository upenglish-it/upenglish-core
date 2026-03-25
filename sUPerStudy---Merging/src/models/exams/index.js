import { api } from "../httpClient";

// ── Exams Service ───────────────────────────────────────────────────────────
const BASE = "/exams";

export const examsService = {
  /** List exams (optionally filter by createdByRole) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List public + teacherVisible + individually shared exams */
  findShared: (examAccessIds) =>
    api.get(`${BASE}/shared`, { examAccessIds }),

  /** List soft-deleted exams */
  findDeleted: () =>
    api.get(`${BASE}/deleted`),

  /** Get a single exam by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a new exam */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update exam (name, sections, settings, etc.) */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Soft-delete exam (isDeleted = true) */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted exam */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete exam (cascades questions + assignments + submissions) */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),

  /** Recalculate and cache question counts for an exam */
  recalcCache: (id) =>
    api.post(`${BASE}/${id}/recalc-cache`),
};
