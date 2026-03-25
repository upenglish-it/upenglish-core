import { api } from "../httpClient";

// ── Email Whitelist Service ─────────────────────────────────────────────────
const BASE = "/email-whitelist";

export const emailWhitelistService = {
  /** List all whitelisted emails (optionally filter by role or used status) */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** Check if an email is whitelisted (returns entry or null) */
  checkEmail: (email) =>
    api.get(`${BASE}/check`, { email }),

  /** Get a single whitelist entry by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Add an email to the whitelist */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Bulk add multiple emails to the whitelist */
  bulkCreate: (entries) =>
    api.post(`${BASE}/bulk`, entries),

  /** Update a whitelist entry (role, duration, groups, etc.) */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Mark a whitelist entry as used (called on registration) */
  markUsed: (id) =>
    api.patch(`${BASE}/${id}/mark-used`),

  /** Remove an email from the whitelist */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),
};
