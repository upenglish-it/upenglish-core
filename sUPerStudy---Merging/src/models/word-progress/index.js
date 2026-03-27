import { api } from "../httpClient";

// ── Word Progress Service ───────────────────────────────────────────────────
const BASE = "/word-progress";

export const wordProgressService = {
  /** Get all progress records for a user (optionally filter by topicId) */
  findAll: (userId, topicId) =>
    api.get(`${BASE}`, { userId, topicId }),

  /** Get progress for a specific word */
  findOne: (userId, topicId, wordId) =>
    api.get(`${BASE}/word`, { userId, topicId, wordId }),

  /** Get mastery summary for a topic (count mastered vs total) */
  getSummary: (userId, topicId) =>
    api.get(`${BASE}/summary`, { userId, topicId }),

  /** Get streak data for a user */
  getStreak: (userId) =>
    api.get(`${BASE}/streak/${userId}`),

  /** Get streak data for multiple users (bulk — for teacher dashboard) */
  getBulkStreak: (userIds) =>
    api.post(`${BASE}/streak/bulk`, { userIds }),

  /** Upsert progress for a single word (create or update) */
  upsert: (body) =>
    api.post(`${BASE}`, body),

  /** Record a game result for a word (updates score + masteryScore) */
  recordGameResult: (body) =>
    api.patch(`${BASE}/game-result`, body),

  /** Update pronunciation score for a word */
  updatePronunciation: (body) =>
    api.patch(`${BASE}/pronunciation`, body),

  /** Reset all progress for a topic (for a user) */
  reset: (userId, topicId) =>
    api.post(`${BASE}/reset`, { userId, topicId }),
};
