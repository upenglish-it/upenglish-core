/**
 * Teacher Rating Service
 * Nest-backed CRUD for teacher ratings and summaries
 */

import {
    teacherRatingsService,
    teacherRatingSummariesService,
    userGroupsService,
    usersService,
} from '../models';
import { chatCompletion } from './aiService';
import { getAllReportPeriods } from './reportPeriodService';

/**
 * Get the currently open rating period (based on ratingStartDate/ratingEndDate).
 * Independent from the report period dates.
 * Returns the period object or null if no rating window is open.
 */
export async function getActiveRatingPeriod() {
    const periods = await getAllReportPeriods();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return periods.find(p => {
        if (!p.ratingStartDate || !p.ratingEndDate) return false;
        const start = new Date(`${p.ratingStartDate}T00:00:00`);
        const end = new Date(`${p.ratingEndDate}T23:59:59`);
        return today >= start && today <= end;
    }) || null;
}

export const RATING_CRITERIA = [
    {
        key: 'communication',
        label: 'Kỹ năng giao tiếp và khích lệ',
        labelEn: 'Communication',
        description: 'Thân thiện, tạo môi trường thoải mái, lắng nghe học viên',
        icon: '💬',
        weight: 15,
    },
    {
        key: 'teachingQuality',
        label: 'Chất lượng giảng dạy',
        labelEn: 'Teaching Quality',
        description: 'Bài giảng rõ ràng, dễ hiểu, có chiều sâu',
        icon: '📚',
        weight: 25,
    },
    {
        key: 'methodology',
        label: 'Phương pháp truyền đạt',
        labelEn: 'Methodology',
        description: 'Phương pháp dạy sáng tạo, dễ tiếp thu',
        icon: '🎯',
        weight: 15,
    },
    {
        key: 'dedication',
        label: 'Sự tận tâm và hỗ trợ',
        labelEn: 'Dedication',
        description: 'Giáo viên sẵn sàng giải đáp thắc mắc, hỗ trợ ngoài giờ',
        icon: '💪',
        weight: 20,
    },
    {
        key: 'feedback',
        label: 'Đánh giá và phản hồi',
        labelEn: 'Feedback',
        description: 'Chấm bài kịp thời, nhận xét chi tiết, hữu ích',
        icon: '✏️',
        weight: 15,
    },
    {
        key: 'progress',
        label: 'Cảm nhận tiến bộ',
        labelEn: 'Student Progress',
        description: 'Bạn có cảm thấy mình tiến bộ nhờ giáo viên trong tháng này?',
        icon: '📈',
        weight: 10,
        type: 'boolean',
    },
];

/**
 * Calculate total weighted score from individual scores (each 1-10).
 * Returns a value out of 100.
 */
export function calculateTotalScore(scores) {
    let total = 0;
    for (const criterion of RATING_CRITERIA) {
        let raw = scores[criterion.key];
        if (raw === undefined || raw === null) raw = 0;
        if (criterion.type === 'boolean') {
            raw = (raw === true || raw === 1 || raw === 10) ? 10 : 0;
        }
        total += (raw / 10) * criterion.weight;
    }
    return Math.round(total * 10) / 10;
}

function unwrapResult(result) {
    return result?.data || result || null;
}

function ensureArray(result) {
    const data = unwrapResult(result);
    return Array.isArray(data) ? data : [];
}

function getEntityId(entity) {
    return entity?.id || entity?._id || entity?.uid || '';
}

function normalizeUser(user) {
    if (!user) return null;
    const uid = getEntityId(user);
    if (!uid) return null;
    return {
        ...user,
        uid,
        id: uid,
        displayName: user.displayName || user.email || 'N/A',
        photoURL: user.photoURL || '',
        groupIds: Array.isArray(user.groupIds) ? user.groupIds : [],
        visibleGroupIds: Array.isArray(user.visibleGroupIds) ? user.visibleGroupIds : [],
    };
}

function normalizeGroup(group) {
    if (!group) return null;
    const id = getEntityId(group);
    if (!id) return null;
    return {
        ...group,
        id,
        name: group.name || group.label || id,
    };
}

async function fetchUsersByIds(userIds = []) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (ids.length === 0) return {};

    const entries = await Promise.all(ids.map(async (id) => {
        try {
            const user = normalizeUser(unwrapResult(await usersService.findOne(id)));
            return [id, user];
        } catch {
            return [id, null];
        }
    }));

    return Object.fromEntries(entries);
}

async function fetchGroupsByIds(groupIds = []) {
    const ids = [...new Set((groupIds || []).filter(Boolean))];
    if (ids.length === 0) return {};

    const entries = await Promise.all(ids.map(async (id) => {
        try {
            const group = normalizeGroup(unwrapResult(await userGroupsService.findOne(id)));
            return [id, group];
        } catch {
            return [id, null];
        }
    }));

    return Object.fromEntries(entries);
}

async function listTeacherRatings(filters = {}) {
    return ensureArray(await teacherRatingsService.findAll(filters)).map(item => ({
        ...item,
        id: getEntityId(item),
    }));
}

async function listTeacherRatingSummaries(filters = {}) {
    return ensureArray(await teacherRatingSummariesService.findAll(filters)).map(item => ({
        ...item,
        id: getEntityId(item),
    }));
}

function buildGroupScores(ratings, groupMap) {
    const grouped = {};
    ratings.forEach(rating => {
        const groupId = rating.groupId || '_unknown';
        if (!grouped[groupId]) grouped[groupId] = [];
        grouped[groupId].push(rating);
    });

    const groupScores = {};
    for (const [groupId, groupRatings] of Object.entries(grouped)) {
        const count = groupRatings.length;
        const averageScores = {};
        for (const criterion of RATING_CRITERIA) {
            const sum = groupRatings.reduce((acc, rating) => acc + (rating.scores?.[criterion.key] || 0), 0);
            averageScores[criterion.key] = Math.round((sum / count) * 10) / 10;
        }
        const overallScore = Math.round(groupRatings.reduce((acc, rating) => acc + (rating.totalScore || 0), 0) / count * 10) / 10;
        groupScores[groupId] = {
            groupName: groupMap[groupId]?.name || groupId,
            count,
            overallScore,
            averageScores,
        };
    }

    return groupScores;
}

async function upsertRatingSummary(periodId, teacherId, summaryData) {
    const existing = await listTeacherRatingSummaries({ periodId, teacherId });
    if (existing[0]?.id) {
        await teacherRatingSummariesService.update(existing[0].id, summaryData);
        return { ...existing[0], ...summaryData, id: existing[0].id };
    }

    const created = unwrapResult(await teacherRatingSummariesService.create(summaryData));
    return { ...summaryData, ...created, id: getEntityId(created) || getEntityId(summaryData) };
}

async function buildAiSummary(averageScores, overallScore, totalResponses, comments) {
    try {
        const criteriaText = RATING_CRITERIA.map(c => `- ${c.label}: ${averageScores[c.key]}/10`).join('\n');
        const commentsText = comments.length > 0
            ? `\nNhận xét từ học viên (ẩn danh):\n${comments.map((comment, index) => `${index + 1}. "${comment}"`).join('\n')}`
            : '\n(Không có nhận xét text)';

        const systemPrompt = `Bạn là trợ lý AI của trung tâm ngoại ngữ. Nhiệm vụ: viết báo cáo tổng hợp ẩn danh về kết quả đánh giá giáo viên.

QUAN TRỌNG:
- KHÔNG tiết lộ danh tính bất kỳ học viên nào
- KHÔNG trích dẫn nguyên văn nhận xét
- Viết bằng tiếng Việt, giọng chuyên nghiệp, tích cực nhưng khách quan
- Nêu điểm mạnh trước, góp ý cải thiện sau
- Độ dài: 3-5 câu ngắn gọn

Dữ liệu:
- Số lượng đánh giá: ${totalResponses}
- Điểm tổng: ${overallScore}/100
- Điểm chi tiết:
${criteriaText}
${commentsText}`;

        const response = await chatCompletion({
            systemPrompt,
            userContent: 'Hãy viết báo cáo tổng hợp ẩn danh cho giáo viên này.',
        });
        return response.text?.trim() || '';
    } catch (error) {
        console.error('AI summary generation failed:', error);
        return `Tổng hợp tự động: Điểm trung bình ${overallScore}/100 từ ${totalResponses} đánh giá.`;
    }
}

async function buildTeacherSummary(periodId, teacherId) {
    const ratings = (await listTeacherRatings({ periodId, teacherId })).filter(rating => !rating.eliminated);
    if (ratings.length === 0) {
        throw new Error('Chưa có đánh giá hợp lệ nào cho giáo viên này.');
    }

    const totalResponses = ratings.length;
    const averageScores = {};
    for (const criterion of RATING_CRITERIA) {
        const sum = ratings.reduce((acc, rating) => acc + (rating.scores?.[criterion.key] || 0), 0);
        averageScores[criterion.key] = Math.round((sum / totalResponses) * 10) / 10;
    }

    const overallScore = Math.round(ratings.reduce((acc, rating) => acc + (rating.totalScore || 0), 0) / totalResponses * 10) / 10;
    const comments = ratings.map(rating => rating.comment).filter(comment => comment && comment.trim().length > 0);

    const [userMap, groupMap] = await Promise.all([
        fetchUsersByIds([teacherId]),
        fetchGroupsByIds(ratings.map(rating => rating.groupId)),
    ]);

    const summaryData = {
        periodId,
        teacherId,
        teacherName: userMap[teacherId]?.displayName || 'N/A',
        totalResponses,
        averageScores,
        overallScore,
        aiSummary: await buildAiSummary(averageScores, overallScore, totalResponses, comments),
        groupScores: buildGroupScores(ratings, groupMap),
        generatedAt: new Date().toISOString(),
    };

    return upsertRatingSummary(periodId, teacherId, summaryData);
}

/**
 * Check if a student has already rated a teacher in a given period.
 */
export async function hasStudentRated(periodId, teacherId, studentId) {
    if (!periodId || !teacherId || !studentId) return false;
    const ratings = await listTeacherRatings({ periodId, teacherId, studentId });
    return ratings.length > 0;
}

/**
 * Submit a teacher rating from a student.
 * Throws if already rated.
 */
export async function submitRating({ periodId, teacherId, studentId, groupId, scores, comment }) {
    if (!periodId || !teacherId || !studentId) throw new Error('Missing required fields');

    const alreadyRated = await hasStudentRated(periodId, teacherId, studentId);
    if (alreadyRated) throw new Error('Bạn đã đánh giá giáo viên này trong kỳ này rồi.');

    const totalScore = calculateTotalScore(scores);
    const created = unwrapResult(await teacherRatingsService.create({
        periodId,
        teacherId,
        studentId,
        groupId: groupId || '',
        scores,
        totalScore,
        comment: (comment || '').trim(),
        eliminated: false,
    }));

    return getEntityId(created);
}

/**
 * Get the list of teachers a student should rate (based on groupIds).
 * Returns teachers who are assigned to the student's groups, enriched with group names.
 */
export async function getTeachersForStudent(studentId) {
    if (!studentId) return [];

    const student = normalizeUser(unwrapResult(await usersService.findOne(studentId)));
    if (!student) return [];

    const studentGroupIds = student.visibleGroupIds.length > 0 ? student.visibleGroupIds : student.groupIds;
    if (studentGroupIds.length === 0) return [];

    const groupMap = await fetchGroupsByIds(studentGroupIds);
    const activeGroupIds = studentGroupIds.filter(groupId => {
        const group = groupMap[groupId];
        return group && !group.isHidden && !group.isDeleted;
    });
    if (activeGroupIds.length === 0) return [];

    const groupNameMap = Object.fromEntries(activeGroupIds.map(groupId => [groupId, groupMap[groupId]?.name || groupId]));
    const [teachers, admins] = await Promise.all([
        ensureArray(await usersService.findAll({ role: 'teacher', status: 'approved' })),
        ensureArray(await usersService.findAll({ role: 'admin', status: 'approved' })),
    ]);

    return [...teachers, ...admins]
        .map(normalizeUser)
        .filter(Boolean)
        .flatMap(user => {
            const teacherGroupIds = user.visibleGroupIds.length > 0 ? user.visibleGroupIds : user.groupIds;
            const commonGroupIds = teacherGroupIds.filter(groupId => activeGroupIds.includes(groupId));
            return commonGroupIds.map(groupId => ({
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email || '',
                ratingGroupId: groupId,
                ratingGroupName: groupNameMap[groupId] || groupId,
                commonGroupIds,
                groupEntries: commonGroupIds.map(id => ({
                    groupId: id,
                    groupName: groupNameMap[id] || id,
                })),
            }));
        });
}

/**
 * Get student's existing ratings for a period (to check which teachers already rated).
 */
export async function getStudentRatingsForPeriod(periodId, studentId) {
    if (!periodId || !studentId) return [];
    return listTeacherRatings({ periodId, studentId });
}

/**
 * Get all individual ratings for a teacher in a period (admin detail view).
 */
export async function getRatingsForTeacher(periodId, teacherId) {
    if (!periodId || !teacherId) return [];
    try {
        const ratings = await listTeacherRatings({ periodId, teacherId });
        const userMap = await fetchUsersByIds(ratings.map(rating => rating.studentId));
        return ratings.map(rating => ({
            ...rating,
            studentName: userMap[rating.studentId]?.displayName || 'Không rõ',
        }));
    } catch (error) {
        console.error('Error loading rating details:', error);
        return [];
    }
}

/**
 * Delete a rating so the student can re-submit.
 */
export async function deleteRating(ratingId) {
    if (!ratingId) throw new Error('Missing ratingId');
    await teacherRatingsService.remove(ratingId);
}

/**
 * Eliminate/restore a rating (soft flag). Eliminated ratings are excluded from AI summary.
 */
export async function toggleEliminateRating(ratingId, eliminated) {
    if (!ratingId) throw new Error('Missing ratingId');
    await teacherRatingsService.update(ratingId, { eliminated: !!eliminated });
}

export async function markRatingStreakBonusAwarded(ratingId, bonus, baseDays) {
    if (!ratingId) throw new Error('Missing ratingId');
    await teacherRatingsService.update(ratingId, {
        streakBonusAwarded: true,
        streakBonus: bonus || 0,
        streakBonusBaseDays: baseDays || 0,
        streakBonusAwardedAt: new Date().toISOString(),
    });
}

/**
 * Get all ratings in a period grouped by teacher (admin overview).
 */
export async function getAllRatingsForPeriod(periodId) {
    if (!periodId) return [];
    try {
        const ratings = await listTeacherRatings({ periodId });
        const grouped = {};
        ratings.forEach(rating => {
            if (!grouped[rating.teacherId]) grouped[rating.teacherId] = [];
            grouped[rating.teacherId].push(rating);
        });

        const teacherIds = Object.keys(grouped);
        const [userMap, groupMap] = await Promise.all([
            fetchUsersByIds(teacherIds),
            fetchGroupsByIds(ratings.map(rating => rating.groupId)),
        ]);

        return teacherIds.map(teacherId => {
            const teacherRatings = grouped[teacherId].filter(rating => !rating.eliminated);
            const totalResponses = teacherRatings.length;
            if (totalResponses === 0) return null;

            const averageScores = {};
            for (const criterion of RATING_CRITERIA) {
                const sum = teacherRatings.reduce((acc, rating) => acc + (rating.scores?.[criterion.key] || 0), 0);
                averageScores[criterion.key] = Math.round((sum / totalResponses) * 10) / 10;
            }

            return {
                teacherId,
                teacherName: userMap[teacherId]?.displayName || 'N/A',
                teacherPhoto: userMap[teacherId]?.photoURL || '',
                totalResponses,
                averageScores,
                overallScore: Math.round(teacherRatings.reduce((acc, rating) => acc + (rating.totalScore || 0), 0) / totalResponses * 10) / 10,
                groupScores: buildGroupScores(teacherRatings, groupMap),
            };
        }).filter(Boolean).sort((a, b) => b.overallScore - a.overallScore);
    } catch (error) {
        console.error('Error loading rating overview:', error);
        return [];
    }
}

/**
 * Get or generate summary for a teacher in a period.
 */
export async function getRatingSummary(periodId, teacherId) {
    if (!periodId || !teacherId) return null;
    try {
        const summaries = await listTeacherRatingSummaries({ periodId, teacherId });
        return summaries[0] || null;
    } catch (error) {
        console.error('Error fetching rating summary:', error);
        return null;
    }
}

export async function updateRatingSummary(summaryId, body) {
    if (!summaryId) throw new Error('Missing summaryId');
    const updated = unwrapResult(await teacherRatingSummariesService.update(summaryId, body));
    return { ...updated, id: getEntityId(updated) };
}

/**
 * Get all summaries for a period.
 */
export async function getAllSummariesForPeriod(periodId) {
    if (!periodId) return [];
    try {
        return listTeacherRatingSummaries({ periodId });
    } catch (error) {
        console.error('Error fetching all summaries:', error);
        return [];
    }
}

/**
 * Generate AI summaries for all teachers in a period.
 * Called by admin when period closes.
 */
export async function generateRatingSummaries(periodId) {
    if (!periodId) throw new Error('Missing periodId');

    const ratings = (await listTeacherRatings({ periodId })).filter(rating => !rating.eliminated);
    if (ratings.length === 0) throw new Error('Chưa có đánh giá hợp lệ nào trong kỳ này.');

    const teacherIds = [...new Set(ratings.map(rating => rating.teacherId).filter(Boolean))];
    const results = [];
    for (const teacherId of teacherIds) {
        results.push(await buildTeacherSummary(periodId, teacherId));
    }
    return results;
}

/**
 * Generate AI summary for a SINGLE teacher in a period.
 */
export async function generateRatingSummaryForTeacher(periodId, teacherId) {
    if (!periodId || !teacherId) throw new Error('Missing periodId or teacherId');
    return buildTeacherSummary(periodId, teacherId);
}

/**
 * Get the latest period's rating stats for a specific teacher, grouped by groupId.
 * Returns { periodLabel, groups: { [groupId]: { avgScore, count } } } or null.
 */
export async function getLatestRatingStatsForTeacher(teacherId) {
    if (!teacherId) return null;

    const periods = await getAllReportPeriods();
    if (periods.length === 0) return null;

    for (const period of periods) {
        const ratings = (await listTeacherRatings({ periodId: period.id, teacherId })).filter(rating => !rating.eliminated);
        if (ratings.length === 0) continue;

        const groups = {};
        ratings.forEach(rating => {
            const groupId = rating.groupId || '_unknown';
            if (!groups[groupId]) groups[groupId] = { totalScoreSum: 0, count: 0 };
            groups[groupId].totalScoreSum += rating.totalScore || 0;
            groups[groupId].count += 1;
        });

        const normalizedGroups = {};
        for (const [groupId, info] of Object.entries(groups)) {
            normalizedGroups[groupId] = {
                avgScore: Math.round((info.totalScoreSum / info.count) * 10) / 10,
                count: info.count,
            };
        }

        return {
            periodId: period.id,
            periodLabel: period.label || 'Kỳ đánh giá',
            groups: normalizedGroups,
        };
    }

    return null;
}
