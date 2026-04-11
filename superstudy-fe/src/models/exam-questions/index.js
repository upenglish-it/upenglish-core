import { api } from "../httpClient";

// ── Exam Questions Service ──────────────────────────────────────────────────
const BASE = "/exam-questions";

export const examQuestionsService = {
  /** List questions for an exam (sorted by order). Optional sectionId filter. */
  findAll: (examId, sectionId) =>
    api.get(`${BASE}`, { examId, sectionId }),

  /** List questions for a specific section */
  findBySection: (examId, sectionId) =>
    api.get(`${BASE}`, { examId, sectionId }),

  /** Get a single exam question by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Get question counts per exam (comma-separated examIds → { examId: count }) */
  getCounts: (examIds) =>
    api.get(`${BASE}/counts`, { examIds: Array.isArray(examIds) ? examIds.join(',') : examIds }),

  /** Get time totals per exam (comma-separated examIds → { examId: { totalSeconds, missingCount, questionCount } }) */
  getTimeTotals: (examIds) =>
    api.get(`${BASE}/time-totals`, { examIds: Array.isArray(examIds) ? examIds.join(',') : examIds }),

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
  reorder: (examId, sectionId, entries) =>
    api.patch(`${BASE}/order/batch`, { examId, sectionId, entries }),
};
