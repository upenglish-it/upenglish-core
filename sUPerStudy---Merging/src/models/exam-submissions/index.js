import { api } from "../httpClient";

// ── Exam Submissions Service ────────────────────────────────────────────────
const BASE = "/exam-submissions";

export const examSubmissionsService = {
  /** List submissions for an assignment */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** Get a single submission by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Start an exam (create submission) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Save progress / submit answers / submit exam */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Release exam results to student */
  release: (id, body) =>
    api.patch(`${BASE}/${id}/release`, body),

  /** Release follow-up results to student */
  releaseFollowUp: (id, body) =>
    api.patch(`${BASE}/${id}/release-follow-up`, body),

  /** Mark results as viewed by student */
  markViewed: (id) =>
    api.patch(`${BASE}/${id}/viewed`),

  /** Mark follow-up results as viewed by student */
  markFollowUpViewed: (id) =>
    api.patch(`${BASE}/${id}/viewed-follow-up`),
};
