/**
 * Report Period Service
 * CRUD for report_periods collection + status helpers
 */

import { db } from '../config/firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

// ═══════════════════════════════════════════════
// AUTO-CREATE DEFAULTS
// ═══════════════════════════════════════════════

/**
 * Get report period auto-create defaults from app settings.
 */
export async function getReportPeriodDefaults() {
    const snap = await getDoc(doc(db, 'settings', 'app'));
    if (snap.exists()) {
        return snap.data().reportPeriodDefaults || null;
    }
    return null;
}

/**
 * Save report period auto-create defaults to app settings.
 */
export async function saveReportPeriodDefaults(defaults) {
    await setDoc(doc(db, 'settings', 'app'), {
        reportPeriodDefaults: defaults,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * Ensure a report period exists for the current month (or next).
 * Auto-creates based on defaults if enabled and no active/upcoming period exists.
 * @returns {string|null} - ID of created period, or null if not needed
 */
export async function ensureCurrentPeriodExists() {
    const defaults = await getReportPeriodDefaults();
    if (!defaults || !defaults.enabled) return null;

    const { startDay, endDay, graceDays } = defaults;
    if (!startDay || !endDay) return null;

    // Helper: clamp day to the actual last day of the given month
    const clampDay = (year, month, day) => {
        // new Date(year, month+1, 0) gives last day of the month
        const lastDay = new Date(year, month + 1, 0).getDate();
        return new Date(year, month, Math.min(day, lastDay));
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // Calculate this month's period dates
    const periodStart = clampDay(year, month, startDay);
    const periodEnd = clampDay(year, month, endDay);
    // If endDay < startDay, the period spans two months (e.g. 25th → next month 5th)
    if (endDay < startDay) {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    // If we're past the grace period for this month, look at next month
    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + (graceDays || 0));

    let targetStart, targetEnd;
    if (now > graceEnd) {
        // This month's period is fully closed, create next month's
        const nextMonth = periodStart.getMonth() + 1;
        const nextYear = nextMonth > 11 ? periodStart.getFullYear() + 1 : periodStart.getFullYear();
        targetStart = clampDay(nextYear, nextMonth % 12, startDay);
        targetEnd = clampDay(nextYear, nextMonth % 12, endDay);
        if (endDay < startDay) {
            targetEnd.setMonth(targetEnd.getMonth() + 1);
        }
    } else {
        targetStart = periodStart;
        targetEnd = periodEnd;
    }

    const startStr = targetStart.toISOString().slice(0, 10);
    const endStr = targetEnd.toISOString().slice(0, 10);

    // Check if a period already exists for these dates
    const existing = await getAllReportPeriods();
    const alreadyExists = existing.some(p => p.startDate === startStr && p.endDate === endStr);
    if (alreadyExists) return null;

    // Also skip if there's any active/upcoming period (don't create duplicates)
    const hasActiveOrUpcoming = existing.some(p => {
        const s = computePeriodStatus(p);
        return s === 'active' || s === 'grace' || s === 'upcoming';
    });
    if (hasActiveOrUpcoming) return null;

    // Auto-create
    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const label = `Kỳ báo cáo ${monthNames[targetStart.getMonth()]}/${targetStart.getFullYear()}`;

    const id = await createReportPeriod({
        label,
        startDate: startStr,
        endDate: endStr,
        graceDays: graceDays || 0,
        dataStartDate: (() => {
            const dsd = defaults.dataStartDay || startDay;
            return clampDay(targetStart.getFullYear(), targetStart.getMonth(), dsd).toISOString().slice(0, 10);
        })(),
        dataEndDate: (() => {
            const ded = defaults.dataEndDay || endDay;
            return clampDay(targetEnd.getFullYear(), targetEnd.getMonth(), ded).toISOString().slice(0, 10);
        })(),
        autoCreated: true
    });
    return id;
}

// ═══════════════════════════════════════════════
// STATUS COMPUTATION (date-driven, no DB field)
// ═══════════════════════════════════════════════

/**
 * Compute the current status of a report period based on dates.
 * @param {Object} period - { startDate, endDate, graceDays }
 * @returns {'upcoming' | 'active' | 'grace' | 'closed'}
 */
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

/**
 * Get the human-readable Vietnamese label for a period status.
 */
export function getStatusLabel(status) {
    const labels = {
        upcoming: 'Sắp mở',
        active: 'Đang diễn ra',
        grace: 'Quá hạn (gia hạn)',
        closed: 'Đã kết thúc'
    };
    return labels[status] || status;
}

/**
 * Get days remaining until endDate (negative if past).
 */
export function getDaysRemaining(endDate) {
    if (!endDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate + 'T23:59:59');
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════

/**
 * Create a new report period.
 */
export async function createReportPeriod(data) {
    const ref = doc(collection(db, 'report_periods'));
    await setDoc(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
}

/**
 * Update an existing report period.
 */
export async function updateReportPeriod(periodId, data) {
    const ref = doc(db, 'report_periods', periodId);
    await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Delete a report period.
 */
export async function deleteReportPeriod(periodId) {
    await deleteDoc(doc(db, 'report_periods', periodId));
}

/**
 * Get all report periods, ordered by startDate desc.
 */
export async function getAllReportPeriods() {
    const snap = await getDocs(collection(db, 'report_periods'));
    const periods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort newest first by startDate
    periods.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    return periods;
}

/**
 * Get the currently active or grace period (if any).
 * Returns the first period that is 'active' or 'grace', or null.
 */
export async function getActiveReportPeriod() {
    const periods = await getAllReportPeriods();
    return periods.find(p => {
        const status = computePeriodStatus(p);
        return status === 'active' || status === 'grace';
    }) || null;
}

// ═══════════════════════════════════════════════
// REPORT STATUS HELPERS
// ═══════════════════════════════════════════════

/**
 * Get report status for a specific group during a period.
 * Returns a Set of studentIds that have a sent report in that date range.
 * Also returns reports with late flag.
 *
 * @param {string} groupId
 * @param {string} startDate - ISO date string (deadline start)
 * @param {string} endDate - ISO date string (deadline end)
 * @param {string} [periodId] - If provided, only count reports tagged with this periodId
 * @returns {Promise<{ sentStudentIds: Set, lateStudentIds: Set, reports: Array }>}
 */
export async function getGroupReportStatus(groupId, startDate, endDate, periodId) {
    const q = query(
        collection(db, 'skill_reports'),
        where('groupId', '==', groupId),
        where('status', '==', 'sent')
    );
    const snap = await getDocs(q);

    const sentStudentIds = new Set();
    const lateStudentIds = new Set();
    const reports = [];

    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    snap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : null);

        if (!sentAt) return;

        // If periodId is specified, only count reports tagged with it
        if (periodId) {
            if (data.periodId !== periodId) return;
        } else {
            // Fallback: count by date range
            if (sentAt < periodStart) return;
        }

        sentStudentIds.add(data.studentId);
        reports.push(data);

        // Check if it was sent after the period end (late)
        if (sentAt > periodEnd) {
            lateStudentIds.add(data.studentId);
        }
    });

    return { sentStudentIds, lateStudentIds, reports };
}

/**
 * Get per-teacher report stats for the admin overview.
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [periodId] - If provided, only count reports tagged with this periodId
 * @returns {Promise<Array<{ teacherId, teacherName, groups, sentCount, lateCount, totalStudents }>>}
 */
export async function getReportStatsForPeriod(startDate, endDate, periodId) {
    // 1. Get all users
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const teachers = users.filter(u => u.role === 'teacher' && u.status === 'approved');
    const students = users.filter(u => u.role === 'user' && u.status === 'approved');

    // 2. Get all groups
    const groupsSnap = await getDocs(collection(db, 'user_groups'));
    const groups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => !g.isHidden);
    const groupMap = {};
    groups.forEach(g => { groupMap[g.id] = g; });

    // 3. Get all sent skill_reports in the period
    const reportsQ = query(
        collection(db, 'skill_reports'),
        where('status', '==', 'sent')
    );
    const reportsSnap = await getDocs(reportsQ);
    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    const periodReports = [];
    reportsSnap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : null;
        if (!sentAt) return;
        // If periodId specified, only count tagged reports
        if (periodId) {
            if (data.periodId !== periodId) return;
        } else {
            if (sentAt < periodStart) return;
        }
        periodReports.push({ ...data, sentAt });
    });

    // 4. Build per-teacher stats
    // Teachers have groupIds array on their user document
    return teachers.map(teacher => {
        const teacherGroupIds = (teacher.groupIds || []).filter(gid => groupMap[gid]);
        const teacherGroupNames = teacherGroupIds.map(gid => groupMap[gid]?.name || gid);

        // Count students in teacher's groups
        const teacherStudentIds = new Set();
        students.forEach(s => {
            (s.groupIds || []).forEach(gid => {
                if (teacherGroupIds.includes(gid)) {
                    teacherStudentIds.add(s.uid);
                }
            });
        });

        // Count reports sent for this teacher's groups
        const sentStudentIds = new Set();
        const lateStudentIds = new Set();
        periodReports.forEach(r => {
            if (teacherGroupIds.includes(r.groupId)) {
                sentStudentIds.add(r.studentId);
                if (r.sentAt > periodEnd) {
                    lateStudentIds.add(r.studentId);
                }
            }
        });

        return {
            teacherId: teacher.uid,
            teacherName: teacher.displayName || teacher.email || 'N/A',
            groups: teacherGroupNames,
            sentCount: sentStudentIds.size,
            lateCount: lateStudentIds.size,
            totalStudents: teacherStudentIds.size
        };
    }).filter(t => t.totalStudents > 0);
}

/**
 * Get per-student report details for a specific teacher during a period.
 * @param {string} teacherId
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [periodId] - If provided, only count reports tagged with this periodId
 * @returns {Promise<Array<{ studentId, studentName, groupName, status, sentAt, reportId }>>}
 */
export async function getTeacherReportDetails(teacherId, startDate, endDate, periodId) {
    // Get teacher's groupIds
    const teacherSnap = await getDoc(doc(db, 'users', teacherId));
    if (!teacherSnap.exists()) return [];
    const teacherData = teacherSnap.data();
    const teacherGroupIds = teacherData.groupIds || [];
    if (teacherGroupIds.length === 0) return [];

    // Get group names
    const groupMap = {};
    for (const gid of teacherGroupIds) {
        const gSnap = await getDoc(doc(db, 'user_groups', gid));
        if (gSnap.exists() && !gSnap.data().isHidden) {
            groupMap[gid] = gSnap.data().name || gid;
        }
    }
    const validGroupIds = Object.keys(groupMap);
    if (validGroupIds.length === 0) return [];

    // Get students in those groups
    const usersSnap = await getDocs(collection(db, 'users'));
    const students = [];
    usersSnap.docs.forEach(d => {
        const u = { uid: d.id, ...d.data() };
        if (u.role === 'user' && u.status === 'approved') {
            const matchedGroups = (u.groupIds || []).filter(gid => validGroupIds.includes(gid));
            if (matchedGroups.length > 0) {
                students.push({ ...u, matchedGroupId: matchedGroups[0] });
            }
        }
    });

    // Get reports
    const reportsQ = query(
        collection(db, 'skill_reports'),
        where('status', '==', 'sent')
    );
    const reportsSnap = await getDocs(reportsQ);
    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T23:59:59');

    // Map: studentId -> report data
    const reportMap = {};
    reportsSnap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : null;
        if (!sentAt) return;
        if (!validGroupIds.includes(data.groupId)) return;
        // If periodId specified, only count tagged reports
        if (periodId) {
            if (data.periodId !== periodId) return;
        } else {
            if (sentAt < periodStart) return;
        }
        
        // Keep the latest report per student
        if (!reportMap[data.studentId] || sentAt > reportMap[data.studentId].sentAt) {
            reportMap[data.studentId] = { ...data, sentAt };
        }
    });

    // Build result
    return students.map(s => {
        const report = reportMap[s.uid];
        let status = 'pending';
        let sentAt = null;
        let reportId = null;

        if (report) {
            sentAt = report.sentAt;
            reportId = report.id;
            status = report.sentAt > periodEnd ? 'late' : 'sent';
        }

        return {
            studentId: s.uid,
            studentName: s.displayName || s.email || 'N/A',
            groupName: groupMap[s.matchedGroupId] || '',
            groupId: s.matchedGroupId,
            status,
            sentAt,
            reportId
        };
    }).sort((a, b) => {
        // Sort: pending first, then late, then sent
        const order = { pending: 0, late: 1, sent: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
}
