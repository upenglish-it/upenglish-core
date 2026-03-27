import { api } from "../httpClient";

// ── Grammar Questions Service ───────────────────────────────────────────────
const BASE = "/grammar-questions";

export const grammarQuestionsService = {
  /** List questions for a grammar exercise (ordered) */
  findAll: (exerciseId) =>
    api.get(`${BASE}`, { exerciseId }),

  /** Get a single grammar question by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a grammar question (auto-assigns order) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update a grammar question */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Delete a grammar question (hard) */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Bulk reorder grammar questions */
  reorder: (entries) =>
    api.patch(`${BASE}/order/batch`, entries),
};
