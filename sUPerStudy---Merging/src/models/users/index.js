import { api } from "../httpClient";

// ── Users Service ───────────────────────────────────────────────────────────
const BASE = "/users";

export const usersService = {
  /** List all users (optionally filter by role / status) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List users in a specific group, filtered by role */
  findByGroup: (groupId, role) =>
    api.get(`${BASE}`, { groupId, role }),

  /** Get user by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Update user fields (role, displayName, disabled, folderAccess, etc.) */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Sync user profile on login (create if not exists) */
  sync: (body) =>
    api.post(`${BASE}/sync`, body),

  /** Approve pending user with role and optional expiry */
  approve: (id, body) =>
    api.post(`${BASE}/${id}/approve`, body),

  /** Renew user access with optional duration */
  renew: (id, body) =>
    api.post(`${BASE}/${id}/renew`, body),

  /** Reject / permanently delete a pending user */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Add user to a group */
  addToGroup: (uid, groupId) =>
    api.post(`${BASE}/${uid}/groups/${groupId}`),

  /** Remove user from a group */
  removeFromGroup: (uid, groupId) =>
    api.delete(`${BASE}/${uid}/groups/${groupId}`),

  /** Get user learning stats */
  getLearningStats: (id, query) =>
    api.get(`${BASE}/${id}/stats`, query),
};
