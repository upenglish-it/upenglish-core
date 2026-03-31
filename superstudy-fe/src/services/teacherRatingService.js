/**
 * Teacher Rating Service
 * CRUD for teacher_ratings + teacher_rating_summaries collections
 * AI summary generation for anonymous results
 */

import { db } from '../config/firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { api } from '../models/httpClient';
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
        const start = new Date(p.ratingStartDate + 'T00:00:00');
        const end = new Date(p.ratingEndDate + 'T23:59:59');
        return today >= start && today <= end;
    }) || null;
}

// ═══════════════════════════════════════════════
// RATING CRITERIA DEFINITIONS
// ═══════════════════════════════════════════════

export const RATING_CRITERIA = [
    {
        key: 'communication',
        label: 'Kỹ năng giao tiếp và khích lệ',
        labelEn: 'Communication',
        description: 'Thân thiện, tạo môi trường thoải mái, lắng nghe HV',
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
        label: 'Sự tận tâm & hỗ trợ',
        labelEn: 'Dedication',
        description: 'GV sẵn sàng giải đáp thắc mắc, hỗ trợ ngoài giờ',
        icon: '💪',
        weight: 20,
    },
    {
        key: 'feedback',
        label: 'Đánh giá & phản hồi',
        labelEn: 'Feedback',
        description: 'Chấm bài kịp thời, nhận xét chi tiết, hữu ích',
        icon: '✏️',
        weight: 15,
    },
    {
        key: 'progress',
        label: 'Cảm nhận tiến bộ',
        labelEn: 'Student Progress',
        description: 'Bạn có cảm thấy mình tiến bộ nhờ GV trong tháng này?',
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
    for (const c of RATING_CRITERIA) {
        let raw = scores[c.key];
        if (raw === undefined || raw === null) raw = 0;
        // Boolean criteria: true/1 = 10, false/0 = 0
        if (c.type === 'boolean') {
            raw = (raw === true || raw === 1 || raw === 10) ? 10 : 0;
        }
        total += (raw / 10) * c.weight;
    }
    return Math.round(total * 10) / 10; // 1 decimal
}

// ═══════════════════════════════════════════════
// STUDENT ACTIONS
// ═══════════════════════════════════════════════

/**
 * Check if a student has already rated a teacher in a given period.
 */
export async function hasStudentRated(periodId, teacherId, studentId) {
    if (!periodId || !teacherId || !studentId) return false;
    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId),
        where('teacherId', '==', teacherId),
        where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
}

/**
 * Submit a teacher rating from a student.
 * Throws if already rated.
 */
export async function submitRating({ periodId, teacherId, studentId, groupId, scores, comment }) {
    // Validate
    if (!periodId || !teacherId || !studentId) throw new Error('Missing required fields');

    const alreadyRated = await hasStudentRated(periodId, teacherId, studentId);
    if (alreadyRated) throw new Error('Bạn đã đánh giá giáo viên này trong kỳ này rồi.');

    const totalScore = calculateTotalScore(scores);

    const ref = doc(collection(db, 'teacher_ratings'));
    await setDoc(ref, {
        periodId,
        teacherId,
        studentId,
        groupId: groupId || '',
        scores,
        totalScore,
        comment: (comment || '').trim(),
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

/**
 * Get the list of teachers a student should rate (based on groupIds).
 * Returns teachers who are assigned to the student's groups, enriched with group names.
 */
export async function getTeachersForStudent(studentId) {
    if (!studentId) return [];

    // Get student's groupIds (prefer visibleGroupIds)
    const studentSnap = await getDoc(doc(db, 'users', studentId));
    if (!studentSnap.exists()) return [];
    const studentData = studentSnap.data();
    const studentGroupIds = studentData.visibleGroupIds || studentData.groupIds || [];
    if (studentGroupIds.length === 0) return [];

    // Fetch group docs and filter out deleted/hidden groups
    const activeGroupIds = [];
    const groupNameMap = {};
    for (const gid of studentGroupIds) {
        try {
            const gSnap = await getDoc(doc(db, 'user_groups', gid));
            if (gSnap.exists()) {
                const gData = gSnap.data();
                // Skip deleted or hidden groups
                if (gData.isHidden || gData.isDeleted) continue;
                activeGroupIds.push(gid);
                groupNameMap[gid] = gData.name || gData.label || gid;
            }
            // If group doc doesn't exist, skip it (deleted)
        } catch { /* skip */ }
    }
    if (activeGroupIds.length === 0) return [];

    // Get all teachers/admins and match by active groupIds
    // Each teacher-group pair is a SEPARATE entry (student rates per group)
    const usersSnap = await getDocs(collection(db, 'users'));
    const teachers = [];

    usersSnap.docs.forEach(d => {
        const u = { uid: d.id, ...d.data() };
        if ((u.role === 'teacher' || u.role === 'admin') && u.status === 'approved') {
            const teacherGroupIds = u.visibleGroupIds || u.groupIds || [];
            const commonGroups = teacherGroupIds.filter(gid => activeGroupIds.includes(gid));
            // Add one entry per common group (not deduplicated by teacher)
            commonGroups.forEach(gid => {
                teachers.push({
                    uid: u.uid,
                    displayName: u.displayName || u.email || 'N/A',
                    photoURL: u.photoURL || '',
                    email: u.email || '',
                    ratingGroupId: gid,
                    ratingGroupName: groupNameMap[gid] || gid,
                    commonGroupIds: commonGroups,
                    groupEntries: commonGroups.map(g => ({
                        groupId: g,
                        groupName: groupNameMap[g] || g,
                    })),
                });
            });
        }
    });

    return teachers;
}

/**
 * Get student's existing ratings for a period (to check which teachers already rated).
 */
export async function getStudentRatingsForPeriod(periodId, studentId) {
    if (!periodId || !studentId) return [];
    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId),
        where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════
// ADMIN ACTIONS
// ═══════════════════════════════════════════════

/**
 * Get all individual ratings for a teacher in a period (admin detail view).
 */
export async function getRatingsForTeacher(periodId, teacherId) {
    if (!periodId || !teacherId) return [];
    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId),
        where('teacherId', '==', teacherId)
    );
    const snap = await getDocs(q);
    const ratings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Enrich with student names
    const studentIds = [...new Set(ratings.map(r => r.studentId))];
    const studentMap = {};
    for (const sid of studentIds) {
        try {
            const sSnap = await getDoc(doc(db, 'users', sid));
            if (sSnap.exists()) {
                studentMap[sid] = sSnap.data().displayName || sSnap.data().email || 'N/A';
            }
        } catch { /* ignore */ }
    }

    return ratings.map(r => ({
        ...r,
        studentName: studentMap[r.studentId] || 'Không rõ',
    }));
}

/**
 * Delete a rating so the student can re-submit.
 */
export async function deleteRating(ratingId) {
    if (!ratingId) throw new Error('Missing ratingId');
    await deleteDoc(doc(db, 'teacher_ratings', ratingId));
}

/**
 * Eliminate/restore a rating (soft flag). Eliminated ratings are excluded from AI summary.
 */
export async function toggleEliminateRating(ratingId, eliminated) {
    if (!ratingId) throw new Error('Missing ratingId');
    await updateDoc(doc(db, 'teacher_ratings', ratingId), { eliminated: !!eliminated });
}

/**
 * Get all ratings in a period grouped by teacher (admin overview).
 */
export async function getAllRatingsForPeriod(periodId) {
    if (!periodId) return [];

    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId)
    );
    const snap = await getDocs(q);
    const ratings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Group by teacherId
    const grouped = {};
    ratings.forEach(r => {
        if (!grouped[r.teacherId]) grouped[r.teacherId] = [];
        grouped[r.teacherId].push(r);
    });

    // Get teacher names
    const teacherIds = Object.keys(grouped);
    const teacherMap = {};
    for (const tid of teacherIds) {
        try {
            const tSnap = await getDoc(doc(db, 'users', tid));
            if (tSnap.exists()) {
                const tData = tSnap.data();
                teacherMap[tid] = {
                    displayName: tData.displayName || tData.email || 'N/A',
                    photoURL: tData.photoURL || '',
                };
            }
        } catch { /* ignore */ }
    }

    // Collect all unique groupIds to fetch names
    const allGroupIds = [...new Set(ratings.map(r => r.groupId).filter(Boolean))];
    const groupNameMap = {};
    for (const gid of allGroupIds) {
        try {
            const gSnap = await getDoc(doc(db, 'user_groups', gid));
            if (gSnap.exists()) {
                groupNameMap[gid] = gSnap.data().name || gSnap.data().label || gid;
            } else {
                groupNameMap[gid] = gid;
            }
        } catch { groupNameMap[gid] = gid; }
    }

    // Calculate averages per teacher (excluding eliminated ratings)
    return teacherIds.map(tid => {
        const allTeacherRatings = grouped[tid];
        const teacherRatings = allTeacherRatings.filter(r => !r.eliminated);
        const count = teacherRatings.length;
        if (count === 0) return null;

        const avgScores = {};
        for (const c of RATING_CRITERIA) {
            const sum = teacherRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
            avgScores[c.key] = Math.round((sum / count) * 10) / 10;
        }

        const avgTotal = Math.round(teacherRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / count * 10) / 10;

        // Per-group breakdown
        const byGroup = {};
        teacherRatings.forEach(r => {
            const gid = r.groupId || '_unknown';
            if (!byGroup[gid]) byGroup[gid] = [];
            byGroup[gid].push(r);
        });
        const groupScores = {};
        for (const [gid, gRatings] of Object.entries(byGroup)) {
            const gCount = gRatings.length;
            const gAvgScores = {};
            for (const c of RATING_CRITERIA) {
                const sum = gRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
                gAvgScores[c.key] = Math.round((sum / gCount) * 10) / 10;
            }
            const gAvgTotal = Math.round(gRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / gCount * 10) / 10;
            groupScores[gid] = {
                groupName: groupNameMap[gid] || gid,
                count: gCount,
                overallScore: gAvgTotal,
                averageScores: gAvgScores,
            };
        }

        return {
            teacherId: tid,
            teacherName: teacherMap[tid]?.displayName || 'N/A',
            teacherPhoto: teacherMap[tid]?.photoURL || '',
            totalResponses: count,
            averageScores: avgScores,
            overallScore: avgTotal,
            groupScores,
        };
    }).filter(Boolean).sort((a, b) => b.overallScore - a.overallScore);
}

// ═══════════════════════════════════════════════
// SUMMARY & AI
// ═══════════════════════════════════════════════

/**
 * Get or generate summary for a teacher in a period.
 */
export async function getRatingSummary(periodId, teacherId) {
    if (!periodId || !teacherId) return null;
    try {
        const result = await api.get('/teacher-ratings/summary', { periodId, teacherId });
        const data = result?.data || result;
        if (!data) return null;
        // The backend returns it properly with id
        return data; 
    } catch (e) {
        console.error('Error fetching rating summary:', e);
        return null;
    }
}

/**
 * Get all summaries for a period.
 */
export async function getAllSummariesForPeriod(periodId) {
    if (!periodId) return [];
    try {
        const result = await api.get('/teacher-ratings/summaries/all', { periodId });
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (e) {
        console.error('Error fetching all summaries:', e);
        return [];
    }
}

/**
 * Generate AI summaries for all teachers in a period.
 * Called by admin when period closes.
 */
export async function generateRatingSummaries(periodId) {
    if (!periodId) throw new Error('Missing periodId');

    // Get all ratings for the period
    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId)
    );
    const snap = await getDocs(q);
    const allRatings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const validRatings = allRatings.filter(r => !r.eliminated);

    if (validRatings.length === 0) throw new Error('Chưa có đánh giá hợp lệ nào trong kỳ này.');

    // Group by teacherId
    const grouped = {};
    validRatings.forEach(r => {
        if (!grouped[r.teacherId]) grouped[r.teacherId] = [];
        grouped[r.teacherId].push(r);
    });

    const teacherIds = Object.keys(grouped);
    const results = [];

    for (const tid of teacherIds) {
        const teacherRatings = grouped[tid];
        const count = teacherRatings.length;

        // Calculate averages
        const avgScores = {};
        for (const c of RATING_CRITERIA) {
            const sum = teacherRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
            avgScores[c.key] = Math.round((sum / count) * 10) / 10;
        }
        const avgTotal = Math.round(teacherRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / count * 10) / 10;

        // Collect comments for AI
        const comments = teacherRatings
            .map(r => r.comment)
            .filter(c => c && c.trim().length > 0);

        // Generate AI summary
        let aiSummary = '';
        try {
            const criteriaText = RATING_CRITERIA.map(c =>
                `- ${c.label}: ${avgScores[c.key]}/10`
            ).join('\n');

            const commentsText = comments.length > 0
                ? `\nNhận xét từ học viên (ẩn danh):\n${comments.map((c, i) => `${i + 1}. "${c}"`).join('\n')}`
                : '\n(Không có nhận xét text)';

            const systemPrompt = `Bạn là trợ lý AI của trung tâm ngoại ngữ. Nhiệm vụ: viết BÁO CÁO TỔNG HỢP ẩn danh về kết quả đánh giá giáo viên.

QUAN TRỌNG:
- KHÔNG tiết lộ danh tính bất kỳ học viên nào
- KHÔNG trích dẫn nguyên văn nhận xét (paraphrase lại)
- Viết bằng tiếng Việt, giọng chuyên nghiệp, tích cực nhưng khách quan
- Nêu điểm mạnh trước, góp ý cải thiện sau
- Độ dài: 3-5 câu ngắn gọn

Dữ liệu:
- Số lượng đánh giá: ${count}
- Điểm tổng: ${avgTotal}/100
- Điểm chi tiết:
${criteriaText}
${commentsText}`;

            const response = await chatCompletion({
                systemPrompt,
                userContent: 'Hãy viết báo cáo tổng hợp ẩn danh cho giáo viên này.',
            });
            aiSummary = response.text?.trim() || '';
        } catch (err) {
            console.error('AI summary generation failed for teacher', tid, err);
            aiSummary = `Tổng hợp tự động: Điểm trung bình ${avgTotal}/100 từ ${count} đánh giá.`;
        }

        // Get teacher name for the summary record
        let teacherName = 'N/A';
        try {
            const tSnap = await getDoc(doc(db, 'users', tid));
            if (tSnap.exists()) teacherName = tSnap.data().displayName || tSnap.data().email || 'N/A';
        } catch { /* ignore */ }

        // Per-group breakdown
        const byGroup = {};
        teacherRatings.forEach(r => {
            const gid = r.groupId || '_unknown';
            if (!byGroup[gid]) byGroup[gid] = [];
            byGroup[gid].push(r);
        });
        const allGroupIds = [...new Set(teacherRatings.map(r => r.groupId).filter(Boolean))];
        const groupNameMap = {};
        for (const gid of allGroupIds) {
            try {
                const gSnap = await getDoc(doc(db, 'user_groups', gid));
                if (gSnap.exists()) groupNameMap[gid] = gSnap.data().name || gSnap.data().label || gid;
                else groupNameMap[gid] = gid;
            } catch { groupNameMap[gid] = gid; }
        }
        const groupScores = {};
        for (const [gid, gRatings] of Object.entries(byGroup)) {
            const gCount = gRatings.length;
            const gAvgScores = {};
            for (const c of RATING_CRITERIA) {
                const sum = gRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
                gAvgScores[c.key] = Math.round((sum / gCount) * 10) / 10;
            }
            const gAvgTotal = Math.round(gRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / gCount * 10) / 10;
            groupScores[gid] = {
                groupName: groupNameMap[gid] || gid,
                count: gCount,
                overallScore: gAvgTotal,
                averageScores: gAvgScores,
            };
        }

        // Save summary
        const docId = `${periodId}_${tid}`;
        const summaryData = {
            periodId,
            teacherId: tid,
            teacherName,
            totalResponses: count,
            averageScores: avgScores,
            overallScore: avgTotal,
            aiSummary,
            groupScores,
            generatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'teacher_rating_summaries', docId), summaryData);
        results.push({ teacherId: tid, teacherName, ...summaryData });
    }

    return results;
}

/**
 * Generate AI summary for a SINGLE teacher in a period.
 */
export async function generateRatingSummaryForTeacher(periodId, teacherId) {
    if (!periodId || !teacherId) throw new Error('Missing periodId or teacherId');

    const q = query(
        collection(db, 'teacher_ratings'),
        where('periodId', '==', periodId),
        where('teacherId', '==', teacherId)
    );
    const snap = await getDocs(q);
    const teacherRatings = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !r.eliminated);

    if (teacherRatings.length === 0) throw new Error('Chưa có đánh giá hợp lệ nào cho GV này.');

    const count = teacherRatings.length;
    const avgScores = {};
    for (const c of RATING_CRITERIA) {
        const sum = teacherRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
        avgScores[c.key] = Math.round((sum / count) * 10) / 10;
    }
    const avgTotal = Math.round(teacherRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / count * 10) / 10;

    const comments = teacherRatings.map(r => r.comment).filter(c => c && c.trim().length > 0);

    let aiSummary = '';
    try {
        const criteriaText = RATING_CRITERIA.map(c => `- ${c.label}: ${avgScores[c.key]}/10`).join('\n');
        const commentsText = comments.length > 0
            ? `\nNhận xét từ học viên (ẩn danh):\n${comments.map((c, i) => `${i + 1}. "${c}"`).join('\n')}`
            : '\n(Không có nhận xét text)';

        const systemPrompt = `Bạn là trợ lý AI của trung tâm ngoại ngữ. Nhiệm vụ: viết BÁO CÁO TỔNG HỢP ẩn danh về kết quả đánh giá giáo viên.

QUAN TRỌNG:
- KHÔNG tiết lộ danh tính bất kỳ học viên nào
- KHÔNG trích dẫn nguyên văn nhận xét (paraphrase lại)
- Viết bằng tiếng Việt, giọng chuyên nghiệp, tích cực nhưng khách quan
- Nêu điểm mạnh trước, góp ý cải thiện sau
- Độ dài: 3-5 câu ngắn gọn

Dữ liệu:
- Số lượng đánh giá: ${count}
- Điểm tổng: ${avgTotal}/100
- Điểm chi tiết:
${criteriaText}
${commentsText}`;

        const response = await chatCompletion({ systemPrompt, userContent: 'Hãy viết báo cáo tổng hợp ẩn danh cho giáo viên này.' });
        aiSummary = response.text?.trim() || '';
    } catch (err) {
        console.error('AI summary generation failed for teacher', teacherId, err);
        aiSummary = `Tổng hợp tự động: Điểm trung bình ${avgTotal}/100 từ ${count} đánh giá.`;
    }

    let teacherName = 'N/A';
    try {
        const tSnap = await getDoc(doc(db, 'users', teacherId));
        if (tSnap.exists()) teacherName = tSnap.data().displayName || tSnap.data().email || 'N/A';
    } catch { /* ignore */ }

    // Per-group breakdown
    const byGroup = {};
    teacherRatings.forEach(r => {
        const gid = r.groupId || '_unknown';
        if (!byGroup[gid]) byGroup[gid] = [];
        byGroup[gid].push(r);
    });
    const allGroupIds = [...new Set(teacherRatings.map(r => r.groupId).filter(Boolean))];
    const groupNameMap = {};
    for (const gid of allGroupIds) {
        try {
            const gSnap = await getDoc(doc(db, 'user_groups', gid));
            if (gSnap.exists()) groupNameMap[gid] = gSnap.data().name || gSnap.data().label || gid;
            else groupNameMap[gid] = gid;
        } catch { groupNameMap[gid] = gid; }
    }
    const groupScores = {};
    for (const [gid, gRatings] of Object.entries(byGroup)) {
        const gCount = gRatings.length;
        const gAvgScores = {};
        for (const c of RATING_CRITERIA) {
            const sum = gRatings.reduce((s, r) => s + (r.scores?.[c.key] || 0), 0);
            gAvgScores[c.key] = Math.round((sum / gCount) * 10) / 10;
        }
        const gAvgTotal = Math.round(gRatings.reduce((s, r) => s + (r.totalScore || 0), 0) / gCount * 10) / 10;
        groupScores[gid] = {
            groupName: groupNameMap[gid] || gid,
            count: gCount,
            overallScore: gAvgTotal,
            averageScores: gAvgScores,
        };
    }

    const docId = `${periodId}_${teacherId}`;
    const summaryData = {
        periodId, teacherId, teacherName,
        totalResponses: count, averageScores: avgScores, overallScore: avgTotal,
        aiSummary, groupScores, generatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'teacher_rating_summaries', docId), summaryData);
    return { teacherId, teacherName, ...summaryData };
}

/**
 * Get the latest period's rating stats for a specific teacher, grouped by groupId.
 * Returns { periodLabel, groups: { [groupId]: { avgScore, count } } } or null.
 */
export async function getLatestRatingStatsForTeacher(teacherId) {
    if (!teacherId) return null;

    // Get all periods sorted newest first
    const periods = await getAllReportPeriods();
    if (periods.length === 0) return null;

    // Try each period (newest first) to find one with ratings for this teacher
    for (const period of periods) {
        const q = query(
            collection(db, 'teacher_ratings'),
            where('periodId', '==', period.id),
            where('teacherId', '==', teacherId)
        );
        const snap = await getDocs(q);
        if (snap.empty) continue;

        // Found ratings – group by groupId
        const byGroup = {};
        snap.docs.forEach(d => {
            const data = d.data();
            const gid = data.groupId || '_unknown';
            if (!byGroup[gid]) byGroup[gid] = { totalScoreSum: 0, count: 0 };
            byGroup[gid].totalScoreSum += (data.totalScore || 0);
            byGroup[gid].count += 1;
        });

        const groups = {};
        for (const [gid, info] of Object.entries(byGroup)) {
            groups[gid] = {
                avgScore: Math.round((info.totalScoreSum / info.count) * 10) / 10,
                count: info.count,
            };
        }

        return {
            periodId: period.id,
            periodLabel: period.label || 'Kỳ đánh giá',
            groups,
        };
    }

    return null;
}
