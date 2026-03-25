import { api } from "../httpClient";

// ── Exam Submissions Service ────────────────────────────────────────────────
const BASE = "/exam-submissions";

export const examSubmissionsService = {
  /** List submissions for an assignment */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List submissions for a single assignment */
  findByAssignment: (assignmentId) =>
    api.get(`${BASE}`, { assignmentId }),

  /** Find submission by assignment and student */
  findByAssignmentAndStudent: (assignmentId, studentId) =>
    api.get(`${BASE}/lookup`, { assignmentId, studentId }),

  /** List submissions for multiple assignments */
  findByAssignments: (assignmentIds) =>
    api.get(`${BASE}`, { assignmentIds }),

  /** List submissions for a student */
  findByStudent: (studentId) =>
    api.get(`${BASE}`, { studentId }),

  /** Get a single submission by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Start an exam (create submission) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Save progress / submit answers / submit exam */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Delete a submission */
  remove: (id) =>
    api.delete(`${BASE}/${id}`),

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
