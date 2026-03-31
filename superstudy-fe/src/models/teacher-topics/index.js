import { api } from "../httpClient";

// ── Teacher Topics Service ──────────────────────────────────────────────────
const BASE = "/teacher-topics";

export const teacherTopicsService = {
  /** List teacher topics by teacherId (default: non-deleted) */
  findAll: (teacherId) =>
    api.get(`${BASE}`, { teacherId }),

  /** List shared and public teacher topics */
  getSharedAndPublic: (topicAccessIds) =>
    api.get(`${BASE}/shared-and-public`, { topicAccessIds: topicAccessIds.join(',') }),


  /** List soft-deleted teacher topics */
  findDeleted: (teacherId) =>
    api.get(`${BASE}/deleted`, { teacherId }),

  /** Get a single teacher topic by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a new teacher topic */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update a teacher topic */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Soft-delete a teacher topic */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted teacher topic */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete a teacher topic */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
