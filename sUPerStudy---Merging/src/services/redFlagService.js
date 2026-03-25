import { db } from '../config/firebase';
import { collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { createNotification, queueEmail, buildEmailHtml } from './notificationService';

/**
 * Violation types for red flags.
 */
export const VIOLATION_TYPES = [
    { value: 'late_homework', label: 'Không hoàn thành bài tập đúng hạn' },
    { value: 'unexcused_absence', label: 'Vắng mặt không phép' },
    { value: 'class_conduct', label: 'Không tuân thủ nội quy lớp' },
    { value: 'cheating', label: 'Gian lận trong kiểm tra' },
    { value: 'uncooperative', label: 'Thái độ thiếu hợp tác' },
    { value: 'other', label: 'Khác' }
];

/**
 * Get all red flags for a specific student.
 * @param {string} studentId
 * @returns {Promise<Array>} sorted by createdAt ascending
 */
export async function getRedFlagsForStudent(studentId) {
    if (!studentId) return [];
    const q = query(
        collection(db, 'red_flags'),
        where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    const flags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client-side to avoid composite index
    flags.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return ta - tb;
    });
    return flags;
}

/**
 * Get all red flags for a specific student in a specific group.
 * Uses single-field query + client-side filter to avoid composite index.
 * @param {string} studentId
 * @param {string} groupId
 * @returns {Promise<Array>} sorted by createdAt ascending
 */
export async function getRedFlagsForStudentInGroup(studentId, groupId) {
    if (!studentId || !groupId) return [];
    const allFlags = await getRedFlagsForStudent(studentId);
    return allFlags.filter(f => f.groupId === groupId);
}

/**
 * Get red flags for a student in a group, filtered by date range.
 * Only returns flags whose createdAt falls within [startDate, endDate].
 * @param {string} studentId
 * @param {string} groupId
 * @param {string} startDate - ISO date string (e.g. '2026-03-01')
 * @param {string} endDate - ISO date string (e.g. '2026-03-15')
 * @returns {Promise<Array>} sorted by createdAt ascending
 */
export async function getRedFlagsForStudentInGroupByDateRange(studentId, groupId, startDate, endDate) {
    const flags = await getRedFlagsForStudentInGroup(studentId, groupId);
    if (!startDate && !endDate) return flags;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
    return flags.filter(f => {
        const dt = f.createdAt?.toDate ? f.createdAt.toDate() : (f.createdAt ? new Date(f.createdAt) : null);
        if (!dt) return false;
        return dt >= start && dt <= end;
    });
}

/**
 * Get red flag counts for multiple students in a group.
 * Returns a map { [studentId]: count }.
 * @param {string} groupId
 * @returns {Promise<Object>}
 */
export async function getRedFlagCountsForGroup(groupId) {
    if (!groupId) return {};
    const q = query(
        collection(db, 'red_flags'),
        where('groupId', '==', groupId)
    );
    const snap = await getDocs(q);
    const counts = {};
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.removed) return; // skip removed flags
        const sid = data.studentId;
        counts[sid] = (counts[sid] || 0) + 1;
    });
    return counts;
}

/**
 * Add a red flag for a student.
 * Also queues email and creates in-app notification.
 * @param {Object} params
 * @returns {Promise<Object>} the created flag data with id
 */
export async function addRedFlag({
    studentId, studentName, studentEmail,
    groupId, groupName,
    violationType, violationLabel, note,
    flaggedBy, flaggedByName, flaggedByRole
}) {
    const roleLabels = { admin: 'Quản trị viên', teacher: 'Giáo viên', staff: 'Nhân viên' };
    const roleLabel = roleLabels[flaggedByRole] || 'Giáo viên';
    // Count existing ACTIVE flags for this student in this group
    const existing = await getRedFlagsForStudentInGroup(studentId, groupId);
    const activeFlags = existing.filter(f => !f.removed);
    const flagNumber = activeFlags.length + 1;

    const flagRef = doc(collection(db, 'red_flags'));
    const flagData = {
        studentId,
        studentName: studentName || '',
        studentEmail: studentEmail || '',
        groupId,
        groupName: groupName || '',
        violationType,
        violationLabel: violationLabel || '',
        note: note || '',
        flaggedBy,
        flaggedByName: flaggedByName || '',
        flagNumber,
        createdAt: serverTimestamp()
    };

    await setDoc(flagRef, flagData);

    // Build email
    const isContractTerminated = flagNumber >= 3;
    const flagEmoji = flagNumber === 1 ? '🟡' : flagNumber === 2 ? '🟠' : '🔴';

    const emailBody = `
        <p>Bạn vừa nhận được <strong>cờ cảnh báo lần ${flagNumber}/3</strong> tại lớp <strong>${groupName}</strong>.</p>
        <p><strong>Loại vi phạm:</strong> ${violationLabel}</p>
        <p><strong>Ghi chú từ ${roleLabel} ${flaggedByName}:</strong></p>
        <p style="font-style:italic;color:#64748b;padding-left:12px;border-left:3px solid #e2e8f0;">${note}</p>
        ${isContractTerminated ? `
        <div style="background:#fef2f2;padding:16px 20px;border-radius:12px;margin:16px 0;border-left:4px solid #dc2626;">
            <p style="color:#dc2626;font-weight:700;margin:0;">⚠️ Hợp đồng đảm bảo chất lượng đầu ra đã bị chấm dứt.</p>
            <p style="color:#64748b;margin:8px 0 0;font-size:0.9rem;">Bạn vẫn được tham gia lớp học cho đến khi hết khóa, nhưng không còn được đảm bảo chất lượng đầu ra.</p>
        </div>` : `
        <p style="color:#ca8a04;font-size:0.9rem;">Lưu ý: Khi nhận đủ 3 cờ cảnh báo, hợp đồng đảm bảo chất lượng đầu ra sẽ không còn hiệu lực. Hãy cố gắng cải thiện để đảm bảo quyền lợi học tập của bạn nhé!</p>
        `}
    `;

    const emailHtml = buildEmailHtml({
        emoji: flagEmoji,
        heading: isContractTerminated ? 'Chấm dứt đảm bảo chất lượng đầu ra' : `Cờ cảnh báo lần ${flagNumber}/3`,
        headingColor: isContractTerminated ? '#dc2626' : '#ca8a04',
        body: emailBody,
        ctaText: 'Mở sUPerStudy', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports',
        ctaColor: isContractTerminated ? '#dc2626' : '#ca8a04',
        ctaColor2: isContractTerminated ? '#ef4444' : '#f59e0b',
        greeting: `Chào ${studentName} 👋`
    });

    // Queue email
    if (studentEmail) {
        await queueEmail(studentEmail, {
            subject: isContractTerminated
                ? `🔴 Chấm dứt đảm bảo CLĐR — ${groupName}`
                : `${flagEmoji} Cờ cảnh báo lần ${flagNumber}/3 — ${groupName}`,
            html: emailHtml
        });
    }

    // In-app notification
    await createNotification({
        userId: studentId,
        type: 'red_flag',
        title: isContractTerminated
            ? `🔴 Chấm dứt đảm bảo CLĐR — ${groupName}`
            : `${flagEmoji} Cờ cảnh báo lần ${flagNumber}/3`,
        message: `Lý do: ${violationLabel}. ${note}`,
        link: '/dashboard?scrollTo=reports'
    });

    return { id: flagRef.id, ...flagData, flagNumber };
}

/**
 * Remove (soft-delete) a red flag.
 * Marks the flag as removed with reason and who removed it.
 */
export async function removeRedFlag({ flagId, removedBy, removedByName, removedByRole, removeReason }) {
    const roleLabels = { admin: 'Quản trị viên', teacher: 'Giáo viên', staff: 'Nhân viên' };
    const roleLabel = roleLabels[removedByRole] || 'Giáo viên';
    const flagRef = doc(db, 'red_flags', flagId);

    // Read the flag data first for email
    const flagSnap = await getDoc(flagRef);
    let flagData = null;
    if (flagSnap.exists()) flagData = flagSnap.data();

    await updateDoc(flagRef, {
        removed: true,
        removedAt: serverTimestamp(),
        removedBy: removedBy || '',
        removedByName: removedByName || '',
        removedByRole: removedByRole || '',
        removeReason: removeReason || ''
    });

    // Renumber remaining active flags for this student+group
    if (flagData) {
        const allFlags = await getRedFlagsForStudentInGroup(flagData.studentId, flagData.groupId);
        const activeFlags = allFlags.filter(f => !f.removed && f.id !== flagId);
        // activeFlags is already sorted by createdAt ascending from getRedFlagsForStudent
        for (let i = 0; i < activeFlags.length; i++) {
            const newNumber = i + 1;
            if (activeFlags[i].flagNumber !== newNumber) {
                await updateDoc(doc(db, 'red_flags', activeFlags[i].id), { flagNumber: newNumber });
            }
        }
    }

    // Send email notification
    if (flagData && flagData.studentEmail) {
        const emailBody = `
            <p>Một cờ cảnh báo của bạn tại lớp <strong>${flagData.groupName}</strong> đã được <strong>gỡ bỏ</strong>.</p>
            <p><strong>Loại vi phạm đã gỡ:</strong> ${flagData.violationLabel}</p>
            <p><strong>Gỡ bởi ${roleLabel} ${removedByName}</strong></p>
            ${removeReason ? `<p><strong>Lý do:</strong> ${removeReason}</p>` : ''}
            <p style="color:#10b981;font-size:0.9rem;">Hãy tiếp tục cố gắng để duy trì kết quả học tập tốt nhé! 💪</p>
        `;

        const emailHtml = buildEmailHtml({
            emoji: '✅',
            heading: 'Cờ cảnh báo đã được gỡ',
            headingColor: '#10b981',
            body: emailBody,
            ctaText: 'Mở sUPerStudy', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports',
            ctaColor: '#10b981',
            ctaColor2: '#34d399',
            greeting: `Chào ${flagData.studentName} 👋`
        });

        await queueEmail(flagData.studentEmail, {
            subject: `✅ Cờ cảnh báo đã được gỡ — ${flagData.groupName}`,
            html: emailHtml
        });

        await createNotification({
            userId: flagData.studentId,
            type: 'red_flag_removed',
            title: `✅ Cờ cảnh báo đã được gỡ — ${flagData.groupName}`,
            message: `${roleLabel} ${removedByName} đã gỡ cờ: ${flagData.violationLabel}`,
            link: '/dashboard?scrollTo=reports'
        });
    }
}
