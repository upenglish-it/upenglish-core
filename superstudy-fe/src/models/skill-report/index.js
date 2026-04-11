import { api } from "../httpClient";

const BASE = "/skill-reports";

export const skillReportsService = {
  checkLock: (field, assignmentId) =>
    api.get(`${BASE}/check-lock`, { field, assignmentId }),

  findAll: (query) =>
    api.get(`${BASE}`, query),

  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  create: (body) =>
    api.post(`${BASE}`, body),

  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  remove: (id) =>
    api.delete(`${BASE}/${id}`),
};
