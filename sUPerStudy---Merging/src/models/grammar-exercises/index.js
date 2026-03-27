import { api } from "../httpClient";

// ── Grammar Exercises Service ───────────────────────────────────────────────
const BASE = "/grammar-exercises";

export const grammarExercisesService = {
  /** List grammar exercises (optionally filter by createdByRole) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List public + teacherVisible + individually shared exercises */
  findShared: (grammarAccessIds) =>
    api.get(`${BASE}/shared`, { grammarAccessIds }),

  /** List soft-deleted exercises */
  findDeleted: () =>
    api.get(`${BASE}/deleted`),

  /** Get a single grammar exercise by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a new grammar exercise */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update a grammar exercise */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Soft-delete a grammar exercise */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted grammar exercise */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete grammar exercise (cascades questions) */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
