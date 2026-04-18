import { api } from '../models/httpClient';

/**
 * Checks if an exam assignment is included in any sent skill reports.
 * Throws an error if it is — preventing deletion of locked assignments.
 */
export async function assertExamAssignmentNotInSentReport(assignmentId) {
    if (!assignmentId) return;

    try {
        const result = await api.get('/skill-reports/check-lock', {
            field: 'includedExamAssignmentIds',
            assignmentId,
        });
        const reports = Array.isArray(result) ? result : (result?.data || []);
        const sentReports = reports.filter(r => r.status === 'sent');
        if (sentReports.length === 0) return;

        const report = sentReports[0];
        const label = report.periodLabel || (report.startDate && report.endDate ? `${report.startDate} → ${report.endDate}` : 'một báo cáo đã gửi');
        throw new Error(`Không thể xóa vì bài này đã được dùng trong báo cáo đã gửi "${label}". Hãy gỡ hoặc xóa báo cáo đó trước.`);
    } catch (err) {
        // Re-throw our business error, swallow 404s (skill-reports endpoint may not exist yet)
        if (err.message?.includes('Không thể xóa')) throw err;
        console.warn('[reportLockService] Could not check report lock:', err.message);
    }
}

export async function assertRegularAssignmentNotInSentReport(assignmentId) {
    if (!assignmentId) return;

    try {
        const result = await api.get('/skill-reports/check-lock', {
            field: 'includedAssignmentIds',
            assignmentId,
        });
        const reports = Array.isArray(result) ? result : (result?.data || []);
        const sentReports = reports.filter(r => r.status === 'sent');
        if (sentReports.length === 0) return;

        const report = sentReports[0];
        const label = report.periodLabel || (report.startDate && report.endDate ? `${report.startDate} → ${report.endDate}` : 'một báo cáo đã gửi');
        throw new Error(`Không thể xóa vì bài này đã được dùng trong báo cáo đã gửi "${label}". Hãy gỡ hoặc xóa báo cáo đó trước.`);
    } catch (err) {
        if (err.message?.includes('Không thể xóa')) throw err;
        console.warn('[reportLockService] Could not check report lock:', err.message);
    }
}
