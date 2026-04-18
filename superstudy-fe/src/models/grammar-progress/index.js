import { api } from "../httpClient";

const BASE = "/grammar-progress";

export const grammarProgressService = {
  findAll: (userId, exerciseId, exerciseIds) =>
    api.get(`${BASE}`, { userId, exerciseId, exerciseIds }),

  findOne: (userId, questionId) =>
    api.get(`${BASE}/question`, { userId, questionId }),

  findDue: (userId) =>
    api.get(`${BASE}/due`, { userId }),

  getReviewCount: (userId) =>
    api.get(`${BASE}/review-count`, { userId }),

  getSummary: (userId, exerciseIds) =>
    api.get(`${BASE}/summary`, { userId, exerciseIds }),

  getQuestions: (userId, exerciseId) =>
    api.get(`${BASE}/questions`, { userId, exerciseId }),

  getStats: (userId, startDate, endDate) =>
    api.get(`${BASE}/stats`, { userId, startDate, endDate }),

  upsert: (body) =>
    api.post(`${BASE}`, body),

  reset: (userId, exerciseId) =>
    api.post(`${BASE}/reset`, { userId, exerciseId }),

  removeOne: (userId, questionId) =>
    api.delete(`${BASE}/question?userId=${encodeURIComponent(userId)}&questionId=${encodeURIComponent(questionId)}`),
};
