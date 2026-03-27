import { api } from "../httpClient";

// ── Exam Assignments Service ────────────────────────────────────────────────
const BASE = "/exam-assignments";

export const examAssignmentsService = {
  /** List exam assignments. Filter by examId, groupId, or studentId. */
  findAll: (query) =>
    api.get(`${BASE}`, query),

  /** List assignments for a specific exam */
  findByExam: (examId) =>
    api.get(`${BASE}`, { examId }),

  /** List assignments for a specific group */
  findByGroup: (groupId) =>
    api.get(`${BASE}`, { targetType: 'group', targetId: groupId }),

  /** List assignments for a student (individual + group-based) */
  findForStudent: (studentId, groupIds) =>
    api.get(`${BASE}/student`, { studentId, groupIds }),

  /** List soft-deleted assignments for a group */
  findDeleted: (groupId) =>
    api.get(`${BASE}/deleted`, { groupId }),

  /** List soft-deleted assignments for a group (alias) */
  findDeletedByGroup: (groupId) =>
    api.get(`${BASE}/deleted`, { groupId }),

  /** Get a single exam assignment by ID */
  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  /** Create a new exam assignment (notifies group/students) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update an assignment */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Update assignment due date (+ optionally notify) */
  updateDueDate: (id, body) =>
    api.patch(`${BASE}/${id}/due-date`, body),

  /** Soft-delete an assignment */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted assignment */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete an assignment and all its submissions */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),
};
