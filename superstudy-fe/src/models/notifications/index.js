import { api } from "../httpClient";

// ── Notifications Service ───────────────────────────────────────────────────
const BASE = "/notifications";

export const notificationsService = {
  /** List notifications for a user (newest first) */
  findAll: (userId, unreadOnly) =>
    api.get(`${BASE}`, { userId, unreadOnly }),

  /** Create a single notification (internal use) */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Mark a single notification as read */
  markRead: (id) =>
    api.patch(`${BASE}/${id}/read`),

  /** Mark all unread notifications as read for a user */
  markAllRead: (userId) =>
    api.post(`${BASE}/batch-read`, { userId }),

  /** Delete all notifications for a user */
  clearAll: (userId) =>
    api.delete(`${BASE}/clear-all?userId=${encodeURIComponent(userId)}`),

  /** Get count of unread notifications for a user */
  unreadCount: (userId) =>
    api.get(`${BASE}/unread-count`, { userId }),
};
