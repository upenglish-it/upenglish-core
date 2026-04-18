import { api } from "../httpClient";

const BASE = "/grammar-submissions";

export const grammarSubmissionsService = {
  findAll: (query) =>
    api.get(`${BASE}`, query),

  findByAssignment: (assignmentId) =>
    api.get(`${BASE}`, { assignmentId }),

  findByAssignmentAndStudent: (assignmentId, studentId) =>
    api.get(`${BASE}/lookup`, { assignmentId, studentId }),

  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  create: (body) =>
    api.post(`${BASE}`, body),

  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  remove: (id) =>
    api.delete(`${BASE}/${id}`),
};
