import { api } from "../httpClient";

// ── Exam Questions Service ──────────────────────────────────────────────────
const BASE = "/exam-questions";

export const examQuestionsService = {
  /** List questions for an exam (sorted by order). Optional sectionId filter. */
  findAll: (examId, sectionId) =>
    api.get(`${BASE}`, { examId, sectionId }),

  /** Get a single exam question by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Get question counts per exam (comma-separated examIds) */
  getCounts: (examIds) =>
    api.get(`${BASE}/counts`, { examIds }),

  /** Create a new exam question (auto-assigns order) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update an exam question */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Delete a question (hard delete) */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Bulk reorder questions (array of { id, order }) */
  reorder: (entries) =>
    api.patch(`${BASE}/order/batch`, entries),
};
