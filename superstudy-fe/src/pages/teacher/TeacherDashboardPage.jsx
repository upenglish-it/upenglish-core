import { createElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    ClipboardCheck,
    FolderKanban,
    LayoutDashboard,
    MessageSquare,
    Sparkles,
    Users,
    UsersRound
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherGroups, getStudentsInGroup, getAssignmentsForGroups, getTeacherTopics } from '../../services/teacherService';
import { getActiveReportPeriod, computePeriodStatus, getDaysRemaining, getGroupReportStatus, getStatusLabel } from '../../services/reportPeriodService';
import { getLatestRatingStatsForTeacher } from '../../services/teacherRatingService';
import { getTeacherPrompts } from '../../services/promptService';
import { getGrammarExercises } from '../../services/grammarService';
import { getExams, getExamAssignmentsForGroup, getExamSubmissionsForAssignments } from '../../services/examService';
import { getMyReceivedFeedback } from '../../services/feedbackService';
import { getApprovedGames } from '../../services/miniGameService';
import './TeacherDashboardPage.css';

const STAT_CARDS = [
    { key: 'groups', label: 'Lớp học', icon: Users, tone: 'primary', helper: 'Các nhóm bạn đang quản lý' },
    { key: 'students', label: 'Học viên', icon: UsersRound, tone: 'success', helper: 'Tổng số học viên trong lớp' },
    { key: 'topics', label: 'Bài vocab', icon: FolderKanban, tone: 'primary', helper: 'Bài học từ vựng tự tạo' },
    { key: 'grammar', label: 'Bài kỹ năng', icon: BookOpen, tone: 'warning', helper: 'Bài grammar và kỹ năng viết' },
    { key: 'exams', label: 'Đề kiểm tra', icon: ClipboardCheck, tone: 'danger', helper: 'Đề thi hoặc homework của bạn' },
    { key: 'prompts', label: 'Prompts', icon: MessageSquare, tone: 'neutral', helper: 'Prompt chấm viết và nói' }
];

function formatDateRange(period) {
    if (!period?.startDate || !period?.endDate) return 'Chưa có kỳ báo cáo đang mở';
    return `${period.startDate} - ${period.endDate}`;
}

function buildRatingSummary(ratingStats) {
    const groups = Object.values(ratingStats?.groups || {});
    if (groups.length === 0) {
        return { average: null, responses: 0 };
    }

    const totals = groups.reduce((acc, group) => {
        acc.weighted += (group.avgScore || 0) * (group.count || 0);
        acc.responses += group.count || 0;
        return acc;
    }, { weighted: 0, responses: 0 });

    if (!totals.responses) {
        return { average: null, responses: 0 };
    }

    return {
        average: Math.round((totals.weighted / totals.responses) * 10) / 10,
        responses: totals.responses
    };
}

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
        // Only count submissions from students who are still in the class now.
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


export default function TeacherDashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboard, setDashboard] = useState({
        stats: {
            groups: 0,
            students: 0,
            topics: 0,
            grammar: 0,
            exams: 0,
            prompts: 0
        },
        activePeriod: null,
        activePeriodStatus: 'closed',
        totalAssignments: 0,
        availableMiniGames: 0,
        feedbackCount: 0,
        unreadFeedback: 0,
        ratingAverage: null,
        ratingResponses: 0,
        spotlightGroups: []
    });

    useEffect(() => {
        if (!user?.uid) return;
        loadDashboard();
    }, [user?.uid, user?.groupIds?.join(',')]);

    async function loadDashboard() {
        setLoading(true);
        setError('');

        try {
            const teacherId = user?.uid;
            const groupIds = user?.groupIds || [];

            const [
                groupsResult,
                topicsResult,
                grammarResult,
                promptsResult,
                examsResult,
                assignmentsResult,
                feedbackResult,
                ratingResult,
                gamesResult,
                activePeriodResult
            ] = await Promise.allSettled([
                getTeacherGroups(groupIds),
                getTeacherTopics(teacherId),
                getGrammarExercises(teacherId),
                getTeacherPrompts(teacherId),
                getExams('teacher'),
                getAssignmentsForGroups(groupIds),
                getMyReceivedFeedback(teacherId),
                getLatestRatingStatsForTeacher(teacherId),
                getApprovedGames(),
                getActiveReportPeriod()
            ]);

            if (groupsResult.status === 'rejected') {
                throw groupsResult.reason;
            }

            const groups = groupsResult.value;
            const topics = topicsResult.status === 'fulfilled' ? topicsResult.value : [];
            const grammar = grammarResult.status === 'fulfilled' ? grammarResult.value : [];
            const prompts = promptsResult.status === 'fulfilled' ? promptsResult.value : [];
            const exams = examsResult.status === 'fulfilled'
                ? examsResult.value.filter(exam => exam.createdBy === teacherId)
                : [];
            const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
            const feedbackItems = feedbackResult.status === 'fulfilled' ? feedbackResult.value : [];
            const ratingStats = ratingResult.status === 'fulfilled' ? ratingResult.value : null;
            const approvedGames = gamesResult.status === 'fulfilled' ? gamesResult.value : [];
            const activePeriod = activePeriodResult.status === 'fulfilled' ? activePeriodResult.value : null;
            const assignmentsByGroupId = assignments.reduce((map, assignment) => {
                if (!assignment.groupId) return map;
                if (!map.has(assignment.groupId)) {
                    map.set(assignment.groupId, []);
                }
                map.get(assignment.groupId).push(assignment);
                return map;
            }, new Map());

            const groupDetails = await Promise.all(
                groups.map(async (group) => {
                    const [currentStudents, reportStatus, examAssignments] = await Promise.all([
                        getStudentsInGroup(group.id).catch(() => []),
                        activePeriod
                            ? getGroupReportStatus(group.id, activePeriod.startDate, activePeriod.endDate, activePeriod.id).catch(() => null)
                            : Promise.resolve(null),
                        getExamAssignmentsForGroup(group.id).catch(() => [])
                    ]);

                    const sentCount = reportStatus?.sentStudentIds?.size || 0;
                    const studentCount = currentStudents.length;
                    const currentStudentIds = new Set(currentStudents.map(student => student.uid));
                    const groupAssignments = assignmentsByGroupId.get(group.id) || [];
                    const assignmentCount = groupAssignments.length;
                    const examSubmissions = examAssignments.length > 0
                        ? await getExamSubmissionsForAssignments(examAssignments.map((assignment) => assignment.id)).catch(() => [])
                        : [];
                    const latestSubmissionMap = getLatestSubmissionMap(examSubmissions, currentStudentIds);

                    let pendingReviewCount = 0;
                    let pendingFollowUpCount = 0;
                    let latestSubmissionActivityAt = 0;

                    latestSubmissionMap.forEach((submission) => {
                        latestSubmissionActivityAt = Math.max(
                            latestSubmissionActivityAt,
                            getTimestampMs(submission.updatedAt) || getTimestampMs(submission.createdAt)
                        );

                        if (submission.status === 'graded' && !submission.resultsReleased) {
                            pendingReviewCount += 1;
                        }

                        if (hasPendingFollowUpAction(submission)) {
                            pendingFollowUpCount += 1;
                        }
                    });

                    const latestAssignmentActivityAt = groupAssignments.reduce((latestActivityAt, assignment) => (
                        Math.max(
                            latestActivityAt,
                            getTimestampMs(assignment.updatedAt) || getTimestampMs(assignment.createdAt)
                        )
                    ), 0);
                    const latestExamAssignmentActivityAt = examAssignments.reduce((latestActivityAt, assignment) => (
                        Math.max(
                            latestActivityAt,
                            getTimestampMs(assignment.updatedAt) || getTimestampMs(assignment.createdAt)
                        )
                    ), 0);
                    const latestGroupActivityAt = Math.max(
                        getTimestampMs(group.updatedAt),
                        getTimestampMs(group.createdAt),
                        latestAssignmentActivityAt,
                        latestExamAssignmentActivityAt,
                        latestSubmissionActivityAt
                    );
                    const pendingActionCount = pendingReviewCount + pendingFollowUpCount;
                    const examAssignmentCount = examAssignments.length;

                    const now = Date.now();
                    const activeAssignmentsCount = groupAssignments.filter(a => !a.dueDate || getTimestampMs(a.dueDate) > now).length;
                    const activeExamAssignmentsCount = examAssignments.filter(a => !a.dueDate || getTimestampMs(a.dueDate) > now).length;
                    const hasNoAssignedWork = studentCount > 0 && activeAssignmentsCount === 0 && activeExamAssignmentsCount === 0;

                    return {
                        ...group,
                        studentCount,
                        assignmentCount,
                        examAssignmentCount,
                        hasNoAssignedWork,
                        reportSent: activePeriod ? sentCount : 0,
                        reportLate: activePeriod ? (reportStatus?.lateStudentIds?.size || 0) : 0,
                        reportMissing: activePeriod ? Math.max(studentCount - sentCount, 0) : 0,
                        pendingReviewCount,
                        pendingFollowUpCount,
                        pendingActionCount,
                        latestActivityAt: latestGroupActivityAt,
                        rating: ratingStats?.groups?.[group.id] || null
                    };
                })
            );

            const totalStudents = groupDetails.reduce((sum, group) => sum + group.studentCount, 0);
            const unreadFeedback = feedbackItems.filter(item => item.isRead === false).length;
            const ratingSummary = buildRatingSummary(ratingStats);
            const activePeriodStatus = computePeriodStatus(activePeriod);

            const spotlightGroups = groupDetails
                .filter(group => group.pendingActionCount > 0 || group.hasNoAssignedWork)
                .sort((a, b) => {
                    const aHasPendingAction = Number(a.pendingActionCount > 0);
                    const bHasPendingAction = Number(b.pendingActionCount > 0);
                    if (aHasPendingAction !== bHasPendingAction) {
                        return bHasPendingAction - aHasPendingAction;
                    }

                    if (a.pendingActionCount !== b.pendingActionCount) {
                        return b.pendingActionCount - a.pendingActionCount;
                    }
                    if (a.pendingReviewCount !== b.pendingReviewCount) {
                        return b.pendingReviewCount - a.pendingReviewCount;
                    }
                    if (a.pendingFollowUpCount !== b.pendingFollowUpCount) {
                        return b.pendingFollowUpCount - a.pendingFollowUpCount;
                    }
                    const aHasNoAssignedWork = Number(a.hasNoAssignedWork);
                    const bHasNoAssignedWork = Number(b.hasNoAssignedWork);
                    if (aHasNoAssignedWork !== bHasNoAssignedWork) {
                        return bHasNoAssignedWork - aHasNoAssignedWork;
                    }
                    if (a.latestActivityAt !== b.latestActivityAt) {
                        return b.latestActivityAt - a.latestActivityAt;
                    }

                    return (a.name || '').localeCompare(b.name || '');
                })
                .slice(0, 4);

            setDashboard({
                stats: {
                    groups: groups.length,
                    students: totalStudents,
                    topics: topics.length,
                    grammar: grammar.length,
                    exams: exams.length,
                    prompts: prompts.length
                },
                activePeriod,
                activePeriodStatus,
                totalAssignments: assignments.length,
                availableMiniGames: approvedGames.length,
                feedbackCount: feedbackItems.length,
                unreadFeedback,
                ratingAverage: ratingSummary.average,
                ratingResponses: ratingSummary.responses,
                spotlightGroups
            });
        } catch (loadError) {
            console.error(loadError);
            setError('Không thể tải tổng quan giáo viên lúc này.');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="teacher-dashboard-page teacher-dashboard-loading">
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }}></div>
                <p>Đang tải tổng quan giáo viên...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="teacher-dashboard-page">
                <div className="admin-card teacher-dashboard-error">
                    <h2>Không tải được dữ liệu</h2>
                    <p>{error}</p>
                    <button className="teacher-dashboard-btn primary" onClick={loadDashboard}>
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    const hasGroups = dashboard.stats.groups > 0;
    const periodStatusLabel = getStatusLabel(dashboard.activePeriodStatus);
    const remainingDays = dashboard.activePeriod ? getDaysRemaining(dashboard.activePeriod.endDate) : null;

    return (
        <div className="admin-page teacher-dashboard-page">
            <section className="teacher-dashboard-hero">
                <div className="teacher-dashboard-hero-content">
                    <span className="teacher-dashboard-kicker">Teacher Control Center</span>
                    <h1 className="teacher-dashboard-title">
                        <LayoutDashboard size={26} />
                        Bảng điều khiển giáo viên
                    </h1>
                    <p className="teacher-dashboard-subtitle">
                        Theo dõi lớp học, nội dung đang quản lý và những việc cần ưu tiên trong một màn hình gọn hơn.
                    </p>

                    <div className="teacher-dashboard-pills">
                        <span className="teacher-dashboard-pill">
                            <Sparkles size={14} />
                            {dashboard.stats.groups > 0 ? `Chủ nhiệm ${dashboard.stats.groups} lớp` : 'Chưa có lớp nào được phân công'}
                        </span>
                        <span className="teacher-dashboard-pill subtle">
                            {dashboard.stats.students > 0 ? `Quản lý ${dashboard.stats.students} học viên` : 'Chưa có học viên trong lớp'}
                        </span>
                        {dashboard.activePeriod && (
                            <span className="teacher-dashboard-pill subtle tone-highlight">
                                {`${dashboard.activePeriod.label || 'Kỳ báo cáo'} - ${periodStatusLabel}`}
                            </span>
                        )}
                    </div>
                </div>

            </section>

            {hasGroups && (
                <section className="teacher-dashboard-grid">
                    <article className="teacher-dashboard-panel">
                        <div className="teacher-dashboard-panel-header">
                            <div>
                                <span className="teacher-dashboard-section-kicker">Ưu tiên hôm nay</span>
                                <h2>Lớp cần chú ý</h2>
                                <p>Chỉ hiện lớp đang có bài cần chấm/trả kết quả, hoặc lớp hiện đang không có bài luyện/bài tập được giao.</p>
                            </div>
                            <Link to="/teacher/groups" className="teacher-dashboard-inline-link">
                                Mở danh sách lớp
                                <ArrowRight size={14} />
                            </Link>
                        </div>

                        {dashboard.activePeriod && (
                            <div className="teacher-dashboard-period-box">
                                <div className="teacher-dashboard-period-header">
                                    <span>Kỳ báo cáo hiện tại</span>
                                    <span className={`teacher-dashboard-badge ${dashboard.activePeriod ? 'highlight' : 'neutral'}`}>
                                        {periodStatusLabel}
                                    </span>
                                </div>
                                <strong>{dashboard.activePeriod?.label || 'Chưa có báo cáo nào ở thời điểm hiện tại'}</strong>
                                {dashboard.activePeriod && <p>{formatDateRange(dashboard.activePeriod)}</p>}
                                {dashboard.activePeriod && remainingDays != null && (
                                    <div className="teacher-dashboard-period-foot">
                                        {remainingDays >= 0
                                            ? `Còn ${remainingDays} ngày đến hạn chính.`
                                            : `Đã quá hạn ${Math.abs(remainingDays)} ngày, hãy kiểm tra trạng thái gia hạn.`}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="teacher-dashboard-list">
                            {dashboard.spotlightGroups.length === 0 ? (
                                <div className="teacher-dashboard-list-empty">
                                    Hiện chưa có lớp nào cần chấm/trả kết quả, và tất cả lớp đang có học viên đều đang có bài tập mở.
                                </div>
                            ) : dashboard.spotlightGroups.map(group => (
                                <Link key={group.id} to={`/teacher/groups/${group.id}`} className="teacher-dashboard-list-item">
                                    <div className="teacher-dashboard-list-item-top">
                                        <h3>{group.name}</h3>
                                    </div>


                                    <div className="teacher-dashboard-list-metrics">
                                        {group.pendingReviewCount > 0 && (
                                            <span className="teacher-dashboard-metric-chip warning">
                                                <ClipboardCheck size={13} />
                                                {group.pendingReviewCount} bài chưa trả kết quả
                                            </span>
                                        )}
                                        {group.pendingFollowUpCount > 0 && (
                                            <span className="teacher-dashboard-metric-chip danger">
                                                <MessageSquare size={13} />
                                                {group.pendingFollowUpCount} bài sửa chờ xử lý
                                            </span>
                                        )}
                                        {group.hasNoAssignedWork && (
                                            <span className="teacher-dashboard-metric-chip neutral">
                                                <FolderKanban size={13} />
                                                Không có bài được giao
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </article>
                </section>
            )}

            <section className="teacher-dashboard-stats-grid">
                {STAT_CARDS.map(({ key, label, icon, tone, helper }) => (
                    <article key={key} className={`teacher-dashboard-stat-card tone-${tone}`}>
                        <div className="teacher-dashboard-stat-icon">
                            {createElement(icon, { size: 20 })}
                        </div>
                        <div className="teacher-dashboard-stat-content">
                            <div className="teacher-dashboard-stat-value">{dashboard.stats[key]}</div>
                            <div className="teacher-dashboard-stat-label">{label}</div>
                            <div className="teacher-dashboard-stat-helper">{helper}</div>
                        </div>
                    </article>
                ))}
            </section>

            {!hasGroups && (
                <section className="admin-card teacher-dashboard-empty">
                    <div className="teacher-dashboard-empty-icon">📚</div>
                    <h3>Chưa có lớp nào trong tài khoản này</h3>
                    <p>Hãy liên hệ admin để được phân công lớp, sau đó dashboard sẽ tự động hiện tổng quan giảng dạy của bạn.</p>
                </section>
            )}
        </div>
    );
}
