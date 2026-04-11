import { api } from "../httpClient";

const BASE = "/teacher-ratings";

export const teacherRatingsService = {
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

  getSummary: (periodId, teacherId) =>
    api.get(`${BASE}/summary`, { periodId, teacherId }),

  getAllPeriodSummaries: (periodId) =>
    api.get(`${BASE}/summaries/all`, { periodId }),
};
