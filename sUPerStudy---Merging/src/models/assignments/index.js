import { api } from "../httpClient";

// ── Assignments Service ─────────────────────────────────────────────────────
const BASE = "/assignments";

export const assignmentsService = {
  /** List assignments for a group (optionally filter by topicId/isGrammar) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

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

  /** Permanently delete an assignment */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
