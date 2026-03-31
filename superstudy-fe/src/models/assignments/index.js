import { api } from "../httpClient";

// ── Assignments Service ─────────────────────────────────────────────────────
const BASE = "/assignments";

export const assignmentsService = {
  /** List assignments for a group (optionally filter by topicId/isGrammar) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List assignments across multiple groups */
  findByGroups: (groupIds) =>
    api.get(`${BASE}`, { groupIds }),

  /** List soft-deleted assignments (filter by groupId) */
  findDeleted: (query) =>
    api.get(`${BASE}/deleted`, query),

  /** Get a single assignment by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a vocabulary/grammar topic assignment */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update assignment (dueDate, constraints, etc.) */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Soft-delete an assignment */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted assignment */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete an assignment */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
