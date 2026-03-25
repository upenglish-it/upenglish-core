import { api } from "../httpClient";

// ── Topics Service ──────────────────────────────────────────────────────────
const BASE = "/topics";

export const topicsService = {
  /** List all topics (admin) — optionally filter by folderId */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** Get a single topic by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create or update a topic */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update topic metadata */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Toggle topic public status */
  togglePublic: (id, isPublic) =>
    api.patch(`${BASE}/${id}/public`, { isPublic }),

  /** Toggle teacher-visible status */
  toggleTeacherVisible: (id, teacherVisible) =>
    api.patch(`${BASE}/${id}/teacher-visible`, { teacherVisible }),

  /** Soft-delete a topic */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Permanently delete a topic */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
