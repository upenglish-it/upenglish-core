import { api } from "../httpClient";

// ── User Groups Service ─────────────────────────────────────────────────────
const BASE = "/user-groups";

export const userGroupsService = {
  /** List all groups (excludes hidden by default) */
  findAll: (includeHidden) =>
    api.get(`${BASE}`, { includeHidden }),

  /** Get a single group by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Get students in a group */
  getStudents: (id) =>
    api.get(`${BASE}/${id}/students`),

  /** Create a new group */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update an existing group */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Delete a group permanently */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Add/remove topic/grammar/exam access for a group */
  updateAccess: (id, body) =>
    api.patch(`${BASE}/${id}/access`, body),
};
