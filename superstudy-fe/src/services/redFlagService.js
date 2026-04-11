import { redFlagsService } from '../models';
import { createNotification, queueEmail, buildEmailHtml } from './notificationService';

/**
 * Violation types for red flags.
 */
export const VIOLATION_TYPES = [
    { value: 'late_homework', label: 'KhÃ´ng hoÃ n thÃ nh bÃ i táº­p Ä‘Ãºng háº¡n' },
    { value: 'unexcused_absence', label: 'Váº¯ng máº·t khÃ´ng phÃ©p' },
    { value: 'class_conduct', label: 'KhÃ´ng tuÃ¢n thá»§ ná»™i quy lá»›p' },
    { value: 'cheating', label: 'Gian láº­n trong kiá»ƒm tra' },
    { value: 'uncooperative', label: 'ThÃ¡i Ä‘á»™ thiáº¿u há»£p tÃ¡c' },
    { value: 'other', label: 'KhÃ¡c' }
];

function sortFlagsAscending(flags = []) {
    return [...flags].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
    });
}

/**
 * Get all red flags for a specific student.
 * @param {string} studentId
 * @returns {Promise<Array>} sorted by createdAt ascending
 */
export async function getRedFlagsForStudent(studentId) {
    if (!studentId) return [];
    const result = await redFlagsService.findAll({ studentId });
    const flags = Array.isArray(result) ? result : (result?.data || []);
    return sortFlagsAscending(flags);
}

/**
 * Get all red flags for a specific student in a specific group.
 * @param {string} studentId
 * @param {string} groupId
 * @returns {Promise<Array>} sorted by createdAt ascending
 */
export async function getRedFlagsForStudentInGroup(studentId, groupId) {
    if (!studentId || !groupId) return [];
    const result = await redFlagsService.findAll({ studentId, groupId });
    const flags = Array.isArray(result) ? result : (result?.data || []);
    return sortFlagsAscending(flags);
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
        const dt = f.createdAt ? new Date(f.createdAt) : null;
        if (!dt || Number.isNaN(dt.getTime())) return false;
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
    const result = await redFlagsService.findAll({ groupId });
    const flags = Array.isArray(result) ? result : (result?.data || []);
    const counts = {};
    flags.forEach(flag => {
        if (flag.removed) return;
        const sid = flag.studentId;
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
    const roleLabels = { admin: 'Quáº£n trá»‹ viÃªn', teacher: 'GiÃ¡o viÃªn', staff: 'NhÃ¢n viÃªn' };
    const roleLabel = roleLabels[flaggedByRole] || 'GiÃ¡o viÃªn';
    const existing = await getRedFlagsForStudentInGroup(studentId, groupId);
    const activeFlags = existing.filter(f => !f.removed);
    const flagNumber = activeFlags.length + 1;

    const createdFlag = await redFlagsService.create({
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
        flaggedByRole: flaggedByRole || '',
        flagNumber,
    });

    const isContractTerminated = flagNumber >= 3;
    const flagEmoji = flagNumber === 1 ? 'ðŸŸ¡' : flagNumber === 2 ? 'ðŸŸ ' : 'ðŸ”´';

    const emailBody = `
        <p>Báº¡n vá»«a nháº­n Ä‘Æ°á»£c <strong>cá» cáº£nh bÃ¡o láº§n ${flagNumber}/3</strong> táº¡i lá»›p <strong>${groupName}</strong>.</p>
        <p><strong>Loáº¡i vi pháº¡m:</strong> ${violationLabel}</p>
        <p><strong>Ghi chÃº tá»« ${roleLabel} ${flaggedByName}:</strong></p>
        <p style="font-style:italic;color:#64748b;padding-left:12px;border-left:3px solid #e2e8f0;">${note}</p>
        ${isContractTerminated ? `
        <div style="background:#fef2f2;padding:16px 20px;border-radius:12px;margin:16px 0;border-left:4px solid #dc2626;">
            <p style="color:#dc2626;font-weight:700;margin:0;">âš ï¸ Há»£p Ä‘á»“ng Ä‘áº£m báº£o cháº¥t lÆ°á»£ng Ä‘áº§u ra Ä‘Ã£ bá»‹ cháº¥m dá»©t.</p>
            <p style="color:#64748b;margin:8px 0 0;font-size:0.9rem;">Báº¡n váº«n Ä‘Æ°á»£c tham gia lá»›p há»c cho Ä‘áº¿n khi háº¿t khÃ³a, nhÆ°ng khÃ´ng cÃ²n Ä‘Æ°á»£c Ä‘áº£m báº£o cháº¥t lÆ°á»£ng Ä‘áº§u ra.</p>
        </div>` : `
        <p style="color:#ca8a04;font-size:0.9rem;">LÆ°u Ã½: Khi nháº­n Ä‘á»§ 3 cá» cáº£nh bÃ¡o, há»£p Ä‘á»“ng Ä‘áº£m báº£o cháº¥t lÆ°á»£ng Ä‘áº§u ra sáº½ khÃ´ng cÃ²n hiá»‡u lá»±c. HÃ£y cá»‘ gáº¯ng cáº£i thiá»‡n Ä‘á»ƒ Ä‘áº£m báº£o quyá»n lá»£i há»c táº­p cá»§a báº¡n nhÃ©!</p>
        `}
    `;

    const emailHtml = buildEmailHtml({
        emoji: flagEmoji,
        heading: isContractTerminated ? 'Cháº¥m dá»©t Ä‘áº£m báº£o cháº¥t lÆ°á»£ng Ä‘áº§u ra' : `Cá» cáº£nh bÃ¡o láº§n ${flagNumber}/3`,
        headingColor: isContractTerminated ? '#dc2626' : '#ca8a04',
        body: emailBody,
        ctaText: 'Má»Ÿ sUPerStudy', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports',
        ctaColor: isContractTerminated ? '#dc2626' : '#ca8a04',
        ctaColor2: isContractTerminated ? '#ef4444' : '#f59e0b',
        greeting: `ChÃ o ${studentName} ðŸ‘‹`
    });

    if (studentEmail) {
        await queueEmail(studentEmail, {
            subject: isContractTerminated
                ? `ðŸ”´ Cháº¥m dá»©t Ä‘áº£m báº£o CLÄR â€” ${groupName}`
                : `${flagEmoji} Cá» cáº£nh bÃ¡o láº§n ${flagNumber}/3 â€” ${groupName}`,
            html: emailHtml
        });
    }

    await createNotification({
        userId: studentId,
        type: 'red_flag',
        title: isContractTerminated
            ? `ðŸ”´ Cháº¥m dá»©t Ä‘áº£m báº£o CLÄR â€” ${groupName}`
            : `${flagEmoji} Cá» cáº£nh bÃ¡o láº§n ${flagNumber}/3`,
        message: `LÃ½ do: ${violationLabel}. ${note}`,
        link: '/dashboard?scrollTo=reports'
    });

    return { ...createdFlag, flagNumber };
}

/**
 * Remove (soft-delete) a red flag.
 * Marks the flag as removed with reason and who removed it.
 */
export async function removeRedFlag({ flagId, removedBy, removedByName, removedByRole, removeReason }) {
    const roleLabels = { admin: 'Quáº£n trá»‹ viÃªn', teacher: 'GiÃ¡o viÃªn', staff: 'NhÃ¢n viÃªn' };
    const roleLabel = roleLabels[removedByRole] || 'GiÃ¡o viÃªn';
    const flagData = await redFlagsService.findOne(flagId).catch(() => null);

    await redFlagsService.update(flagId, {
        removed: true,
        removedAt: new Date().toISOString(),
        removedBy: removedBy || '',
        removedByName: removedByName || '',
        removedByRole: removedByRole || '',
        removeReason: removeReason || ''
    });

    if (flagData) {
        const allFlags = await getRedFlagsForStudentInGroup(flagData.studentId, flagData.groupId);
        const activeFlags = allFlags.filter(f => !f.removed && f.id !== flagId);
        for (let i = 0; i < activeFlags.length; i++) {
            const newNumber = i + 1;
            if (activeFlags[i].flagNumber !== newNumber) {
                await redFlagsService.update(activeFlags[i].id, { flagNumber: newNumber });
            }
        }
    }

    if (flagData && flagData.studentEmail) {
        const emailBody = `
            <p>Má»™t cá» cáº£nh bÃ¡o cá»§a báº¡n táº¡i lá»›p <strong>${flagData.groupName}</strong> Ä‘Ã£ Ä‘Æ°á»£c <strong>gá»¡ bá»</strong>.</p>
            <p><strong>Loáº¡i vi pháº¡m Ä‘Ã£ gá»¡:</strong> ${flagData.violationLabel}</p>
            <p><strong>Gá»¡ bá»Ÿi ${roleLabel} ${removedByName}</strong></p>
            ${removeReason ? `<p><strong>LÃ½ do:</strong> ${removeReason}</p>` : ''}
            <p style="color:#10b981;font-size:0.9rem;">HÃ£y tiáº¿p tá»¥c cá»‘ gáº¯ng Ä‘á»ƒ duy trÃ¬ káº¿t quáº£ há»c táº­p tá»‘t nhÃ©! ðŸ’ª</p>
        `;

        const emailHtml = buildEmailHtml({
            emoji: 'âœ…',
            heading: 'Cá» cáº£nh bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c gá»¡',
            headingColor: '#10b981',
            body: emailBody,
            ctaText: 'Má»Ÿ sUPerStudy', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports',
            ctaColor: '#10b981',
            ctaColor2: '#34d399',
            greeting: `ChÃ o ${flagData.studentName} ðŸ‘‹`
        });

        await queueEmail(flagData.studentEmail, {
            subject: `âœ… Cá» cáº£nh bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c gá»¡ â€” ${flagData.groupName}`,
            html: emailHtml
        });

        await createNotification({
            userId: flagData.studentId,
            type: 'red_flag_removed',
            title: `âœ… Cá» cáº£nh bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c gá»¡ â€” ${flagData.groupName}`,
            message: `${roleLabel} ${removedByName} Ä‘Ã£ gá»¡ cá»: ${flagData.violationLabel}`,
            link: '/dashboard?scrollTo=reports'
        });
    }
}
