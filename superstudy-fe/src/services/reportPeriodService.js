import { api } from '../models/httpClient';

// ═══════════════════════════════════════════════
// REPORT PERIODS: AUTO-CREATE DEFAULTS
// ═══════════════════════════════════════════════

export async function getReportPeriodDefaults() {
    try {
        const result = await api.get('/report-periods/settings/defaults');
        return result?.data || result || null;
    } catch {
        return null; // Return null implicitly instead of failing
    }
}

export async function saveReportPeriodDefaults(defaults) {
    return api.post('/report-periods/settings/defaults', defaults);
}

export async function ensureCurrentPeriodExists() {
    try {
        const result = await api.post('/report-periods/actions/ensure-current');
        return (result?.data || result) ? (result?.data?.id || result?.id) : null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════
// STATUS COMPUTATION (date-driven, no DB field)
// ═══════════════════════════════════════════════

export function computePeriodStatus(period) {
    if (!period?.startDate || !period?.endDate) return 'closed';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(period.startDate + 'T00:00:00');
    const end = new Date(period.endDate + 'T23:59:59');
    const graceDays = period.graceDays || 0;
    const graceEnd = new Date(end);
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    graceEnd.setHours(23, 59, 59, 999);

    if (today < start) return 'upcoming';
    if (today <= end) return 'active';
    if (today <= graceEnd) return 'grace';
    return 'closed';
}

export function getStatusLabel(status) {
    const labels = {
        upcoming: 'Sắp mở',
        active: 'Đang diễn ra',
        grace: 'Quá hạn (gia hạn)',
        closed: 'Đã kết thúc'
    };
    return labels[status] || status;
}

export function getDaysRemaining(endDate) {
    if (!endDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate + 'T23:59:59');
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════
// REPORT PERIODS: CRUD
// ═══════════════════════════════════════════════

export async function createReportPeriod(data) {
    const res = await api.post('/report-periods', data);
    return res?.data?.id || res?.id;
}

export async function updateReportPeriod(periodId, data) {
    if (!periodId) return;
    return api.patch(`/report-periods/${periodId}`, data);
}

export async function deleteReportPeriod(periodId) {
    if (!periodId) return;
    return api.delete(`/report-periods/${periodId}`);
}

export async function restoreReportPeriod(periodId) {
    if (!periodId) return;
    return api.patch(`/report-periods/${periodId}/restore`);
}

export async function permanentlyDeleteReportPeriod(periodId) {
    if (!periodId) return;
    return api.delete(`/report-periods/${periodId}/permanent`);
}

export async function getDeletedReportPeriods() {
    try {
        const res = await api.get('/report-periods/deleted');
        return Array.isArray(res) ? res : (res?.data || []);
    } catch {
        return [];
    }
}

export async function purgeExpiredDeletedPeriods() {
    try {
        const res = await api.post('/report-periods/actions/purge-expired');
        return res?.data?.purgedCount || res?.purgedCount || 0;
    } catch {
        return 0;
    }
}

export async function getAllReportPeriods() {
    try {
        const res = await api.get('/report-periods');
        return Array.isArray(res) ? res : (res?.data || []);
    } catch {
        return [];
    }
}

export async function getActiveReportPeriod() {
    const periods = await getAllReportPeriods();
    return periods.find(p => {
        const status = computePeriodStatus(p);
        return status === 'active' || status === 'grace';
    }) || null;
}

// ═══════════════════════════════════════════════
// REPORT STATUS HELPERS (Federated Stats)
// ═══════════════════════════════════════════════

export async function getGroupReportStatus(groupId, startDate, endDate, periodId) {
    const query = new URLSearchParams({ startDate, endDate });
    if (periodId) query.append('periodId', periodId);

    try {
        const res = await api.get(`/report-periods/stats/groups/${groupId}?${query.toString()}`);
        const data = res?.data || res;
        return {
            sentStudentIds: new Set(data?.sentStudentIds || []),
            lateStudentIds: new Set(data?.lateStudentIds || []),
            reports: data?.reports || []
        };
    } catch {
        return { sentStudentIds: new Set(), lateStudentIds: new Set(), reports: [] };
    }
}

export async function getReportStatsForPeriod(startDate, endDate, periodId) {
    const query = new URLSearchParams({ startDate, endDate });
    if (periodId) query.append('periodId', periodId);

    try {
        const res = await api.get(`/report-periods/stats/teachers?${query.toString()}`);
        return Array.isArray(res) ? res : (res?.data || []);
    } catch {
        return [];
    }
}

export async function getTeacherReportDetails(teacherId, startDate, endDate, periodId) {
    if (!teacherId) return [];
    
    const query = new URLSearchParams({ startDate, endDate });
    if (periodId) query.append('periodId', periodId);

    try {
        const res = await api.get(`/report-periods/stats/teachers/${teacherId}?${query.toString()}`);
        return Array.isArray(res) ? res : (res?.data || []);
    } catch {
        return [];
    }
}
