import { api } from "../httpClient";

// ── Report Periods Service ────────────────────────────────────────────────────
const BASE = "/report-periods";

export const reportPeriodService = {
  /** Get all valid (non-deleted) report periods */
  getAll: () =>
    api.get(`${BASE}`),

  /** Get all soft-deleted periods */
  getDeleted: () =>
    api.get(`${BASE}/deleted`),

  /** Get report period defaults from settings */
  getDefaults: () =>
    api.get(`${BASE}/settings/defaults`),

  /** Save report period defaults to settings */
  saveDefaults: (body) =>
    api.post(`${BASE}/settings/defaults`, body),

  /** Auto-create or ensure the current period exists */
  ensureCurrent: () =>
    api.post(`${BASE}/actions/ensure-current`),

  /** Purge old soft-deleted periods older than threshold */
  purgeExpired: () =>
    api.post(`${BASE}/actions/purge-expired`),

  /** Create a new report period */
  create: (body) =>
    api.post(`${BASE}`, body),

  /** Update a report period */
  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  /** Soft-delete a period */
  softDelete: (id) =>
    api.delete(`${BASE}/${id}`),

  /** Restore a soft-deleted period */
  restore: (id) =>
    api.patch(`${BASE}/${id}/restore`),

  /** Permanently delete a period */
  permanentDelete: (id) =>
    api.delete(`${BASE}/${id}/permanent`),

  /** Get group report status for a date range */
  getGroupStatus: (groupId, startDate, endDate, periodId) => {
    const params = { startDate, endDate };
    if (periodId) params.periodId = periodId;
    return api.get(`${BASE}/stats/groups/${groupId}`, params);
  },

  /** Get report stats for all teachers for a date range */
  getTeacherStats: (startDate, endDate, periodId) => {
    const params = { startDate, endDate };
    if (periodId) params.periodId = periodId;
    return api.get(`${BASE}/stats/teachers`, params);
  },

  /** Get per-student report details for a specific teacher */
  getTeacherDetails: (teacherId, startDate, endDate, periodId) => {
    const params = { startDate, endDate };
    if (periodId) params.periodId = periodId;
    return api.get(`${BASE}/stats/teachers/${teacherId}`, params);
  },
};
