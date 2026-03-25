import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, Sparkles, Send, Trash2, Eye, EyeOff, Loader, ChevronDown, ChevronUp, Calendar, PenLine, X, AlertTriangle } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { getGroupById, getStudentsInGroup, getAssignmentsForGroup, getStudentTopicProgressSummary, getStudentTopicWordsProgress } from '../../services/teacherService';
import { getUserLearningStats, getAdminTopics, getFolders } from '../../services/adminService';
import { getGrammarExercises, getSharedAndPublicGrammarExercises } from '../../services/grammarService';
import { getStudentGrammarProgressSummary, getStudentGrammarQuestionsProgress } from '../../services/grammarSpacedRepetition';
import { getExamAssignmentsForGroup, getExamSubmissionsForAssignments, getExams, getSharedExams } from '../../services/examService';
import { analyzeStudentSkills } from '../../services/skillAnalysisService';
import { generateSkillReport, saveSkillReport, getSkillReports, deleteSkillReport, sendSkillReport } from '../../services/skillReportService';
import { getActiveReportPeriod, computePeriodStatus, getAllReportPeriods } from '../../services/reportPeriodService';
import { getRedFlagsForStudentInGroup, getRedFlagsForStudentInGroupByDateRange, addRedFlag, removeRedFlag, VIOLATION_TYPES } from '../../services/redFlagService';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import './StudentProgressPage.css';

const SKILL_ORDER = ['listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary'];
const SKILL_EMOJIS = { listening: '🎧', speaking: '🗣️', reading: '📖', writing: '✍️', grammar: '📝', vocabulary: '📚' };
const SKILL_LABELS = { listening: 'Listening', speaking: 'Speaking', reading: 'Reading', writing: 'Writing', grammar: 'Grammar', vocabulary: 'Vocabulary' };

function getScoreColor(score) {
    if (score === null) return '#cbd5e1';
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#ca8a04';
    if (score >= 40) return '#f97316';
    return '#ef4444';
}

function getErrorStyle(rate) {
    if (rate > 30) return { color: '#dc2626', bg: '#fef2f2' };
    if (rate > 15) return { color: '#ca8a04', bg: '#fefce8' };
    return { color: '#16a34a', bg: '#f0fdf4' };
}

function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PROGRESS_FILTERS = [
    { key: '7_days', label: '7 ngày' },
    { key: 'this_week', label: 'Tuần này' },
    { key: 'last_week', label: 'Tuần trước' },
    { key: 'this_month', label: 'Tháng này' },
    { key: 'last_month', label: 'Tháng trước' },
    { key: '3_months', label: '3 tháng' },
    { key: 'all', label: 'Tất cả' },
    { key: 'custom', label: 'Tùy chọn' },
];

function getFilterDateRange(filterKey) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    switch (filterKey) {
        case '7_days': {
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            return { start, end: now };
        }
        case 'this_week': {
            const start = new Date(today);
            start.setDate(today.getDate() + mondayOffset);
            return { start, end: now };
        }
        case 'last_week': {
            const thisMonday = new Date(today);
            thisMonday.setDate(today.getDate() + mondayOffset);
            const lastMonday = new Date(thisMonday);
            lastMonday.setDate(thisMonday.getDate() - 7);
            const lastSunday = new Date(thisMonday);
            lastSunday.setDate(thisMonday.getDate() - 1);
            lastSunday.setHours(23, 59, 59, 999);
            return { start: lastMonday, end: lastSunday };
        }
        case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start, end: now };
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            return { start, end };
        }
        case '3_months': {
            const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            return { start, end: now };
        }
        default:
            return null;
    }
}

export default function StudentProgressPage() {
    const { groupId, studentId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isAdminView = location.pathname.startsWith('/admin/');
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';

    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState(null);
    const [student, setStudent] = useState(null);
    const [studentStats, setStudentStats] = useState(null);

    // Progress data
    const [studentTopicProgress, setStudentTopicProgress] = useState(null);
    const [studentGrammarProgress, setStudentGrammarProgress] = useState(null);
    const [studentExamSubmissions, setStudentExamSubmissions] = useState([]);
    const [topics, setTopics] = useState([]);
    const [folders, setFolders] = useState([]);
    const [grammarExercises, setGrammarExercises] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [examAssignments, setExamAssignments] = useState([]);
    const [allExams, setAllExams] = useState([]);

    // Time filter for progress
    const [progressFilter, setProgressFilter] = useState('7_days');
    const [progressStartDate, setProgressStartDate] = useState('');
    const [progressEndDate, setProgressEndDate] = useState('');
    const [progressLoading, setProgressLoading] = useState(false);

    // Active report period
    const [activeReportPeriod, setActiveReportPeriod] = useState(null);
    const [isPeriodFilter, setIsPeriodFilter] = useState(false);
    const [periodLabelMap, setPeriodLabelMap] = useState({}); // { periodId: label }

    // Computed start/end date strings from filter (shared by skill report)
    const currentFilterRange = progressFilter === 'custom'
        ? (progressStartDate || progressEndDate ? { start: progressStartDate ? new Date(progressStartDate) : new Date(0), end: progressEndDate ? new Date(progressEndDate + 'T23:59:59') : new Date() } : null)
        : (progressFilter !== 'all' ? getFilterDateRange(progressFilter) : null);
    const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const currentFilterStartDate = currentFilterRange ? toLocalDateStr(currentFilterRange.start) : '';
    const currentFilterEndDate = currentFilterRange ? toLocalDateStr(currentFilterRange.end) : '';
    // Format date for display: 2026-03-12 → 12/03/2026
    const formatFilterDateVN = (isoStr) => {
        if (!isoStr) return 'hôm nay';
        const [y, m, d] = isoStr.split('-');
        return `${d}/${m}/${y}`;
    };
    // For deadline comparison: use the earlier of filterEnd and now
    const getDeadlineCheckDate = () => {
        const filterEnd = currentFilterEndDate ? new Date(currentFilterEndDate + 'T23:59:59') : new Date();
        const now = new Date();
        return new Date(Math.min(filterEnd.getTime(), now.getTime()));
    };

    // Expandable details
    const [expandedTopicId, setExpandedTopicId] = useState(null);
    const [topicWordsCache, setTopicWordsCache] = useState({});
    const [grammarQuestionsCache, setGrammarQuestionsCache] = useState({});
    const [expandedErrorGroup, setExpandedErrorGroup] = useState(null);
    const [expandedErrorChild, setExpandedErrorChild] = useState(null);

    // Skill Report
    const [skillData, setSkillData] = useState(null);
    const [aiReport, setAiReport] = useState(null);
    const [reportText, setReportText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [reports, setReports] = useState([]);
    const [viewingReport, setViewingReport] = useState(null);
    const [editingReportId, setEditingReportId] = useState(null);

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'primary' });

    // Red Flag state
    const [redFlags, setRedFlags] = useState([]);
    const [showRedFlagModal, setShowRedFlagModal] = useState(false);
    const [redFlagForm, setRedFlagForm] = useState({ violationType: '', note: '' });
    const [violationDropdownOpen, setViolationDropdownOpen] = useState(false);
    const [redFlagLoading, setRedFlagLoading] = useState(false);
    const [redFlagViewIndex, setRedFlagViewIndex] = useState(null);
    const [removingFlagId, setRemovingFlagId] = useState(null);
    const [removeReasonText, setRemoveReasonText] = useState('');
    const [filteredRedFlags, setFilteredRedFlags] = useState([]);

    // Toast notification
    const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
    function showToast(message, type = 'success') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }

    useEffect(() => {
        loadAllData();
    }, [groupId, studentId]);

    async function loadAllData() {
        setLoading(true);
        try {
            const [grp, stds, tps, flds, asgns] = await Promise.all([
                getGroupById(groupId),
                getStudentsInGroup(groupId),
                getAdminTopics(),
                getFolders(),
                getAssignmentsForGroup(groupId),
            ]);

            const studentData = stds.find(s => s.uid === studentId);
            if (!studentData || !grp) { setLoading(false); return; }

            // Load grammar exercises
            let finalGrammar = [];
            try {
                const myGrammar = isAdminView ? await getGrammarExercises() : (user?.uid ? await getGrammarExercises(user.uid) : []);
                const publicGrammar = isAdminView ? [] : await getSharedAndPublicGrammarExercises(grp.grammarAccess || []);
                const map = new Map();
                myGrammar.forEach(g => map.set(g.id, g));
                publicGrammar.forEach(g => map.set(g.id, g));
                finalGrammar = Array.from(map.values());
            } catch (e) { console.error(e); }

            // Load exams
            let examAsgns = [];
            let allExamsList = [];
            try {
                const [teacherExams, adminExams, sharedExams, groupExamAsgns] = await Promise.all([
                    getExams('teacher'),
                    getExams('admin'),
                    getSharedExams(user?.mergedExamAccess || user?.examAccess || []),
                    getExamAssignmentsForGroup(groupId).catch(() => [])
                ]);
                examAsgns = groupExamAsgns;
                const map = new Map();
                [...teacherExams, ...adminExams].forEach(e => map.set(e.id, e));
                sharedExams.forEach(e => { if (!map.has(e.id)) map.set(e.id, e); });
                allExamsList = Array.from(map.values());
            } catch (e) { console.error(e); }

            setGroup(grp);
            setStudent(studentData);
            setTopics(tps);
            setFolders(flds);
            setAssignments(asgns);
            setGrammarExercises(finalGrammar);
            setExamAssignments(examAsgns);
            setAllExams(allExamsList);

            // Load student stats
            const stats = await getUserLearningStats(studentId);
            setStudentStats(stats);

            // Load existing reports
            const existingReports = await getSkillReports(groupId, studentId);
            setReports(existingReports);

            // Load red flags for student in this group
            try {
                const flags = await getRedFlagsForStudentInGroup(studentId, groupId);
                setRedFlags(flags);
            } catch (e) { console.error('Error loading red flags:', e); }

            // Load active report period + all period labels
            try {
                const [period, allPeriods] = await Promise.all([
                    getActiveReportPeriod(),
                    getAllReportPeriods()
                ]);
                if (period) {
                    setActiveReportPeriod(period);
                    // Auto-select report period as default filter (skip if report already sent)
                    const periodAlreadySent = existingReports.some(r => r.periodId === period.id && r.status === 'sent');
                    if (period.dataStartDate && period.dataEndDate && !periodAlreadySent) {
                        setIsPeriodFilter(true);
                        setProgressFilter('custom');
                        setProgressStartDate(period.dataStartDate);
                        setProgressEndDate(period.dataEndDate);
                    }
                }
                // Build periodId → label map
                const map = {};
                allPeriods.forEach(p => { map[p.id] = p.label; });
                setPeriodLabelMap(map);
            } catch (e) { console.error('Error loading active period:', e); }

            // Trigger initial progress load with current filter
            setLoading(false);
            loadFilteredProgress(asgns, examAsgns, tps, grp);
            return;

        } catch (error) {
            console.error('Error loading student data:', error);
        }
        setLoading(false);
    }

    // Re-load progress when filter changes
    useEffect(() => {
        if (!loading && assignments.length > 0 || examAssignments.length > 0) {
            loadFilteredProgress();
        }
    }, [progressFilter, progressStartDate, progressEndDate]);

    // Load progress data based on filter
    async function loadFilteredProgress(currentAssignments, currentExamAssignments, currentTopics, currentGroup) {
        const asgns = currentAssignments || assignments;
        const examAsgns = currentExamAssignments || examAssignments;
        const tps = currentTopics || topics;
        const grp = currentGroup || group;
        if (!asgns.length && !examAsgns.length) return;

        setProgressLoading(true);
        setExpandedTopicId(null);
        try {
            // Compute date range from filter
            let filterRange = null;
            if (progressFilter === 'custom') {
                if (progressStartDate || progressEndDate) {
                    filterRange = {
                        start: progressStartDate ? new Date(progressStartDate) : new Date(0),
                        end: progressEndDate ? new Date(progressEndDate + 'T23:59:59') : new Date(),
                    };
                }
            } else if (progressFilter !== 'all') {
                filterRange = getFilterDateRange(progressFilter);
            }

            // Helper to check if assignment's deadline is in the filter range
            const isInRange = (a) => {
                if (!filterRange) return true;
                const dl = a.dueDate;
                if (!dl) return true; // no deadline = always show
                const dlDate = dl.toDate ? dl.toDate() : new Date(dl);
                return dlDate >= filterRange.start && dlDate <= filterRange.end;
            };

            // Filter vocab assignments by deadline, then load progress
            const filteredVocabAssignments = asgns.filter(a => !a.isGrammar).filter(isInRange);
            const vocabTopicIdsFromAssignments = filteredVocabAssignments.map(a => a.topicId);
            const accessibleTopicIds = filterRange ? [] : tps.filter(t => grp?.folderAccess?.includes(t.folderId)).map(t => t.id);
            const allVocabIds = [...new Set([...accessibleTopicIds, ...vocabTopicIdsFromAssignments])];
            if (allVocabIds.length > 0) {
                const prog = await getStudentTopicProgressSummary(studentId, allVocabIds);
                setStudentTopicProgress(prog);
            } else {
                setStudentTopicProgress({});
            }

            // Filter grammar assignments by deadline, then load progress
            const filteredGrammarAssignments = asgns.filter(a => a.isGrammar).filter(isInRange);
            const grammarIds = filteredGrammarAssignments.map(a => a.topicId);
            if (grammarIds.length > 0) {
                const gProg = await getStudentGrammarProgressSummary(studentId, grammarIds);
                setStudentGrammarProgress(gProg);
            } else {
                setStudentGrammarProgress({});
            }

            // Load submissions for ALL exam assignments (not filtered by range,
            // because the UI groups by deadline, not creation date)
            if (examAsgns.length > 0) {
                const allSubs = await getExamSubmissionsForAssignments(examAsgns.map(a => a.id));
                const studentSubs = allSubs.filter(s => s.studentId === studentId);
                // Deduplicate: keep only the latest submission per assignment
                const latestMap = new Map();
                studentSubs.forEach(sub => {
                    const existing = latestMap.get(sub.assignmentId);
                    if (!existing) {
                        latestMap.set(sub.assignmentId, sub);
                    } else {
                        const existingTime = existing.updatedAt?.toMillis?.() || existing.createdAt?.toMillis?.() || 0;
                        const newTime = sub.updatedAt?.toMillis?.() || sub.createdAt?.toMillis?.() || 0;
                        if (newTime > existingTime) latestMap.set(sub.assignmentId, sub);
                    }
                });
                setStudentExamSubmissions(Array.from(latestMap.values()));
            } else {
                setStudentExamSubmissions([]);
            }

            // Load red flags for the selected date range
            try {
                const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const startStr = filterRange ? toLocalDateStr(filterRange.start) : '';
                const endStr = filterRange ? toLocalDateStr(filterRange.end) : '';
                const flags = await getRedFlagsForStudentInGroupByDateRange(studentId, grp?.id || groupId, startStr, endStr);
                setFilteredRedFlags(flags);
            } catch (e) {
                console.error('Error loading red flags:', e);
                setFilteredRedFlags([]);
            }
        } catch (error) {
            console.error('Error loading filtered progress:', error);
        }
        setProgressLoading(false);
    }

    async function toggleTopicDetail(topicId, isGrammar = false) {
        if (expandedTopicId === topicId) {
            setExpandedTopicId(null);
            return;
        }
        setExpandedTopicId(topicId);
        if (isGrammar) {
            if (!grammarQuestionsCache[topicId]) {
                try {
                    const questions = await getStudentGrammarQuestionsProgress(studentId, topicId);
                    setGrammarQuestionsCache(prev => ({ ...prev, [topicId]: questions }));
                } catch (e) { console.error(e); }
            }
        } else {
            if (!topicWordsCache[topicId]) {
                try {
                    const words = await getStudentTopicWordsProgress(studentId, topicId);
                    setTopicWordsCache(prev => ({ ...prev, [topicId]: words }));
                } catch (e) { console.error(e); }
            }
        }
    }

    async function handleGenerateReport() {
        setIsAnalyzing(true);
        setSkillData(null);
        setAiReport(null);
        setReportText('');

        try {
            // Step 1: Analyze skills
            const vocabTopicIds = assignments.filter(a => !a.isGrammar).map(a => a.topicId);
            const grammarExIds = assignments.filter(a => a.isGrammar).map(a => a.topicId);

            // Only include exam assignments whose deadline has expired
            const reportEndDate = currentFilterEndDate ? new Date(currentFilterEndDate + 'T23:59:59') : new Date();
            const expiredExamAsgns = examAssignments.filter(a => {
                const studentDl = a.studentDeadlines?.[studentId];
                const effectiveDl = studentDl || a.dueDate;
                if (!effectiveDl) return true; // no deadline = always count
                const dlMs = effectiveDl.toMillis ? effectiveDl.toMillis() : (effectiveDl.seconds ? effectiveDl.seconds * 1000 : new Date(effectiveDl).getTime());
                return dlMs <= reportEndDate.getTime();
            });
            const examAsgIds = expiredExamAsgns.map(a => a.id);

            const analysis = await analyzeStudentSkills(studentId, {
                startDate: currentFilterStartDate || undefined,
                endDate: currentFilterEndDate || undefined,
                topicIds: vocabTopicIds,
                grammarExerciseIds: grammarExIds,
                examAssignmentIds: examAsgIds,
            });
            setSkillData(analysis);
            setIsAnalyzing(false);

            // Step 2: Fetch red flags for the report period
            const reportRedFlags = await getRedFlagsForStudentInGroupByDateRange(
                studentId, groupId, currentFilterStartDate, currentFilterEndDate
            );

            // Step 3: Generate AI report
            setIsGenerating(true);
            const latestSentReport = reports.find(r => r.status === 'sent' && r.aiReport);
            const report = await generateSkillReport(
                student?.displayName || student?.email || 'Học viên',
                analysis,
                {
                    teacherName: user?.displayName || 'Giáo viên',
                    groupName: group?.name || '',
                    startDate: currentFilterStartDate,
                    endDate: currentFilterEndDate,
                    previousReport: latestSentReport?.aiReport || null,
                    redFlags: reportRedFlags,
                }
            );
            setAiReport(report);
            setReportText(report.detailedReport || report.summary || '');
        } catch (error) {
            console.error('Error generating report:', error);
            showToast('Lỗi: ' + error.message, 'error');
        }
        setIsAnalyzing(false);
        setIsGenerating(false);
    }

    async function handleSaveAndSend() {
        if (!reportText.trim()) return;
        setIsSending(true);
        try {
            const reportId = await saveSkillReport({
                ...(editingReportId ? { id: editingReportId } : {}),
                studentId,
                groupId,
                teacherId: user?.uid,
                startDate: currentFilterStartDate || null,
                endDate: currentFilterEndDate || null,
                ...(isPeriodFilter && activeReportPeriod ? { periodId: activeReportPeriod.id, periodLabel: activeReportPeriod.label || 'Kỳ báo cáo' } : {}),
                ...(skillData ? { skillData } : {}),
                ...(aiReport ? { aiReport } : {}),
                redFlagsSummary: filteredRedFlags.filter(f => !f.removed).map(f => ({
                    violationType: f.violationType,
                    violationLabel: f.violationLabel || f.violationType,
                    note: f.note || '',
                })),
                finalReport: reportText,
                status: 'sent',
            });

            await sendSkillReport(reportId, {
                studentId,
                studentName: student?.displayName || student?.email,
                teacherName: user?.displayName || 'Giáo viên',
                groupName: group?.name || '',
            });

            // Refresh reports
            const updated = await getSkillReports(groupId, studentId);
            setReports(updated);
            setSkillData(null);
            setAiReport(null);
            setReportText('');
            setEditingReportId(null);
            showToast('Đã gửi báo cáo cho học viên thành công!');
        } catch (error) {
            console.error('Error sending report:', error);
            showToast('Lỗi: ' + error.message, 'error');
        }
        setIsSending(false);
    }

    async function handleSaveDraft() {
        if (!reportText.trim()) return;
        setIsSending(true);
        try {
            await saveSkillReport({
                ...(editingReportId ? { id: editingReportId } : {}),
                studentId,
                groupId,
                teacherId: user?.uid,
                startDate: currentFilterStartDate || null,
                endDate: currentFilterEndDate || null,
                ...(isPeriodFilter && activeReportPeriod ? { periodId: activeReportPeriod.id, periodLabel: activeReportPeriod.label || 'Kỳ báo cáo' } : {}),
                ...(skillData ? { skillData } : {}),
                ...(aiReport ? { aiReport } : {}),
                redFlagsSummary: filteredRedFlags.filter(f => !f.removed).map(f => ({
                    violationType: f.violationType,
                    violationLabel: f.violationLabel || f.violationType,
                    note: f.note || '',
                })),
                finalReport: reportText,
                status: 'draft',
            });
            const updated = await getSkillReports(groupId, studentId);
            setReports(updated);
            showToast('Đã lưu bản nháp!');
        } catch (error) {
            showToast('Lỗi: ' + error.message, 'error');
        }
        setIsSending(false);
    }

    function handleLoadDraft(report) {
        if (editingReportId === report.id) {
            // Toggle off
            setEditingReportId(null);
            setReportText('');
            setAiReport(null);
            setSkillData(null);
            return;
        }
        setEditingReportId(report.id);
        setReportText(report.finalReport || report.aiReport?.detailedReport || '');
        setSkillData(report.skillData || null);
        setAiReport(report.aiReport || null);
        setViewingReport(null);
    }

    async function handleDeleteReport(reportId) {
        setConfirmModal({
            isOpen: true,
            title: 'Xóa báo cáo',
            message: 'Bạn có chắc muốn xóa báo cáo này?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await deleteSkillReport(reportId);
                    setReports(prev => prev.filter(r => r.id !== reportId));
                    if (viewingReport?.id === reportId) setViewingReport(null);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
            }
        });
    }

    // Radar chart data
    const radarData = skillData ? SKILL_ORDER.filter(key => skillData.skills[key]).map(key => ({
        skill: SKILL_LABELS[key] || key,
        score: skillData.skills[key].score ?? 0,
        fullMark: 100,
    })) : [];

    const backUrl = isAdminView ? `/admin/groups/${groupId}` : `/teacher/groups/${groupId}`;

    if (loading) {
        return <div className="sp-page"><div className="sp-loading">Đang tải dữ liệu học viên...</div></div>;
    }

    if (!student || !group) {
        return <div className="sp-page"><div className="sp-loading">Không tìm thấy học viên hoặc nhóm.</div></div>;
    }

    return (
        <div className="sp-page">
            <button onClick={() => navigate(-1)} className="sp-back-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={16} /> Quay lại {group.name}
            </button>

            <div className="sp-header">
                <h1>{student.displayName || student.email}</h1>
                <p>{group.name}</p>
            </div>

            {/* ═══ SKILL PROGRESSION CHART ═══ */}
            {(() => {
                const sentReports = reports.filter(r => r.status === 'sent' && r.skillData?.skills);
                if (sentReports.length < 1) return null;
                // Sort oldest first for chronological X-axis
                const sorted = [...sentReports].sort((a, b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
                    return tA - tB;
                });
                const SKILL_COLORS = { listening: '#6366f1', speaking: '#f59e0b', reading: '#10b981', writing: '#ef4444', grammar: '#8b5cf6', vocabulary: '#06b6d4' };
                const chartData = sorted.map(r => {
                    const label = r.endDate || formatDate(r.createdAt);
                    const row = { name: label };
                    SKILL_ORDER.forEach(key => {
                        if (r.skillData.skills[key]?.score !== null && r.skillData.skills[key]?.score !== undefined) {
                            row[key] = r.skillData.skills[key].score;
                        }
                    });
                    return row;
                });
                // Only show skills that appear in at least one report
                const activeSkills = SKILL_ORDER.filter(key => chartData.some(row => row[key] !== undefined));
                if (activeSkills.length === 0) return null;
                return (
                    <div className="sp-progression-card">
                        <div className="sp-report-summary-header">
                            <span>📈 Tiến triển kỹ năng qua các kỳ báo cáo</span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}
                                    formatter={(val, name) => [`${val}/100`, SKILL_LABELS[name] || name]}
                                />
                                <Legend formatter={(value) => SKILL_LABELS[value] || value} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 700 }} />
                                {activeSkills.map(key => (
                                    <Line key={key} type="monotone" dataKey={key} stroke={SKILL_COLORS[key]} strokeWidth={2.5}
                                        dot={{ r: 4, fill: SKILL_COLORS[key], strokeWidth: 0 }}
                                        activeDot={{ r: 6 }} connectNulls />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                );
            })()}

            {/* ═══ LATEST REPORT SUMMARY — WEAKNESS TRACKING ═══ */}
            {(() => {
                const sentReports = reports.filter(r => r.status === 'sent');
                const latest = sentReports[0];
                const previous = sentReports[1];
                if (!latest?.aiReport) return null;

                const { strengths, weaknesses } = latest.aiReport;
                if ((!strengths || strengths.length === 0) && (!weaknesses || weaknesses.length === 0)) return null;

                const dateLabel = latest.startDate && latest.endDate
                    ? `${latest.startDate} → ${latest.endDate}`
                    : formatDate(latest.createdAt);

                // Classify weaknesses across reports
                const prevWeaknesses = previous?.aiReport?.weaknesses || [];
                const persistentW = [];
                const newW = [];
                const improvedW = [];

                (weaknesses || []).forEach(w => {
                    const wLower = w.toLowerCase();
                    const isPersistent = prevWeaknesses.some(pw => {
                        const pwLower = pw.toLowerCase();
                        // Match if same text or significant word overlap
                        return pwLower === wLower || wLower.includes(pwLower.slice(0, 15)) || pwLower.includes(wLower.slice(0, 15));
                    });
                    if (isPersistent && previous) persistentW.push(w);
                    else newW.push(w);
                });

                if (previous) {
                    prevWeaknesses.forEach(pw => {
                        const pwLower = pw.toLowerCase();
                        const stillExists = (weaknesses || []).some(w => {
                            const wLower = w.toLowerCase();
                            return wLower === pwLower || wLower.includes(pwLower.slice(0, 15)) || pwLower.includes(wLower.slice(0, 15));
                        });
                        if (!stillExists) improvedW.push(pw);
                    });
                }

                // Error category breakdown from latest report's skillData
                const ERROR_CAT_LABELS = {
                    verb_tense: 'Thì động từ', article: 'Mạo từ', preposition: 'Giới từ',
                    word_form: 'Dạng từ', subject_verb_agreement: 'Hòa hợp chủ-vị',
                    pronoun: 'Đại từ', conjunction: 'Liên từ', comparison: 'So sánh',
                    passive_voice: 'Câu bị động', conditional: 'Câu điều kiện',
                    modal_verb: 'Động từ khiếm khuyết', relative_clause: 'Mệnh đề quan hệ',
                    reported_speech: 'Câu tường thuật', gerund_infinitive: 'V-ing / To V',
                    quantifier: 'Lượng từ', grammar_sentence_structure: 'Cấu trúc câu',
                    listening_detail: 'Nghe chi tiết', listening_main_idea: 'Nghe ý chính',
                    listening_inference: 'Nghe suy luận', listening_purpose_attitude: 'Nghe mục đích & thái độ',
                    pronunciation_sounds: 'Phát âm', pronunciation_stress_intonation: 'Trọng âm & Ngữ điệu',
                    fluency: 'Độ lưu loát', speaking_interaction: 'Tương tác giao tiếp',
                    reading_detail: 'Đọc chi tiết', reading_main_idea: 'Đọc ý chính',
                    reading_inference: 'Đọc suy luận', reading_context_vocab: 'Đoán từ qua ngữ cảnh',
                    writing_structure: 'Cấu trúc viết', writing_coherence: 'Tính mạch lạc',
                    writing_task_response: 'Đáp ứng yêu cầu đề', writing_punctuation: 'Dấu câu & Viết hoa',
                    vocabulary_meaning: 'Nghĩa từ', vocabulary_usage: 'Cách dùng từ',
                    vocabulary_collocation: 'Kết hợp từ', vocabulary_spelling: 'Chính tả',
                    vocabulary_idiom_phrasal: 'Thành ngữ & Cụm động từ',
                };
                const errorBreakdown = latest.skillData?.errorCategoryBreakdown || [];

                return (
                    <div className="sp-report-summary-card">
                        <div className="sp-report-summary-header">
                            <span>📋 Phân tích năng lực học viên</span>
                            <span className="sp-report-summary-date">{dateLabel}</span>
                        </div>
                        <div className="sp-report-summary-body">
                            {strengths && strengths.length > 0 && (
                                <div className="sp-report-summary-section">
                                    <div className="sp-report-summary-label strength">💪 Điểm mạnh</div>
                                    <ul className="sp-report-summary-list">
                                        {strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            )}

                            {persistentW.length > 0 && (
                                <div className="sp-report-summary-section">
                                    <div className="sp-report-summary-label" style={{ color: '#dc2626' }}>🔴 Vẫn cần cải thiện</div>
                                    <ul className="sp-report-summary-list">
                                        {persistentW.map((w, i) => <li key={i} style={{ color: '#dc2626', fontWeight: 600 }}>{w}</li>)}
                                    </ul>
                                </div>
                            )}

                            {improvedW.length > 0 && (
                                <div className="sp-report-summary-section">
                                    <div className="sp-report-summary-label" style={{ color: '#16a34a' }}>🟢 Đã cải thiện</div>
                                    <ul className="sp-report-summary-list">
                                        {improvedW.map((w, i) => <li key={i} style={{ color: '#16a34a', textDecoration: 'line-through', opacity: 0.7 }}>{w}</li>)}
                                    </ul>
                                </div>
                            )}

                            {newW.length > 0 && (
                                <div className="sp-report-summary-section">
                                    <div className="sp-report-summary-label" style={{ color: previous ? '#ca8a04' : '#ef4444' }}>
                                        {previous ? '🟡 Mới phát hiện' : '⚡ Cần cải thiện'}
                                    </div>
                                    <ul className="sp-report-summary-list">
                                        {newW.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            )}

                            {errorBreakdown.length > 0 && (() => {
                                // Parent-child mapping
                                const PARENT_GROUPS = {
                                    grammar_verbs: { label: '📝 Ngữ pháp: Động từ', children: ['verb_tense', 'subject_verb_agreement', 'modal_verb', 'gerund_infinitive', 'passive_voice'] },
                                    grammar_parts: { label: '📝 Ngữ pháp: Từ loại', children: ['word_form', 'article', 'pronoun', 'quantifier', 'preposition'] },
                                    grammar_structures: { label: '📝 Ngữ pháp: Cấu trúc câu', children: ['conjunction', 'relative_clause', 'conditional', 'reported_speech', 'comparison', 'grammar_sentence_structure'] },
                                    speaking: { label: '🗣️ Nói', children: ['pronunciation_sounds', 'pronunciation_stress_intonation', 'fluency', 'speaking_interaction'] },
                                    listening: { label: '🎧 Nghe', children: ['listening_detail', 'listening_main_idea', 'listening_inference', 'listening_purpose_attitude'] },
                                    reading: { label: '📖 Đọc', children: ['reading_detail', 'reading_main_idea', 'reading_inference', 'reading_context_vocab'] },
                                    writing: { label: '✍️ Viết', children: ['writing_structure', 'writing_coherence', 'writing_task_response', 'writing_punctuation'] },
                                    vocabulary: { label: '📚 Từ vựng', children: ['vocabulary_meaning', 'vocabulary_usage', 'vocabulary_collocation', 'vocabulary_spelling', 'vocabulary_idiom_phrasal'] },
                                };

                                // Build category → data lookup
                                const catData = {};
                                errorBreakdown.forEach(item => { catData[item.category] = item; });

                                // Build parent groups with data
                                const feedbackSamples = latest.skillData?.aiFeedbackSamples || [];
                                const parentEntries = Object.entries(PARENT_GROUPS).map(([key, group]) => {
                                    const childrenWithData = group.children.filter(c => catData[c]);
                                    if (childrenWithData.length === 0) return null;
                                    const totalEarned = childrenWithData.reduce((s, c) => s + (catData[c].accuracy * catData[c].totalAttempts), 0);
                                    const totalAttempts = childrenWithData.reduce((s, c) => s + catData[c].totalAttempts, 0);
                                    const avgAccuracy = totalAttempts > 0 ? Math.round(totalEarned / totalAttempts) : 0;
                                    return { key, ...group, childrenWithData, avgAccuracy, totalAttempts };
                                }).filter(Boolean).sort((a, b) => a.avgAccuracy - b.avgAccuracy);

                                // Find notes matching a category
                                const getNotesForCategory = (cat) => feedbackSamples.filter(s =>
                                    s.errorCategory === cat || (s.detectedErrors && s.detectedErrors.includes(cat))
                                );

                                const barColor = pct => pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

                                return (
                                    <div className="sp-report-summary-section" style={{ marginTop: '8px' }}>
                                        <div className="sp-report-summary-label" style={{ color: '#6366f1' }}>📊 Phân tích lỗi theo dạng bài</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {parentEntries.map(parent => {
                                                const isOpen = expandedErrorGroup === parent.key;
                                                const pct = parent.avgAccuracy;
                                                return (
                                                    <div key={parent.key}>
                                                        {/* Parent bar */}
                                                        <div onClick={() => { setExpandedErrorGroup(isOpen ? null : parent.key); setExpandedErrorChild(null); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 0', borderRadius: '6px' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', minWidth: '160px', flexShrink: 0 }}>
                                                                {isOpen ? '▼' : '▶'} {parent.label}
                                                            </span>
                                                            <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${pct}%`, height: '100%', background: barColor(pct), borderRadius: '4px', transition: 'width 0.3s' }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: barColor(pct), minWidth: '35px', textAlign: 'right' }}>{pct}%</span>
                                                        </div>
                                                        {/* Children */}
                                                        {isOpen && (
                                                            <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                                                                {parent.childrenWithData.map(childKey => {
                                                                    const cd = catData[childKey];
                                                                    const childPct = cd.accuracy;
                                                                    const notes = getNotesForCategory(childKey);
                                                                    const isChildOpen = expandedErrorChild === childKey;
                                                                    return (
                                                                        <div key={childKey}>
                                                                            <div onClick={() => notes.length > 0 ? setExpandedErrorChild(isChildOpen ? null : childKey) : null}
                                                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: notes.length > 0 ? 'pointer' : 'default' }}>
                                                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', minWidth: '140px', flexShrink: 0 }}>
                                                                                    {notes.length > 0 ? (isChildOpen ? '▼' : '▶') : '•'} {ERROR_CAT_LABELS[childKey] || childKey}
                                                                                </span>
                                                                                <div style={{ flex: 1, height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                                                    <div style={{ width: `${childPct}%`, height: '100%', background: barColor(childPct), borderRadius: '3px' }} />
                                                                                </div>
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: barColor(childPct), minWidth: '35px', textAlign: 'right' }}>{childPct}%</span>
                                                                            </div>
                                                                            {/* TeacherNotes */}
                                                                            {isChildOpen && notes.length > 0 && (
                                                                                <div style={{ paddingLeft: '16px', marginBottom: '4px' }}>
                                                                                    {notes.slice(0, 3).map((n, ni) => (
                                                                                        <div key={ni} style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', padding: '2px 0', lineHeight: 1.4 }}>
                                                                                            💬 "{n.note}" <span style={{ color: '#94a3b8', fontStyle: 'normal' }}>— {n.score}/{n.maxScore}đ</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                );
            })()}

            {/* ═══ DETAILED PROGRESS WITH TIME FILTER ═══ */}
            {(assignments.length > 0 || examAssignments.length > 0) ? (
                <div style={{ marginBottom: '20px' }}>
                    <div className="sp-section-header">
                        <BarChart3 size={18} color="#16a34a" /> Tiến độ chi tiết
                    </div>

                    {/* Time Filter Bar */}
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                        Lọc dữ liệu theo thời hạn:
                    </div>
                    <div className="sp-time-filter-bar">
                        {activeReportPeriod && activeReportPeriod.dataStartDate && activeReportPeriod.dataEndDate && (() => {
                            // Hide period filter if a report for this period was already sent
                            const periodReportSent = reports.some(r => r.periodId === activeReportPeriod.id && r.status === 'sent');
                            if (periodReportSent) return null;
                            return (
                                <button
                                    className={`sp-filter-btn${isPeriodFilter ? ' active' : ''}`}
                                    onClick={() => {
                                        if (isPeriodFilter) {
                                            setIsPeriodFilter(false);
                                            setProgressFilter('7_days');
                                        } else {
                                            setIsPeriodFilter(true);
                                            setProgressFilter('custom');
                                            setProgressStartDate(activeReportPeriod.dataStartDate);
                                            setProgressEndDate(activeReportPeriod.dataEndDate);
                                        }
                                    }}
                                    style={isPeriodFilter ? {
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: 'white',
                                        border: '2px solid #6366f1',
                                        fontWeight: 800,
                                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                                        position: 'relative'
                                    } : {
                                        background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)',
                                        color: '#4f46e5',
                                        border: '2px solid #a5b4fc',
                                        fontWeight: 700,
                                        position: 'relative'
                                    }}
                                >
                                    📋 {activeReportPeriod.label || 'Kỳ báo cáo'}
                                </button>
                            );
                        })()}
                        {PROGRESS_FILTERS.map(f => (
                            <button
                                key={f.key}
                                className={`sp-filter-btn${progressFilter === f.key && !isPeriodFilter ? ' active' : ''}`}
                                onClick={() => {
                                    setIsPeriodFilter(false);
                                    setProgressFilter(f.key);
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {isPeriodFilter && activeReportPeriod && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                            background: '#ede9fe', borderRadius: '10px', fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600,
                            margin: '8px 0'
                        }}>
                            📋 Báo cáo tạo với bộ lọc này sẽ được tính cho kỳ "{activeReportPeriod.label}"
                            <span style={{ color: '#6366f1', fontWeight: 800 }}>({activeReportPeriod.dataStartDate} → {activeReportPeriod.dataEndDate})</span>
                        </div>
                    )}
                    {progressFilter === 'custom' && (
                        <div className="sp-custom-date-row">
                            <Calendar size={14} color="#64748b" />
                            <input type="date" className="sp-date-input" value={progressStartDate} onChange={e => setProgressStartDate(e.target.value)} />
                            <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem' }}>→</span>
                            <input type="date" className="sp-date-input" value={progressEndDate} onChange={e => setProgressEndDate(e.target.value)} />
                        </div>
                    )}

                    {/* Loading indicator */}
                    {progressLoading && (
                        <div className="sp-loading" style={{ padding: '20px' }}>
                            <Loader size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Đang tải dữ liệu...
                        </div>
                    )}

                    {/* Red Flag Summary for selected period */}
                    {!progressLoading && (() => {
                        const activeCount = redFlags.filter(f => !f.removed).length;
                        const activeInPeriod = filteredRedFlags.filter(f => !f.removed);
                        const removedInPeriod = filteredRedFlags.filter(f => f.removed);
                        return (
                            <div style={{
                                padding: '12px 18px', borderRadius: '14px', marginBottom: '16px',
                                background: activeInPeriod.length > 0 ? 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)' : 'var(--bg-secondary)',
                                border: `1.5px solid ${activeInPeriod.length > 0 ? '#fecaca' : 'var(--border-color)'}`,
                                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
                            }}>
                                {/* 3 flag icons */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {[1, 2, 3].map(i => {
                                        const isFilled = i <= activeCount;
                                        const isNext = i === activeCount + 1 && activeCount < 3;
                                        const flagColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                        return (
                                            <span
                                                key={i}
                                                onClick={() => {
                                                    if (isFilled) {
                                                        setRedFlagViewIndex(i);
                                                    } else if (isNext && !isStaff) {
                                                        setShowRedFlagModal(true);
                                                        setRedFlagForm({ violationType: '', note: '' });
                                                    }
                                                }}
                                                style={{
                                                    width: '30px', height: '30px', borderRadius: '9px',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.9rem',
                                                    background: isFilled ? (i >= 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'transparent',
                                                    border: isFilled ? `1.5px solid ${flagColor}40` : '1.5px solid var(--border-color)',
                                                    cursor: (isFilled || (isNext && !isStaff)) ? 'pointer' : 'default',
                                                    opacity: isFilled ? 1 : 0.3,
                                                    transition: 'all 0.2s',
                                                    filter: !isFilled ? 'grayscale(1)' : 'none'
                                                }}
                                                title={isFilled ? `Xem cờ đỏ lần ${i}` : isNext ? `Đánh cờ đỏ lần ${i}` : `Cờ đỏ lần ${i}`}
                                            >
                                                🚩
                                            </span>
                                        );
                                    })}
                                </div>
                                {/* Info text */}
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    {activeCount >= 3 ? (
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>
                                            Không còn đảm bảo đầu ra
                                            {activeInPeriod.length > 0 && <span style={{ fontWeight: 600, fontSize: '0.75rem' }}> • {activeInPeriod.length} cờ mới trong giai đoạn</span>}
                                        </div>
                                    ) : activeCount > 0 ? (
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: activeInPeriod.length > 0 ? '#dc2626' : '#ca8a04', marginBottom: activeInPeriod.length > 0 ? '4px' : '0' }}>
                                                Tổng: {activeCount} cờ đỏ{activeInPeriod.length > 0 ? ` • ${activeInPeriod.length} cờ mới trong giai đoạn` : ' • Không có cờ mới trong giai đoạn này'}
                                            </div>
                                            {activeInPeriod.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {activeInPeriod.map(f => (
                                                        <span key={f.id} style={{
                                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                                                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                                                        }}>
                                                            {f.violationLabel || f.violationType}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                                            Chưa có cờ đỏ nào
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {!progressLoading && studentTopicProgress && Object.keys(studentTopicProgress).length === 0 && studentGrammarProgress && Object.keys(studentGrammarProgress).length === 0 && studentExamSubmissions.length === 0 && (
                        <div className="sp-loading" style={{ padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>Không có dữ liệu trong khoảng thời gian này.</div>
                    )}

                    {/* ═══ VOCAB PROGRESS ═══ */}
                    {!progressLoading && studentTopicProgress && Object.keys(studentTopicProgress).length > 0 && (() => {
                        const topicsToShow = Object.keys(studentTopicProgress)
                            .map(tId => topics.find(t => t.id === tId) || { id: tId, name: assignments.find(a => a.topicId === tId)?.topicName || 'Unknown', folderId: 'unassigned' })
                            .filter(Boolean);

                        if (topicsToShow.length === 0) return null;

                        // Split by deadline
                        const filterEndDate = getDeadlineCheckDate();
                        const getTopicDl = (topicId) => {
                            const asg = assignments.find(x => x.topicId === topicId);
                            if (!asg) return null;
                            // Check student-specific deadline first
                            const studentDl = asg.studentDeadlines?.[studentId];
                            const effectiveDl = studentDl || asg.dueDate;
                            if (!effectiveDl) return null;
                            return effectiveDl.toMillis ? effectiveDl.toMillis() : (effectiveDl.seconds ? effectiveDl.seconds * 1000 : new Date(effectiveDl).getTime());
                        };
                        const expiredTopics = topicsToShow.filter(t => { const d = getTopicDl(t.id); return !d || d <= filterEndDate.getTime(); });
                        const inProgressTopics = topicsToShow.filter(t => { const d = getTopicDl(t.id); return d && d > filterEndDate.getTime(); });

                        const renderTopicCard = (topic) => {
                            const prog = studentTopicProgress[topic.id];
                            if (!prog) return null;
                            const { total, learned, learning, totalCorrect: tc, totalWrong: tw } = prog;
                            const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
                            const attempts = (tc ?? 0) + (tw ?? 0);
                            const errorRate = attempts > 0 ? Math.round(((tw ?? 0) / attempts) * 100) : 0;
                            const errStyle = getErrorStyle(errorRate);
                            return (
                                <div key={topic.id} className="sp-progress-card">
                                    <div className="sp-progress-card-header" onClick={() => toggleTopicDetail(topic.id)}>
                                        <div className="sp-card-top">
                                            <div className="sp-card-badges">
                                                <span className="sp-badge sp-badge-vocab">Từ vựng</span>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{topic.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {attempts > 0 && (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: errStyle.color, background: errStyle.bg, padding: '2px 8px', borderRadius: '8px' }}>
                                                        Sai: {errorRate}%
                                                    </span>
                                                )}
                                                <span style={{ fontWeight: 900, fontSize: '0.9rem', color: percent === 100 ? '#10b981' : '#f59e0b' }}>{percent}%</span>
                                            </div>
                                        </div>
                                        <div className="sp-progress-bar">
                                            <div className="sp-progress-bar-learned" style={{ width: `${(learned / total) * 100}%` }} />
                                            <div className="sp-progress-bar-learning" style={{ width: `${(learning / total) * 100}%` }} />
                                        </div>
                                        <div className="sp-progress-footer">
                                            <span>{learned}/{total} từ</span>
                                            <span>{expandedTopicId === topic.id ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                                        </div>
                                    </div>
                                    {expandedTopicId === topic.id && (
                                        <div className="sp-progress-card-expanded">
                                            {!topicWordsCache[topic.id] ? (
                                                <div className="sp-loading" style={{ padding: '12px' }}>Đang tải...</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {topicWordsCache[topic.id].map(w => {
                                                        let bg = '#f1f5f9', color = '#94a3b8';
                                                        if (w.progress) {
                                                            const wAttempts = (w.progress.correctCount || 0) + (w.progress.wrongCount || 0);
                                                            if (w.progress.learned) { bg = '#ecfdf5'; color = '#10b981'; }
                                                            else if (wAttempts > 0) { bg = '#fef3c7'; color = '#f59e0b'; }
                                                        }
                                                        return (
                                                            <span key={w.id} className="sp-word-chip" style={{ background: bg, color, border: `1px solid ${color}22`, fontWeight: 600, fontSize: '0.75rem' }}>
                                                                {w.word}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        const renderGroup = (topicList, listStyle = {}) => {
                            const grouped = {};
                            topicList.forEach(t => { const fId = t.folderId || 'unassigned'; if (!grouped[fId]) grouped[fId] = []; grouped[fId].push(t); });
                            return <div className="sp-progress-list" style={listStyle}>
                                {Object.entries(grouped).map(([folderId, folderTopics]) => {
                                    return folderTopics.sort((a, b) => {
                                        const aA = assignments.find(x => x.topicId === a.id);
                                        const bA = assignments.find(x => x.topicId === b.id);
                                        return (bA?.createdAt?.toMillis?.() || 0) - (aA?.createdAt?.toMillis?.() || 0);
                                    }).map(renderTopicCard);
                                })}
                            </div>;
                        };

                        return <>
                            {expiredTopics.length > 0 && <>
                                <div className="sp-section-label">
                                    📊 BÀI LUYỆN TỪ VỰNG — Được tính vào báo cáo
                                </div>
                                {renderGroup(expiredTopics)}
                            </>}
                            {inProgressTopics.length > 0 && <>
                                <div className="sp-section-label" style={{ marginTop: expiredTopics.length > 0 ? '20px' : 0 }}>
                                    ⏳ BÀI LUYỆN TỪ VỰNG — Đang diễn ra
                                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#f59e0b', marginLeft: '8px' }}>
                                        (Hạn làm bài nằm ngoài kỳ báo cáo)
                                    </span>
                                </div>
                                {renderGroup(inProgressTopics, { opacity: 0.5 })}
                            </>}
                        </>;
                    })()}

                    {/* ═══ GRAMMAR PROGRESS ═══ */}
                    {!progressLoading && studentGrammarProgress && Object.keys(studentGrammarProgress).length > 0 && (() => {
                        const entries = Object.entries(studentGrammarProgress);
                        if (entries.length === 0) return null;

                        // Split by deadline
                        const filterEndDate = getDeadlineCheckDate();
                        const getGrammarDl = (exId) => {
                            const asg = assignments.find(x => x.topicId === exId);
                            if (!asg) return null;
                            // Check student-specific deadline first
                            const studentDl = asg.studentDeadlines?.[studentId];
                            const effectiveDl = studentDl || asg.dueDate;
                            if (!effectiveDl) return null;
                            return effectiveDl.toMillis ? effectiveDl.toMillis() : (effectiveDl.seconds ? effectiveDl.seconds * 1000 : new Date(effectiveDl).getTime());
                        };
                        const expiredEntries = entries.filter(([exId]) => { const d = getGrammarDl(exId); return !d || d <= filterEndDate.getTime(); });
                        const inProgressEntries = entries.filter(([exId]) => { const d = getGrammarDl(exId); return d && d > filterEndDate.getTime(); });

                        const renderGrammarCard = ([exId, prog]) => {
                            const exercise = grammarExercises.find(e => e.id === exId);
                            const name = exercise?.name || assignments.find(a => a.topicId === exId)?.topicName || 'Bài luyện';
                            const { total, learned, learning } = prog;
                            const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
                            return (
                                <div key={exId} className="sp-progress-card">
                                    <div className="sp-progress-card-header" onClick={() => toggleTopicDetail(exId, true)}>
                                        <div className="sp-card-top">
                                            <div className="sp-card-badges">
                                                <span className="sp-badge sp-badge-grammar">KỸ NĂNG</span>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{name}</span>
                                            </div>
                                            <span style={{ fontWeight: 900, fontSize: '0.9rem', color: percent === 100 ? '#10b981' : '#f59e0b' }}>{percent}%</span>
                                        </div>
                                        <div className="sp-progress-bar">
                                            <div className="sp-progress-bar-learned" style={{ width: `${total > 0 ? (learned / total) * 100 : 0}%` }} />
                                            <div className="sp-progress-bar-learning" style={{ width: `${total > 0 ? (learning / total) * 100 : 0}%` }} />
                                        </div>
                                        <div className="sp-progress-footer">
                                            <span>{learned}/{total} câu</span>
                                            <span>{expandedTopicId === exId ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                                        </div>
                                    </div>
                                    {expandedTopicId === exId && (
                                        <div className="sp-progress-card-expanded">
                                            {!grammarQuestionsCache[exId] ? (
                                                <div className="sp-loading" style={{ padding: '12px' }}>Đang tải...</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {grammarQuestionsCache[exId].map((q, qIdx) => {
                                                        const pc = q.progress?.passCount ?? 0;
                                                        const fc = q.progress?.failCount ?? 0;
                                                        const totalAttempts = q.progress ? Math.max(fc + pc, 1) : 0;
                                                        const isLearned = q.progress && (q.progress.variationsPassed || []).length >= 1;
                                                        let color = '#94a3b8', bg = '#fff';
                                                        if (q.progress) {
                                                            if (totalAttempts <= 1) { color = '#16a34a'; bg = '#f0fdf4'; }
                                                            else if (totalAttempts <= 2) { color = '#ca8a04'; bg = '#fefce8'; }
                                                            else if (totalAttempts <= 3) { color = '#f97316'; bg = '#fff7ed'; }
                                                            else { color = '#ef4444'; bg = '#fef2f2'; }
                                                        }
                                                        return (
                                                            <div key={q.id} className="sp-grammar-detail" style={{ background: bg, color: '#1e293b', border: `1px solid ${bg === '#fff' ? '#f1f5f9' : 'transparent'}` }}>
                                                                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.3 }}>
                                                                    {q.sentence || q.originalSentence || `Câu ${qIdx + 1}`}
                                                                </span>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                                                                    {isLearned ? `Hoàn thành sau ${totalAttempts} lần` : (totalAttempts > 0 ? `Đã làm ${totalAttempts} lần` : 'Chưa làm')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        const sortEntries = (list) => [...list].sort(([aId], [bId]) => {
                            const aA = assignments.find(x => x.topicId === aId);
                            const bA = assignments.find(x => x.topicId === bId);
                            return (bA?.createdAt?.toMillis?.() || 0) - (aA?.createdAt?.toMillis?.() || 0);
                        });

                        return <>
                            {expiredEntries.length > 0 && <>
                                <div className="sp-section-label">
                                    📊 BÀI LUYỆN KỸ NĂNG — Được tính vào báo cáo
                                </div>
                                <div className="sp-progress-list">
                                    {sortEntries(expiredEntries).map(renderGrammarCard)}
                                </div>
                            </>}
                            {inProgressEntries.length > 0 && <>
                                <div className="sp-section-label" style={{ marginTop: expiredEntries.length > 0 ? '20px' : 0 }}>
                                    ⏳ BÀI LUYỆN KỸ NĂNG — Đang diễn ra
                                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#f59e0b', marginLeft: '8px' }}>
                                        (Hạn làm bài nằm ngoài kỳ báo cáo)
                                    </span>
                                </div>
                                <div className="sp-progress-list" style={{ opacity: 0.5 }}>
                                    {sortEntries(inProgressEntries).map(renderGrammarCard)}
                                </div>
                            </>}
                        </>;
                    })()}

                    {/* ═══ EXAM RESULTS ═══ */}
                    {!progressLoading && studentExamSubmissions !== null && examAssignments.length > 0 && (() => {
                        // An assignment is "done" if: deadline expired OR student has submitted/graded/released
                        const filterEndDate = getDeadlineCheckDate();
                        const getEffectiveDeadline = (a) => {
                            const dl = a.studentDeadlines?.[studentId] || a.dueDate;
                            if (!dl) return null;
                            return dl.toMillis ? dl.toMillis() : (dl.seconds ? dl.seconds * 1000 : new Date(dl).getTime());
                        };

                        // Filter exams: only show exams whose deadline falls within the selected filter range
                        const filterStart = currentFilterStartDate ? new Date(currentFilterStartDate).getTime() : null;
                        const filterEnd = currentFilterEndDate ? new Date(currentFilterEndDate + 'T23:59:59').getTime() : null;
                        const filteredExams = (filterStart && filterEnd) ? examAssignments.filter(a => {
                            const dlMs = getEffectiveDeadline(a);
                            if (!dlMs) return true; // no deadline = always show
                            return dlMs >= filterStart && dlMs <= filterEnd;
                        }) : examAssignments;

                        const DONE_STATUSES = ['submitted', 'graded', 'released'];
                        const isDone = (a) => {
                            const dlMs = getEffectiveDeadline(a);
                            const deadlineExpired = dlMs ? dlMs <= filterEndDate.getTime() : false;
                            const sub = studentExamSubmissions.find(s => s.assignmentId === a.id);
                            const subDone = sub && DONE_STATUSES.includes(sub.status);
                            return deadlineExpired || subDone;
                        };
                        const doneAsgns = filteredExams.filter(isDone);
                        const inProgressAsgns = filteredExams.filter(a => !isDone(a));

                        const renderExamCard = (a) => {
                            const sub = studentExamSubmissions.find(s => s.assignmentId === a.id);
                            const exam = allExams.find(e => e.id === a.examId);
                            const isTest = exam?.examType === 'test';
                            const statusMap = {
                                'in_progress': { label: 'Đang làm', color: '#f59e0b', bg: '#fef3c7' },
                                'submitted': { label: 'Đã nộp', color: '#3b82f6', bg: '#eff6ff' },
                                'graded': { label: 'AI đã chấm', color: '#10b981', bg: '#ecfdf4' },
                                'released': { label: 'Đã trả kết quả', color: '#7c3aed', bg: '#f5f3ff' }
                            };
                            const statusKey = sub ? (sub.status === 'graded' && sub.resultsReleased ? 'released' : sub.status) : 'none';
                            const subHasError = sub?.results && Object.values(sub.results).some(r => r.feedback && (r.feedback.includes('Lỗi khi chấm') || r.feedback.includes('chấm thủ công')));
                            let st = sub ? (statusMap[statusKey] || statusMap.submitted) : (() => {
                                const dlMs = getEffectiveDeadline(a);
                                const deadlinePassed = dlMs && dlMs <= Date.now();
                                return deadlinePassed
                                    ? { label: 'Không hoàn thành', color: '#ef4444', bg: '#fef2f2' }
                                    : { label: 'Chưa làm', color: '#94a3b8', bg: '#f8fafc' };
                            })();
                            if (subHasError && sub?.status === 'graded' && !sub?.resultsReleased) {
                                st = { label: 'AI chấm sót', color: '#ea580c', bg: '#fff7ed' };
                            }

                            return (
                                <div key={a.id} className="sp-progress-card" style={{ padding: '16px' }}>
                                    <div className="sp-card-top">
                                        <div className="sp-card-badges">
                                            <span className={`sp-badge ${isTest ? 'sp-badge-test' : 'sp-badge-homework'}`}>
                                                {isTest ? 'KIỂM TRA' : 'BÀI TẬP'}
                                            </span>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                                {exam?.name || a.examName}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {sub && sub.totalScore !== undefined && (
                                                <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#6366f1' }}>
                                                    {Math.round(sub.totalScore * 10) / 10}/{sub.maxTotalScore}
                                                </span>
                                            )}
                                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, color: st.color, background: st.bg }}>
                                                {st.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        if (doneAsgns.length === 0 && inProgressAsgns.length === 0) return null;

                        return <>
                            {doneAsgns.length > 0 && <>
                                <div className="sp-section-label">
                                    📊 BÀI TẬP & KIỂM TRA — Được tính vào báo cáo
                                </div>
                                <div className="sp-progress-list">
                                    {[...doneAsgns].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map(renderExamCard)}
                                </div>
                            </>}
                            {inProgressAsgns.length > 0 && <>
                                <div className="sp-section-label" style={{ marginTop: doneAsgns.length > 0 ? '20px' : 0 }}>
                                    ⏳ BÀI TẬP & KIỂM TRA — Đang diễn ra
                                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#f59e0b', marginLeft: '8px' }}>
                                        (Hạn làm bài nằm ngoài kỳ báo cáo)
                                    </span>
                                </div>
                                <div className="sp-progress-list" style={{ opacity: 0.5 }}>
                                    {[...inProgressAsgns].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map(renderExamCard)}
                                </div>
                            </>}
                        </>;
                    })()}

                </div>
            ) : null}

            {/* ═══════════════════════════════════════════════ */}
            {/* ═══ SKILL REPORT SECTION ═══ */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="sp-report-section">
                {/* Check for unreleased exam submissions */}
                {(() => {
                    const checkDate = getDeadlineCheckDate();
                    const getEffDl = (a) => {
                        const dl = a.studentDeadlines?.[studentId] || a.dueDate;
                        if (!dl) return null;
                        return dl.toMillis ? dl.toMillis() : (dl.seconds ? dl.seconds * 1000 : new Date(dl).getTime());
                    };
                    // Find exams with unreleased submissions (regardless of deadline)
                    const unreleasedExams = examAssignments.filter(a => {
                        const sub = studentExamSubmissions?.find(s => s.assignmentId === a.id);
                        if (!sub) return false; // no submission = OK
                        // submitted or graded but not released
                        return sub.status === 'submitted' || (sub.status === 'graded' && !sub.resultsReleased);
                    });
                    const hasUnreleased = unreleasedExams.length > 0;
                    const basePath = isAdminView ? '/admin' : '/teacher';

                    return <>
                        <div className="sp-report-header">
                            <h2><Sparkles size={20} color="#8b5cf6" /> Báo cáo kỹ năng</h2>
                            {!isStaff && (
                                <button className="sp-generate-btn primary" onClick={handleGenerateReport} disabled={isAnalyzing || isGenerating || hasUnreleased}>
                                    {isAnalyzing ? <><Loader size={16} className="animate-spin" /> Đang phân tích...</> :
                                        isGenerating ? <><Loader size={16} className="animate-spin" /> AI đang viết...</> :
                                            <><Sparkles size={16} /> Tạo báo cáo AI</>}
                                </button>
                            )}
                        </div>
                        {hasUnreleased && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                                background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', marginBottom: '12px',
                                lineHeight: 1.5
                            }}>
                                🚫 Không thể tạo báo cáo — {unreleasedExams.map((a, i) => {
                                    const exam = allExams.find(e => e.id === a.examId);
                                    const name = exam?.name || a.examName || a.examId;
                                    return <span key={a.id}>
                                        {i > 0 && ', '}
                                        <Link to={`${basePath}/exam-submissions/${a.id}/${studentId}`} style={{ color: '#991b1b', textDecoration: 'underline', fontWeight: 800 }}>
                                            {name}
                                        </Link>
                                    </span>;
                                })} chưa được trả kết quả. Bấm vào tên bài để chấm.
                            </div>
                        )}
                    </>;
                })()}
                {currentFilterStartDate && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '12px' }}>
                        📅 Dữ liệu từ {currentFilterStartDate} đến {currentFilterEndDate || 'nay'}
                    </div>
                )}

                {/* Warning: assignments with active deadlines */}
                {(() => {
                    const now = Date.now();
                    const getEffDl = (a) => {
                        const dl = a.studentDeadlines?.[studentId] || a.dueDate;
                        if (!dl) return null;
                        return dl.toMillis ? dl.toMillis() : (dl.seconds ? dl.seconds * 1000 : new Date(dl).getTime());
                    };
                    // Only warn about assignments whose deadline is:
                    // 1. Within the filter date range
                    // 2. Still in the future (not yet expired)
                    // 3. Student hasn't completed yet
                    const filterStart = currentFilterStartDate ? new Date(currentFilterStartDate).getTime() : null;
                    const filterEndMs = currentFilterEndDate ? new Date(currentFilterEndDate + 'T23:59:59').getTime() : null;
                    const isInFilterRange = (dlMs) => {
                        if (!filterStart || !filterEndMs) return true;
                        return dlMs >= filterStart && dlMs <= filterEndMs;
                    };
                    const DONE_STATUSES = ['submitted', 'graded', 'released'];
                    // Check regular assignments (vocab/grammar)
                    const activeRegular = assignments.filter(a => {
                        const dlMs = getEffDl(a);
                        if (!dlMs) return false;
                        // Must be within filter range and still in the future
                        if (!isInFilterRange(dlMs) || dlMs <= now) return false;
                        // Exclude if student already completed 100%
                        const vocabProg = studentTopicProgress?.[a.topicId];
                        if (vocabProg && vocabProg.total > 0 && vocabProg.learned >= vocabProg.total) return false;
                        const grammarProg = studentGrammarProgress?.[a.topicId];
                        if (grammarProg && grammarProg.total > 0 && grammarProg.learned >= grammarProg.total) return false;
                        return true;
                    });
                    // Check exam assignments
                    const activeExams = examAssignments.filter(a => {
                        const dlMs = getEffDl(a);
                        if (!dlMs) return false;
                        // Must be within filter range and still in the future
                        if (!isInFilterRange(dlMs) || dlMs <= now) return false;
                        // Exclude if student already submitted/graded/released
                        const sub = studentExamSubmissions?.find(s => s.assignmentId === a.id);
                        if (sub && DONE_STATUSES.includes(sub.status)) return false;
                        return true;
                    });
                    if (activeRegular.length === 0 && activeExams.length === 0) return null;
                    const basePath = isAdminView ? '/admin' : '/teacher';
                    const linkItems = [
                        ...activeRegular.map(a => {
                            const topic = topics.find(t => t.id === a.topicId);
                            const grammar = grammarExercises.find(e => e.id === a.topicId);
                            const name = topic?.name || grammar?.name || a.topicName || a.topicId;
                            return { id: a.id, name, to: `${basePath}/groups/${groupId}?tab=assignments` };
                        }),
                        ...activeExams.map(a => {
                            const exam = allExams.find(e => e.id === a.examId);
                            const name = exam?.name || a.examName || a.examId;
                            return { id: a.id, name, to: `${basePath}/groups/${groupId}?tab=exams` };
                        })
                    ];
                    return (
                        <div style={{
                            padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                            background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', marginBottom: '12px',
                            lineHeight: 1.5
                        }}>
                            ⚠️ Dữ liệu có thể chưa đầy đủ — deadline bài {linkItems.map((item, i) => (
                                <span key={item.id}>
                                    {i > 0 && ', '}
                                    <Link to={item.to} style={{ color: '#92400e', textDecoration: 'underline', fontWeight: 800 }}>
                                        {item.name}
                                    </Link>
                                </span>
                            ))} vẫn chưa hết hạn và sẽ không được tổng hợp vào báo cáo.
                        </div>
                    );
                })()}

                {/* ═══ RADAR CHART ═══ */}
                {skillData && !editingReportId && (
                    <>
                        <div className="sp-radar-container" style={{ marginTop: '20px' }}>
                            <h3>Biểu đồ kỹ năng</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                    <Radar name="Kỹ năng" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                                    <Tooltip formatter={(val) => [`${val}/100`, 'Điểm']} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Skill Score Cards */}
                        <div className="sp-skill-scores">
                            {SKILL_ORDER.filter(key => skillData.skills[key]).map(key => {
                                const val = skillData.skills[key];
                                return (
                                    <div key={key} className="sp-skill-card">
                                        <span className="sp-skill-card-emoji">{SKILL_EMOJIS[key]}</span>
                                        <div className="sp-skill-card-name">{SKILL_LABELS[key]}</div>
                                        <div className="sp-skill-card-score" style={{ color: getScoreColor(val.score) }}>
                                            {val.score !== null ? val.score : '—'}
                                        </div>
                                    </div>);
                            })}
                        </div>

                        {/* Strengths & Weaknesses */}
                        {(skillData.strengths.length > 0 || skillData.weaknesses.length > 0) && (
                            <div style={{ marginBottom: '16px' }}>
                                {skillData.strengths.length > 0 && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a' }}>💪 Điểm mạnh: </span>
                                        <div className="sp-ai-chips" style={{ display: 'inline-flex' }}>
                                            {skillData.strengths.map(s => (
                                                <span key={s} className="sp-chip sp-chip-strength">{SKILL_EMOJIS[s]} {SKILL_LABELS[s]}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {skillData.weaknesses.length > 0 && (
                                    <div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>⚡ Cần cải thiện: </span>
                                        <div className="sp-ai-chips" style={{ display: 'inline-flex' }}>
                                            {skillData.weaknesses.map(s => (
                                                <span key={s} className="sp-chip sp-chip-weakness">{SKILL_EMOJIS[s]} {SKILL_LABELS[s]}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Red flags in period */}
                                {filteredRedFlags.filter(f => !f.removed).length > 0 && (
                                    <div style={{ marginTop: '8px' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#dc2626' }}>🚩 Cờ đỏ ({filteredRedFlags.filter(f => !f.removed).length}): </span>
                                        <div className="sp-ai-chips" style={{ display: 'inline-flex' }}>
                                            {filteredRedFlags.filter(f => !f.removed).map(f => (
                                                <span key={f.id} style={{
                                                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                                                }}>
                                                    {f.violationLabel || f.violationType}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ═══ Skeleton loading while generating ═══ */}
                {(isAnalyzing || isGenerating) && (
                    <div className="sp-report-editor" style={{ opacity: 0.7 }}>
                        <div style={{ padding: '20px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Loader size={16} className="animate-spin" />
                                {isAnalyzing ? 'Đang phân tích dữ liệu kỹ năng...' : 'Đang viết báo cáo...'}
                            </div>
                            {/* Skeleton bars */}
                            {[
                                { w: '35%', h: '18px', mb: '16px' },  // Title
                                { w: '100%', h: '12px', mb: '8px' },  // Paragraph line
                                { w: '90%', h: '12px', mb: '20px' },  // Paragraph line
                                { w: '40%', h: '16px', mb: '12px' },  // Section title
                                { w: '100%', h: '12px', mb: '6px' },
                                { w: '85%', h: '12px', mb: '6px' },
                                { w: '95%', h: '12px', mb: '20px' },
                                { w: '40%', h: '16px', mb: '12px' },  // Section title
                                { w: '100%', h: '12px', mb: '6px' },
                                { w: '75%', h: '12px', mb: '6px' },
                                { w: '90%', h: '12px', mb: '20px' },
                                { w: '40%', h: '16px', mb: '12px' },  // Section title
                                { w: '100%', h: '12px', mb: '6px' },
                                { w: '80%', h: '12px', mb: '6px' },
                            ].map((bar, i) => (
                                <div key={i} style={{
                                    width: bar.w, height: bar.h, marginBottom: bar.mb,
                                    borderRadius: '6px', background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 1.5s infinite',
                                }} />
                            ))}
                        </div>
                        <style>{`
                            @keyframes shimmer {
                                0% { background-position: 200% 0; }
                                100% { background-position: -200% 0; }
                            }
                        `}</style>
                    </div>
                )}

                {/* ═══ AI Report / Editor (only for new AI-generated reports) ═══ */}
                {aiReport && !editingReportId && !isStaff && (
                    <div className="sp-report-editor">
                        {aiReport.summary && (
                            <div className="sp-ai-summary">
                                <p><strong>Tóm tắt:</strong> {aiReport.summary}</p>
                                {aiReport.overallLevel && (
                                    <p style={{ marginTop: '6px' }}><strong>Trình độ ước tính:</strong> {aiReport.overallLevel}</p>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>
                                Nội dung báo cáo (có thể chỉnh sửa):
                            </label>
                        </div>
                        <div className="sp-quill-wrapper">
                            <ReactQuill
                                theme="snow"
                                value={reportText}
                                onChange={setReportText}
                                modules={{
                                    toolbar: [
                                        [{ 'header': [3, false] }],
                                        ['bold', 'italic', 'underline'],
                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                        ['clean']
                                    ]
                                }}
                                placeholder="Nội dung báo cáo sẽ hiển thị ở đây..."
                            />
                        </div>

                        <div className="sp-report-actions">
                            <button className="sp-generate-btn success" onClick={handleSaveAndSend} disabled={isSending || !reportText.trim()}>
                                {isSending ? <><Loader size={16} className="animate-spin" /> Đang gửi...</> : <><Send size={16} /> Gửi cho học viên</>}
                            </button>
                            <button className="sp-generate-btn primary" onClick={handleSaveDraft} disabled={isSending || !reportText.trim()} style={{ background: '#f1f5f9', color: '#334155', boxShadow: 'none' }}>
                                Lưu bản nháp
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ REPORT HISTORY ═══ */}
                {reports.length > 0 && (
                    <div className="sp-report-history">
                        <div className="sp-section-label">LỊCH SỬ BÁO CÁO</div>
                        {reports.map(r => (
                            <div key={r.id} className={`sp-report-history-wrapper${viewingReport?.id === r.id ? ' is-expanded' : ''}${editingReportId === r.id ? ' is-editing' : ''}`}>
                                <div className="sp-report-history-item">
                                    <div className="sp-report-history-info">
                                        <span className="sp-report-history-date">
                                            {(() => {
                                                const liveLabel = r.periodId ? (periodLabelMap[r.periodId] || r.periodLabel) : null;
                                                if (liveLabel) {
                                                    return <><span style={{ color: '#6366f1', fontWeight: 700 }}>📋 {liveLabel}</span> <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>({r.startDate} → {r.endDate})</span></>;
                                                }
                                                return r.startDate && r.endDate ? `${r.startDate} → ${r.endDate}` : formatDate(r.createdAt);
                                            })()}
                                        </span>
                                        <span className={`sp-report-history-status ${r.status === 'sent' ? 'sp-status-sent' : 'sp-status-draft'}`}>
                                            {editingReportId === r.id ? '✏️ Đang chỉnh sửa' : r.status === 'sent' ? '✅ Đã gửi' : '📝 Bản nháp'}
                                        </span>
                                    </div>
                                    <div className="sp-report-history-actions">
                                        <button className="sp-generate-btn" style={{ background: '#eef2ff', color: '#6366f1', padding: '6px 10px', fontSize: '0.78rem' }}
                                            onClick={() => setViewingReport(viewingReport?.id === r.id ? null : r)}>
                                            {viewingReport?.id === r.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                                        </button>
                                        {!isStaff && r.status === 'draft' && (
                                            <button className="sp-generate-btn" style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 10px', fontSize: '0.78rem' }}
                                                onClick={() => handleLoadDraft(r)}>
                                                <PenLine size={14} />
                                            </button>
                                        )}
                                        {!isStaff && (r.status !== 'sent' || isAdminView) && (
                                            <button className="sp-generate-btn danger" style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                                                onClick={() => handleDeleteReport(r.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {viewingReport?.id === r.id && editingReportId !== r.id && (
                                    <div className="sp-report-expanded-body">
                                        {r.skillData && (
                                            <div className="sp-radar-container" style={{ marginBottom: '14px', border: 'none', boxShadow: 'none', padding: '10px 0' }}>
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <RadarChart data={SKILL_ORDER.filter(key => r.skillData.skills[key]).map(key => ({
                                                        skill: SKILL_LABELS[key] || key,
                                                        score: r.skillData.skills[key].score ?? 0,
                                                        fullMark: 100,
                                                    }))} cx="50%" cy="50%" outerRadius="70%">
                                                        <PolarGrid stroke="#e2e8f0" />
                                                        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                        <Radar name="Kỹ năng" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                                                        <Tooltip formatter={(val) => [`${val}/100`, 'Điểm']} />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                        {r.skillData && (
                                            <div className="sp-skill-scores" style={{ marginBottom: '14px' }}>
                                                {SKILL_ORDER.map(key => {
                                                    const val = r.skillData.skills[key];
                                                    if (!val) return null;
                                                    return (
                                                        <div key={key} className="sp-skill-card">
                                                            <span className="sp-skill-card-emoji">{SKILL_EMOJIS[key]}</span>
                                                            <div className="sp-skill-card-name">{SKILL_LABELS[key]}</div>
                                                            <div className="sp-skill-card-score" style={{ color: getScoreColor(val.score) }}>
                                                                {val.score !== null ? val.score : '—'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="sp-report-html" style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '14px', borderRadius: '12px' }}
                                            dangerouslySetInnerHTML={{ __html: (r.finalReport || r.aiReport?.detailedReport || 'Không có nội dung.').replace(/&nbsp;/g, ' ') }}
                                        />
                                    </div>
                                )}
                                {!isStaff && editingReportId === r.id && (
                                    <div className="sp-report-expanded-body">
                                        {r.skillData && (
                                            <>
                                                <div className="sp-radar-container" style={{ marginBottom: '14px', border: 'none', boxShadow: 'none', padding: '10px 0' }}>
                                                    <ResponsiveContainer width="100%" height={250}>
                                                        <RadarChart data={SKILL_ORDER.filter(key => r.skillData.skills[key]).map(key => ({
                                                            skill: SKILL_LABELS[key] || key,
                                                            score: r.skillData.skills[key].score ?? 0,
                                                            fullMark: 100,
                                                        }))} cx="50%" cy="50%" outerRadius="70%">
                                                            <PolarGrid stroke="#e2e8f0" />
                                                            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                            <Radar name="Kỹ năng" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                                                            <Tooltip formatter={(val) => [`${val}/100`, 'Điểm']} />
                                                        </RadarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="sp-skill-scores" style={{ marginBottom: '14px' }}>
                                                    {SKILL_ORDER.map(key => {
                                                        const val = r.skillData.skills[key];
                                                        if (!val) return null;
                                                        return (
                                                            <div key={key} className="sp-skill-card">
                                                                <span className="sp-skill-card-emoji">{SKILL_EMOJIS[key]}</span>
                                                                <div className="sp-skill-card-name">{SKILL_LABELS[key]}</div>
                                                                <div className="sp-skill-card-score" style={{ color: getScoreColor(val.score) }}>
                                                                    {val.score !== null ? val.score : '—'}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {(r.skillData.strengths?.length > 0 || r.skillData.weaknesses?.length > 0) && (
                                                    <div style={{ marginBottom: '14px' }}>
                                                        {r.skillData.strengths?.length > 0 && (
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a' }}>💪 Điểm mạnh: </span>
                                                                <div className="sp-ai-chips" style={{ display: 'inline-flex' }}>
                                                                    {r.skillData.strengths.map(s => (
                                                                        <span key={s} className="sp-chip sp-chip-strength">{SKILL_EMOJIS[s]} {SKILL_LABELS[s]}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {r.skillData.weaknesses?.length > 0 && (
                                                            <div>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>⚡ Cần cải thiện: </span>
                                                                <div className="sp-ai-chips" style={{ display: 'inline-flex' }}>
                                                                    {r.skillData.weaknesses.map(s => (
                                                                        <span key={s} className="sp-chip sp-chip-weakness">{SKILL_EMOJIS[s]} {SKILL_LABELS[s]}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <div className="sp-quill-wrapper">
                                            <ReactQuill
                                                theme="snow"
                                                value={reportText}
                                                onChange={setReportText}
                                                modules={{
                                                    toolbar: [
                                                        [{ 'header': [3, false] }],
                                                        ['bold', 'italic', 'underline'],
                                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                        ['clean']
                                                    ]
                                                }}
                                                placeholder="Nội dung báo cáo sẽ hiển thị ở đây..."
                                            />
                                        </div>
                                        <div className="sp-report-actions">
                                            <button className="sp-generate-btn success" onClick={handleSaveAndSend} disabled={isSending || !reportText.trim()}>
                                                {isSending ? <><Loader size={16} className="animate-spin" /> Đang gửi...</> : <><Send size={16} /> Gửi cho học viên</>}
                                            </button>
                                            <button className="sp-generate-btn primary" onClick={handleSaveDraft} disabled={isSending || !reportText.trim()} style={{ background: '#f1f5f9', color: '#334155', boxShadow: 'none' }}>
                                                Lưu bản nháp
                                            </button>
                                            <button className="sp-generate-btn danger" onClick={() => { setEditingReportId(null); setReportText(''); setAiReport(null); setSkillData(null); }} disabled={isSending}>
                                                Huỷ
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                confirmText="Xác nhận"
            />

            {/* Red Flag View/History Modal */}
            {redFlagViewIndex !== null && student && (() => {
                const activeCount = redFlags.filter(f => !f.removed).length;
                const isTerminated = activeCount >= 3;
                const activeFlags = redFlags.filter(f => !f.removed);
                const removedFlagsArr = redFlags.filter(f => f.removed);
                const viewIdx = redFlagViewIndex;
                const flagsToShow = activeFlags.filter(f => f.flagNumber === viewIdx);
                const removedToShow = removedFlagsArr.filter(f => f.flagNumber === viewIdx);
                const roleLabels = { admin: 'QTV', teacher: 'GV', staff: 'NV' };
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setRedFlagViewIndex(null)}>
                        <div onClick={e => e.stopPropagation()} style={{
                            width: '90%', maxWidth: '520px', borderRadius: '20px', overflow: 'hidden',
                            background: 'var(--bg-primary)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            animation: 'slideUp 0.3s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
                        }}>
                            {/* Header */}
                            <div style={{
                                background: isTerminated ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #334155 0%, #475569 100%)',
                                padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                            }}>
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                                        🚩 Cờ đỏ lần {viewIdx}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                        {student.displayName || student.email}
                                    </div>
                                </div>
                                <button onClick={() => setRedFlagViewIndex(null)} style={{
                                    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
                                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#fff'
                                }}><X size={18} /></button>
                            </div>

                            {/* Tab navigation */}
                            {activeCount > 1 && (
                                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}>
                                    {[1, 2, 3].map(i => {
                                        const hasFlag = i <= activeCount;
                                        const isActive = viewIdx === i;
                                        const tabColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                        return (
                                            <button key={i}
                                                onClick={() => hasFlag ? setRedFlagViewIndex(i) : null}
                                                style={{
                                                    flex: 1, padding: '10px 0', border: 'none',
                                                    cursor: hasFlag ? 'pointer' : 'default',
                                                    fontSize: '0.78rem', fontWeight: 700,
                                                    background: isActive ? `${tabColor}08` : 'transparent',
                                                    color: hasFlag ? (isActive ? tabColor : '#64748b') : '#cbd5e1',
                                                    borderBottom: isActive ? `2.5px solid ${tabColor}` : '2.5px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {hasFlag ? '🚩' : '⚪'} Cờ {i}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Body */}
                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                                {flagsToShow.length === 0 && removedToShow.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Cờ này đã được gỡ.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Active flags */}
                                        {flagsToShow.map((flag) => {
                                            const date = flag.createdAt?.toDate ? flag.createdAt.toDate() : (flag.createdAt ? new Date(flag.createdAt) : null);
                                            const bg = flag.flagNumber >= 3 ? '#fef2f2' : flag.flagNumber === 2 ? '#fff7ed' : '#fefce8';
                                            const color = flag.flagNumber >= 3 ? '#dc2626' : flag.flagNumber === 2 ? '#ea580c' : '#ca8a04';
                                            const border = flag.flagNumber >= 3 ? '#fecaca' : flag.flagNumber === 2 ? '#fed7aa' : '#fde68a';
                                            return (
                                                <div key={flag.id} style={{ padding: '16px 18px', borderRadius: '16px', background: bg, border: `1.5px solid ${border}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color }}>
                                                            🚩 Cờ đỏ lần {flag.flagNumber}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                                            {date ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                                        {flag.violationLabel || flag.violationType}
                                                    </div>
                                                    {flag.note && (
                                                        <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '12px', borderLeft: `3px solid ${border}`, lineHeight: 1.5, marginBottom: '10px' }}>
                                                            {flag.note}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                                        👤 {roleLabels[flag.flaggedByRole] || 'GV'} {flag.flaggedByName}
                                                    </div>

                                                    {/* Remove button */}
                                                    {!isStaff && (removingFlagId === flag.id ? (
                                                        <div style={{ marginTop: '14px' }}>
                                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lý do gỡ cờ</label>
                                                            <textarea
                                                                value={removeReasonText}
                                                                onChange={e => setRemoveReasonText(e.target.value)}
                                                                placeholder="Nhập lý do gỡ cờ đỏ..."
                                                                rows={2}
                                                                style={{
                                                                    width: '100%', padding: '10px 12px',
                                                                    border: '1.5px solid var(--border-color)', borderRadius: '10px',
                                                                    fontSize: '0.82rem', fontWeight: 500,
                                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                                                    marginBottom: '8px', lineHeight: 1.4
                                                                }}
                                                                autoFocus
                                                            />
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={() => { setRemovingFlagId(null); setRemoveReasonText(''); }} style={{
                                                                    flex: 1, padding: '8px', borderRadius: '8px',
                                                                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                                                    color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                                                                }}>Huỷ</button>
                                                                <button
                                                                    disabled={!removeReasonText.trim() || redFlagLoading}
                                                                    onClick={async () => {
                                                                        if (!removeReasonText.trim()) return;
                                                                        setRedFlagLoading(true);
                                                                        try {
                                                                            await removeRedFlag({
                                                                                flagId: flag.id,
                                                                                removedBy: user?.uid,
                                                                                removedByName: user?.displayName || user?.email?.split('@')[0] || '',
                                                                                removedByRole: user?.role || 'teacher',
                                                                                removeReason: removeReasonText.trim()
                                                                            });
                                                                            const updated = await getRedFlagsForStudentInGroup(studentId, groupId);
                                                                            setRedFlags(updated);
                                                                            setRedFlagViewIndex(null);
                                                                            setRemovingFlagId(null);
                                                                            setRemoveReasonText('');
                                                                            showToast('Đã gỡ cờ đỏ!');
                                                                        } catch (err) {
                                                                            showToast('Lỗi: ' + err.message, 'error');
                                                                        }
                                                                        setRedFlagLoading(false);
                                                                    }}
                                                                    style={{
                                                                        flex: 2, padding: '8px', borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: !removeReasonText.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #10b981, #059669)',
                                                                        color: !removeReasonText.trim() ? '#94a3b8' : '#fff',
                                                                        fontSize: '0.78rem', fontWeight: 700,
                                                                        cursor: !removeReasonText.trim() ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                >✅ Xác nhận gỡ cờ</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => { setRemovingFlagId(flag.id); setRemoveReasonText(''); }}
                                                            style={{
                                                                marginTop: '14px', padding: '9px 0', borderRadius: '10px',
                                                                background: 'rgba(16,185,129,0.08)',
                                                                color: '#10b981', fontSize: '0.78rem', fontWeight: 700,
                                                                cursor: 'pointer', textAlign: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.16)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
                                                        >
                                                            ✅ Gỡ cờ đỏ này
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}

                                        {/* Removed flags */}
                                        {removedToShow.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                                                    Cờ đã gỡ
                                                </div>
                                                {removedToShow.map(flag => {
                                                    const removedDate = flag.removedAt?.toDate ? flag.removedAt.toDate() : (flag.removedAt ? new Date(flag.removedAt) : null);
                                                    return (
                                                        <div key={flag.id} style={{
                                                            padding: '12px 14px', borderRadius: '12px',
                                                            background: 'var(--bg-input, #f1f5f9)', border: '1px solid var(--border-color, #e2e8f0)',
                                                            opacity: 0.6
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
                                                                    🚩 {flag.violationLabel || flag.violationType}
                                                                </span>
                                                                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>✅ Đã gỡ</span>
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 500 }}>
                                                                Gỡ bởi {roleLabels[flag.removedByRole] || ''} {flag.removedByName}
                                                                {removedDate && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>
                                                                    {removedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>}
                                                            </div>
                                                            {flag.removeReason && (
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                                                    Lý do: {flag.removeReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Red Flag Add Modal */}
            {showRedFlagModal && student && (() => {
                const currentCount = redFlags.filter(f => !f.removed).length;
                const nextFlag = currentCount + 1;
                const isThirdFlag = nextFlag >= 3;
                const hasHistory = redFlags.length > 0;
                return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowRedFlagModal(false)}>
                    <style>{`
                        .rfm-body { display: flex; flex-direction: row; flex: 1; overflow: hidden; min-height: 0; }
                        .rfm-form { flex: 1; min-width: 0; overflow-y: auto; }
                        .rfm-history { width: 280px; flex-shrink: 0; border-left: 1px solid var(--border-color, #e2e8f0); overflow-y: auto; }
                        @media (max-width: 700px) {
                            .rfm-body { flex-direction: column; overflow-y: auto; }
                            .rfm-form { overflow-y: visible; }
                            .rfm-history { width: 100%; border-left: none; border-top: 1px solid var(--border-color, #e2e8f0); overflow-y: visible; }
                        }
                    `}</style>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '90%', maxWidth: hasHistory ? '780px' : '480px', borderRadius: '20px', overflow: 'hidden',
                        background: 'var(--bg-primary)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Header */}
                        <div style={{
                            background: isThirdFlag ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                            padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                        }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                                    🚩 Đánh cờ đỏ lần {nextFlag}/3
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                    {student.displayName || student.email}
                                </div>
                            </div>
                            <button onClick={() => setShowRedFlagModal(false)} style={{
                                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#fff', transition: 'background 0.2s'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            ><X size={18} /></button>
                        </div>

                        {/* Body - two columns */}
                        <div className="rfm-body">
                            {/* Left: Form */}
                            <div className="rfm-form" style={{ padding: '20px 24px' }}>
                                {/* Warning Banner */}
                                {isThirdFlag && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '14px', marginBottom: '20px',
                                        background: '#fef2f2', border: '1.5px solid #fecaca',
                                        display: 'flex', alignItems: 'flex-start', gap: '10px'
                                    }}>
                                        <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>
                                                Cờ đỏ lần 3 — Không còn đảm bảo đầu ra!
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                Hành động này sẽ chấm dứt hợp đồng đảm bảo chất lượng đầu ra của học viên.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Progress dots */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.85rem', fontWeight: 800,
                                            background: i <= currentCount ? (i === 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'var(--bg-secondary)',
                                            color: i <= currentCount ? (i === 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04') : i === nextFlag ? (isThirdFlag ? '#dc2626' : '#d97706') : '#cbd5e1',
                                            border: i === nextFlag ? `2px dashed ${isThirdFlag ? '#fecaca' : '#fed7aa'}` : i <= currentCount ? `1.5px solid ${i === 3 ? '#fecaca' : i === 2 ? '#fed7aa' : '#fde68a'}` : '1.5px solid var(--border-color)',
                                            transition: 'all 0.2s'
                                        }}>
                                            {i <= currentCount ? '🚩' : i}
                                        </div>
                                    ))}
                                </div>

                                {/* Violation Type */}
                                <div style={{ marginBottom: '16px', position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Loại vi phạm
                                    </label>
                                    <div
                                        onClick={() => setViolationDropdownOpen(prev => !prev)}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            border: `1.5px solid ${violationDropdownOpen ? '#d97706' : 'var(--border-color)'}`, borderRadius: '14px',
                                            fontSize: '0.9rem', fontWeight: 500,
                                            background: 'var(--bg-secondary)', color: redFlagForm.violationType ? 'var(--text-primary)' : '#94a3b8',
                                            cursor: 'pointer', transition: 'border-color 0.2s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
                                        }}
                                    >
                                        <span>{redFlagForm.violationType ? VIOLATION_TYPES.find(v => v.value === redFlagForm.violationType)?.label : '— Chọn loại vi phạm —'}</span>
                                        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: violationDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                    </div>
                                    {violationDropdownOpen && (
                                        <>
                                            <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setViolationDropdownOpen(false)} />
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2,
                                                marginTop: '4px', borderRadius: '14px', overflow: 'hidden',
                                                background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '200px', overflowY: 'auto'
                                            }}>
                                                {VIOLATION_TYPES.map(vt => (
                                                    <div
                                                        key={vt.value}
                                                        onClick={() => { setRedFlagForm(prev => ({ ...prev, violationType: vt.value })); setViolationDropdownOpen(false); }}
                                                        style={{
                                                            padding: '11px 16px', fontSize: '0.88rem', fontWeight: 500,
                                                            color: redFlagForm.violationType === vt.value ? '#d97706' : 'var(--text-primary)',
                                                            background: redFlagForm.violationType === vt.value ? '#fffbeb' : 'transparent',
                                                            cursor: 'pointer', transition: 'background 0.15s',
                                                            borderBottom: '1px solid var(--border-color)'
                                                        }}
                                                        onMouseEnter={e => { if (redFlagForm.violationType !== vt.value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = redFlagForm.violationType === vt.value ? '#fffbeb' : 'transparent'; }}
                                                    >
                                                        {vt.label}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Note */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Ghi chú lý do
                                    </label>
                                    <textarea
                                        value={redFlagForm.note}
                                        onChange={e => setRedFlagForm(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder="Mô tả chi tiết lý do đánh cờ đỏ..."
                                        rows={3}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            border: '1.5px solid var(--border-color)', borderRadius: '14px',
                                            fontSize: '0.9rem', fontWeight: 500,
                                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                            outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                            transition: 'border-color 0.2s', lineHeight: 1.5
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#d97706'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setShowRedFlagModal(false)} style={{
                                        flex: 1, padding: '12px', borderRadius: '14px',
                                        border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}>Huỷ bỏ</button>
                                    <button
                                        disabled={!redFlagForm.violationType || !redFlagForm.note.trim() || redFlagLoading}
                                        style={{
                                            flex: 2, padding: '12px', borderRadius: '14px',
                                            border: 'none',
                                            background: (!redFlagForm.violationType || !redFlagForm.note.trim()) ? '#e2e8f0' : isThirdFlag ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                                            color: (!redFlagForm.violationType || !redFlagForm.note.trim()) ? '#94a3b8' : '#fff',
                                            fontSize: '0.9rem', fontWeight: 800,
                                            cursor: (!redFlagForm.violationType || !redFlagForm.note.trim() || redFlagLoading) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                        onClick={async () => {
                                            setRedFlagLoading(true);
                                            try {
                                                const vt = VIOLATION_TYPES.find(v => v.value === redFlagForm.violationType);
                                                const activeCount2 = redFlags.filter(f => !f.removed).length;
                                                await addRedFlag({
                                                    studentId,
                                                    studentName: student.displayName || student.email,
                                                    studentEmail: student.email,
                                                    groupId,
                                                    groupName: group?.name || '',
                                                    violationType: redFlagForm.violationType,
                                                    violationLabel: vt?.label || redFlagForm.violationType,
                                                    note: redFlagForm.note.trim(),
                                                    flaggedBy: user?.uid,
                                                    flaggedByName: user?.displayName || user?.email?.split('@')[0] || '',
                                                    flaggedByRole: user?.role || 'teacher',
                                                    flagNumber: activeCount2 + 1
                                                });
                                                const updated = await getRedFlagsForStudentInGroup(studentId, groupId);
                                                setRedFlags(updated);
                                                setShowRedFlagModal(false);
                                                showToast('Đã đánh cờ đỏ!');
                                            } catch (err) {
                                                console.error(err);
                                                showToast('Lỗi: ' + err.message, 'error');
                                            }
                                            setRedFlagLoading(false);
                                        }}
                                    >
                                        {redFlagLoading ? 'Đang xử lý...' : (isThirdFlag ? '🔴 Xác nhận — Mất đảm bảo đầu ra' : '🚩 Xác nhận đánh cờ đỏ')}
                                    </button>
                                </div>
                            </div>

                            {/* Right: History */}
                            {hasHistory && (
                                <div className="rfm-history" style={{ padding: '20px 16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Lịch sử cờ đỏ</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {[...redFlags].sort((a, b) => { const ta = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0)); const tb = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0)); return tb - ta; }).map(f => {
                                            const d = f.createdAt?.toDate ? f.createdAt.toDate() : (f.createdAt ? new Date(f.createdAt) : null);
                                            const flagColor = f.flagNumber >= 3 ? '#dc2626' : f.flagNumber === 2 ? '#ea580c' : '#ca8a04';
                                            return (
                                                <div key={f.id} style={{
                                                    padding: '10px 12px', borderRadius: '10px',
                                                    background: f.removed ? 'var(--bg-input, #f1f5f9)' : (f.flagNumber >= 3 ? '#fef2f2' : f.flagNumber === 2 ? '#fff7ed' : '#fefce8'),
                                                    border: `1px solid ${f.removed ? 'var(--border-color, #e2e8f0)' : (f.flagNumber >= 3 ? '#fecaca' : f.flagNumber === 2 ? '#fed7aa' : '#fde68a')}`,
                                                    opacity: f.removed ? 0.6 : 1
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: f.removed ? '#94a3b8' : flagColor, textDecoration: f.removed ? 'line-through' : 'none' }}>
                                                            🚩 Cờ {f.flagNumber}: {f.violationLabel || f.violationType}
                                                        </span>
                                                        {f.removed && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>✅ Đã gỡ</span>}
                                                    </div>
                                                    {f.note && (
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px', lineHeight: 1.4 }}>
                                                            {f.note}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                                        {d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        {' · '}{f.removed ? `Gỡ bởi ${f.removedByName || ''}` : `Bởi ${f.flaggedByName || ''}`}
                                                    </div>
                                                    {f.removed && f.removeReason && (
                                                        <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '4px', fontStyle: 'italic' }}>
                                                            Lý do gỡ: {f.removeReason}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    padding: '12px 24px', borderRadius: '16px', zIndex: 9999,
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                    border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    fontSize: '0.88rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    {toast.type === 'error' ? '❌' : '✅'} {toast.message}
                </div>
            )}
        </div>
    );
}
