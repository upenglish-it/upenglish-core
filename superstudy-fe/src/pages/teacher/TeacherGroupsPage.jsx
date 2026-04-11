import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherGroups, getStudentsInGroup, getAssignmentsForGroups } from '../../services/teacherService';
import { getActiveReportPeriod, getGroupReportStatus, computePeriodStatus } from '../../services/reportPeriodService';
import { getLatestRatingStatsForTeacher } from '../../services/teacherRatingService';
import { getExamAssignmentsForGroup, getExamSubmissionsForAssignments } from '../../services/examService';
import { Layers, Users, ChevronRight, ClipboardList, CheckCircle, AlertTriangle, ClipboardCheck, FolderKanban, MessageSquare, Send, Star } from 'lucide-react';

function getTimestampMs(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLatestSubmissionMap(submissions, currentStudentIds) {
    const latestSubmissionMap = new Map();

    submissions.forEach((submission) => {
        if (!currentStudentIds.has(submission.studentId)) return;

        const key = `${submission.assignmentId}_${submission.studentId}`;
        const existing = latestSubmissionMap.get(key);
        const submissionTime = getTimestampMs(submission.updatedAt) || getTimestampMs(submission.createdAt);

        if (!existing) {
            latestSubmissionMap.set(key, submission);
            return;
        }

        const existingTime = getTimestampMs(existing.updatedAt) || getTimestampMs(existing.createdAt);
        if (submissionTime > existingTime) {
            latestSubmissionMap.set(key, submission);
        }
    });

    return latestSubmissionMap;
}

function hasPendingFollowUpAction(submission) {
    if (!submission?.resultsReleased || submission?.followUpResultsReleased) return false;

    const followUpRequested = submission.followUpRequested || {};
    const requestedQuestionIds = Object.keys(followUpRequested);
    if (requestedQuestionIds.length === 0) return false;

    const followUpAnswers = submission.followUpAnswers || {};
    return requestedQuestionIds.every((questionId) => (
        Object.values(followUpAnswers).some((sectionAnswers) => sectionAnswers?.[questionId])
    ));
}

function hasAiGradingError(submission) {
    return Object.values(submission?.results || {}).some((result) => {
        const feedback = result?.feedback || '';
        return feedback.includes('Lỗi khi chấm')
            || feedback.includes('chấm thủ công')
            || feedback.includes('chưa được AI chấm');
    });
}

function hasAnyActiveDeadline(item, nowTime) {
    const due = item?.dueDate ? (item.dueDate.toDate ? item.dueDate.toDate() : new Date(item.dueDate)) : null;
    if (!due || due.getTime() >= nowTime) return true;

    if (item?.studentDeadlines) {
        return Object.values(item.studentDeadlines).some((studentDeadline) => {
            const date = studentDeadline?.toDate ? studentDeadline.toDate() : new Date(studentDeadline);
            return date.getTime() >= nowTime;
        });
    }

    return false;
}

function buildGroupTaskStats({ submissions, currentStudentIds, regularAssignments, examAssignments }) {
    const latestSubmissionMap = getLatestSubmissionMap(submissions, currentStudentIds);

    let pendingToGradeCount = 0;
    let pendingReleaseCount = 0;
    let pendingFollowUpCount = 0;

    latestSubmissionMap.forEach((submission) => {
        if (hasPendingFollowUpAction(submission)) {
            pendingFollowUpCount += 1;
            return;
        }

        if (submission.status === 'submitted' || submission.status === 'grading') {
            pendingToGradeCount += 1;
            return;
        }

        if (submission.status === 'graded' && !submission.resultsReleased) {
            if (hasAiGradingError(submission)) {
                pendingToGradeCount += 1;
            } else {
                pendingReleaseCount += 1;
            }
        }
    });

    const now = Date.now();
    const activeAssignmentsCount = regularAssignments.filter((assignment) => hasAnyActiveDeadline(assignment, now)).length;
    const activeExamAssignmentsCount = examAssignments.filter((assignment) => hasAnyActiveDeadline(assignment, now)).length;
    const hasNoAssignedWork = currentStudentIds.size > 0 && activeAssignmentsCount === 0 && activeExamAssignmentsCount === 0;

    return {
        pendingToGradeCount,
        pendingReleaseCount,
        pendingFollowUpCount,
        totalPendingCount: pendingToGradeCount + pendingReleaseCount + pendingFollowUpCount,
        hasNoAssignedWork
    };
}

export default function TeacherGroupsPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Report period
    const [activePeriod, setActivePeriod] = useState(null);
    const [groupReportStats, setGroupReportStats] = useState({}); // { [groupId]: { sent, total } }
    const [groupExamWorkStats, setGroupExamWorkStats] = useState({}); // { [groupId]: { pendingToGradeCount, pendingReleaseCount, pendingFollowUpCount } }
    const [ratingStats, setRatingStats] = useState(null); // { periodLabel, groups: { [groupId]: { avgScore, count } } }

    const loadGroups = useCallback(async () => {
        if (!user?.groupIds || user.groupIds.length === 0) {
            setGroups([]);
            setActivePeriod(null);
            setGroupReportStats({});
            setGroupExamWorkStats({});
            setRatingStats(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await getTeacherGroups(user.groupIds);
            setGroups(data);
            const assignments = await getAssignmentsForGroups(user.groupIds).catch((e) => {
                console.warn('Error loading assignments for groups:', e);
                return [];
            });
            const regularAssignmentsByGroupId = assignments.reduce((map, assignment) => {
                if (!assignment?.groupId) return map;
                if (!map.has(assignment.groupId)) {
                    map.set(assignment.groupId, []);
                }
                map.get(assignment.groupId).push(assignment);
                return map;
            }, new Map());

            const studentsByGroupId = {};

            await Promise.all(data.map(async (group) => {
                try {
                    const students = await getStudentsInGroup(group.id);
                    studentsByGroupId[group.id] = students;
                } catch (e) {
                    console.warn('Error loading students for group', group.id, e);
                    studentsByGroupId[group.id] = [];
                }
            }));

            // Load report period + per-group stats
            const period = await getActiveReportPeriod();
            setActivePeriod(period);
            if (period && data.length > 0) {
                const statsMap = {};
                await Promise.all(data.map(async (group) => {
                    try {
                        const students = studentsByGroupId[group.id] || [];
                        const reportStatus = await getGroupReportStatus(group.id, period.startDate, period.endDate, period.id);
                        statsMap[group.id] = {
                            sent: reportStatus.sentStudentIds.size,
                            late: reportStatus.lateStudentIds.size,
                            total: students.length
                        };
                    } catch (e) {
                        console.warn('Error loading report stats for group', group.id, e);
                    }
                }));
                setGroupReportStats(statsMap);
            } else {
                setGroupReportStats({});
            }

            try {
                const groupExamAssignments = await Promise.all(data.map(async (group) => {
                    const examAssignments = await getExamAssignmentsForGroup(group.id).catch((e) => {
                        console.warn('Error loading exam assignments for group', group.id, e);
                        return [];
                    });
                    return [group.id, examAssignments];
                }));

                const assignmentsByGroupId = Object.fromEntries(groupExamAssignments);

                const allAssignmentIds = [...new Set(
                    Object.values(assignmentsByGroupId)
                        .flat()
                        .map((assignment) => assignment.id)
                        .filter(Boolean)
                )];

                const allSubmissions = allAssignmentIds.length > 0
                    ? await getExamSubmissionsForAssignments(allAssignmentIds).catch((e) => {
                        console.warn('Error loading exam submissions:', e);
                        return [];
                    })
                    : [];

                const examWorkStatsMap = {};
                data.forEach((group) => {
                    const groupStudents = studentsByGroupId[group.id] || [];
                    const currentStudentIds = new Set(groupStudents.map((student) => student.uid || student.id).filter(Boolean));
                    const examGroupAssignments = assignmentsByGroupId[group.id] || [];
                    const assignmentIds = new Set(examGroupAssignments.map((assignment) => assignment.id));
                    const relevantSubmissions = allSubmissions.filter((submission) => assignmentIds.has(submission.assignmentId));
                    examWorkStatsMap[group.id] = buildGroupTaskStats({
                        submissions: relevantSubmissions,
                        currentStudentIds,
                        regularAssignments: regularAssignmentsByGroupId.get(group.id) || [],
                        examAssignments: examGroupAssignments
                    });
                });
                setGroupExamWorkStats(examWorkStatsMap);
            } catch (e) {
                console.warn('Error loading pending exam work stats:', e);
                setGroupExamWorkStats({});
            }

            // Load teacher rating stats
            try {
                const rStats = await getLatestRatingStatsForTeacher(user.uid);
                setRatingStats(rStats);
            } catch (e) {
                console.warn('Error loading rating stats', e);
            }
        } catch (err) {
            console.error(err);
            setError('Lỗi tải danh sách lớp học.');
            setGroupExamWorkStats({});
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    return (
        <div className="admin-page">


            {error && (
                <div className="admin-alert error">
                    {error}
                </div>
            )}

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải dữ liệu...</div>
                ) : groups.length === 0 ? (
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><Layers size={28} /></div>
                        <h3>Chưa được phân công</h3>
                        <p>Bạn hiện chưa được phân công quản lý lớp học (Group) nào. Vui lòng liên hệ Admin.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {groups.map(group => {
                            const stats = groupReportStats[group.id];
                            const examWork = groupExamWorkStats[group.id];
                            const shouldShowTaskTags = examWork && (
                                examWork.pendingToGradeCount > 0
                                || examWork.pendingReleaseCount > 0
                                || examWork.pendingFollowUpCount > 0
                                || examWork.hasNoAssignedWork
                            );
                            const periodStatus = activePeriod ? computePeriodStatus(activePeriod) : null;
                            const missing = stats ? stats.total - stats.sent : 0;
                            const groupRating = ratingStats?.groups?.[group.id];

                            return (
                                <Link key={group.id} to={`/teacher/groups/${group.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div style={{
                                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column',
                                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer',
                                        height: '100%',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--color-primary-light)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={24} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 700 }}>{group.name}</h3>
                                            </div>
                                        </div>
                                        {shouldShowTaskTags && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                                {examWork.pendingToGradeCount > 0 && (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '6px 10px',
                                                        borderRadius: '999px',
                                                        background: '#fff7ed',
                                                        border: '1px solid #fed7aa',
                                                        color: '#c2410c',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700
                                                    }}>
                                                        <ClipboardCheck size={13} /> {examWork.pendingToGradeCount} chờ chấm
                                                    </span>
                                                )}
                                                {examWork.pendingReleaseCount > 0 && (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '6px 10px',
                                                        borderRadius: '999px',
                                                        background: '#eef2ff',
                                                        border: '1px solid #c7d2fe',
                                                        color: '#4f46e5',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700
                                                    }}>
                                                        <Send size={13} /> {examWork.pendingReleaseCount} chờ trả kết quả
                                                    </span>
                                                )}
                                                {examWork.pendingFollowUpCount > 0 && (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '6px 10px',
                                                        borderRadius: '999px',
                                                        background: '#fefce8',
                                                        border: '1px solid #fcd34d',
                                                        color: '#a16207',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700
                                                    }}>
                                                        <MessageSquare size={13} /> {examWork.pendingFollowUpCount} bài sửa chờ xử lý
                                                    </span>
                                                )}
                                                {examWork.hasNoAssignedWork && (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '6px 10px',
                                                        borderRadius: '999px',
                                                        background: '#fff7ed',
                                                        border: '1px solid #fdba74',
                                                        color: '#c2410c',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700
                                                    }}>
                                                        <FolderKanban size={13} /> Chưa có bài được giao
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Report period stats */}
                                        {activePeriod && stats && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: '12px', marginBottom: '16px',
                                                background: missing > 0 ? (periodStatus === 'grace' ? '#fef2f2' : '#eff6ff') : '#f0fdf4',
                                                border: `1px solid ${missing > 0 ? (periodStatus === 'grace' ? '#fecaca' : '#bfdbfe') : '#bbf7d0'}`
                                            }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <ClipboardList size={12} /> {activePeriod.label || 'Kỳ báo cáo'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                                                        <CheckCircle size={14} /> {stats.sent}/{stats.total} đã gửi
                                                    </span>
                                                    {missing > 0 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.82rem', fontWeight: 700,
                                                            color: periodStatus === 'grace' ? '#dc2626' : '#2563eb'
                                                        }}>
                                                            <AlertTriangle size={14} /> {missing} chưa gửi
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Teacher rating badge */}
                                        {groupRating && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: '12px', marginBottom: '16px',
                                                background: groupRating.avgScore >= 80 ? '#f0fdf4' : groupRating.avgScore >= 60 ? '#fffbeb' : '#fef2f2',
                                                border: `1px solid ${groupRating.avgScore >= 80 ? '#bbf7d0' : groupRating.avgScore >= 60 ? '#fde68a' : '#fecaca'}`,
                                            }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Star size={12} fill="#f59e0b" color="#f59e0b" /> {ratingStats.periodLabel}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '0.95rem', fontWeight: 800,
                                                        color: groupRating.avgScore >= 80 ? '#16a34a' : groupRating.avgScore >= 60 ? '#d97706' : '#dc2626',
                                                    }}>
                                                        {groupRating.avgScore}%
                                                    </span>
                                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                                                        từ {groupRating.count} đánh giá
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                Chi tiết <ChevronRight size={16} />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
