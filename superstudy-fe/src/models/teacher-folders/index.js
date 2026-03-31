import { api } from "../httpClient";

// ── Teacher Folders Service ─────────────────────────────────────────────────
const BASE = "/teacher-folders";

export const teacherFoldersService = {
  // ─── Topics ─────────────────────────────────────────────────────────────
  /** Get topic folders for a teacher (sorted by order, excludes deleted) */
  getTopicFolders: (teacherId) =>
    api.get(`${BASE}/topics`, { teacherId }),

  /** Get ALL teacher topic folders across all teachers (admin use) */
  getAllTopicFolders: () =>
    api.get(`${BASE}/topics/all`),

  /** Get soft-deleted topic folders for a teacher */
  getDeletedTopicFolders: (teacherId) =>
    api.get(`${BASE}/topics/deleted`, { teacherId }),

  /** Create or update a teacher topic folder */
  saveTopicFolder: (body) =>
    api.post(`${BASE}/topics`, body),

  /** Reorder teacher topic folders (drag-and-drop) */
  reorderTopicFolders: (folders) =>
    api.patch(`${BASE}/topics/reorder`, { folders }),

  /** Soft-delete a teacher topic folder */
  softDeleteTopicFolder: (id) =>
    api.delete(`${BASE}/topics/${id}`),

  /** Restore a soft-deleted teacher topic folder */
  restoreTopicFolder: (id) =>
    api.post(`${BASE}/topics/${id}/restore`),

  /** Permanently delete a teacher topic folder */
  permanentDeleteTopicFolder: (id) =>
    api.delete(`${BASE}/topics/${id}/permanent`),

  // ─── Grammar ────────────────────────────────────────────────────────────
  /** Get grammar folders for a teacher */
  getGrammarFolders: (teacherId) =>
    api.get(`${BASE}/grammar`, { teacherId }),

  /** Get ALL teacher grammar folders (admin use) */
  getAllGrammarFolders: () =>
    api.get(`${BASE}/grammar/all`),

  /** Get soft-deleted grammar folders for a teacher */
  getDeletedGrammarFolders: (teacherId) =>
    api.get(`${BASE}/grammar/deleted`, { teacherId }),

  /** Create or update a teacher grammar folder */
  saveGrammarFolder: (body) =>
    api.post(`${BASE}/grammar`, body),

  /** Reorder teacher grammar folders */
  reorderGrammarFolders: (folders) =>
    api.patch(`${BASE}/grammar/reorder`, { folders }),

  /** Soft-delete a teacher grammar folder */
  softDeleteGrammarFolder: (id) =>
    api.delete(`${BASE}/grammar/${id}`),

  /** Restore a soft-deleted teacher grammar folder */
  restoreGrammarFolder: (id) =>
    api.post(`${BASE}/grammar/${id}/restore`),

  /** Permanently delete a teacher grammar folder */
  permanentDeleteGrammarFolder: (id) =>
    api.delete(`${BASE}/grammar/${id}/permanent`),

  // ─── Exams ──────────────────────────────────────────────────────────────
  /** Get exam folders for a teacher */
  getExamFolders: (teacherId) =>
    api.get(`${BASE}/exams`, { teacherId }),

  /** Get ALL teacher exam folders (admin use) */
  getAllExamFolders: () =>
    api.get(`${BASE}/exams/all`),

  /** Get soft-deleted exam folders for a teacher */
  getDeletedExamFolders: (teacherId) =>
    api.get(`${BASE}/exams/deleted`, { teacherId }),

  /** Create or update a teacher exam folder */
  saveExamFolder: (body) =>
    api.post(`${BASE}/exams`, body),

  /** Reorder teacher exam folders */
  reorderExamFolders: (folders) =>
    api.patch(`${BASE}/exams/reorder`, { folders }),

  /** Soft-delete a teacher exam folder */
  softDeleteExamFolder: (id) =>
    api.delete(`${BASE}/exams/${id}`),

  /** Restore a soft-deleted teacher exam folder */
  restoreExamFolder: (id) =>
    api.post(`${BASE}/exams/${id}/restore`),

  /** Permanently delete a teacher exam folder */
  permanentDeleteExamFolder: (id) =>
    api.delete(`${BASE}/exams/${id}/permanent`),
};
