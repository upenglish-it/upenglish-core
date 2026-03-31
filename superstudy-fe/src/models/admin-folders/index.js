import { api } from "../httpClient";

// ── Admin Folders Service ───────────────────────────────────────────────────
const BASE = "/admin-folders";

export const adminFoldersService = {
  // ─── Topic Folders ──────────────────────────────────────────────────────
  /** Get all admin topic folders (sorted by order) */
  getTopicFolders: () =>
    api.get(`${BASE}/topics`),

  /** Create or update an admin topic folder */
  saveTopicFolder: (body) =>
    api.post(`${BASE}/topics`, body),

  /** Delete an admin topic folder */
  deleteTopicFolder: (id) =>
    api.delete(`${BASE}/topics/${id}`),

  /** Reorder admin topic folders (drag-and-drop) */
  reorderTopicFolders: (folders) =>
    api.patch(`${BASE}/topics/reorder`, { folders }),

  // ─── Grammar Folders ────────────────────────────────────────────────────
  /** Get all admin grammar folders (sorted by order) */
  getGrammarFolders: () =>
    api.get(`${BASE}/grammar`),

  /** Create or update an admin grammar folder */
  saveGrammarFolder: (body) =>
    api.post(`${BASE}/grammar`, body),

  /** Delete an admin grammar folder */
  deleteGrammarFolder: (id) =>
    api.delete(`${BASE}/grammar/${id}`),

  /** Reorder admin grammar folders */
  reorderGrammarFolders: (folders) =>
    api.patch(`${BASE}/grammar/reorder`, { folders }),

  // ─── Exam Folders ───────────────────────────────────────────────────────
  /** Get all admin exam folders (sorted by order) */
  getExamFolders: () =>
    api.get(`${BASE}/exams`),

  /** Create or update an admin exam folder */
  saveExamFolder: (body) =>
    api.post(`${BASE}/exams`, body),

  /** Delete an admin exam folder */
  deleteExamFolder: (id) =>
    api.delete(`${BASE}/exams/${id}`),

  /** Reorder admin exam folders */
  reorderExamFolders: (folders) =>
    api.patch(`${BASE}/exams/reorder`, { folders }),
};
