import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getGroupById, getStudentsInGroup, getAssignmentsForGroup, createAssignment, deleteAssignment, updateAssignmentDueDate, updateAssignmentStudentDeadline, getStudentTopicProgressSummary, getStudentTopicWordsProgress, getTeacherTopics, getSharedAndPublicTeacherTopics, restoreAssignment, permanentlyDeleteAssignment, getDeletedAssignmentsForGroup, getTeacherTopicFolders, getAllTeacherTopicFolders } from '../../services/teacherService';
import { getUserLearningStats, getAdminTopics, getFolders } from '../../services/adminService';
import { getStudentsStreakData } from '../../services/userService';
import { getGrammarExercises, getSharedAndPublicGrammarExercises, getTeacherGrammarFolders, getAllTeacherGrammarFolders } from '../../services/grammarService';
import { getStudentGrammarProgressSummary, getStudentGrammarQuestionsProgress, getUserOverallGrammarStats, getGrammarReviewCountForUser } from '../../services/grammarSpacedRepetition';
import { getReviewCountsForUser } from '../../services/spacedRepetition';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { ArrowLeft, Users, FileText, CheckCircle, Clock, Calendar, BarChart3, Trash2, Plus, X, PieChart, Trophy, AlertTriangle, BookOpen, ChevronDown, ChevronRight, Check, UserCheck, User, List, Search, ClipboardList, GraduationCap, Send, RefreshCw, Info, CalendarClock, Flame, EyeOff, RotateCcw, Archive, Flag, Sparkles, FolderOpen } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getExams, getSharedExams, createExamAssignment, getExamAssignmentsForGroup, deleteExamAssignment, updateExamAssignmentDueDate, updateExamAssignmentStudentDeadline, getExamSubmissionsForAssignment, getExamSubmissionsForAssignments, overrideExamQuestionScore, releaseExamSubmissionResults, deleteExamSubmission, restoreExamAssignment, permanentlyDeleteExamAssignment, getDeletedExamAssignmentsForGroup, cleanupExpiredDeletedItems, gradeExamSubmission, getExam, getExamQuestions, getTeacherExamFolders, getExamFolders, getAllTeacherExamFolders } from '../../services/examService';

import ConfirmModal from '../../components/common/ConfirmModal';
import { getActiveReportPeriod, getGroupReportStatus, computePeriodStatus } from '../../services/reportPeriodService';
import { getRedFlagCountsForGroup, getRedFlagsForStudentInGroup, addRedFlag, removeRedFlag, VIOLATION_TYPES } from '../../services/redFlagService';

// Shorten Vietnamese name: keep last 2 words, abbreviate the rest
// "Nguyễn Dương Khả Linh" → "N.D. Khả Linh"
function shortenName(name) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    const initials = parts.slice(0, -2).map(p => p.charAt(0).toUpperCase() + '.').join('');
    return `${initials} ${parts.slice(-2).join(' ')}`;
}

// Helper: check if an assignment/exam has any deadline still active (including per-student overrides)
function hasAnyActiveDeadline(a, nowTime) {
    const due = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
    if (!due || due.getTime() >= nowTime) return true;
    // Main deadline passed — check if any student has an extended deadline still active
    if (a.studentDeadlines) {
        return Object.values(a.studentDeadlines).some(sd => {
            const sdDate = sd?.toDate ? sd.toDate() : new Date(sd);
            return sdDate.getTime() >= nowTime;
        });
    }
    return false;
}

// Helper: get the latest deadline across main + all student overrides
function getLatestDeadline(a) {
    let latest = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
    if (a.studentDeadlines) {
        Object.values(a.studentDeadlines).forEach(sd => {
            const sdDate = sd?.toDate ? sd.toDate() : new Date(sd);
            if (!latest || sdDate > latest) latest = sdDate;
        });
    }
    return latest;
}

export default function TeacherGroupDetailPage() {
    const { groupId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'students';
    const isAdminView = location.pathname.startsWith('/admin/');
    const { user } = useAuth();
    const { settings } = useAppSettings();
    const isStaff = user?.role === 'staff';
    const [group, setGroup] = useState(null);
    const [activeTab, setActiveTab] = useState(initialTab); // students | assignments | exams | statistics
    const [loading, setLoading] = useState(true);

    // Students
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentStats, setStudentStats] = useState(null);
    const [studentTopicProgress, setStudentTopicProgress] = useState(null);
    const [expandedTopicId, setExpandedTopicId] = useState(null);
    const [topicWordsCache, setTopicWordsCache] = useState({});
    const [statsLoading, setStatsLoading] = useState(false);
    const [studentGrammarProgress, setStudentGrammarProgress] = useState(null);
    const [grammarQuestionsCache, setGrammarQuestionsCache] = useState({});

    // Statistics Tab Data
    const [allStudentsStats, setAllStudentsStats] = useState([]);
    const [isAllStatsLoading, setIsAllStatsLoading] = useState(false);
    const [assignmentCompletionData, setAssignmentCompletionData] = useState([]);
    const [allStudentsGrammarStats, setAllStudentsGrammarStats] = useState([]);
    const [vocabBreakdownStats, setVocabBreakdownStats] = useState({ totalLearned: 0, totalLearning: 0, totalNotStarted: 0 });
    const [allStudentsExamStats, setAllStudentsExamStats] = useState([]);
    const [allStudentsHomeworkStats, setAllStudentsHomeworkStats] = useState([]);
    const [allStudentsAllExamStats, setAllStudentsAllExamStats] = useState([]);
    const [studentsActivityData, setStudentsActivityData] = useState({});

    // Report Period
    const [activeReportPeriod, setActiveReportPeriod] = useState(null);
    const [reportSentStudentIds, setReportSentStudentIds] = useState(new Set());
    const [reportLateStudentIds, setReportLateStudentIds] = useState(new Set());

    // Filters for Assignment Completion Progress
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Assignments
    const [assignments, setAssignments] = useState([]);
    const [topics, setTopics] = useState([]);
    const [teacherTopics, setTeacherTopics] = useState([]);
    const [grammarExercises, setGrammarExercises] = useState([]);
    const [folders, setFolders] = useState([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState({ topicId: '', dueDate: '', scheduledStart: '' });
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignmentToDelete, setAssignmentToDelete] = useState(null);
    const [assignmentMode, setAssignmentMode] = useState('all'); // 'all' | 'individual'
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);

    // Topic Picker
    const [topicPickerOpen, setTopicPickerOpen] = useState(false);
    const [topicSearch, setTopicSearch] = useState('');
    const [topicTypeFilter, setTopicTypeFilter] = useState('all'); // all | vocab | grammar
    const [topicSourceFilter, setTopicSourceFilter] = useState('all'); // all | mine | default

    // Assignment Progress Modal
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [assignmentProgressData, setAssignmentProgressData] = useState([]);
    const [isAssignmentProgressLoading, setIsAssignmentProgressLoading] = useState(false);
    const [expandedAssignmentStudentId, setExpandedAssignmentStudentId] = useState(null);
    const [assignmentWordsCache, setAssignmentWordsCache] = useState({});
    const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('all'); // all | vocab | grammar
    const [examTypeFilter, setExamTypeFilter] = useState('all'); // all | homework | test

    // Exam Assignments
    const [examAssignments, setExamAssignments] = useState([]);
    const [allExams, setAllExams] = useState([]);
    const [isExamAssignModalOpen, setIsExamAssignModalOpen] = useState(false);
    const [examAssignmentForm, setExamAssignmentForm] = useState({ examId: '', dueDate: '', scheduledStart: '' });
    const [examAssignmentMode, setExamAssignmentMode] = useState('all'); // 'all' | 'individual'
    const [examAssignLoading, setExamAssignLoading] = useState(false);
    const [examAssignmentToDelete, setExamAssignmentToDelete] = useState(null);
    const [selectedExamAssignment, setSelectedExamAssignment] = useState(null);
    const [examSubmissions, setExamSubmissions] = useState([]);
    const [studentExamSubmissions, setStudentExamSubmissions] = useState([]); // For individual student modal
    const [examSubmissionsLoading, setExamSubmissionsLoading] = useState(false);
    const [examPopupQuestions, setExamPopupQuestions] = useState([]);
    const [unreleasedCounts, setUnreleasedCounts] = useState({});
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [overrideData, setOverrideData] = useState({ submissionId: '', questionId: '', score: 0, note: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'primary' });

    // Extend Deadline
    const [extendDeadlineTarget, setExtendDeadlineTarget] = useState(null); // { type: 'assignment' | 'exam', item: {...} }
    const [extendDeadlineDate, setExtendDeadlineDate] = useState('');
    const [extendDeadlineLoading, setExtendDeadlineLoading] = useState(false);
    const [extendDeadlineMode, setExtendDeadlineMode] = useState('all'); // 'all' | 'individual'
    const [extendIndividualDates, setExtendIndividualDates] = useState({}); // { [studentId]: datetime-local string }

    // Exam Picker
    const [examPickerOpen, setExamPickerOpen] = useState(false);
    const [examSearch, setExamSearch] = useState('');
    const [examPickerTypeFilter, setExamPickerTypeFilter] = useState('all'); // all | homework | test

    // Teacher Folders for picker grouping
    const [teacherTopicFoldersData, setTeacherTopicFoldersData] = useState([]);
    const [teacherGrammarFoldersData, setTeacherGrammarFoldersData] = useState([]);
    const [teacherExamFoldersData, setTeacherExamFoldersData] = useState([]);
    const [examFoldersData, setExamFoldersData] = useState([]);
    const [expandedPickerFolders, setExpandedPickerFolders] = useState(new Set());
    const [expandedExamPickerFolders, setExpandedExamPickerFolders] = useState(new Set());
    const [examPickerSourceFilter, setExamPickerSourceFilter] = useState('all'); // all | mine | shared

    // Trash (Soft Delete)
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const [deletedAssignments, setDeletedAssignments] = useState([]);
    const [deletedExamAssignments, setDeletedExamAssignments] = useState([]);
    const [trashLoading, setTrashLoading] = useState(false);

    // Red Flags
    const [reviewCounts, setReviewCounts] = useState({}); // { [uid]: { vocab, grammar } }
    const [redFlagCounts, setRedFlagCounts] = useState({}); // { [studentId]: count }
    const [redFlagModalStudent, setRedFlagModalStudent] = useState(null); // student to add flag to
    const [redFlagForm, setRedFlagForm] = useState({ violationType: '', note: '' });
    const [violationDropdownOpen, setViolationDropdownOpen] = useState(false);
    const [redFlagLoading, setRedFlagLoading] = useState(false);
    const [redFlagHistoryStudent, setRedFlagHistoryStudent] = useState(null); // student to view history
    const [redFlagHistory, setRedFlagHistory] = useState([]);
    const [redFlagHistoryLoading, setRedFlagHistoryLoading] = useState(false);
    const [removingFlagId, setRemovingFlagId] = useState(null);
    const [removeReasonText, setRemoveReasonText] = useState('');
    const [redFlagViewIndex, setRedFlagViewIndex] = useState(null);
    const [addModalFlags, setAddModalFlags] = useState([]); // which flag number to show (1, 2, 3) or null for all

    const getErrorStyle = (rate) => {
        if (rate > 30) return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
        if (rate > 15) return { color: '#ca8a04', bg: '#fefce8', border: '#fde68a' };
        return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    };

    useEffect(() => {
        loadData();
    }, [groupId]);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tab = queryParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [location.search]);

    async function loadData() {
        setLoading(true);
        try {
            const grp = await getGroupById(groupId);
            if (!grp) {
                setLoading(false);
                return;
            }

            const [stds, asgns, tps, flds, myGrammar, publicGrammar] = await Promise.all([
                getStudentsInGroup(groupId),
                getAssignmentsForGroup(groupId),
                getAdminTopics(),
                getFolders(),
                isAdminView ? getGrammarExercises() : (user?.uid ? getGrammarExercises(user.uid) : Promise.resolve([])),
                isAdminView ? Promise.resolve([]) : getSharedAndPublicGrammarExercises(grp.grammarAccess || [])
            ]);

            const mergedGrammarMap = new Map();
            myGrammar.forEach(g => mergedGrammarMap.set(g.id, g));
            publicGrammar.forEach(g => mergedGrammarMap.set(g.id, g));
            const finalGrammarExs = Array.from(mergedGrammarMap.values());

            let fetchedTtps = [];
            if (isAdminView) {
                // If admin, we need to show all teacher topics or fetching specific ones isn't directly supported here yet.
                // We'll update getAdminAllTeacherTopics to support this shortly.
                const { getAdminAllTeacherTopics } = await import('../../services/adminService');
                fetchedTtps = await getAdminAllTeacherTopics();
            } else if (user?.uid) {
                const [myTopics, publicTopics] = await Promise.all([
                    getTeacherTopics(user.uid),
                    getSharedAndPublicTeacherTopics(grp.topicAccess || [])
                ]);
                const mergedTopicsMap = new Map();
                myTopics.forEach(t => mergedTopicsMap.set(t.id, t));
                publicTopics.forEach(t => mergedTopicsMap.set(t.id, t));
                fetchedTtps = Array.from(mergedTopicsMap.values());
            }

            setGroup(grp);
            setStudents(stds);
            setAssignments(asgns);
            setTopics(tps);
            setFolders(flds);
            setGrammarExercises(finalGrammarExs);
            setTeacherTopics(fetchedTtps);

            // Load teacher folders for picker grouping (fire-and-forget)
            if (user?.uid) {
                const topicFolderPromise = isAdminView
                    ? getAllTeacherTopicFolders().catch(() => [])
                    : getTeacherTopicFolders(user.uid).catch(() => []);
                const grammarFolderPromise = isAdminView
                    ? getAllTeacherGrammarFolders().catch(() => [])
                    : getTeacherGrammarFolders(user.uid).catch(() => []);
                const examFolderPromise = isAdminView
                    ? getAllTeacherExamFolders().catch(() => [])
                    : getTeacherExamFolders(user.uid).catch(() => []);
                Promise.all([
                    topicFolderPromise,
                    grammarFolderPromise,
                    examFolderPromise,
                    getExamFolders().catch(() => [])
                ]).then(([ttf, tgf, tef, aef]) => {
                    setTeacherTopicFoldersData(ttf);
                    setTeacherGrammarFoldersData(tgf);
                    setTeacherExamFoldersData(tef);
                    setExamFoldersData(aef);
                }).catch(err => console.error('Error loading teacher folders:', err));
            }

            // Fetch streak & last activity for all students
            if (stds.length > 0) {
                getStudentsStreakData(stds.map(s => s.uid))
                    .then(setStudentsActivityData)
                    .catch(err => console.error('Error fetching students activity data:', err));

                // Fetch review counts for all students (vocab + grammar)
                Promise.all(stds.map(async (s) => {
                    const [vocabData, grammarCount] = await Promise.all([
                        getReviewCountsForUser(s.uid),
                        getGrammarReviewCountForUser(s.uid)
                    ]);
                    return { uid: s.uid, vocab: vocabData.vocabReviewCount, grammar: grammarCount };
                })).then(results => {
                    const counts = {};
                    results.forEach(r => { counts[r.uid] = { vocab: r.vocab, grammar: r.grammar }; });
                    setReviewCounts(counts);
                }).catch(err => console.error('Error fetching review counts:', err));
            }

            // Load exams — admin sees all, teacher only sees own + shared
            let teacherExams, adminExams, sharedExams;
            if (isAdminView) {
                [teacherExams, adminExams, sharedExams] = await Promise.all([
                    getExams('teacher'),
                    getExams('admin'),
                    getSharedExams(user.mergedExamAccess || user.examAccess || [])
                ]);
            } else {
                // Teacher view: only load exams created by this teacher
                const [allTeacherExams, ae, se] = await Promise.all([
                    getExams('teacher'),
                    getExams('admin'),
                    getSharedExams(user.mergedExamAccess || user.examAccess || [])
                ]);
                teacherExams = allTeacherExams.filter(e => e.createdBy === user?.uid);
                adminExams = ae;
                sharedExams = se;
            }
            const groupExamAssignments = await getExamAssignmentsForGroup(groupId).catch(err => {
                console.error('[ExamAssignments] Failed to load group assignments:', err);
                return [];
            });

            // Also fetch individual exam assignments for all students in this group
            let individualExamAssignments = [];
            if (stds.length > 0) {
                const studentIds = stds.map(s => s.uid);
                for (let i = 0; i < studentIds.length; i += 10) {
                    const batch = studentIds.slice(i, i + 10);
                    try {
                        const { getDocs: _getDocs, query: _query, collection: _coll, where: _where } = await import('firebase/firestore');
                        const { db: _db } = await import('../../config/firebase');
                        const q = _query(_coll(_db, 'exam_assignments'), _where('targetType', '==', 'individual'), _where('targetId', 'in', batch));
                        const snap = await _getDocs(q);
                        snap.forEach(d => individualExamAssignments.push({ id: d.id, ...d.data() }));
                    } catch (err) {
                        console.error('[ExamAssignments] Failed to load individual assignments:', err);
                    }
                }
            }

            // Merge group + individual, deduplicate by id, sort newest first
            const allExamAssignmentsMap = new Map();
            [...groupExamAssignments, ...individualExamAssignments].filter(a => !a.isDeleted).forEach(a => allExamAssignmentsMap.set(a.id, a));
            const allExamAssignments = Array.from(allExamAssignmentsMap.values()).sort((a, b) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });

            const map = new Map();
            [...teacherExams, ...adminExams].forEach(e => map.set(e.id, { ...e, isOwner: e.createdBy === user?.uid }));
            sharedExams.forEach(e => {
                if (!map.has(e.id)) map.set(e.id, { ...e, isOwner: false });
            });
            setAllExams(Array.from(map.values()));
            setExamAssignments(allExamAssignments);

            // Compute unreleased graded counts per assignment
            const currentStudentUids = new Set(stds.map(s => s.uid));
            if (allExamAssignments.length > 0) {
                try {
                    const allAssignmentSubs = await getExamSubmissionsForAssignments(allExamAssignments.map(a => a.id));
                    // Deduplicate by studentId+assignmentId: keep only the latest submission per student per assignment
                    const latestSubMap = new Map(); // key: `${assignmentId}_${studentId}` -> latest sub
                    allAssignmentSubs.forEach(sub => {
                        // Only count submissions from students currently in the group
                        if (!currentStudentUids.has(sub.studentId)) return;
                        const key = `${sub.assignmentId}_${sub.studentId}`;
                        const existing = latestSubMap.get(key);
                        if (!existing) {
                            latestSubMap.set(key, sub);
                        } else {
                            // Keep the one with the later updatedAt/createdAt
                            const existingTime = existing.updatedAt?.toMillis?.() || existing.createdAt?.toMillis?.() || 0;
                            const newTime = sub.updatedAt?.toMillis?.() || sub.createdAt?.toMillis?.() || 0;
                            if (newTime > existingTime) {
                                latestSubMap.set(key, sub);
                            }
                        }
                    });
                    const counts = {};
                    latestSubMap.forEach(sub => {
                        if (sub.status === 'graded' && !sub.resultsReleased) {
                            counts[sub.assignmentId] = (counts[sub.assignmentId] || 0) + 1;
                        }
                    });
                    setUnreleasedCounts(counts);
                } catch (e) {
                    console.error('Error computing unreleased counts:', e);
                }
            }



        } catch (error) {
            console.error("Error loading group details:", error);
        }
        setLoading(false);

        // Load active report period + report status
        try {
            const period = await getActiveReportPeriod();
            setActiveReportPeriod(period);
            if (period) {
                const { sentStudentIds, lateStudentIds } = await getGroupReportStatus(groupId, period.startDate, period.endDate, period.id);
                setReportSentStudentIds(sentStudentIds);
                setReportLateStudentIds(lateStudentIds);
            }
        } catch (err) {
            console.warn('Could not load report period status:', err);
        }

        // Auto-cleanup expired soft-deleted items (30 days)
        cleanupExpiredDeletedItems(groupId).catch(err => console.error('Cleanup error:', err));

        // Load red flag counts for all students
        getRedFlagCountsForGroup(groupId)
            .then(setRedFlagCounts)
            .catch(err => console.warn('Could not load red flag counts:', err));
    }



    // Fetch stats for all students when 'statistics' tab is active
    useEffect(() => {
        if (activeTab === 'statistics' && students.length > 0) {
            fetchAllStudentsStats();
        }
    }, [activeTab, students, filterStartDate, filterEndDate, assignments, examAssignments]);

    async function fetchAllStudentsStats() {
        setIsAllStatsLoading(true);
        try {
            // Fetch assigned vocab stats for all students
            const vocabAssignmentsAll = assignments.filter(a => !a.isGrammar);
            const vocabTopicIdsAll = vocabAssignmentsAll.map(a => a.topicId);
            const grammarAssignmentIds = assignments.filter(a => a.isGrammar).map(a => a.topicId);

            const studentStatsPromises = students.map(async (student) => {
                let stats = { totalWords: 0, learnedWords: 0, totalReviews: 0, totalCorrect: 0, totalWrong: 0, totalNotStarted: 0 };

                if (vocabTopicIdsAll.length > 0) {
                    const summary = await getStudentTopicProgressSummary(student.uid, vocabTopicIdsAll, filterStartDate, filterEndDate);
                    Object.values(summary).forEach(prog => {
                        stats.totalWords += prog.total || 0;
                        stats.learnedWords += prog.learned || 0;
                        stats.totalCorrect += prog.totalCorrect || 0;
                        stats.totalWrong += prog.totalWrong || 0;
                        stats.totalNotStarted += prog.notStarted || 0;
                    });
                }

                // Fetch overall stats for self-study calculation
                const overallVocabTask = getUserLearningStats(student.uid, filterStartDate, filterEndDate);
                const overallGrammarTask = getUserOverallGrammarStats(student.uid, filterStartDate, filterEndDate);
                const [overallVocab, overallGrammar] = await Promise.all([overallVocabTask, overallGrammarTask]);

                // Grammar assigned stats
                let assignedGrammarLearned = 0;
                if (grammarAssignmentIds.length > 0) {
                    const gSummary = await getStudentGrammarProgressSummary(student.uid, grammarAssignmentIds);
                    Object.values(gSummary).forEach(prog => {
                        assignedGrammarLearned += prog.learned || 0;
                    });
                }

                // Self study = Overall - Assigned
                const ssVocab = Math.max(0, (overallVocab.learnedWords || 0) - stats.learnedWords);
                const ssGrammar = Math.max(0, (overallGrammar.learned || 0) - assignedGrammarLearned);

                return {
                    ...student,
                    stats,
                    selfStudyVocab: ssVocab,
                    selfStudyGrammar: ssGrammar,
                    selfStudyTotal: ssVocab + ssGrammar
                };
            });

            const results = await Promise.all(studentStatsPromises);
            setAllStudentsStats(results);

            // Calculate class-wide vocab breakdown for the donut chart from the filtered results
            let classTotalLearned = 0, classTotalLearning = 0, classTotalNotStarted = 0, classTotalCorrect = 0, classTotalWrong = 0;
            results.forEach(s => {
                classTotalLearned += s.stats.learnedWords;
                classTotalLearning += (s.stats.totalWords - s.stats.learnedWords - s.stats.totalNotStarted);
                classTotalNotStarted += s.stats.totalNotStarted;
                classTotalCorrect += s.stats.totalCorrect;
                classTotalWrong += s.stats.totalWrong;
            });
            setVocabBreakdownStats({
                totalLearned: classTotalLearned,
                totalLearning: classTotalLearning,
                totalNotStarted: classTotalNotStarted,
                totalCorrect: classTotalCorrect,
                totalWrong: classTotalWrong
            });

            // Fetch grammar stats for all students (for statistics tab)
            if (grammarAssignmentIds.length > 0) {
                const grammarStatsPromises = students.map(async (student) => {
                    const summary = await getStudentGrammarProgressSummary(student.uid, grammarAssignmentIds, filterStartDate, filterEndDate);
                    let totalQuestions = 0;
                    let correctQuestions = 0;
                    let learningQuestions = 0;
                    let totalCorrect = 0;
                    let totalWrong = 0;
                    Object.values(summary).forEach(prog => {
                        totalQuestions += prog.total || 0;
                        correctQuestions += prog.learned || 0;
                        learningQuestions += prog.learning || 0;
                        totalCorrect += prog.totalCorrect || 0;
                        totalWrong += prog.totalWrong || 0;
                    });
                    return {
                        uid: student.uid,
                        displayName: student.displayName || student.email?.split('@')[0] || 'N/A',
                        totalQuestions,
                        correctQuestions,
                        learningQuestions,
                        totalCorrect,
                        totalWrong,
                        notStarted: totalQuestions - correctQuestions - learningQuestions
                    };
                });
                const grammarResults = await Promise.all(grammarStatsPromises);
                grammarResults.sort((a, b) => b.correctQuestions - a.correctQuestions);
                setAllStudentsGrammarStats(grammarResults);
            } else {
                setAllStudentsGrammarStats([]);
            }
            // Filter assignments based on dates
            let filteredAssignments = assignments;
            if (filterStartDate) {
                const start = new Date(filterStartDate).setHours(0, 0, 0, 0);
                filteredAssignments = filteredAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() >= start;
                });
            }
            if (filterEndDate) {
                const end = new Date(filterEndDate).setHours(23, 59, 59, 999);
                filteredAssignments = filteredAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() <= end;
                });
            }

            // Assignment Completion: compute per-student how many assignments are completed
            if (filteredAssignments.length > 0) {
                // Separate vocab and grammar assignments
                const vocabAssignments = filteredAssignments.filter(a => !a.isGrammar);
                const grammarAssignments = filteredAssignments.filter(a => a.isGrammar);
                const vocabTopicIds = vocabAssignments.map(a => a.topicId);
                const grammarExerciseIds = grammarAssignments.map(a => a.topicId);

                const completionPromises = students.map(async (student) => {
                    let completed = 0;

                    // Vocab assignments
                    if (vocabTopicIds.length > 0) {
                        const vocabSummary = await getStudentTopicProgressSummary(student.uid, vocabTopicIds, filterStartDate, filterEndDate);
                        vocabAssignments.forEach(a => {
                            const prog = vocabSummary[a.topicId];
                            if (prog && prog.total > 0 && prog.learned === prog.total) {
                                completed++;
                            }
                        });
                    }

                    // Grammar assignments
                    if (grammarExerciseIds.length > 0) {
                        const grammarSummary = await getStudentGrammarProgressSummary(student.uid, grammarExerciseIds);
                        grammarAssignments.forEach(a => {
                            const prog = grammarSummary[a.topicId];
                            if (prog && prog.total > 0 && prog.learned === prog.total) {
                                completed++;
                            }
                        });
                    }

                    return {
                        uid: student.uid,
                        displayName: student.displayName || student.email?.split('@')[0] || 'N/A',
                        completed,
                        total: filteredAssignments.length
                    };
                });
                const completionResults = await Promise.all(completionPromises);
                // Sort by completion rate descending
                completionResults.sort((a, b) => (b.completed / b.total) - (a.completed / a.total));
                setAssignmentCompletionData(completionResults);
            } else {
                setAssignmentCompletionData([]);
            }

            // Exam Submissions Stats - only count exams with examType === 'test'
            let filteredExamAssignments = examAssignments.filter(a => {
                const exam = allExams.find(e => e.id === a.examId);
                return exam?.examType === 'test';
            });
            if (filterStartDate) {
                const start = new Date(filterStartDate).setHours(0, 0, 0, 0);
                filteredExamAssignments = filteredExamAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() >= start;
                });
            }
            if (filterEndDate) {
                const end = new Date(filterEndDate).setHours(23, 59, 59, 999);
                filteredExamAssignments = filteredExamAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() <= end;
                });
            }

            if (filteredExamAssignments.length > 0) {
                const assignmentIds = filteredExamAssignments.map(a => a.id);
                const allSubmissions = await getExamSubmissionsForAssignments(assignmentIds);

                const examStatsResults = students.map(student => {
                    const studentSubs = allSubmissions.filter(s => s.studentId === student.uid);
                    let totalScore = 0;
                    let maxTotalScore = 0;
                    let submittedCount = 0;

                    studentSubs.forEach(sub => {
                        if (sub.status === 'graded' || sub.status === 'submitted' || sub.status === 'grading') {
                            submittedCount++;
                        }
                        if (sub.status === 'graded' || sub.status === 'released') {
                            totalScore += sub.totalScore || 0;
                            maxTotalScore += sub.maxTotalScore || 0;
                        }
                    });

                    // Calculate average percentage
                    const averageScoreStr = maxTotalScore > 0 ? ((totalScore / maxTotalScore) * 100).toFixed(1) : 0;
                    const averageScore = parseFloat(averageScoreStr);

                    return {
                        uid: student.uid,
                        displayName: student.displayName || student.email?.split('@')[0] || 'N/A',
                        submittedCount,
                        totalExpected: filteredExamAssignments.length,
                        averageScore,
                        totalScore,
                        maxTotalScore
                    };
                });
                setAllStudentsExamStats(examStatsResults);
            } else {
                setAllStudentsExamStats([]);
            }

            // All Exams Stats (both homework and test) - for overview donut chart
            let filteredAllExamAssignments = examAssignments;
            if (filterStartDate) {
                const start = new Date(filterStartDate).setHours(0, 0, 0, 0);
                filteredAllExamAssignments = filteredAllExamAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() >= start;
                });
            }
            if (filterEndDate) {
                const end = new Date(filterEndDate).setHours(23, 59, 59, 999);
                filteredAllExamAssignments = filteredAllExamAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() <= end;
                });
            }
            if (filteredAllExamAssignments.length > 0) {
                const allIds = filteredAllExamAssignments.map(a => a.id);
                const allSubs = await getExamSubmissionsForAssignments(allIds);
                const allExamStatsResults = students.map(student => {
                    const studentSubs = allSubs.filter(s => s.studentId === student.uid);
                    let totalScore = 0;
                    let maxTotalScore = 0;
                    let submittedCount = 0;
                    studentSubs.forEach(sub => {
                        if (sub.status === 'graded' || sub.status === 'submitted' || sub.status === 'grading') submittedCount++;
                        if (sub.status === 'graded' || sub.status === 'released') {
                            totalScore += sub.totalScore || 0;
                            maxTotalScore += sub.maxTotalScore || 0;
                        }
                    });
                    const averageScoreStr = maxTotalScore > 0 ? ((totalScore / maxTotalScore) * 100).toFixed(1) : 0;
                    return {
                        uid: student.uid,
                        displayName: student.displayName || student.email?.split('@')[0] || 'N/A',
                        submittedCount,
                        totalExpected: filteredAllExamAssignments.length,
                        averageScore: parseFloat(averageScoreStr),
                        totalScore,
                        maxTotalScore
                    };
                });
                setAllStudentsAllExamStats(allExamStatsResults);
            } else {
                setAllStudentsAllExamStats([]);
            }

            // Homework Completion Stats - only count exams with examType !== 'test' (homework)
            let filteredHomeworkAssignments = examAssignments.filter(a => {
                const exam = allExams.find(e => e.id === a.examId);
                return (exam?.examType || 'homework') !== 'test';
            });
            if (filterStartDate) {
                const start = new Date(filterStartDate).setHours(0, 0, 0, 0);
                filteredHomeworkAssignments = filteredHomeworkAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() >= start;
                });
            }
            if (filterEndDate) {
                const end = new Date(filterEndDate).setHours(23, 59, 59, 999);
                filteredHomeworkAssignments = filteredHomeworkAssignments.filter(a => {
                    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
                    return due.getTime() <= end;
                });
            }

            if (filteredHomeworkAssignments.length > 0) {
                const hwIds = filteredHomeworkAssignments.map(a => a.id);
                const hwSubmissions = await getExamSubmissionsForAssignments(hwIds);
                const hwStatsResults = students.map(student => {
                    const studentSubs = hwSubmissions.filter(s => s.studentId === student.uid);
                    let submittedCount = 0;
                    studentSubs.forEach(sub => {
                        if (sub.status === 'graded' || sub.status === 'submitted' || sub.status === 'grading') {
                            submittedCount++;
                        }
                    });
                    return {
                        uid: student.uid,
                        displayName: student.displayName || student.email?.split('@')[0] || 'N/A',
                        submittedCount,
                        totalExpected: filteredHomeworkAssignments.length
                    };
                });
                setAllStudentsHomeworkStats(hwStatsResults);
            } else {
                setAllStudentsHomeworkStats([]);
            }
        } catch (error) {
            console.error("Error fetching all students stats:", error);
        }
        setIsAllStatsLoading(false);
    }

    async function handleViewStudent(student) {
        setSelectedStudent(student);
        setStudentStats(null);
        setStudentTopicProgress(null);
        setStudentGrammarProgress(null);
        setExpandedTopicId(null);
        setTopicWordsCache({});
        setGrammarQuestionsCache({});
        setStatsLoading(true);
        try {
            const stats = await getUserLearningStats(student.uid);
            setStudentStats(stats);

            // Fetch exam submissions for this student across all exam assignments of this group
            if (examAssignments.length > 0) {
                const subms = await getExamSubmissionsForAssignments(examAssignments.map(a => a.id));
                setStudentExamSubmissions(subms.filter(s => s.studentId === student.uid));
            } else {
                setStudentExamSubmissions([]);
            }

            // Fetch detailed topic progress for all accessible topics in this group plus assigned ones
            const accessibleTopicIds = topics
                .filter(t => group?.folderAccess?.includes(t.folderId))
                .map(t => t.id);
            // Separate vocab and grammar assignments
            const vocabAssignedTopicIds = assignments.filter(a => !a.isGrammar).map(a => a.topicId);
            const grammarAssignedExerciseIds = assignments.filter(a => a.isGrammar).map(a => a.topicId);
            const allVocabTopicIds = [...new Set([...accessibleTopicIds, ...vocabAssignedTopicIds])];

            if (allVocabTopicIds.length > 0) {
                const topicProgress = await getStudentTopicProgressSummary(student.uid, allVocabTopicIds);
                setStudentTopicProgress(topicProgress);
            } else {
                setStudentTopicProgress({});
            }

            // Fetch grammar progress
            if (grammarAssignedExerciseIds.length > 0) {
                const grammarProgress = await getStudentGrammarProgressSummary(student.uid, grammarAssignedExerciseIds);
                setStudentGrammarProgress(grammarProgress);
            } else {
                setStudentGrammarProgress({});
            }
        } catch (error) {
            console.error(error);
        }
        setStatsLoading(false);
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
                    const questions = await getStudentGrammarQuestionsProgress(selectedStudent.uid, topicId);
                    setGrammarQuestionsCache(prev => ({ ...prev, [topicId]: questions }));
                } catch (error) {
                    console.error(error);
                }
            }
        } else {
            if (!topicWordsCache[topicId]) {
                try {
                    const words = await getStudentTopicWordsProgress(selectedStudent.uid, topicId);
                    setTopicWordsCache(prev => ({ ...prev, [topicId]: words }));
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    function toggleStudentSelection(uid) {
        setSelectedStudentIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    }

    async function handleCreateAssignment(e) {
        e.preventDefault();
        if (!assignmentForm.topicId || !assignmentForm.dueDate) return;
        if (assignmentMode === 'individual' && selectedStudentIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 học viên');
            return;
        }
        setAssignLoading(true);
        try {
            const isTeacherTopic = assignmentForm.topicId.startsWith('teacher_');
            const isGrammar = assignmentForm.topicId.startsWith('grammar_');

            let cleanTopicId = assignmentForm.topicId;
            let selectedTopic = null;

            if (isTeacherTopic) {
                cleanTopicId = assignmentForm.topicId.replace('teacher_', '');
                selectedTopic = teacherTopics.find(t => t.id === cleanTopicId);
            } else if (isGrammar) {
                cleanTopicId = assignmentForm.topicId.replace('grammar_', '');
                selectedTopic = grammarExercises.find(t => t.id === cleanTopicId);
            } else {
                selectedTopic = topics.find(t => t.id === cleanTopicId);
            }

            if (!selectedTopic) {
                alert("Không tìm thấy chủ đề hoặc bài luyện");
                setAssignLoading(false);
                return;
            }

            const dueDateTimestamp = Timestamp.fromDate(new Date(assignmentForm.dueDate));
            const assignmentData = {
                groupId,
                topicId: cleanTopicId,
                topicName: selectedTopic.name,
                dueDate: dueDateTimestamp,
                isTeacherTopic: isTeacherTopic,
                isGrammar: isGrammar,
                createdBy: user?.uid
            };

            if (assignmentForm.scheduledStart && assignmentForm.scheduledStart !== 'pending') {
                assignmentData.scheduledStart = Timestamp.fromDate(new Date(assignmentForm.scheduledStart));
            }

            if (assignmentMode === 'individual') {
                assignmentData.assignedStudentIds = selectedStudentIds;
            }

            await createAssignment(assignmentData);
            setIsAssignModalOpen(false);
            setAssignmentForm({ topicId: '', dueDate: '', scheduledStart: '' });
            setAssignmentMode('all');
            setSelectedStudentIds([]);
            const asgns = await getAssignmentsForGroup(groupId);
            setAssignments(asgns);
        } catch (error) {
            console.error(error);
            alert("Lỗi khi giao bài luyện");
        }
        setAssignLoading(false);
    }

    async function confirmDeleteAssignment() {
        if (!assignmentToDelete) return;
        setAssignLoading(true);
        try {
            await deleteAssignment(assignmentToDelete.id);
            setAssignments(assignments.filter(a => a.id !== assignmentToDelete.id));
            // Optimistically add to deleted list so it shows in "Đã xoá" tab
            setDeletedAssignments(prev => [{ ...assignmentToDelete, isDeleted: true, deletedAt: { toDate: () => new Date(), toMillis: () => Date.now() } }, ...prev]);
            setAssignmentToDelete(null);
        } catch (error) {
            console.error(error);
            alert('Lỗi khi xoá bài luyện');
        }
        setAssignLoading(false);
    }

    async function handleConfirmDeleteExamAssignment() {
        if (!examAssignmentToDelete) return;
        setExamAssignLoading(true);
        try {
            await deleteExamAssignment(examAssignmentToDelete.id);
            setExamAssignments(examAssignments.filter(a => a.id !== examAssignmentToDelete.id));
            // Optimistically add to deleted list so it shows in "Đã xoá" tab
            setDeletedExamAssignments(prev => [{ ...examAssignmentToDelete, isDeleted: true, deletedAt: { toDate: () => new Date(), toMillis: () => Date.now() } }, ...prev]);
            setExamAssignmentToDelete(null);
        } catch (error) {
            console.error(error);
            alert('Lỗi khi xoá bài tập/kiểm tra');
        }
        setExamAssignLoading(false);
    }

    // TRASH FUNCTIONS
    async function openTrashModal() {
        setIsTrashModalOpen(true);
        await loadTrashData();
    }

    async function loadTrashData() {
        setTrashLoading(true);
        try {
            const [delAssigns, delExams] = await Promise.all([
                getDeletedAssignmentsForGroup(groupId),
                getDeletedExamAssignmentsForGroup(groupId)
            ]);
            setDeletedAssignments(delAssigns);
            setDeletedExamAssignments(delExams);
        } catch (error) {
            console.error('Error loading trash:', error);
        }
        setTrashLoading(false);
    }

    async function handleRestoreAssignment(item, type) {
        setTrashLoading(true);
        try {
            if (type === 'assignment') {
                await restoreAssignment(item.id);
                setDeletedAssignments(prev => prev.filter(a => a.id !== item.id));
                const asgns = await getAssignmentsForGroup(groupId);
                setAssignments(asgns);
            } else {
                await restoreExamAssignment(item.id);
                setDeletedExamAssignments(prev => prev.filter(a => a.id !== item.id));
                const examAsgns = await getExamAssignmentsForGroup(groupId);
                setExamAssignments(examAsgns);
            }
        } catch (error) {
            console.error('Error restoring:', error);
            alert('Lỗi khi khôi phục');
        }
        setTrashLoading(false);
    }

    async function handlePermanentlyDelete(item, type) {
        if (!confirm('Xoá vĩnh viễn? Hành động này không thể hoàn tác.')) return;
        setTrashLoading(true);
        try {
            if (type === 'assignment') {
                await permanentlyDeleteAssignment(item.id);
                setDeletedAssignments(prev => prev.filter(a => a.id !== item.id));
            } else {
                await permanentlyDeleteExamAssignment(item.id);
                setDeletedExamAssignments(prev => prev.filter(a => a.id !== item.id));
            }
        } catch (error) {
            console.error('Error permanently deleting:', error);
            alert('Lỗi khi xoá vĩnh viễn');
        }
        setTrashLoading(false);
    }

    async function handleViewAssignment(assignment) {
        setSelectedAssignment(assignment);
        setIsAssignmentProgressLoading(true);
        setAssignmentProgressData([]);
        setExpandedAssignmentStudentId(null);
        setAssignmentWordsCache({});

        try {
            const topicId = assignment.topicId;

            // If individual assignment, only fetch progress for assigned students
            const targetStudents = (assignment.assignedStudentIds && assignment.assignedStudentIds.length > 0)
                ? students.filter(s => assignment.assignedStudentIds.includes(s.uid))
                : students;

            const progressPromises = targetStudents.map(async (student) => {
                let progress;
                if (assignment.isGrammar) {
                    const summary = await getStudentGrammarProgressSummary(student.uid, [topicId]);
                    progress = summary[topicId] || { total: 0, learned: 0, learning: 0, notStarted: 0, totalCorrect: 0, totalWrong: 0 };
                } else {
                    const summary = await getStudentTopicProgressSummary(student.uid, [topicId]);
                    progress = summary[topicId] || { total: 0, learned: 0, learning: 0, notStarted: 0, totalCorrect: 0, totalWrong: 0 };
                }
                return { student, progress };
            });

            const results = await Promise.all(progressPromises);
            setAssignmentProgressData(results);
        } catch (error) {
            console.error("Error fetching assignment progress:", error);
        }
        setIsAssignmentProgressLoading(false);
    }

    async function toggleAssignmentStudentDetail(studentId, topicId, isGrammar = false) {
        if (expandedAssignmentStudentId === studentId) {
            setExpandedAssignmentStudentId(null);
            return;
        }
        setExpandedAssignmentStudentId(studentId);
        if (!assignmentWordsCache[studentId]) {
            try {
                if (isGrammar) {
                    const questions = await getStudentGrammarQuestionsProgress(studentId, topicId);
                    setAssignmentWordsCache(prev => ({ ...prev, [studentId]: { isGrammar: true, items: questions } }));
                } else {
                    const words = await getStudentTopicWordsProgress(studentId, topicId);
                    setAssignmentWordsCache(prev => ({ ...prev, [studentId]: { isGrammar: false, items: words } }));
                }
            } catch (error) {
                console.error("Error fetching assignment student detail:", error);
            }
        }
    }

    // EXAM HANDLERS
    async function handleCreateExamAssignment(e) {
        e.preventDefault();
        if (!examAssignmentForm.examId || !examAssignmentForm.dueDate) return;
        if (examAssignmentMode === 'individual' && selectedStudentIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 học viên');
            return;
        }
        setExamAssignLoading(true);
        try {
            const selectedExam = allExams.find(e => e.id === examAssignmentForm.examId);
            if (!selectedExam) {
                alert("Không tìm thấy bài tập và kiểm tra");
                setExamAssignLoading(false);
                return;
            }

            // Block if time setup is incomplete
            if (selectedExam.timingMode === 'section' && (selectedExam.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) {
                alert(`Bài "${selectedExam.name}" có section chưa đặt thời gian. Vui lòng hoàn thành thiết lập thời gian trước khi giao bài.`);
                setExamAssignLoading(false);
                return;
            }
            if (selectedExam.timingMode === 'question' && selectedExam.cachedQuestionTimeMissingCount > 0) {
                alert(`Bài "${selectedExam.name}" chưa hoàn thành thiết lập thời gian theo từng câu hỏi. Vui lòng kiểm tra thời gian từng câu trước khi giao bài.`);
                setExamAssignLoading(false);
                return;
            }

            const dueDateTimestamp = Timestamp.fromDate(new Date(examAssignmentForm.dueDate));
            const assignmentData = {
                groupId,
                examId: examAssignmentForm.examId,
                examName: selectedExam.name,
                dueDate: dueDateTimestamp,
                targetType: examAssignmentMode === 'individual' ? 'individual' : 'group',
                targetId: examAssignmentMode === 'individual' ? selectedStudentIds : groupId,
                createdBy: user?.uid,
                teacherTitle: user?.teacherTitle || '',
                studentTitle: user?.studentTitle || ''
            };

            if (examAssignmentForm.scheduledStart && examAssignmentForm.scheduledStart !== 'pending') {
                assignmentData.scheduledStart = Timestamp.fromDate(new Date(examAssignmentForm.scheduledStart));
            }

            // In individual mode, we might need a different handling if targetId is expected to be a single string.
            // Looking at examService.js, targetId is used with 'in' query for groups, and directly for individual studentId.
            // If the user wants multiple individuals, we'll create one assignment per student or update targetId handling.
            // Actually, based on getExamAssignmentsForStudent, individual assignment expects targetId to be a single studentId.

            if (examAssignmentMode === 'individual') {
                await Promise.all(selectedStudentIds.map(studentId =>
                    createExamAssignment({ ...assignmentData, targetId: studentId })
                ));
            } else {
                await createExamAssignment(assignmentData);
            }

            setIsExamAssignModalOpen(false);
            setExamAssignmentForm({ examId: '', dueDate: '', scheduledStart: '' });
            setExamAssignmentMode('all');
            setSelectedStudentIds([]);
            const asgns = await getExamAssignmentsForGroup(groupId);
            setExamAssignments(asgns);
        } catch (error) {
            console.error(error);
            alert("Lỗi khi giao bài tập và kiểm tra");
        }
        setExamAssignLoading(true); // Wait for loading to finish
        setExamAssignLoading(false);
    }

    async function handleViewExamAssignment(assignment) {
        setSelectedExamAssignment(assignment);
        setExamSubmissionsLoading(true);
        setExamPopupQuestions([]);
        try {
            const [allSubs, questions] = await Promise.all([
                getExamSubmissionsForAssignment(assignment.id),
                getExamQuestions(assignment.examId)
            ]);
            // Deduplicate: keep only the latest submission per student
            const latestMap = new Map();
            allSubs.forEach(sub => {
                const existing = latestMap.get(sub.studentId);
                if (!existing) {
                    latestMap.set(sub.studentId, sub);
                } else {
                    const existingTime = existing.updatedAt?.toMillis?.() || existing.createdAt?.toMillis?.() || 0;
                    const newTime = sub.updatedAt?.toMillis?.() || sub.createdAt?.toMillis?.() || 0;
                    if (newTime > existingTime) latestMap.set(sub.studentId, sub);
                }
            });
            const submissions = Array.from(latestMap.values());
            setExamSubmissions(submissions);
            setExamPopupQuestions(questions);
        } catch (error) {
            console.error("Error fetching exam submissions:", error);
        }
        setExamSubmissionsLoading(false);
    }



    // EXTEND DEADLINE HANDLER
    function openExtendDeadlineModal(type, item) {
        setExtendDeadlineTarget({ type, item });
        setExtendDeadlineMode('all');
        // Pre-fill with current dueDate
        const due = item.dueDate?.toDate ? item.dueDate.toDate() : new Date(item.dueDate);
        const localISO = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setExtendDeadlineDate(localISO);
        // Pre-fill individual dates from existing studentDeadlines
        const indDates = {};
        if (item.studentDeadlines) {
            Object.entries(item.studentDeadlines).forEach(([uid, ts]) => {
                const d = ts?.toDate ? ts.toDate() : new Date(ts);
                indDates[uid] = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            });
        }
        setExtendIndividualDates(indDates);
    }

    function closeExtendDeadlineModal() {
        setExtendDeadlineTarget(null);
        setExtendDeadlineDate('');
        setExtendDeadlineMode('all');
        setExtendIndividualDates({});
    }

    async function handleExtendDeadline() {
        if (!extendDeadlineTarget) return;
        setExtendDeadlineLoading(true);
        try {
            if (extendDeadlineMode === 'all') {
                if (!extendDeadlineDate) { setExtendDeadlineLoading(false); return; }
                const newTimestamp = Timestamp.fromDate(new Date(extendDeadlineDate));
                if (extendDeadlineTarget.type === 'assignment') {
                    await updateAssignmentDueDate(extendDeadlineTarget.item.id, newTimestamp);
                    setAssignments(prev => prev.map(a =>
                        a.id === extendDeadlineTarget.item.id ? { ...a, dueDate: newTimestamp } : a
                    ));
                } else {
                    await updateExamAssignmentDueDate(extendDeadlineTarget.item.id, newTimestamp);
                    setExamAssignments(prev => prev.map(a =>
                        a.id === extendDeadlineTarget.item.id ? { ...a, dueDate: newTimestamp } : a
                    ));
                }
            } else {
                // Individual mode: update each selected student's deadline
                const entries = Object.entries(extendIndividualDates).filter(([, val]) => val);
                if (entries.length === 0) { setExtendDeadlineLoading(false); return; }
                const promises = entries.map(([studentId, dateStr]) => {
                    const ts = Timestamp.fromDate(new Date(dateStr));
                    if (extendDeadlineTarget.type === 'assignment') {
                        return updateAssignmentStudentDeadline(extendDeadlineTarget.item.id, studentId, ts);
                    } else {
                        return updateExamAssignmentStudentDeadline(extendDeadlineTarget.item.id, studentId, ts);
                    }
                });
                await Promise.all(promises);
                // Update local state with the new studentDeadlines
                const newStudentDeadlines = { ...(extendDeadlineTarget.item.studentDeadlines || {}) };
                entries.forEach(([studentId, dateStr]) => {
                    newStudentDeadlines[studentId] = Timestamp.fromDate(new Date(dateStr));
                });
                if (extendDeadlineTarget.type === 'assignment') {
                    setAssignments(prev => prev.map(a =>
                        a.id === extendDeadlineTarget.item.id ? { ...a, studentDeadlines: newStudentDeadlines } : a
                    ));
                } else {
                    setExamAssignments(prev => prev.map(a =>
                        a.id === extendDeadlineTarget.item.id ? { ...a, studentDeadlines: newStudentDeadlines } : a
                    ));
                }
            }
            closeExtendDeadlineModal();
        } catch (error) {
            console.error('Error extending deadline:', error);
            alert('Lỗi khi gia hạn deadline');
        }
        setExtendDeadlineLoading(false);
    }

    async function handleOpenOverrideModal(submission, questionId, currentResult) {
        setOverrideData({
            submissionId: submission.id,
            questionId: questionId,
            score: currentResult?.teacherOverride?.score ?? currentResult?.score ?? 0,
            note: currentResult?.teacherOverride?.note ?? ''
        });
        setIsOverrideModalOpen(true);
    }

    async function handleSaveOverride() {
        try {
            const overriderName = user?.displayName || user?.email || (user?.role === 'admin' ? 'Admin' : 'Giáo viên');
            const { results, totalScore } = await overrideExamQuestionScore(
                overrideData.submissionId,
                overrideData.questionId,
                overrideData.score,
                overrideData.note,
                undefined, // newFeedback
                user?.uid,
                overriderName
            );

            // Update local state
            setExamSubmissions(prev => prev.map(sub =>
                sub.id === overrideData.submissionId ? { ...sub, results, totalScore } : sub
            ));

            setIsOverrideModalOpen(false);
        } catch (error) {
            console.error("Error overriding score:", error);
            alert("Lỗi khi cập nhật điểm");
        }
    }

    function formatDate(ts) {
        if (!ts) return '';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const absStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        if (diff <= 0) return absStr;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        let countdown;
        if (hours < 1) {
            countdown = `còn ${minutes} phút`;
        } else if (hours < 48) {
            countdown = `còn ${hours}h${minutes > 0 ? minutes + 'p' : ''}`;
        } else {
            const days = Math.floor(hours / 24);
            countdown = `còn ${days} ngày`;
        }
        return `${absStr} (${countdown})`;
    }

    if (loading) return <div className="admin-page"><div className="admin-empty-state">Đang tải chi tiết lớp học...</div></div>;
    if (!group) return <div className="admin-page"><div className="admin-empty-state">Không tìm thấy Lớp học.</div></div>;

    return (
        <div className="teacher-page-container">
            <div className="teacher-header-section">
                <button onClick={() => navigate(-1)} className="teacher-back-btn" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ArrowLeft size={16} /> Quay lại
                </button>
                <h1 className="teacher-group-title">{group.name}</h1>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    background: '#f8fafc',
                    color: '#64748b',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: '1px solid #e2e8f0'
                }}>
                    <Users size={14} /> Lớp học
                </span>
            </div>

            <div className="teacher-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`teacher-tab ${activeTab === 'students' ? 'active' : ''}`}>
                    <Users size={18} /> <span className="teacher-btn-text">Học viên</span>
                    <span className="teacher-count-badge">{students.length}</span>
                    {activeReportPeriod && (() => {
                        const missingCount = students.filter(s => !reportSentStudentIds.has(s.uid)).length;
                        return missingCount > 0 ? (
                            <span style={{
                                background: '#ef4444', color: 'white', borderRadius: '100px',
                                padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700,
                                minWidth: '18px', textAlign: 'center', lineHeight: '1.3',
                                boxShadow: '0 2px 4px rgba(239,68,68,0.3)'
                            }}>{missingCount}</span>
                        ) : null;
                    })()}
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    className={`teacher-tab ${activeTab === 'assignments' ? 'active' : ''}`}>
                    <FileText size={18} /> <span className="teacher-btn-text">Bài luyện</span>
                    {(() => {
                        const activeCount = assignments.filter(a => hasAnyActiveDeadline(a, Date.now())).length;
                        return (
                            <span className="teacher-count-badge" style={activeCount > 0 && activeTab !== 'assignments' ? { background: '#f59e0b', color: 'white' } : {}}>
                                {activeCount}
                            </span>
                        );
                    })()}
                </button>
                <button
                    onClick={() => setActiveTab('exams')}
                    className={`teacher-tab ${activeTab === 'exams' ? 'active' : ''}`}>
                    <GraduationCap size={18} /> <span className="teacher-btn-text">Bài tập và Kiểm tra</span>
                    {(() => {
                        const activeCount = examAssignments.filter(a => hasAnyActiveDeadline(a, Date.now())).length;
                        return (
                            <span className="teacher-count-badge" style={activeCount > 0 && activeTab !== 'exams' ? { background: '#8b5cf6', color: 'white' } : {}}>
                                {activeCount}
                            </span>
                        );
                    })()}
                </button>
                <button
                    onClick={() => setActiveTab('statistics')}
                    className={`teacher-tab ${activeTab === 'statistics' ? 'active' : ''}`}>
                    <PieChart size={18} /> <span className="teacher-btn-text">Thống kê</span>
                </button>
            </div>

            {/* TAB: STUDENTS */}
            {activeTab === 'students' && (
                <div className="teacher-tab-section">
                    <div className="teacher-section-content">
                        {students.length === 0 ? (
                            <div className="admin-empty-state">Lớp này chưa có học viên nào.</div>
                        ) : (
                            <div className="teacher-items-list">
                                {students.map(s => {
                                    const actData = studentsActivityData[s.uid];
                                    const streak = actData?.currentStreak || 0;
                                    const lastActive = actData?.lastActiveDate;
                                    let inactiveDays = null;
                                    if (lastActive) {
                                        const lastDate = new Date(lastActive + 'T00:00:00');
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        inactiveDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                                    }

                                    return (
                                        <div key={s.uid} className="teacher-student-card">
                                            <div className="teacher-student-info">
                                                <span className="teacher-student-email">{s.displayName || s.email.split('@')[0]}</span>
                                                <span className="teacher-student-date">{s.email}</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                    {/* Streak badge */}
                                                    {streak > 0 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa'
                                                        }}>
                                                            <Flame size={12} /> Streak: {streak}
                                                        </span>
                                                    )}
                                                    {/* Review counts — combined badge */}
                                                    {((reviewCounts[s.uid]?.vocab || 0) > 0 || (reviewCounts[s.uid]?.grammar || 0) > 0) && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a'
                                                        }}>
                                                            📋 Cần ôn:
                                                            {(reviewCounts[s.uid]?.vocab || 0) > 0 && (
                                                                <span>{reviewCounts[s.uid].vocab} từ</span>
                                                            )}
                                                            {(reviewCounts[s.uid]?.vocab || 0) > 0 && (reviewCounts[s.uid]?.grammar || 0) > 0 && (
                                                                <span style={{ opacity: 0.5 }}>·</span>
                                                            )}
                                                            {(reviewCounts[s.uid]?.grammar || 0) > 0 && (
                                                                <span>{reviewCounts[s.uid].grammar} câu</span>
                                                            )}
                                                        </span>
                                                    )}
                                                    {/* Missing student warning */}
                                                    {inactiveDays !== null && inactiveDays >= 7 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                                                        }}>
                                                            <EyeOff size={12} /> Mất tích {inactiveDays} ngày
                                                        </span>
                                                    )}
                                                    {inactiveDays !== null && inactiveDays >= 3 && inactiveDays < 7 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fefce8', color: '#ca8a04', border: '1px solid #fde68a'
                                                        }}>
                                                            <AlertTriangle size={12} /> Không hoạt động {inactiveDays} ngày
                                                        </span>
                                                    )}
                                                    {lastActive === null && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                                                        }}>
                                                            <EyeOff size={12} /> Chưa từng hoạt động
                                                        </span>
                                                    )}
                                                    {/* Report period indicator */}
                                                    {activeReportPeriod && (() => {
                                                        const periodStatus = computePeriodStatus(activeReportPeriod);
                                                        const hasSent = reportSentStudentIds.has(s.uid);
                                                        const isLate = reportLateStudentIds.has(s.uid);
                                                        const endDate = new Date(activeReportPeriod.endDate + 'T00:00:00');
                                                        const endLabel = endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                                                        const periodLabel = activeReportPeriod.label || 'Kỳ báo cáo';

                                                        if (hasSent && isLate) {
                                                            return (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                    padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: '#fefce8', color: '#ca8a04', border: '1px solid #fde68a'
                                                                }}>
                                                                    ⏰ {periodLabel} — Đã gửi (trễ)
                                                                </span>
                                                            );
                                                        }
                                                        if (hasSent) {
                                                            return (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                    padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0'
                                                                }}>
                                                                    <CheckCircle size={12} /> {periodLabel} — Đã gửi
                                                                </span>
                                                            );
                                                        }
                                                        if (periodStatus === 'grace') {
                                                            return (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                    padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                                                    animation: 'pulse 2s infinite'
                                                                }}>
                                                                    🔴 {periodLabel} — Đã trễ hẹn
                                                                </span>
                                                            );
                                                        }
                                                        if (periodStatus === 'active') {
                                                            return (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                    padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'
                                                                }}>
                                                                    📊 {periodLabel} — Chưa gửi (hạn {endLabel})
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    {/* Red Flag 3-flag indicators + "Không còn đảm bảo đầu ra" */}
                                                    {(() => {
                                                        const count = redFlagCounts[s.uid] || 0;
                                                        return (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {[1, 2, 3].map(i => {
                                                                    const isFilled = i <= count;
                                                                    const isNext = i === count + 1 && count < 3;
                                                                    const flagColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                                                    return (
                                                                        <span
                                                                            key={i}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isFilled) {
                                                                                    setRedFlagViewIndex(i);
                                                                                    setRedFlagHistoryStudent(s);
                                                                                    setRedFlagHistoryLoading(true);
                                                                                    getRedFlagsForStudentInGroup(s.uid, groupId).then(setRedFlagHistory).finally(() => setRedFlagHistoryLoading(false));
                                                                                } else if (isNext && !isStaff) {
                                                                                    setRedFlagModalStudent(s);
                                                                                    setRedFlagForm({ violationType: '', note: '' });
                                                                                    getRedFlagsForStudentInGroup(s.uid, groupId).then(setAddModalFlags);
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                width: '26px', height: '26px', borderRadius: '7px',
                                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                fontSize: '0.8rem',
                                                                                background: isFilled ? (i >= 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'transparent',
                                                                                border: isFilled ? `1.5px solid ${flagColor}40` : '1.5px solid transparent',
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
                                                                </span>
                                                                {!isStaff && count >= 3 && (
                                                                    <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                                                                        ❌ Không còn đảm bảo đầu ra
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                <Link
                                                    className="teacher-view-progress-btn"
                                                    to={isAdminView ? `/admin/groups/${groupId}/students/${s.uid}` : `/teacher/groups/${groupId}/students/${s.uid}`}
                                                    title="Tiến độ & Báo cáo"
                                                >
                                                    <BarChart3 size={18} /> <span className="teacher-btn-text">Tiến độ & Báo cáo</span>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: ASSIGNMENTS */}
            {activeTab === 'assignments' && (
                <div className="teacher-tab-section">
                    <div className="teacher-tab-actions">
                        <div className="teacher-filter-scroll-wrapper">
                            <div className="teacher-filters-container">
                                <button
                                    onClick={() => setAssignmentTypeFilter('all')}
                                    className={`teacher-filter-btn ${assignmentTypeFilter === 'all' ? 'active' : ''}`}
                                >
                                    <List size={16} /> <span>Tất cả</span>
                                </button>
                                <button
                                    onClick={() => setAssignmentTypeFilter('vocab')}
                                    className={`teacher-filter-btn vocab ${assignmentTypeFilter === 'vocab' ? 'active' : ''}`}
                                >
                                    <BookOpen size={16} /> <span>Từ vựng</span>
                                </button>
                                <button
                                    onClick={() => setAssignmentTypeFilter('grammar')}
                                    className={`teacher-filter-btn grammar ${assignmentTypeFilter === 'grammar' ? 'active' : ''}`}
                                >
                                    <CheckCircle size={16} /> <span>Kỹ năng</span>
                                </button>
                                {!isStaff && (
                                    <button
                                        onClick={() => {
                                            setAssignmentTypeFilter('deleted');
                                            loadTrashData();
                                        }}
                                        className={`teacher-filter-btn ${assignmentTypeFilter === 'deleted' ? 'active' : ''}`}
                                        style={assignmentTypeFilter === 'deleted' ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' } : { color: '#94a3b8' }}
                                    >
                                        <Trash2 size={16} /> <span>Đã xoá</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {!isStaff && (
                            <button className="admin-btn admin-btn-primary teacher-add-asgn-btn" onClick={() => setIsAssignModalOpen(true)}>
                                <Plus size={18} /> <span className="teacher-btn-text">Giao bài mới</span>
                            </button>
                        )}
                    </div>
                    <div className="teacher-section-content">
                        {assignmentTypeFilter === 'deleted' ? (
                            trashLoading ? (
                                <div className="admin-empty-state">Đang tải...</div>
                            ) : deletedAssignments.length === 0 ? (
                                <div className="admin-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0' }}>
                                    <Archive size={40} strokeWidth={1.5} color="#94a3b8" />
                                    <span>Không có bài luyện nào đã xoá</span>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Các bài đã xoá sẽ tự động bị xoá vĩnh viễn sau 30 ngày</span>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Đã xoá ({deletedAssignments.length}) · Tự xoá vĩnh viễn sau 30 ngày
                                    </div>
                                    <div className="teacher-items-list">
                                        {deletedAssignments.map(item => {
                                            const deletedDate = item.deletedAt?.toDate ? item.deletedAt.toDate() : new Date(item.deletedAt);
                                            const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)));
                                            const topicName = item.isGrammar
                                                ? (grammarExercises.find(g => g.id === item.topicId)?.name || item.topicName || 'Bài Kỹ năng')
                                                : item.isTeacherTopic
                                                    ? (teacherTopics.find(t => t.id === item.topicId)?.name || item.topicName || 'Bài từ vựng')
                                                    : (topics.find(t => t.id === item.topicId)?.name || item.topicName || 'Bài luyện');
                                            return (
                                                <div key={item.id} className="teacher-student-card" style={{ opacity: 0.75 }}>
                                                    <div className="teacher-student-info">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', textTransform: 'uppercase' }}>
                                                                {item.isGrammar ? 'Kỹ năng' : 'Từ vựng'}
                                                            </span>
                                                        </div>
                                                        <span className="teacher-student-email" style={{ color: '#64748b', fontWeight: 800, fontSize: '1rem', display: 'block', marginBottom: '8px' }}>{topicName}</span>
                                                        <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
                                                            ⏳ Còn {daysLeft} ngày trước khi xoá vĩnh viễn
                                                        </div>
                                                    </div>
                                                    <div className="teacher-assignment-actions" style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="teacher-view-progress-btn teacher-mobile-icon-btn" style={{ borderColor: '#4f46e5', color: '#4f46e5' }} onClick={() => handleRestoreAssignment(item, 'assignment')} disabled={trashLoading}>
                                                            <RotateCcw size={16} /> <span className="teacher-btn-text">Khôi phục</span>
                                                        </button>
                                                        <button className="admin-action-btn danger teacher-mobile-icon-btn" onClick={() => handlePermanentlyDelete(item, 'assignment')} disabled={trashLoading}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        ) : assignments.length === 0 ? (
                            <div className="admin-empty-state">Chưa có bài luyện nào được giao.</div>
                        ) : (
                            (() => {
                                const filteredAssignments = assignments.filter(a => {
                                    if (assignmentTypeFilter === 'vocab') return !a.isGrammar;
                                    if (assignmentTypeFilter === 'grammar') return a.isGrammar;
                                    return true;
                                }).sort((a, b) => {
                                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                                    return tB - tA;
                                });

                                const renderAssignmentCard = (a) => {
                                    const now = new Date();
                                    const due = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
                                    const isOverdue = due && due < now;
                                    const hasStudentExtensions = a.studentDeadlines && Object.keys(a.studentDeadlines).length > 0;
                                    const latestDeadline = hasStudentExtensions ? getLatestDeadline(a) : null;
                                    const hasActiveExtension = latestDeadline && latestDeadline.getTime() >= now.getTime();

                                    let actualTopic = null;
                                    if (a.isTeacherTopic) {
                                        actualTopic = teacherTopics.find(t => t.id === a.topicId);
                                    } else if (a.isGrammar) {
                                        actualTopic = grammarExercises.find(t => t.id === a.topicId);
                                    } else {
                                        actualTopic = topics.find(t => t.id === a.topicId);
                                    }
                                    const displayName = actualTopic ? actualTopic.name : a.topicName;

                                    return (
                                        <div key={a.id} className="teacher-student-card">
                                            <div className="teacher-student-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    {a.isGrammar ? (
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                                            background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            Kỹ năng
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                                            background: '#fefce8', color: '#a16207', border: '1px solid #fde68a',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            Từ vựng
                                                        </span>
                                                    )}
                                                    {a.assignedStudentIds && a.assignedStudentIds.length > 0 ? (
                                                        <span className="teacher-assignment-badge individual">
                                                            <User size={12} /> {a.assignedStudentIds.length} học viên
                                                        </span>
                                                    ) : (
                                                        <span className="teacher-assignment-badge whole-class">
                                                            <Users size={12} /> Cả lớp
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="teacher-student-email" style={{ color: '#1e293b', fontWeight: 800, fontSize: '1rem', display: 'block', marginBottom: '8px' }}>{displayName}</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                                                        background: (isOverdue && !hasActiveExtension) ? '#fee2e2' : '#f0fdf4', color: (isOverdue && !hasActiveExtension) ? '#ef4444' : '#10b981', width: 'fit-content'
                                                    }}>
                                                        <Clock size={14} /> Hạn: {formatDate(a.dueDate)}
                                                    </span>
                                                    {(() => {
                                                        if (!a.scheduledStart) return null;
                                                        const ss = a.scheduledStart.toDate ? a.scheduledStart.toDate() : new Date(a.scheduledStart);
                                                        const isFuture = ss > new Date();
                                                        return (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                                                background: isFuture ? '#fef3c7' : '#ecfdf5', color: isFuture ? '#d97706' : '#059669', border: `1px solid ${isFuture ? '#fde68a' : '#a7f3d0'}`
                                                            }}>
                                                                {isFuture ? '🕐 Sẽ mở lúc' : '✅ Đã mở từ'} {ss.toLocaleString('vi-VN')}
                                                            </span>
                                                        );
                                                    })()}
                                                    {hasActiveExtension && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fff7ed', color: '#f59e0b', border: '1px solid #fed7aa'
                                                        }}>
                                                            ⏰ Gia hạn cá nhân đến {formatDate(latestDeadline)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="teacher-assignment-actions" style={{ display: 'flex', gap: '8px' }}>
                                                <button className="teacher-view-progress-btn teacher-mobile-icon-btn" onClick={() => handleViewAssignment(a)} title="Xem tiến độ">
                                                    <BarChart3 size={18} /> <span className="teacher-btn-text">Xem tiến độ</span>
                                                </button>
                                                {!isStaff && (
                                                    <button className="admin-action-btn teacher-mobile-icon-btn" onClick={() => openExtendDeadlineModal('assignment', a)} title="Gia hạn" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                                                        <CalendarClock size={18} />
                                                    </button>
                                                )}
                                                {!isStaff && (
                                                    <button className="admin-action-btn danger teacher-mobile-icon-btn" onClick={() => setAssignmentToDelete(a)} title="Xóa">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                const nowTime = new Date().getTime();
                                const activeAssignments = filteredAssignments.filter(a => hasAnyActiveDeadline(a, nowTime));
                                const expiredAssignments = filteredAssignments.filter(a => !hasAnyActiveDeadline(a, nowTime));

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {activeAssignments.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Còn hạn ({activeAssignments.length})
                                                </div>
                                                <div className="teacher-items-list">
                                                    {activeAssignments.map(renderAssignmentCard)}
                                                </div>
                                            </div>
                                        )}
                                        {expiredAssignments.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Đã hết hạn ({expiredAssignments.length})
                                                </div>
                                                <div className="teacher-items-list">
                                                    {expiredAssignments.map(renderAssignmentCard)}
                                                </div>
                                            </div>
                                        )}
                                        {activeAssignments.length === 0 && expiredAssignments.length === 0 && (
                                            <div className="admin-empty-state">Không có bài luyện nào phù hợp.</div>
                                        )}
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* STUDENT STATS MODAL */}
            {selectedStudent && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide">
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setSelectedStudent(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="teacher-modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', paddingRight: '40px', textAlign: 'center' }}>
                                {selectedStudent.displayName || selectedStudent.email}
                            </h2>
                        </div>

                        {statsLoading ? (
                            <div className="admin-empty-state">Đang tải dữ liệu học tập...</div>
                        ) : studentStats ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                                    <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>{studentStats.learnedWords}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Đã thuộc</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ca8a04' }}>{studentStats.totalWords}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#ca8a04', fontWeight: 700, textTransform: 'uppercase' }}>Đang học</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ca8a04' }}>{studentStats.totalReviews}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#ca8a04', fontWeight: 700, textTransform: 'uppercase' }}>Ôn tập</div>
                                    </div>
                                </div>

                                {/* Chi tiết topic đã giao hoặc có quyền truy cập */}
                                {studentTopicProgress && Object.keys(studentTopicProgress).length > 0 ? (
                                    <div style={{ marginTop: '0' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#475569', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <BarChart3 size={18} color="#16a34a" />
                                            Tiến độ chi tiết
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {(() => {
                                                const topicsToShow = Object.keys(studentTopicProgress)
                                                    .map(tId => topics.find(t => t.id === tId) || { id: tId, name: assignments.find(a => a.topicId === tId)?.topicName || 'Unknown Topic', folderId: 'unassigned' })
                                                    .filter(Boolean);

                                                const grouped = {};
                                                topicsToShow.forEach(t => {
                                                    const fId = t.folderId || 'unassigned';
                                                    if (!grouped[fId]) grouped[fId] = [];
                                                    grouped[fId].push(t);
                                                });

                                                return Object.entries(grouped).map(([folderId, folderTopics]) => {
                                                    const folder = folders.find(f => f.id === folderId);
                                                    return (
                                                        <div key={folderId} style={{ marginBottom: '8px' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                                                                {folder?.name || (folderId === 'unassigned' ? 'BÀI LUYỆN TỪ VỰNG' : 'THƯ MỤC KHÁC')}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                {folderTopics.sort((a, b) => {
                                                                    const aAssign = assignments.find(x => x.topicId === a.id);
                                                                    const bAssign = assignments.find(x => x.topicId === b.id);
                                                                    const aTime = aAssign?.createdAt?.toMillis ? aAssign.createdAt.toMillis() : 0;
                                                                    const bTime = bAssign?.createdAt?.toMillis ? bAssign.createdAt.toMillis() : 0;
                                                                    return bTime - aTime;
                                                                }).map(topic => {
                                                                    const prog = studentTopicProgress[topic.id];
                                                                    if (!prog) return null;
                                                                    const { total, learned, learning, notStarted, totalCorrect: tc, totalWrong: tw } = prog;
                                                                    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
                                                                    const attempts = (tc ?? 0) + (tw ?? 0);
                                                                    const errorRate = attempts > 0 ? Math.round(((tw ?? 0) / attempts) * 100) : 0;

                                                                    return (
                                                                        <div key={topic.id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                                            {/* Card Header (Clickable) */}
                                                                            <div
                                                                                onClick={() => toggleTopicDetail(topic.id)}
                                                                                style={{ padding: '16px', cursor: 'pointer' }}
                                                                            >
                                                                                <div className="student-card-header">
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: '#fefce8', color: '#a16207', border: '1px solid #fde68a', textTransform: 'uppercase' }}>Từ vựng</span>
                                                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{topic.name}</span>
                                                                                    </div>
                                                                                    <div className="student-card-stats">
                                                                                        {attempts > 0 && (
                                                                                            <span style={{
                                                                                                fontSize: '0.7rem', fontWeight: 700,
                                                                                                color: getErrorStyle(errorRate).color,
                                                                                                background: getErrorStyle(errorRate).bg,
                                                                                                padding: '2px 8px', borderRadius: '8px'
                                                                                            }}>
                                                                                                Sai: {errorRate}%
                                                                                            </span>
                                                                                        )}
                                                                                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: percent === 100 ? '#10b981' : '#f59e0b' }}>{percent}%</span>
                                                                                    </div>
                                                                                </div>
                                                                                {/* Progress Bar */}
                                                                                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                                                                                    <div style={{ width: `${(learned / total) * 100}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }} />
                                                                                    <div style={{ width: `${(learning / total) * 100}%`, background: '#facc15' }} />
                                                                                </div>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                                                                    <span>{learned}/{total} từ</span>
                                                                                    <span>{expandedTopicId === topic.id ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Expanded Word List */}
                                                                            {expandedTopicId === topic.id && (
                                                                                <div style={{ padding: '0 16px 16px 16px', background: '#f8fafc' }}>
                                                                                    {!topicWordsCache[topic.id] ? (
                                                                                        <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Đang tải...</div>
                                                                                    ) : (
                                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                                            {topicWordsCache[topic.id].map(w => {
                                                                                                const isLearned = w.progress && w.progress.level >= 1;
                                                                                                const isLearning = w.progress && w.progress.level === 0;

                                                                                                let color = '#94a3b8';
                                                                                                let bg = '#fff';
                                                                                                if (isLearned) { color = '#16a34a'; bg = '#f0fdf4'; }
                                                                                                else if (isLearning) { color = '#ca8a04'; bg = '#fefce8'; }

                                                                                                return (
                                                                                                    <span key={w.id || w.word} style={{
                                                                                                        padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
                                                                                                        background: bg, color: color, border: `1px solid ${bg === '#fff' ? '#f1f5f9' : 'transparent'}`
                                                                                                    }}>
                                                                                                        {w.word}
                                                                                                    </span>
                                                                                                )
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                        Chưa có bài học từ vựng nào được giao.
                                    </div>
                                )}

                                {/* Grammar Exercises Section */}
                                {studentGrammarProgress && Object.keys(studentGrammarProgress).length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                                            BÀI LUYỆN KỸ NĂNG
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {Object.entries(studentGrammarProgress).sort(([aId], [bId]) => {
                                                const aAssign = assignments.find(x => x.topicId === aId);
                                                const bAssign = assignments.find(x => x.topicId === bId);
                                                const aTime = aAssign?.createdAt?.toMillis ? aAssign.createdAt.toMillis() : 0;
                                                const bTime = bAssign?.createdAt?.toMillis ? bAssign.createdAt.toMillis() : 0;
                                                return bTime - aTime;
                                            }).map(([exId, prog]) => {
                                                const exercise = grammarExercises.find(e => e.id === exId);
                                                const exerciseName = exercise?.name || assignments.find(a => a.topicId === exId)?.topicName || 'Bài luyện kỹ năng';
                                                const { total, learned, learning } = prog;
                                                const percent = total > 0 ? Math.round((learned / total) * 100) : 0;

                                                return (
                                                    <div key={exId} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div
                                                            onClick={() => toggleTopicDetail(exId, true)}
                                                            style={{ padding: '16px', cursor: 'pointer' }}
                                                        >
                                                            <div className="student-card-header">
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}>KỸ NĂNG</span>
                                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{exerciseName}</span>
                                                                </div>
                                                                <div className="student-card-stats">
                                                                    {(() => { const att = learned + learning; const er = att > 0 ? Math.round((learning / att) * 100) : 0; const style = getErrorStyle(er); return att > 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: style.color, background: style.bg, padding: '2px 8px', borderRadius: '8px' }}>Sai: {er}%</span> : null; })()}
                                                                    <span style={{ fontWeight: 900, fontSize: '0.9rem', color: percent === 100 ? '#10b981' : '#f59e0b' }}>{percent}%</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                                                                <div style={{ width: `${total > 0 ? (learned / total) * 100 : 0}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }} />
                                                                <div style={{ width: `${total > 0 ? (learning / total) * 100 : 0}%`, background: '#facc15' }} />
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                                                <span>{learned}/{total} câu</span>
                                                                <span>{expandedTopicId === exId ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                                                            </div>
                                                        </div>

                                                        {expandedTopicId === exId && (
                                                            <div style={{ padding: '0 16px 16px 16px', background: '#f8fafc' }}>
                                                                {!grammarQuestionsCache[exId] ? (
                                                                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Đang tải...</div>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                        {grammarQuestionsCache[exId].map((q, qIdx) => {
                                                                            const variationsPassed = q.progress?.variationsPassed || [];
                                                                            const passedCount = variationsPassed.length;
                                                                            const totalVars = Math.max((q.variations || []).filter(v => v && (v.text || v.content)).length, 1);
                                                                            const isLearned = q.progress && passedCount >= 1;

                                                                            // Total attempts = fails + passes (tổng số lần làm, kể cả vòng lại)
                                                                            const fc = q.progress?.failCount ?? 0;
                                                                            const pc = q.progress?.passCount ?? 0;
                                                                            const totalAttempts = q.progress ? Math.max(fc + pc, 1) : 0;

                                                                            let color = '#94a3b8';
                                                                            let bg = '#fff';
                                                                            if (q.progress) {
                                                                                if (totalAttempts <= 1) { color = '#16a34a'; bg = '#f0fdf4'; }
                                                                                else if (totalAttempts <= 2) { color = '#ca8a04'; bg = '#fefce8'; }
                                                                                else if (totalAttempts <= 3) { color = '#f97316'; bg = '#fff7ed'; }
                                                                                else { color = '#ef4444'; bg = '#fef2f2'; }
                                                                            }

                                                                            const statusLabel = isLearned ? 'Hoàn thành' : 'Chưa hoàn thành';

                                                                            return (
                                                                                <div key={q.id} style={{
                                                                                    padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem',
                                                                                    background: bg, color: '#1e293b', border: `1px solid ${bg === '#fff' ? '#f1f5f9' : 'transparent'}`,
                                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                                                                                }}>
                                                                                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.78rem', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                        {q.sentence || q.originalSentence || `Câu ${qIdx + 1}`}
                                                                                        {q.type && (
                                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                                                                {{ multiple_choice: 'Trắc nghiệm', fill_in_blank: 'Chọn đáp án cho chỗ trống', fill_in_blanks: 'Viết vào chỗ trống', fill_in_blank_typing: 'Điền từ', matching: 'Nối cặp', categorization: 'Phân loại', essay: 'Tự luận', audio_recording: 'Ghi âm', ordering: 'Sắp xếp' }[q.type] || q.type}
                                                                                            </span>
                                                                                        )}
                                                                                        <span style={{ color: '#94a3b8', fontWeight: 500 }}>({totalVars} dạng)</span>
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
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Exam Results Section */}
                                {examAssignments.length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                                            BÀI TẬP VÀ KIỂM TRA
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {[...examAssignments].sort((a, b) => {
                                                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                                                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                                                return bTime - aTime;
                                            }).map(a => {
                                                const sub = studentExamSubmissions.find(s => s.assignmentId === a.id);
                                                const statusMap = {
                                                    'in_progress': { label: 'Đang làm', color: '#f59e0b', bg: '#fef3c7' },
                                                    'submitted': { label: 'Đã nộp', color: '#3b82f6', bg: '#eff6ff' },
                                                    'graded': { label: 'AI đã chấm', color: '#10b981', bg: '#ecfdf4' },
                                                    'released': { label: 'Đã trả kết quả', color: '#7c3aed', bg: '#f5f3ff' }
                                                };
                                                const statusKey = sub ? (sub.status === 'graded' && sub.resultsReleased ? 'released' : sub.status) : 'none';
                                                const subHasError = sub?.results && (
                                                    Object.values(sub.results).some(r => r.feedback && (r.feedback.includes('Lỗi khi chấm') || r.feedback.includes('chấm thủ công') || r.feedback.includes('chưa được AI chấm')))
                                                    || Object.entries(sub.results).some(([qId, r]) => (r.score === 0 || r.score === undefined) && !r.feedback && !r.teacherOverride && Object.values(sub.answers || {}).some(sec => sec?.[qId]?.answer?.hasRecording))
                                                );
                                                let statusStyle = sub ? (statusMap[statusKey] || statusMap['submitted']) : (() => {
                                                    const studentDl = a.studentDeadlines?.[selectedStudent?.uid];
                                                    const dl = studentDl ? (studentDl.toDate ? studentDl.toDate() : new Date(studentDl)) : (a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null);
                                                    const deadlinePassed = dl && dl.getTime() <= Date.now();
                                                    return deadlinePassed
                                                        ? { label: 'Không hoàn thành', color: '#ef4444', bg: '#fef2f2' }
                                                        : { label: 'Chưa làm', color: '#94a3b8', bg: '#f8fafc' };
                                                })();
                                                if (subHasError && sub?.status === 'graded' && !sub?.resultsReleased) {
                                                    statusStyle = { label: 'AI chấm sót', color: '#ea580c', bg: '#fff7ed' };
                                                }
                                                // Follow-up status overrides
                                                if (sub && sub.resultsReleased && sub.followUpRequested && Object.keys(sub.followUpRequested).length > 0) {
                                                    const fuReq = sub.followUpRequested;
                                                    const fuAns = sub.followUpAnswers || {};
                                                    const fuRes = sub.followUpResults || {};
                                                    const hasAllAnswers = Object.keys(fuReq).every(qId => Object.values(fuAns).some(sec => sec?.[qId]));
                                                    const hasAllGraded = Object.keys(fuReq).every(qId => fuRes[qId]);
                                                    if (sub.followUpResultsReleased) {
                                                        statusStyle = { label: 'Đã trả bài sửa', color: '#059669', bg: '#ecfdf5' };
                                                    } else if (hasAllGraded) {
                                                        statusStyle = { label: 'AI đã chấm bài sửa', color: '#0891b2', bg: '#ecfeff' };
                                                    } else if (hasAllAnswers) {
                                                        statusStyle = { label: 'Đã nộp bài sửa', color: '#6d28d9', bg: '#f5f3ff' };
                                                    } else {
                                                        statusStyle = { label: 'Chờ bài sửa', color: '#d97706', bg: '#fffbeb' };
                                                    }
                                                }

                                                return (
                                                    <div key={a.id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div className="student-card-header">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: (allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#fef2f2' : '#f5f3ff', color: (allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#dc2626' : '#7c3aed', border: `1px solid ${(allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#fecaca' : '#ddd6fe'}` }}>{(allExams.find(e => e.id === a.examId)?.examType === 'test') ? 'KIỂM TRA' : 'BÀI TẬP'}</span>
                                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{allExams.find(e => e.id === a.examId)?.name || a.examName}</span>
                                                            </div>
                                                            <div className="student-card-stats" style={{ gap: '10px' }}>
                                                                {sub && sub.totalScore !== undefined && (
                                                                    <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#6366f1' }}>
                                                                        {Math.round(sub.totalScore * 10) / 10}/{sub.maxTotalScore}
                                                                    </span>
                                                                )}
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 800,
                                                                    color: statusStyle.color,
                                                                    background: statusStyle.bg
                                                                }}>
                                                                    {statusStyle.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="admin-empty-state">Không có dữ liệu.</div>
                        )}
                        {/* The 'Đóng cửa sổ' button was removed per request */}
                    </div>
                </div>
            )}

            {/* ASSIGNMENT MODAL */}
            {isAssignModalOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '500px', overflow: topicPickerOpen ? 'visible' : 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => { setIsAssignModalOpen(false); setAssignmentMode('all'); setSelectedStudentIds([]); }} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <Plus size={24} color="#4f46e5" /> Giao bài mới
                        </h2>

                        <form onSubmit={handleCreateAssignment}>
                            <div className="teacher-form-group">
                                <label className="teacher-form-label">
                                    <BookOpen size={16} /> Chọn bài học
                                </label>
                                {/* Hidden input for form validation */}
                                <input type="hidden" required value={assignmentForm.topicId} />
                                <div style={{ position: 'relative' }}>
                                    {/* Trigger Button */}
                                    <div className="teacher-input-wrapper" onClick={() => { setTopicPickerOpen(!topicPickerOpen); setTopicSearch(''); }}>
                                        <span className="teacher-input-icon"><BookOpen size={18} /></span>
                                        <div className={`topic-picker-trigger ${!assignmentForm.topicId ? 'placeholder' : ''} ${topicPickerOpen ? 'open' : ''}`}>
                                            {(() => {
                                                if (!assignmentForm.topicId) return '-- Chọn một bài học --';
                                                const val = assignmentForm.topicId;
                                                if (val.startsWith('teacher_')) {
                                                    const t = teacherTopics.find(x => x.id === val.replace('teacher_', ''));
                                                    return t ? t.name : val;
                                                }
                                                if (val.startsWith('grammar_')) {
                                                    const t = grammarExercises.find(x => x.id === val.replace('grammar_', ''));
                                                    return t ? t.name : val;
                                                }
                                                const t = topics.find(x => x.id === val);
                                                return t ? t.name : val;
                                            })()}
                                        </div>
                                        <div style={{ position: 'absolute', right: '16px', pointerEvents: 'none', color: '#94a3b8' }}>
                                            <ChevronDown size={18} style={{ transition: 'transform 0.2s', transform: topicPickerOpen ? 'rotate(180deg)' : 'none' }} />
                                        </div>
                                    </div>

                                    {/* Picker Panel */}
                                    {topicPickerOpen && (
                                        <div className="topic-picker-panel">
                                            <div className="topic-picker-search-wrapper" style={{ padding: '8px 10px 4px 10px' }}>
                                                <Search size={14} className="topic-picker-search-icon" />
                                                <input
                                                    type="text"
                                                    className="topic-picker-search"
                                                    placeholder="Tìm kiếm bài học..."
                                                    value={topicSearch}
                                                    onChange={e => setTopicSearch(e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                    autoFocus
                                                    style={{ padding: '7px 10px 7px 32px', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', padding: '2px 16px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, marginRight: '2px' }}>Loại</span>
                                                {[{ v: 'all', l: 'Tất cả' }, { v: 'vocab', l: 'Từ vựng' }, { v: 'grammar', l: 'Kỹ năng' }].map(tab => (
                                                    <button
                                                        key={tab.v}
                                                        type="button"
                                                        className={`topic-picker-tab ${topicTypeFilter === tab.v ? 'active' : ''}`}
                                                        onClick={e => { e.stopPropagation(); setTopicTypeFilter(tab.v); }}
                                                        style={{
                                                            padding: '3px 10px', fontSize: '0.72rem', borderRadius: '6px',
                                                            ...(topicTypeFilter === tab.v && tab.v === 'vocab' ? { color: '#a16207', background: '#fefce8' } : {}),
                                                            ...(topicTypeFilter === tab.v && tab.v === 'grammar' ? { color: '#0e7490', background: '#ecfeff' } : {})
                                                        }}
                                                    >
                                                        {tab.l}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', padding: '2px 16px 6px 16px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, marginRight: '2px' }}>Nguồn</span>
                                                {[{ v: 'all', l: 'Tất cả' }, { v: 'mine', l: 'Tự soạn' }, { v: 'default', l: 'Chính thức' }].map(tab => (
                                                    <button
                                                        key={tab.v}
                                                        type="button"
                                                        className={`topic-picker-tab ${topicSourceFilter === tab.v ? 'active' : ''}`}
                                                        onClick={e => { e.stopPropagation(); setTopicSourceFilter(tab.v); }}
                                                        style={{ padding: '3px 10px', fontSize: '0.72rem', borderRadius: '6px' }}
                                                    >
                                                        {tab.l}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="topic-picker-list">
                                                {(() => {
                                                    const searchLower = topicSearch.toLowerCase().trim();

                                                    // For non-admin teachers, filter admin content by group access
                                                    const groupFolderAccess = group?.folderAccess || [];
                                                    const groupTopicAccess = group?.topicAccess || [];

                                                    // Filter admin folders by group access (admin sees all)
                                                    const accessibleAdminFolders = isAdminView
                                                        ? (folders || [])
                                                        : (folders || []).filter(f => f.isPublic || groupFolderAccess.includes(f.id));

                                                    // Build a merged folder map: folderId -> { id, name, order }
                                                    // Admin folders (topic_folders) contain topicIds array
                                                    const adminTopicFolderMap = {}; // topicId -> folderId
                                                    accessibleAdminFolders.forEach(f => {
                                                        (f.topicIds || []).forEach(tid => { adminTopicFolderMap[tid] = f.id; });
                                                    });

                                                    // Build set of accessible admin topic IDs (topics in accessible folders + explicitly granted)
                                                    const accessibleAdminTopicIds = new Set(groupTopicAccess);
                                                    accessibleAdminFolders.forEach(f => {
                                                        (f.topicIds || []).forEach(tid => accessibleAdminTopicIds.add(tid));
                                                    });

                                                    // Filter admin topics by access (admin sees all)
                                                    const accessibleAdminTopics = isAdminView
                                                        ? (topics || [])
                                                        : (topics || []).filter(t => t.isPublic || accessibleAdminTopicIds.has(t.id));

                                                    // Teacher topic folders: topics reference folderId directly
                                                    // Teacher grammar folders: exercises reference folderId directly
                                                    // Build unified folder lookup
                                                    const allPickerFolders = new Map(); // folderId -> { id, name, order }
                                                    accessibleAdminFolders.forEach(f => allPickerFolders.set(f.id, { id: f.id, name: f.name, order: f.order || 0, icon: f.icon }));
                                                    (teacherTopicFoldersData || []).forEach(f => { if (!allPickerFolders.has(f.id)) allPickerFolders.set(f.id, { id: f.id, name: f.name, order: f.order || 0, icon: f.icon }); });
                                                    (teacherGrammarFoldersData || []).forEach(f => { if (!allPickerFolders.has(f.id)) allPickerFolders.set(f.id, { id: f.id, name: f.name, order: f.order || 0, icon: f.icon }); });

                                                    const showVocab = topicTypeFilter === 'all' || topicTypeFilter === 'vocab';
                                                    const showGrammar = topicTypeFilter === 'all' || topicTypeFilter === 'grammar';
                                                    const showMine = topicSourceFilter === 'all' || topicSourceFilter === 'mine';
                                                    const showDefault = topicSourceFilter === 'all' || topicSourceFilter === 'default';

                                                    // Collect all matching items
                                                    const allItems = [];

                                                    // Helper to determine folderId for a topic
                                                    const getTopicFolderId = (t, isTeacher) => {
                                                        if (isTeacher) return t.folderId || null;
                                                        return adminTopicFolderMap[t.id] || t.folderId || null;
                                                    };

                                                    // My vocab topics
                                                    if (showVocab && showMine) {
                                                        teacherTopics.filter(t => t.teacherId === user?.uid)
                                                            .filter(t => !searchLower || t.name.toLowerCase().includes(searchLower))
                                                            .forEach(t => allItems.push({ type: 'item', id: `teacher_${t.id}`, name: t.name, badge: 'vocab', badgeText: 'Từ vựng', createdAt: t.createdAt, folderId: getTopicFolderId(t, true) }));
                                                    }

                                                    // Default vocab (accessible admin topics + public teacher topics)
                                                    if (showVocab && showDefault) {
                                                        accessibleAdminTopics.filter(t => !searchLower || t.name.toLowerCase().includes(searchLower))
                                                            .forEach(t => allItems.push({ type: 'item', id: t.id, name: t.name, badge: 'default', badgeText: 'Từ vựng', createdAt: t.createdAt, folderId: getTopicFolderId(t, false) }));
                                                        teacherTopics.filter(t => t.teacherId !== user?.uid).filter(t => !searchLower || t.name.toLowerCase().includes(searchLower))
                                                            .forEach(t => allItems.push({ type: 'item', id: `teacher_${t.id}`, name: t.name, badge: 'vocab', badgeText: 'Từ vựng', createdAt: t.createdAt, folderId: getTopicFolderId(t, true) }));
                                                    }

                                                    // My grammar exercises
                                                    if (showGrammar && showMine) {
                                                        (grammarExercises || []).filter(t => t.teacherId === user?.uid).filter(t => !searchLower || t.name.toLowerCase().includes(searchLower))
                                                            .forEach(t => allItems.push({ type: 'item', id: `grammar_${t.id}`, name: t.name, badge: 'grammar', badgeText: 'Kỹ năng', createdAt: t.createdAt, folderId: t.folderId || null }));
                                                    }

                                                    // Default grammar
                                                    if (showGrammar && showDefault) {
                                                        (grammarExercises || []).filter(t => t.teacherId !== user?.uid).filter(t => !searchLower || t.name.toLowerCase().includes(searchLower))
                                                            .forEach(t => allItems.push({ type: 'item', id: `grammar_${t.id}`, name: t.name, badge: 'grammar', badgeText: 'Kỹ năng', createdAt: t.createdAt, folderId: t.folderId || null }));
                                                    }

                                                    if (allItems.length === 0) {
                                                        return <div className="topic-picker-empty">Không tìm thấy bài học nào.</div>;
                                                    }

                                                    // Group by folderId
                                                    const folderGroups = {}; // folderId -> items[]
                                                    const noFolderItems = [];
                                                    allItems.forEach(item => {
                                                        if (item.folderId) {
                                                            if (!folderGroups[item.folderId]) folderGroups[item.folderId] = [];
                                                            folderGroups[item.folderId].push(item);
                                                        } else {
                                                            noFolderItems.push(item);
                                                        }
                                                    });

                                                    // Sort items inside each folder by createdAt newest first
                                                    const sortItems = (arr) => arr.sort((a, b) => {
                                                        const ta = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                                                        const tb = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                                                        return tb - ta;
                                                    });

                                                    // Build ordered folder list
                                                    const orderedFolderIds = Object.keys(folderGroups).sort((a, b) => {
                                                        const fa = allPickerFolders.get(a);
                                                        const fb = allPickerFolders.get(b);
                                                        return (fa?.order || 0) - (fb?.order || 0);
                                                    });

                                                    // When searching, auto-expand all folders
                                                    const isSearching = !!searchLower;

                                                    const renderItem = (item) => {
                                                        const isSelected = assignmentForm.topicId === item.id;
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`topic-picker-item ${isSelected ? 'selected' : ''}`}
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    setAssignmentForm({ ...assignmentForm, topicId: item.id });
                                                                    setTopicPickerOpen(false);
                                                                    setTopicSearch('');
                                                                }}
                                                            >
                                                                <span className={`topic-picker-badge ${item.badge}`}>{item.badgeText}</span>
                                                                <span className="topic-picker-item-name">{item.name}</span>
                                                                {isSelected && <Check size={16} className="topic-picker-check" />}
                                                            </div>
                                                        );
                                                    };

                                                    return (
                                                        <>
                                                            {orderedFolderIds.map(folderId => {
                                                                const folder = allPickerFolders.get(folderId);
                                                                const folderItems = sortItems(folderGroups[folderId]);
                                                                const isExpanded = isSearching || expandedPickerFolders.has(folderId);
                                                                return (
                                                                    <div key={folderId} className="picker-folder-group">
                                                                        <div
                                                                            className={`picker-folder-header ${isExpanded ? 'expanded' : ''}`}
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                setExpandedPickerFolders(prev => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has(folderId)) next.delete(folderId);
                                                                                    else next.add(folderId);
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        >
                                                                            <div className="picker-folder-header-left">
                                                                                <FolderOpen size={15} />
                                                                                <span>{folder?.name || 'Thư mục'}</span>
                                                                                <span className="picker-folder-count">{folderItems.length}</span>
                                                                            </div>
                                                                            <ChevronDown size={16} className={`picker-folder-chevron ${isExpanded ? 'expanded' : ''}`} />
                                                                        </div>
                                                                        {isExpanded && (
                                                                            <div className="picker-folder-items">
                                                                                {folderItems.map(renderItem)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {noFolderItems.length > 0 && (
                                                                <div className="picker-folder-group">
                                                                    {orderedFolderIds.length > 0 && (
                                                                        <div
                                                                            className={`picker-folder-header no-folder ${isSearching || expandedPickerFolders.has('__none__') ? 'expanded' : ''}`}
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                setExpandedPickerFolders(prev => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has('__none__')) next.delete('__none__');
                                                                                    else next.add('__none__');
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        >
                                                                            <div className="picker-folder-header-left">
                                                                                <FileText size={15} />
                                                                                <span>Không có thư mục</span>
                                                                                <span className="picker-folder-count">{noFolderItems.length}</span>
                                                                            </div>
                                                                            <ChevronDown size={16} className={`picker-folder-chevron ${isSearching || expandedPickerFolders.has('__none__') ? 'expanded' : ''}`} />
                                                                        </div>
                                                                    )}
                                                                    {(orderedFolderIds.length === 0 || isSearching || expandedPickerFolders.has('__none__')) && (
                                                                        <div className="picker-folder-items">
                                                                            {sortItems(noFolderItems).map(renderItem)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scheduled Start Toggle */}
                            <div className="teacher-form-group">
                                <label className="teacher-form-label">
                                    ⏰ Thời điểm bắt đầu
                                </label>
                                <div className="teacher-assign-mode-toggle">
                                    <button
                                        type="button"
                                        className={`teacher-assign-mode-btn ${!assignmentForm.scheduledStart ? 'active' : ''}`}
                                        onClick={() => setAssignmentForm({ ...assignmentForm, scheduledStart: '' })}
                                        style={!assignmentForm.scheduledStart ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderColor: '#059669' } : {}}
                                    >
                                        Bắt đầu ngay
                                    </button>
                                    <button
                                        type="button"
                                        className={`teacher-assign-mode-btn ${assignmentForm.scheduledStart ? 'active' : ''}`}
                                        onClick={() => setAssignmentForm({ ...assignmentForm, scheduledStart: 'pending' })}
                                        style={assignmentForm.scheduledStart ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', borderColor: '#d97706' } : {}}
                                    >
                                        Hẹn ngày...
                                    </button>
                                </div>
                                {assignmentForm.scheduledStart && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div className="teacher-input-wrapper">
                                            <span className="teacher-input-icon">📅</span>
                                            <input
                                                type="datetime-local"
                                                className="teacher-input"
                                                value={assignmentForm.scheduledStart === 'pending' ? '' : assignmentForm.scheduledStart}
                                                onChange={e => setAssignmentForm({ ...assignmentForm, scheduledStart: e.target.value })}
                                                style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
                                            />
                                        </div>
                                        {assignmentForm.scheduledStart && assignmentForm.scheduledStart !== 'pending' && assignmentForm.dueDate && new Date(assignmentForm.scheduledStart) >= new Date(assignmentForm.dueDate) && (
                                            <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0', fontWeight: 600 }}>⚠ Ngày bắt đầu phải trước hạn nộp!</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="teacher-form-group">
                                <label className="teacher-form-label">
                                    <Clock size={16} /> Hạn chót (Deadline)
                                </label>
                                <div className="teacher-input-wrapper">
                                    <span className="teacher-input-icon"><Clock size={18} /></span>
                                    <input
                                        type="datetime-local" className="teacher-input" required
                                        value={assignmentForm.dueDate}
                                        onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Assignment Mode Toggle */}
                            <div className="teacher-form-group">
                                <label className="teacher-form-label">
                                    <UserCheck size={16} /> Giao cho
                                </label>
                                <div className="teacher-assign-mode-toggle">
                                    <button
                                        type="button"
                                        className={`teacher-assign-mode-btn ${assignmentMode === 'all' ? 'active' : ''}`}
                                        onClick={() => { setAssignmentMode('all'); setSelectedStudentIds([]); }}
                                    >
                                        <Users size={16} /> Cả lớp
                                    </button>
                                    <button
                                        type="button"
                                        className={`teacher-assign-mode-btn ${assignmentMode === 'individual' ? 'active' : ''}`}
                                        onClick={() => setAssignmentMode('individual')}
                                    >
                                        <User size={16} /> Chọn
                                    </button>
                                </div>

                                {/* Student Selection List */}
                                {assignmentMode === 'individual' && (
                                    <div style={{ marginTop: '12px' }}>
                                        {students.length === 0 ? (
                                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '12px' }}>
                                                Lớp chưa có học viên nào.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="teacher-student-select-all">
                                                    <span className="teacher-student-select-count">
                                                        Đã chọn {selectedStudentIds.length}/{students.length}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (selectedStudentIds.length === students.length) {
                                                                setSelectedStudentIds([]);
                                                            } else {
                                                                setSelectedStudentIds(students.map(s => s.uid));
                                                            }
                                                        }}
                                                    >
                                                        {selectedStudentIds.length === students.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                    </button>
                                                </div>
                                                <div className="teacher-student-select-list">
                                                    {students.map(s => {
                                                        const isSelected = selectedStudentIds.includes(s.uid);
                                                        return (
                                                            <div
                                                                key={s.uid}
                                                                className={`teacher-student-select-item ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => toggleStudentSelection(s.uid)}
                                                            >
                                                                <div className="teacher-student-select-checkbox">
                                                                    {isSelected && <Check size={14} />}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                                    <span className="teacher-student-select-name">
                                                                        {s.displayName || s.email?.split('@')[0]}
                                                                    </span>
                                                                    <span className="teacher-student-select-email">{s.email}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="teacher-modal-actions" style={{ flexDirection: 'row' }}>
                                <button type="button" className="teacher-btn teacher-btn-secondary" style={{ flex: 1 }} onClick={() => { setIsAssignModalOpen(false); setAssignmentMode('all'); setSelectedStudentIds([]); }} disabled={assignLoading}>
                                    Hủy
                                </button>
                                <button type="submit" className="teacher-btn teacher-btn-primary" style={{ flex: 1 }} disabled={assignLoading || (assignmentMode === 'individual' && selectedStudentIds.length === 0) || assignmentForm.scheduledStart === 'pending' || (assignmentForm.scheduledStart && assignmentForm.scheduledStart !== 'pending' && assignmentForm.dueDate && new Date(assignmentForm.scheduledStart) >= new Date(assignmentForm.dueDate))}>
                                    {assignLoading ? 'Đang giao...' : 'Giao bài luyện'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ASSIGNMENT PROGRESS MODAL */}
            {selectedAssignment && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide">
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setSelectedAssignment(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="teacher-modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'flex-start', gap: '10px', paddingRight: '40px' }}>
                                    {selectedAssignment.isGrammar ? (
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                            background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc',
                                            textTransform: 'uppercase'
                                        }}>
                                            Kỹ năng
                                        </span>
                                    ) : (
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                            background: '#fefce8', color: '#a16207', border: '1px solid #fde68a',
                                            textTransform: 'uppercase'
                                        }}>
                                            Từ vựng
                                        </span>
                                    )}
                                    {(() => {
                                        let actualTopic = null;
                                        if (selectedAssignment.isGrammar) {
                                            actualTopic = grammarExercises.find(t => t.id === selectedAssignment.topicId);
                                        } else if (selectedAssignment.isTeacherTopic) {
                                            actualTopic = teacherTopics.find(t => t.id === selectedAssignment.topicId);
                                        } else {
                                            actualTopic = topics.find(t => t.id === selectedAssignment.topicId);
                                        }
                                        return actualTopic ? actualTopic.name : selectedAssignment.topicName;
                                    })()}
                                </h2>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                                    Hạn nộp: {formatDate(selectedAssignment.dueDate)}
                                </div>
                            </div>
                        </div>

                        {isAssignmentProgressLoading ? (
                            <div className="admin-empty-state">Đang tải tiến độ bài luyện...</div>
                        ) : assignmentProgressData.length === 0 && students.length === 0 ? (
                            <div className="admin-empty-state">Lớp chưa có học viên.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(() => {
                                    // Check if assignment is expired (consider studentDeadlines)
                                    const dueDateObj = selectedAssignment.dueDate?.toDate ? selectedAssignment.dueDate.toDate() : (selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate) : null);
                                    // Assignment is only fully expired if ALL students' deadlines have passed
                                    const hasAnyActiveStudentDeadline = selectedAssignment.studentDeadlines && Object.values(selectedAssignment.studentDeadlines).some(sd => {
                                        const sdDate = sd?.toDate ? sd.toDate() : (sd ? new Date(sd) : null);
                                        return sdDate && sdDate > new Date();
                                    });
                                    const isExpired = (dueDateObj ? dueDateObj < new Date() : false) && !hasAnyActiveStudentDeadline;

                                    // Calculate overall stats for assignment
                                    let completedCount = 0;
                                    let learningCount = 0;
                                    let notStartedCount = 0;

                                    assignmentProgressData.forEach(item => {
                                        const { total, learned, learning } = item.progress;
                                        if (total > 0 && learned === total) completedCount++;
                                        else if (learned > 0 || learning > 0) learningCount++;
                                        else notStartedCount++;
                                    });

                                    const notCompletedCount = learningCount + notStartedCount;

                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: isExpired ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '8px', marginBottom: '16px' }}>
                                            <div style={{ padding: '12px 8px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a' }}>{completedCount}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Hoàn thành</div>
                                            </div>
                                            {isExpired ? (
                                                <div style={{ padding: '12px 8px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fecaca', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>{notCompletedCount}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Không hoàn thành</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ padding: '12px 8px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fde68a', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ca8a04' }}>{learningCount}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#ca8a04', fontWeight: 700, textTransform: 'uppercase' }}>Đang học</div>
                                                    </div>
                                                    <div style={{ padding: '12px 8px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#64748b' }}>{notStartedCount}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Chưa học</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* List of students */}
                                {assignmentProgressData.map((item) => {
                                    const { student, progress } = item;
                                    const { total, learned, learning, totalCorrect: tc, totalWrong: tw } = progress;
                                    // Use step-based progress (same as student dashboard) for consistency
                                    const totalSteps = total * 6;
                                    const completedSteps = progress.completedSteps || 0;
                                    let percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                                    // Cap at 99% if not fully mastered yet, show 100% only when all words are learned
                                    if (total > 0 && learned === total) {
                                        percent = 100;
                                    } else if (percent >= 100) {
                                        percent = 99;
                                    }
                                    const attempts = (tc ?? 0) + (tw ?? 0);
                                    const errorRate = attempts > 0 ? Math.round(((tw ?? 0) / attempts) * 100) : 0;

                                    // Check if assignment is expired (consider studentDeadlines for this specific student)
                                    const studentSpecificDl = selectedAssignment.studentDeadlines?.[student.uid];
                                    const effectiveDueDate = studentSpecificDl || selectedAssignment.dueDate;
                                    const dueDateObj = effectiveDueDate?.toDate ? effectiveDueDate.toDate() : (effectiveDueDate ? new Date(effectiveDueDate) : null);
                                    const isExpired = dueDateObj ? dueDateObj < new Date() : false;

                                    let statusColor = '#64748b'; // Not started
                                    let statusText = 'Chưa học';
                                    if (total > 0 && learned === total) {
                                        statusColor = '#16a34a'; // Completed
                                        statusText = 'Hoàn thành';
                                    } else if (isExpired) {
                                        statusColor = '#dc2626'; // Not completed (expired)
                                        statusText = 'Không hoàn thành';
                                    } else if (learned > 0 || learning > 0) {
                                        statusColor = '#ca8a04'; // Learning - yellow
                                        statusText = 'Đang học';
                                    }

                                    return (
                                        <div key={student.uid} style={{
                                            background: 'white',
                                            borderRadius: '20px',
                                            padding: '16px',
                                            border: '1px solid #f1f5f9',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
                                                        {shortenName(student.displayName || student.email.split('@')[0])}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: statusColor, fontWeight: 700 }}>
                                                            {statusText}
                                                        </span>
                                                        {attempts > 0 && (
                                                            <span style={{
                                                                fontSize: '0.7rem', fontWeight: 700,
                                                                color: getErrorStyle(errorRate).color,
                                                                background: getErrorStyle(errorRate).bg,
                                                                padding: '1px 8px', borderRadius: '8px'
                                                            }}>
                                                                Sai: {errorRate}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontWeight: 900, fontSize: '0.95rem', color: percent === 100 ? '#10b981' : '#f59e0b' }}>
                                                        {percent}%
                                                    </span>
                                                    {/* Red flag indicators */}
                                                    {(() => {
                                                        const count = redFlagCounts[student.uid] || 0;
                                                        return (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                {[1, 2, 3].map(i => {
                                                                    const isFilled = i <= count;
                                                                    const isNext = i === count + 1 && count < 3;
                                                                    const flagColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                                                    return (
                                                                        <span
                                                                            key={i}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isNext && !isStaff) {
                                                                                    setRedFlagModalStudent(student);
                                                                                    setRedFlagForm({ violationType: '', note: '' });
                                                                                    getRedFlagsForStudentInGroup(student.uid, groupId).then(setAddModalFlags);
                                                                                } else if (isFilled) {
                                                                                    setRedFlagViewIndex(i);
                                                                                    setRedFlagHistoryStudent(student);
                                                                                    setRedFlagHistoryLoading(true);
                                                                                    getRedFlagsForStudentInGroup(student.uid, groupId).then(setRedFlagHistory).finally(() => setRedFlagHistoryLoading(false));
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                width: '20px', height: '20px', borderRadius: '5px',
                                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                fontSize: '0.65rem',
                                                                                background: isFilled ? (i >= 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'transparent',
                                                                                border: isFilled ? `1.5px solid ${flagColor}40` : '1.5px solid transparent',
                                                                                cursor: (isFilled || (isNext && !isStaff)) ? 'pointer' : 'default',
                                                                                opacity: isFilled ? 1 : 0.3,
                                                                                filter: !isFilled ? 'grayscale(1)' : 'none',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                            title={isFilled ? `Xem cờ đỏ lần ${i}` : isNext ? `Đánh cờ đỏ lần ${i}` : ''}
                                                                        >
                                                                            🚩
                                                                        </span>
                                                                    );
                                                                })}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            {total > 0 ? (
                                                <>
                                                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                                                        <div style={{ width: `${(learned / total) * 100}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }} />
                                                        <div style={{ width: `${(learning / total) * 100}%`, background: '#facc15' }} />
                                                    </div>
                                                    <div
                                                        style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}
                                                        onClick={() => toggleAssignmentStudentDetail(student.uid, selectedAssignment.topicId, selectedAssignment?.isGrammar)}
                                                    >
                                                        <span>{learned}/{total} {selectedAssignment?.isGrammar ? 'câu đã hoàn thành' : 'từ đã thuộc'}</span>
                                                        <span>{expandedAssignmentStudentId === student.uid ? 'Thu gọn ▲' : 'Chi tiết ▼'}</span>
                                                    </div>

                                                    {expandedAssignmentStudentId === student.uid && (
                                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                                            {!assignmentWordsCache[student.uid] ? (
                                                                <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Đang tải...</div>
                                                            ) : assignmentWordsCache[student.uid]?.isGrammar ? (
                                                                /* Grammar questions detail */
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    {assignmentWordsCache[student.uid].items.map((q, qIdx) => {
                                                                        const variationsPassed = q.progress?.variationsPassed || [];
                                                                        const passedCount = variationsPassed.length;
                                                                        const totalVars = Math.max((q.variations || []).filter(v => v && (v.text || v.content)).length, 1);
                                                                        const isLearned = q.progress && passedCount >= 1;

                                                                        // Total attempts = fails + passes
                                                                        const fc = q.progress?.failCount ?? 0;
                                                                        const pc = q.progress?.passCount ?? 0;
                                                                        const totalAttempts = q.progress ? Math.max(fc + pc, 1) : 0;

                                                                        let color = '#94a3b8';
                                                                        let bg = '#fff';
                                                                        if (q.progress) {
                                                                            if (totalAttempts <= 1) { color = '#16a34a'; bg = '#f0fdf4'; }
                                                                            else if (totalAttempts <= 2) { color = '#ca8a04'; bg = '#fefce8'; }
                                                                            else if (totalAttempts <= 3) { color = '#f97316'; bg = '#fff7ed'; }
                                                                            else { color = '#ef4444'; bg = '#fef2f2'; }
                                                                        }

                                                                        const statusLabel = isLearned ? 'Hoàn thành' : 'Chưa hoàn thành';
                                                                        const varLabel = `${totalAttempts}/${totalVars}`;

                                                                        return (
                                                                            <div key={q.id} style={{
                                                                                padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem',
                                                                                background: bg, color: '#1e293b', border: `1px solid ${bg === '#fff' ? '#f1f5f9' : 'transparent'}`,
                                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                                                                            }}>
                                                                                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.78rem', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                    {q.sentence || q.originalSentence || `Câu ${qIdx + 1}`}
                                                                                    {q.type && (
                                                                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                                                            {{ multiple_choice: 'Trắc nghiệm', fill_in_blank: 'Điền từ', fill_in_blanks: 'Điền nhiều từ', fill_in_blank_typing: 'Điền từ', matching: 'Nối cặp', categorization: 'Phân loại', essay: 'Tự luận', audio_recording: 'Ghi âm', ordering: 'Sắp xếp' }[q.type] || q.type}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                                                                                    {statusLabel} {varLabel}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                /* Vocabulary words detail */
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                    {(assignmentWordsCache[student.uid]?.items || assignmentWordsCache[student.uid]).map(w => {
                                                                        const isLearned = w.progress && w.progress.level >= 1;
                                                                        const isLearning = w.progress && w.progress.level === 0;

                                                                        let color = '#94a3b8';
                                                                        let bg = '#fff';
                                                                        if (isLearned) { color = '#16a34a'; bg = '#f0fdf4'; }
                                                                        else if (isLearning) { color = '#ca8a04'; bg = '#fefce8'; }

                                                                        return (
                                                                            <span key={w.id || w.word} style={{
                                                                                padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
                                                                                background: bg, color: color, border: `1px solid ${bg === '#fff' ? '#e2e8f0' : 'transparent'}`
                                                                            }}>
                                                                                {w.word}
                                                                            </span>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>{selectedAssignment?.isGrammar ? 'Không có câu hỏi' : 'Không có từ vựng'}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {/* The 'Đóng cửa sổ' button was removed per request */}
                    </div>
                </div>
            )}

            {/* TAB: STATISTICS */}
            {activeTab === 'statistics' && (
                <div className="teacher-tab-section">
                    <div className="teacher-section-content" style={{ padding: '0' }}>
                        {isAllStatsLoading ? (
                            <div className="admin-empty-state">Đang tổng hợp dữ liệu thống kê...</div>
                        ) : allStudentsStats.length === 0 ? (
                            <div className="admin-empty-state">Chưa có dữ liệu thống kê.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* Global Date Filters */}
                                <div className="stats-date-filter" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                                    <strong style={{ color: '#1e293b', flexShrink: 0 }}><Calendar size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Thời gian:</strong>
                                    <div className="stats-date-inputs" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                                        <input
                                            type="date"
                                            value={filterStartDate}
                                            onChange={(e) => setFilterStartDate(e.target.value)}
                                            style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', flex: 1, minWidth: 0 }}
                                        />
                                        <span style={{ color: '#94a3b8', fontWeight: 'bold', flexShrink: 0 }}>-</span>
                                        <input
                                            type="date"
                                            value={filterEndDate}
                                            onChange={(e) => setFilterEndDate(e.target.value)}
                                            style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', flex: 1, minWidth: 0 }}
                                        />
                                    </div>
                                    <div className="stats-date-filter-hint" style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b', flexShrink: 0 }}>
                                        Để trống để xem tất cả
                                    </div>
                                </div>

                                {/* Class Activity Rate Card */}
                                {(() => {
                                    const totalStudents = students.length;
                                    let activeCount = 0;
                                    students.forEach(s => {
                                        const act = studentsActivityData[s.uid];
                                        if (!act?.lastActiveDate) return;
                                        const lastDate = act.lastActiveDate; // YYYY-MM-DD string
                                        if (filterStartDate && lastDate < filterStartDate) return;
                                        if (filterEndDate && lastDate > filterEndDate) return;
                                        activeCount++;
                                    });
                                    const pct = totalStudents > 0 ? Math.round((activeCount / totalStudents) * 100) : 0;
                                    const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444';

                                    return (
                                        <div style={{ background: 'white', borderRadius: '20px', padding: '16px 20px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ padding: '10px', borderRadius: '14px', background: `${barColor}15`, color: barColor, display: 'flex' }}>
                                                <Users size={22} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Tỷ lệ hoạt động lớp {filterStartDate || filterEndDate ? '(trong thời gian lọc)' : ''}</div>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: barColor }}>{activeCount}/{totalStudents}</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>học viên hoạt động</span>
                                                </div>
                                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '10px', transition: 'width 0.5s ease' }} />
                                                </div>
                                            </div>
                                            <div style={{ padding: '4px 12px', borderRadius: '12px', background: `${barColor}15`, color: barColor, fontWeight: 800, fontSize: '1rem' }}>
                                                {pct}%
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Overall Summary Level */}
                                {(() => {
                                    // Calculate overall stats for the donut chart
                                    let totalLearned = 0;
                                    let totalLearning = 0;
                                    let totalReview = 0;
                                    let totalCorrectAll = 0;
                                    let totalWrongAll = 0;

                                    allStudentsStats.forEach(s => {
                                        totalLearned += s.stats.learnedWords;
                                        totalLearning += (s.stats.totalWords - s.stats.learnedWords);
                                        totalReview += s.stats.totalReviews;
                                        totalCorrectAll += s.stats.totalCorrect ?? 0;
                                        totalWrongAll += s.stats.totalWrong ?? 0;
                                    });

                                    // Grammar totals
                                    let totalGrammarCorrect = 0;
                                    let totalGrammarLearning = 0;
                                    let totalGrammarNotStarted = 0;
                                    let grammarTotalCorrectAll = 0;
                                    let grammarTotalWrongAll = 0;
                                    allStudentsGrammarStats.forEach(g => {
                                        totalGrammarCorrect += g.correctQuestions;
                                        totalGrammarLearning += g.learningQuestions;
                                        totalGrammarNotStarted += g.notStarted;
                                        grammarTotalCorrectAll += g.totalCorrect || 0;
                                        grammarTotalWrongAll += g.totalWrong || 0;
                                    });

                                    const totalAttempts = totalCorrectAll + totalWrongAll;
                                    const overallErrorRate = totalAttempts > 0 ? Math.round((totalWrongAll / totalAttempts) * 100) : 0;

                                    const totalGrammarAttempts = grammarTotalCorrectAll + grammarTotalWrongAll;
                                    const realGrammarErrorRate = totalGrammarAttempts > 0 ? Math.round((grammarTotalWrongAll / totalGrammarAttempts) * 100) : 0;

                                    let examTotalSubmissions = 0;
                                    let examTotalExpected = 0;
                                    let examTotalScore = 0;
                                    let examMaxTotalScore = 0;

                                    // Categories for pie chart
                                    let countXuatSac = 0; // >= 90
                                    let countGioi = 0;    // >= 80
                                    let countKha = 0;     // >= 65
                                    let countTrungBinh = 0; // >= 50
                                    let countYeu = 0;     // < 50

                                    allStudentsAllExamStats.forEach(e => {
                                        examTotalSubmissions += e.submittedCount;
                                        examTotalExpected += e.totalExpected;
                                        examTotalScore += e.totalScore;
                                        examMaxTotalScore += e.maxTotalScore;

                                        // Count categories based on each test submission if possible, 
                                        // or average score if detailed submissions aren't readily available in this loop.
                                        // Since we only have `averageScore` per student here, we'll categorize the student's average.
                                        if (e.submittedCount > 0) {
                                            const score = e.averageScore;
                                            if (score >= 90) countXuatSac++;
                                            else if (score >= 80) countGioi++;
                                            else if (score >= 65) countKha++;
                                            else if (score >= 50) countTrungBinh++;
                                            else countYeu++;
                                        }
                                    });
                                    const hasExams = examTotalExpected > 0;
                                    const examAvgScoreStr = examMaxTotalScore > 0 ? ((examTotalScore / examMaxTotalScore) * 100).toFixed(1) : 0;
                                    const examAvgScore = parseFloat(examAvgScoreStr);

                                    const examDonutData = [
                                        { name: 'Xuất sắc', value: countXuatSac, color: '#ef4444' },     // Red-500 (Hot/Bright)
                                        { name: 'Giỏi', value: countGioi, color: '#f97316' },            // Orange-500 (Warm/Bright)
                                        { name: 'Khá', value: countKha, color: '#eab308' },              // Yellow-500 (Warm)
                                        { name: 'Trung bình', value: countTrungBinh, color: '#3b82f6' }, // Blue-500 (Cool)
                                        { name: 'Yếu', value: countYeu, color: '#1e293b' }               // Slate-800 (Cold/Dark)
                                    ];

                                    const vocabDonutData = [
                                        { name: 'Đã thuộc', value: totalLearned, color: '#16a34a' },
                                        { name: 'Đang học', value: totalLearning, color: '#f59e0b' },
                                        { name: 'Chưa học', value: vocabBreakdownStats.totalNotStarted, color: '#94a3b8' }
                                    ];

                                    const hasGrammar = grammarTotalCorrectAll + grammarTotalWrongAll > 0;
                                    const grammarDonutData = [
                                        { name: 'Lần đúng', value: grammarTotalCorrectAll, color: '#16a34a' },
                                        { name: 'Lần sai', value: grammarTotalWrongAll, color: '#ef4444' },
                                    ];

                                    return (
                                        <>
                                            {/* Donut Charts Card - Full width */}
                                            <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <PieChart size={20} color="#64748b" /> Tổng quan Lớp học
                                                </h3>

                                                <div className="stats-donut-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                                    {/* Vocabulary Donut */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '4px' }}>
                                                            TỪ VỰNG
                                                        </div>
                                                        {vocabDonutData.some(d => d.value > 0) ? (
                                                            <div style={{ height: '200px', width: '100%' }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <RechartsPieChart>
                                                                        <Pie
                                                                            data={vocabDonutData.filter(d => d.value > 0)}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={50}
                                                                            outerRadius={80}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                        >
                                                                            {vocabDonutData.filter(d => d.value > 0).map((entry, index) => (
                                                                                <Cell key={`vcell-${index}`} fill={entry.color} />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip
                                                                            formatter={(value) => [`${value} từ (${(totalLearned + totalLearning + vocabBreakdownStats.totalNotStarted) > 0 ? ((value / (totalLearned + totalLearning + vocabBreakdownStats.totalNotStarted)) * 100).toFixed(1) : 0}%)`, '']}
                                                                            separator=" "
                                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                        />
                                                                    </RechartsPieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Chưa có dữ liệu</div>
                                                        )}
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            {vocabDonutData.map(d => (
                                                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, display: 'inline-block' }}></span>
                                                                    {d.name}: {d.value}
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </div>

                                                    {/* Grammar Donut */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '4px' }}>
                                                            KỸ NĂNG
                                                        </div>
                                                        {grammarDonutData.some(d => d.value > 0) ? (
                                                            <div style={{ height: '200px', width: '100%' }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <RechartsPieChart>
                                                                        <Pie
                                                                            data={grammarDonutData.filter(d => d.value > 0)}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={50}
                                                                            outerRadius={80}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                        >
                                                                            {grammarDonutData.filter(d => d.value > 0).map((entry, index) => (
                                                                                <Cell key={`gcell-${index}`} fill={entry.color} />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip
                                                                            formatter={(value) => [`${value} lần (${totalGrammarAttempts > 0 ? ((value / totalGrammarAttempts) * 100).toFixed(1) : 0}%)`, '']}
                                                                            separator=" "
                                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                        />
                                                                    </RechartsPieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Chưa có dữ liệu</div>
                                                        )}
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            {grammarDonutData.map(d => (
                                                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, display: 'inline-block' }}></span>
                                                                    {d.name}: {d.value}
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </div>

                                                    {/* Exam Donut */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '4px' }}>
                                                            KẾT QUẢ BÀI TẬP & KIỂM TRA
                                                        </div>
                                                        {examDonutData.some(d => d.value > 0) ? (
                                                            <div style={{ height: '200px', width: '100%' }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <RechartsPieChart>
                                                                        <Pie
                                                                            data={examDonutData.filter(d => d.value > 0)}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={50}
                                                                            outerRadius={80}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                        >
                                                                            {examDonutData.filter(d => d.value > 0).map((entry, index) => (
                                                                                <Cell key={`ecell-${index}`} fill={entry.color} />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip
                                                                            formatter={(value) => [`${value} học viên (${examTotalSubmissions > 0 ? ((value / examTotalSubmissions) * 100).toFixed(1) : 0}%)`, '']}
                                                                            separator=" "
                                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                        />
                                                                    </RechartsPieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Chưa có dữ liệu</div>
                                                        )}
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            {examDonutData.map(d => (
                                                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, display: 'inline-block' }}></span>
                                                                    {d.name}: {d.value}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {examTotalSubmissions > 0 && (
                                                            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#eef2ff', borderRadius: '10px', border: '1px solid #e0e7ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Điểm trung bình (TB)</span>
                                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#4f46e5' }}>{examAvgScore}%</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>

                                            {/* Top & Bottom Students - Separate row */}
                                            <div className="stats-praise-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>
                                                {(() => {
                                                    // --- Top Performance Score = 1/3 vocab accuracy + 1/3 grammar accuracy + 1/3 exam score ---
                                                    const grammarMap = {};
                                                    allStudentsGrammarStats.forEach(g => { grammarMap[g.uid] = g; });
                                                    const examMap = {};
                                                    allStudentsAllExamStats.forEach(e => { examMap[e.uid] = e; });

                                                    const calcPerformance = (s) => {
                                                        // 1/3: Vocab accuracy rate
                                                        const vocabAtt = (s.stats.totalCorrect ?? 0) + (s.stats.totalWrong ?? 0);
                                                        const gData = grammarMap[s.uid];
                                                        const grammarAtt = (gData?.totalCorrect ?? 0) + (gData?.totalWrong ?? 0);
                                                        const eData = examMap[s.uid];

                                                        let total = 0;
                                                        let count = 0;

                                                        // Vocab: only count if student has attempted vocab
                                                        if (vocabAtt > 0) {
                                                            total += ((s.stats.totalCorrect ?? 0) / vocabAtt) * 100;
                                                            count++;
                                                        }

                                                        // Grammar: only count if student has attempted grammar
                                                        if (grammarAtt > 0) {
                                                            total += ((gData?.totalCorrect ?? 0) / grammarAtt) * 100;
                                                            count++;
                                                        }

                                                        // Exam: only count if student has submitted at least one exam
                                                        if (eData?.submittedCount > 0) {
                                                            total += (eData.averageScore ?? 0);
                                                            count++;
                                                        }

                                                        return count > 0 ? total / count : 0;
                                                    };

                                                    const allWithScore = allStudentsStats.map(s => ({
                                                        ...s,
                                                        performanceScore: calcPerformance(s)
                                                    }));

                                                    const sorted = [...allWithScore].sort((a, b) => b.performanceScore - a.performanceScore);
                                                    const topStudents = sorted.filter(s => s.performanceScore > 0).slice(0, 5);

                                                    // Bottom students: students with the highest number of words/questions left to learn
                                                    const bottomSorted = [...allStudentsStats].sort((a, b) => {
                                                        const leftA = (a.stats.totalWords - a.stats.learnedWords) + (grammarMap[a.uid]?.notStarted || 0) + (grammarMap[a.uid]?.learningQuestions || 0);
                                                        const leftB = (b.stats.totalWords - b.stats.learnedWords) + (grammarMap[b.uid]?.notStarted || 0) + (grammarMap[b.uid]?.learningQuestions || 0);
                                                        return leftB - leftA;
                                                    });
                                                    const bottomStudents = bottomSorted.filter(s => {
                                                        const left = (s.stats.totalWords - s.stats.learnedWords) + (grammarMap[s.uid]?.notStarted || 0) + (grammarMap[s.uid]?.learningQuestions || 0);
                                                        return left > 0;
                                                    }).slice(0, 5);

                                                    const topExamStudents = [...allStudentsExamStats]
                                                        .filter(s => s.submittedCount > 0)
                                                        .sort((a, b) => b.averageScore - a.averageScore)
                                                        .slice(0, 5);

                                                    const bottomExamStudents = [...allStudentsExamStats]
                                                        .filter(s => s.totalExpected > 0)
                                                        .sort((a, b) => a.averageScore - b.averageScore)
                                                        .slice(0, 5);

                                                    const topEffortStudents = [...allStudentsStats]
                                                        .filter(s => (s.selfStudyTotal || 0) > 0)
                                                        .sort((a, b) => (b.selfStudyTotal || 0) - (a.selfStudyTotal || 0))
                                                        .slice(0, 5);

                                                    return (
                                                        <>
                                                            <div style={{ background: '#fef9c3', borderRadius: '24px', padding: '24px', border: '1px solid #fde047' }}>
                                                                <h4 style={{ margin: '0 0 16px 0', color: '#a16207', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                                                    <BookOpen size={18} /> Top Cố gắng nhất
                                                                    <div title="Số lượng từ vựng và chủ đề kỹ năng học viên tự học thêm (nằm ngoài các bài đã giao)." style={{ display: 'inline-flex', cursor: 'help', opacity: 0.6 }}>
                                                                        <Info size={14} />
                                                                    </div>
                                                                </h4>
                                                                {topEffortStudents.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        {topEffortStudents.map((s, i) => (
                                                                            <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px 16px', borderRadius: '12px' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                                                                                    {i + 1}. {shortenName(s.displayName || s.email.split('@')[0])}
                                                                                </span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span style={{ fontWeight: 800, color: '#a16207', fontSize: '0.9rem' }}>
                                                                                        {s.selfStudyVocab > 0 ? `${s.selfStudyVocab} từ` : ''}
                                                                                        {s.selfStudyVocab > 0 && s.selfStudyGrammar > 0 ? ' + ' : ''}
                                                                                        {s.selfStudyGrammar > 0 ? `${s.selfStudyGrammar} câu` : ''}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#a16207', opacity: 0.8 }}>Chưa có dữ liệu.</div>
                                                                )}
                                                            </div>
                                                            <div style={{ background: '#f0fdf4', borderRadius: '24px', padding: '24px', border: '1px solid #bbf7d0' }}>
                                                                <h4 style={{ margin: '0 0 16px 0', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                                                    <Trophy size={18} /> Top Performance
                                                                    <div title="Điểm TB dựa trên: % Đúng Từ Vựng, % Đúng Kỹ Năng và % Điểm Bài tập & KT. Tỉ lệ là 1/3 mỗi loại. Nếu loại nào chưa có dữ liệu sẽ không tính vào để đảm bảo công bằng." style={{ display: 'inline-flex', cursor: 'help', opacity: 0.6 }}>
                                                                        <Info size={14} />
                                                                    </div>
                                                                </h4>
                                                                {topStudents.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        {topStudents.map((s, i) => (
                                                                            <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 16px', borderRadius: '12px' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', flex: 1 }}>
                                                                                    {i + 1}. {shortenName(s.displayName || s.email.split('@')[0])}
                                                                                </span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.9rem' }}>{s.performanceScore.toFixed(1)}%</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#16a34a', opacity: 0.8 }}>Chưa có dữ liệu.</div>
                                                                )}
                                                            </div>

                                                            <div style={{ background: '#fef2f2', borderRadius: '24px', padding: '24px', border: '1px solid #fecaca' }}>
                                                                <h4 style={{ margin: '0 0 16px 0', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                                                    <AlertTriangle size={18} /> Top Lazy
                                                                    <div title="Top học viên có nhiều từ vựng và bài luyện kỹ năng (trong các bài được giao) chưa hoàn thành nhất." style={{ display: 'inline-flex', cursor: 'help', opacity: 0.6 }}>
                                                                        <Info size={14} />
                                                                    </div>
                                                                </h4>
                                                                {bottomStudents.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        {bottomStudents.map((s, i) => (
                                                                            <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 16px', borderRadius: '12px' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', flex: 1 }}>
                                                                                    {i + 1}. {shortenName(s.displayName || s.email.split('@')[0])}
                                                                                </span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    {(() => { const att = (s.stats.totalCorrect ?? 0) + (s.stats.totalWrong ?? 0); const er = att > 0 ? Math.round(((s.stats.totalWrong ?? 0) / att) * 100) : 0; const style = getErrorStyle(er); return att > 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: style.color, background: style.bg, padding: '2px 8px', borderRadius: '8px' }}>Sai: {er}%</span> : null; })()}
                                                                                    <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.9rem' }}>{s.stats.totalWords - s.stats.learnedWords} từ{(grammarMap[s.uid]?.notStarted || 0) + (grammarMap[s.uid]?.learningQuestions || 0) > 0 ? ` + ${(grammarMap[s.uid]?.notStarted || 0) + (grammarMap[s.uid]?.learningQuestions || 0)} câu` : ''}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#dc2626', opacity: 0.8 }}>Chưa có dữ liệu.</div>
                                                                )}
                                                            </div>

                                                            <div style={{ background: '#eef2ff', borderRadius: '24px', padding: '24px', border: '1px solid #c7d2fe' }}>
                                                                <h4 style={{ margin: '0 0 16px 0', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                                                    <Trophy size={18} /> Top Kiểm Tra
                                                                    <div title="Những học viên có điểm trung bình các bài kiểm tra cao nhất." style={{ display: 'inline-flex', cursor: 'help', opacity: 0.6 }}>
                                                                        <Info size={14} />
                                                                    </div>
                                                                </h4>
                                                                {topExamStudents.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        {topExamStudents.map((s, i) => (
                                                                            <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 16px', borderRadius: '12px' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', flex: 1 }}>
                                                                                    {i + 1}. {shortenName(s.displayName)}
                                                                                </span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                                                        {s.submittedCount}/{s.totalExpected}
                                                                                    </span>
                                                                                    <span style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.9rem' }}>{s.averageScore}%</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#4f46e5', opacity: 0.8 }}>Chưa có dữ liệu.</div>
                                                                )}
                                                            </div>

                                                            <div style={{ background: '#fff1f2', borderRadius: '24px', padding: '24px', border: '1px solid #fecdd3' }}>
                                                                <h4 style={{ margin: '0 0 16px 0', color: '#e11d48', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                                                    <AlertTriangle size={18} /> Cần cố gắng (Kiểm Tra)
                                                                    <div title="Những học viên có điểm trung bình các bài kiểm tra thấp nhất." style={{ display: 'inline-flex', cursor: 'help', opacity: 0.6 }}>
                                                                        <Info size={14} />
                                                                    </div>
                                                                </h4>
                                                                {bottomExamStudents.length > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        {bottomExamStudents.map(s => (
                                                                            <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 16px', borderRadius: '12px' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', flex: 1 }}>
                                                                                    {shortenName(s.displayName)}
                                                                                </span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                                                        {s.submittedCount}/{s.totalExpected}
                                                                                    </span>
                                                                                    <span style={{ fontWeight: 800, color: '#e11d48', fontSize: '0.9rem' }}>{s.submittedCount > 0 ? s.averageScore + '%' : 'Chưa nộp'}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#e11d48', opacity: 0.8 }}>Chưa có dữ liệu.</div>
                                                                )}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* Red Flag Status - students at risk */}
                                {(() => {
                                    const atRisk = []; // 2 flags
                                    const terminated = []; // 3 flags
                                    students.forEach(s => {
                                        const count = redFlagCounts[s.uid] || 0;
                                        if (count >= 3) terminated.push({ ...s, flagCount: count });
                                        else if (count === 2) atRisk.push({ ...s, flagCount: count });
                                    });
                                    if (atRisk.length === 0 && terminated.length === 0) return null;
                                    return (
                                        <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #fecaca' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                🚩 Tình trạng cờ cảnh báo
                                            </h3>
                                            {terminated.length > 0 && (
                                                <div style={{ marginBottom: atRisk.length > 0 ? '16px' : 0 }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.3px' }}>
                                                        ❌ Không còn đảm bảo đầu ra ({terminated.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {terminated.map(s => (
                                                            <div key={s.uid} style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                padding: '10px 14px', borderRadius: '12px',
                                                                background: '#fef2f2', border: '1px solid #fecaca'
                                                            }}>
                                                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#991b1b' }}>
                                                                    {shortenName(s.displayName || s.email?.split('@')[0])}
                                                                </span>
                                                                <span style={{ display: 'inline-flex', gap: '3px' }}>
                                                                    {[1, 2, 3].map(i => (
                                                                        <span key={i} style={{ fontSize: '0.65rem' }}>🚩</span>
                                                                    ))}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {atRisk.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.3px' }}>
                                                        ⚠️ Sắp mất đảm bảo đầu ra ({atRisk.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {atRisk.map(s => (
                                                            <div key={s.uid} style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                padding: '10px 14px', borderRadius: '12px',
                                                                background: '#fff7ed', border: '1px solid #fed7aa'
                                                            }}>
                                                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#9a3412' }}>
                                                                    {shortenName(s.displayName || s.email?.split('@')[0])}
                                                                </span>
                                                                <span style={{ display: 'inline-flex', gap: '3px' }}>
                                                                    {[1, 2].map(i => (
                                                                        <span key={i} style={{ fontSize: '0.65rem' }}>🚩</span>
                                                                    ))}
                                                                    <span style={{ fontSize: '0.65rem', opacity: 0.2, filter: 'grayscale(1)' }}>🚩</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    // Prepare data for bar chart (include grammar)
                                    const grammarMapBar = {};
                                    allStudentsGrammarStats.forEach(g => { grammarMapBar[g.uid] = g; });
                                    const examMapBar = {};
                                    allStudentsAllExamStats.forEach(e => { examMapBar[e.uid] = e; });
                                    const assignMapBar = {};
                                    assignmentCompletionData.forEach(a => { assignMapBar[a.uid] = a; });

                                    const barData = allStudentsStats.map(s => ({
                                        name: shortenName(s.displayName || s.email.split('@')[0]),
                                        'Từ đã thuộc': s.stats.learnedWords,
                                        'Kỹ năng đúng': grammarMapBar[s.uid]?.correctQuestions || 0,
                                        'Điểm TB Bài tập & KT (%)': examMapBar[s.uid]?.averageScore || 0,
                                        'Bài luyện giao hoàn thành': assignMapBar[s.uid]?.completed || 0
                                    })).sort((a, b) => (b['Từ đã thuộc'] + b['Kỹ năng đúng']) - (a['Từ đã thuộc'] + a['Kỹ năng đúng']));

                                    return (
                                        <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                                            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <BarChart3 size={20} color="#64748b" /> So sánh Tiến độ Học viên
                                            </h3>
                                            <div className="teacher-chart-scroll-wrapper">
                                                <div style={{ height: '350px', minWidth: Math.max(barData.length * 55, 450) + 'px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={barData}
                                                            margin={{ top: 20, right: 10, left: -20, bottom: 10 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                            <XAxis
                                                                dataKey="name"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#64748b', fontSize: 11 }}
                                                                interval={0}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                            />
                                                            <Tooltip
                                                                cursor={{ fill: '#f8fafc' }}
                                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                                                            />
                                                            <Bar dataKey="Từ đã thuộc" fill="#ca8a04" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                            <Bar dataKey="Kỹ năng đúng" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                            <Bar dataKey="Điểm TB Bài tập & KT (%)" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })()}

                                {/* Assignment Completion Section */}
                                {(() => {
                                    if (assignments.length === 0) {
                                        return (
                                            <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <CheckCircle size={20} color="#64748b" /> Mức độ Hoàn thành Bài luyện
                                                </h3>
                                                <div className="admin-empty-state">Chưa có bài luyện nào được giao cho lớp này.</div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '24px' }}>
                                            <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9', flex: '1 1 400px', minWidth: 0 }}>
                                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <CheckCircle size={20} color="#4f46e5" /> Mức độ Hoàn thành Bài luyện
                                                </h3>

                                                {/* Time range + summary */}

                                                {/* Comparison List */}
                                                {assignmentCompletionData.length === 0 ? (
                                                    <div className="admin-empty-state">Đang tính toán...</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {assignmentCompletionData.map((item, idx) => {
                                                            const percent = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                                                            const isAllComplete = percent === 100;
                                                            const barColor = isAllComplete
                                                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                                                : 'linear-gradient(90deg, #f59e0b, #fbbf24)';

                                                            return (
                                                                <div key={item.uid} style={{
                                                                    background: idx === 0 && isAllComplete ? '#f0fdf4' : '#f8fafc',
                                                                    borderRadius: '16px',
                                                                    padding: '14px 16px',
                                                                    border: idx === 0 && isAllComplete ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            {idx === 0 && isAllComplete && <Trophy size={16} color="#16a34a" />}
                                                                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                                                {shortenName(item.displayName)}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <span style={{
                                                                                fontWeight: 800,
                                                                                fontSize: '0.9rem',
                                                                                color: isAllComplete ? '#16a34a' : '#f59e0b'
                                                                            }}>
                                                                                {item.completed}/{item.total}
                                                                            </span>
                                                                            <span style={{
                                                                                padding: '2px 10px',
                                                                                borderRadius: '20px',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 800,
                                                                                color: 'white',
                                                                                background: isAllComplete ? '#16a34a' : '#f59e0b'
                                                                            }}>
                                                                                {percent}%
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {/* Progress bar */}
                                                                    <div style={{
                                                                        height: '8px',
                                                                        background: '#e2e8f0',
                                                                        borderRadius: '10px',
                                                                        overflow: 'hidden'
                                                                    }}>
                                                                        <div style={{
                                                                            width: `${percent}%`,
                                                                            height: '100%',
                                                                            background: barColor,
                                                                            borderRadius: '10px',
                                                                            transition: 'width 0.5s ease'
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Exam Completion Section */}
                                            {allStudentsHomeworkStats && allStudentsHomeworkStats.some(e => e.totalExpected > 0) && (
                                                <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9', flex: '1 1 400px', minWidth: 0 }}>
                                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <CheckCircle size={20} color="#6366f1" /> Mức độ Hoàn thành Bài tập
                                                    </h3>

                                                    {/* Time range + summary */}

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {[...allStudentsHomeworkStats]
                                                            .sort((a, b) => b.submittedCount - a.submittedCount)
                                                            .map((item, idx) => {
                                                                const percent = item.totalExpected > 0 ? Math.round((item.submittedCount / item.totalExpected) * 100) : 0;
                                                                const isAllComplete = percent === 100;
                                                                const barColor = isAllComplete
                                                                    ? 'linear-gradient(90deg, #6366f1, #818cf8)'
                                                                    : 'linear-gradient(90deg, #94a3b8, #cbd5e1)';

                                                                return (
                                                                    <div key={item.uid} style={{
                                                                        background: idx === 0 && isAllComplete ? '#eef2ff' : '#f8fafc',
                                                                        borderRadius: '16px',
                                                                        padding: '14px 16px',
                                                                        border: idx === 0 && isAllComplete ? '1px solid #c7d2fe' : '1px solid #f1f5f9',
                                                                        transition: 'all 0.2s ease'
                                                                    }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                {idx === 0 && isAllComplete && <Trophy size={16} color="#4f46e5" />}
                                                                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                                                    {shortenName(item.displayName)}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                <span style={{
                                                                                    fontWeight: 800,
                                                                                    fontSize: '0.9rem',
                                                                                    color: isAllComplete ? '#4f46e5' : '#64748b'
                                                                                }}>
                                                                                    {item.submittedCount}/{item.totalExpected}
                                                                                </span>
                                                                                <span style={{
                                                                                    padding: '2px 10px',
                                                                                    borderRadius: '20px',
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: 800,
                                                                                    color: 'white',
                                                                                    background: isAllComplete ? '#6366f1' : '#94a3b8'
                                                                                }}>
                                                                                    {percent}%
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        {/* Progress bar */}
                                                                        <div style={{
                                                                            height: '8px',
                                                                            background: '#e2e8f0',
                                                                            borderRadius: '10px',
                                                                            overflow: 'hidden'
                                                                        }}>
                                                                            <div style={{
                                                                                width: `${percent}%`,
                                                                                height: '100%',
                                                                                background: barColor,
                                                                                borderRadius: '10px',
                                                                                transition: 'width 0.5s ease'
                                                                            }} />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: EXAMS */}
            {activeTab === 'exams' && (
                <div className="teacher-tab-section">
                    <div className="teacher-tab-actions">
                        <div className="teacher-filter-scroll-wrapper">
                            <div className="teacher-filters-container">
                                <button
                                    onClick={() => setExamTypeFilter('all')}
                                    className={`teacher-filter-btn ${examTypeFilter === 'all' ? 'active' : ''}`}
                                >
                                    <List size={16} /> <span>Tất cả</span>
                                </button>
                                <button
                                    onClick={() => setExamTypeFilter('homework')}
                                    className={`teacher-filter-btn homework ${examTypeFilter === 'homework' ? 'active' : ''}`}
                                >
                                    <span>📝</span> <span>Bài tập</span>
                                </button>
                                <button
                                    onClick={() => setExamTypeFilter('test')}
                                    className={`teacher-filter-btn test ${examTypeFilter === 'test' ? 'active' : ''}`}
                                >
                                    <span>📋</span> <span>Kiểm tra</span>
                                </button>
                                {!isStaff && (
                                    <button
                                        onClick={() => {
                                            setExamTypeFilter('deleted');
                                            loadTrashData();
                                        }}
                                        className={`teacher-filter-btn ${examTypeFilter === 'deleted' ? 'active' : ''}`}
                                        style={examTypeFilter === 'deleted' ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' } : { color: '#94a3b8' }}
                                    >
                                        <Trash2 size={16} /> <span>Đã xoá</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {!isStaff && (
                            <button className="admin-btn admin-btn-primary teacher-add-asgn-btn" style={{ background: '#8b5cf6' }} onClick={() => setIsExamAssignModalOpen(true)}>
                                <Plus size={18} /> <span className="teacher-btn-text">Giao bài mới</span>
                            </button>
                        )}
                    </div>
                    <div className="teacher-section-content">
                        {examTypeFilter === 'deleted' ? (
                            trashLoading ? (
                                <div className="admin-empty-state">Đang tải...</div>
                            ) : deletedExamAssignments.length === 0 ? (
                                <div className="admin-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0' }}>
                                    <Archive size={40} strokeWidth={1.5} color="#94a3b8" />
                                    <span>Không có bài tập/kiểm tra nào đã xoá</span>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Các bài đã xoá sẽ tự động bị xoá vĩnh viễn sau 30 ngày</span>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Đã xoá ({deletedExamAssignments.length}) · Tự xoá vĩnh viễn sau 30 ngày
                                    </div>
                                    <div className="teacher-items-list">
                                        {deletedExamAssignments.map(item => {
                                            const deletedDate = item.deletedAt?.toDate ? item.deletedAt.toDate() : new Date(item.deletedAt);
                                            const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)));
                                            const examInfo = allExams.find(e => e.id === item.examId);
                                            const examType = examInfo?.examType || 'homework';
                                            return (
                                                <div key={item.id} className="teacher-student-card" style={{ opacity: 0.75 }}>
                                                    <div className="teacher-student-info">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', textTransform: 'uppercase' }}>
                                                                {examType === 'test' ? 'Kiểm tra' : 'Bài tập'}
                                                            </span>
                                                        </div>
                                                        <span className="teacher-student-email" style={{ color: '#64748b', fontWeight: 800, fontSize: '1rem', display: 'block', marginBottom: '8px' }}>{allExams.find(e => e.id === item.examId)?.name || item.examName || 'Không tên'}</span>
                                                        <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
                                                            ⏳ Còn {daysLeft} ngày trước khi xoá vĩnh viễn
                                                        </div>
                                                    </div>
                                                    <div className="teacher-assignment-actions" style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="teacher-view-progress-btn teacher-mobile-icon-btn" style={{ borderColor: '#4f46e5', color: '#4f46e5' }} onClick={() => handleRestoreAssignment(item, 'exam')} disabled={trashLoading}>
                                                            <RotateCcw size={16} /> <span className="teacher-btn-text">Khôi phục</span>
                                                        </button>
                                                        <button className="admin-action-btn danger teacher-mobile-icon-btn" onClick={() => handlePermanentlyDelete(item, 'exam')} disabled={trashLoading}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        ) : examAssignments.length === 0 ? (
                            <div className="admin-empty-state">Chưa có bài test nào được giao.</div>
                        ) : (
                            (() => {
                                const renderExamCard = (a) => {
                                    const now = new Date();
                                    const due = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
                                    const isOverdue = due && due < now;
                                    const hasStudentExtensions = a.studentDeadlines && Object.keys(a.studentDeadlines).length > 0;
                                    const latestDeadline = hasStudentExtensions ? getLatestDeadline(a) : null;
                                    const hasActiveExtension = latestDeadline && latestDeadline.getTime() >= now.getTime();

                                    return (
                                        <div key={a.id} className="teacher-student-card">
                                            <div className="teacher-student-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                                        background: (allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#fef2f2' : '#f5f3ff',
                                                        color: (allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#dc2626' : '#7c3aed',
                                                        border: `1px solid ${(allExams.find(e => e.id === a.examId)?.examType === 'test') ? '#fecaca' : '#ddd6fe'}`,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {(allExams.find(e => e.id === a.examId)?.examType === 'test') ? 'Kiểm tra' : 'Bài tập'}
                                                    </span>
                                                    <span className={`teacher-assignment-badge ${a.targetType === 'individual' ? 'individual' : 'whole-class'}`}>
                                                        {a.targetType === 'individual' ? <User size={12} /> : <Users size={12} />}
                                                        {a.targetType === 'individual'
                                                            ? (() => {
                                                                const s = students.find(st => st.uid === a.targetId);
                                                                return s ? (s.displayName || s.email?.split('@')[0]) : 'Cá nhân';
                                                            })()
                                                            : 'Cả lớp'}
                                                    </span>
                                                </div>
                                                <span className="teacher-student-email" style={{ color: '#1e293b', fontWeight: 800, fontSize: '1rem', display: 'block', marginBottom: '8px' }}>
                                                    {allExams.find(e => e.id === a.examId)?.name || a.examName}
                                                </span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                                                        background: (isOverdue && !hasActiveExtension) ? '#fee2e2' : '#f5f3ff', color: (isOverdue && !hasActiveExtension) ? '#ef4444' : '#7c3aed'
                                                    }}>
                                                        <Clock size={14} /> Hạn: {formatDate(a.dueDate)}
                                                    </span>
                                                    {(() => {
                                                        if (!a.scheduledStart) return null;
                                                        const ss = a.scheduledStart.toDate ? a.scheduledStart.toDate() : new Date(a.scheduledStart);
                                                        const isFuture = ss > new Date();
                                                        return (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                                                background: isFuture ? '#fef3c7' : '#ecfdf5', color: isFuture ? '#d97706' : '#059669', border: `1px solid ${isFuture ? '#fde68a' : '#a7f3d0'}`
                                                            }}>
                                                                {isFuture ? '🕐 Sẽ mở lúc' : '✅ Đã mở từ'} {ss.toLocaleString('vi-VN')}
                                                            </span>
                                                        );
                                                    })()}
                                                    {hasActiveExtension && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                                            background: '#fff7ed', color: '#f59e0b', border: '1px solid #fed7aa'
                                                        }}>
                                                            ⏰ Gia hạn cá nhân đến {formatDate(latestDeadline)}
                                                        </span>
                                                    )}
                                                    {unreleasedCounts[a.id] > 0 && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800,
                                                            background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa'
                                                        }}>
                                                            ✏️ {unreleasedCounts[a.id]} bài chưa trả
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="teacher-assignment-actions" style={{ display: 'flex', gap: '8px' }}>
                                                <button className="teacher-view-progress-btn teacher-mobile-icon-btn" style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }} onClick={() => handleViewExamAssignment(a)}>
                                                    <BarChart3 size={18} /> <span className="teacher-btn-text">Xem bài làm</span>
                                                </button>
                                                {!isStaff && (
                                                    <button className="admin-action-btn teacher-mobile-icon-btn" onClick={() => openExtendDeadlineModal('exam', a)} title="Gia hạn" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                                                        <CalendarClock size={18} />
                                                    </button>
                                                )}
                                                {!isStaff && (
                                                    <button className="admin-action-btn danger teacher-mobile-icon-btn" onClick={() => setExamAssignmentToDelete(a)}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                const nowTime = new Date().getTime();
                                const filteredByType = examAssignments.filter(a => {
                                    if (examTypeFilter === 'all') return true;
                                    const exam = allExams.find(e => e.id === a.examId);
                                    const type = exam?.examType || 'homework';
                                    return type === examTypeFilter;
                                });
                                const activeExams = filteredByType.filter(a => hasAnyActiveDeadline(a, nowTime));
                                const expiredExams = filteredByType.filter(a => !hasAnyActiveDeadline(a, nowTime));

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {activeExams.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8b5cf6', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Còn hạn ({activeExams.length})
                                                </div>
                                                <div className="teacher-items-list">
                                                    {activeExams.map(renderExamCard)}
                                                </div>
                                            </div>
                                        )}
                                        {expiredExams.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', marginBottom: '12px', paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Đã hết hạn ({expiredExams.length})
                                                </div>
                                                <div className="teacher-items-list">
                                                    {expiredExams.map(renderExamCard)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            )
            }

            {/* DELETE ASSIGNMENT MODAL */}
            {
                assignmentToDelete && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <div className="teacher-modal-header">
                                <h2 className="teacher-modal-title" style={{ color: '#ef4444' }}>
                                    <Trash2 size={24} /> Xác nhận xóa bài luyện
                                </h2>
                                <button className="teacher-modal-close" onClick={() => setAssignmentToDelete(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: '0 24px 24px' }}>
                                <p style={{ margin: 0, color: '#475569', fontSize: '1rem', lineHeight: '1.5' }}>
                                    Bạn có chắc chắn muốn xóa bài luyện {(() => {
                                        const actualTopic = assignmentToDelete.isTeacherTopic
                                            ? teacherTopics.find(t => t.id === assignmentToDelete.topicId)
                                            : topics.find(t => t.id === assignmentToDelete.topicId);
                                        return <strong>{actualTopic ? actualTopic.name : assignmentToDelete.topicName}</strong>;
                                    })()}?<br /><br />
                                    Bài sẽ được chuyển vào <strong>Thùng rác</strong> và có thể khôi phục trong vòng 30 ngày.
                                </p>
                            </div>
                            <div className="teacher-modal-actions" style={{ padding: '0 24px 24px', flexDirection: 'row' }}>
                                <button className="teacher-btn teacher-btn-secondary" style={{ flex: 1 }} onClick={() => setAssignmentToDelete(null)} disabled={assignLoading}>
                                    Hủy
                                </button>
                                <button className="teacher-btn teacher-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={confirmDeleteAssignment} disabled={assignLoading}>
                                    {assignLoading ? 'Đang xóa...' : 'Xóa bài luyện'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DELETE EXAM ASSIGNMENT MODAL */}
            {
                examAssignmentToDelete && (() => {
                    const deleteExamType = allExams.find(e => e.id === examAssignmentToDelete.examId)?.examType;
                    const deleteExamLabel = deleteExamType === 'test' ? 'bài kiểm tra' : 'bài tập';
                    return (
                        <div className="teacher-modal-overlay">
                            <div className="teacher-modal">
                                <div className="teacher-modal-header">
                                    <h2 className="teacher-modal-title" style={{ color: '#ef4444' }}>
                                        <Trash2 size={24} /> Xác nhận xóa {deleteExamLabel} đã giao
                                    </h2>
                                    <button className="teacher-modal-close" onClick={() => setExamAssignmentToDelete(null)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <div style={{ padding: '0 24px 24px' }}>
                                    <p style={{ margin: 0, color: '#475569', fontSize: '1rem', lineHeight: '1.5' }}>
                                        Bạn có chắc chắn muốn xóa {deleteExamLabel} <strong>{allExams.find(e => e.id === examAssignmentToDelete.examId)?.name || examAssignmentToDelete.examName}</strong> đã giao cho lớp này?<br /><br />
                                        Bài sẽ được chuyển vào <strong>Thùng rác</strong> và có thể khôi phục trong vòng 30 ngày. Bài làm của học sinh vẫn được giữ nguyên.
                                    </p>
                                </div>
                                <div className="teacher-modal-actions" style={{ padding: '0 24px 24px', flexDirection: 'row' }}>
                                    <button className="teacher-btn teacher-btn-secondary" style={{ flex: 1 }} onClick={() => setExamAssignmentToDelete(null)} disabled={examAssignLoading}>
                                        Hủy
                                    </button>
                                    <button className="teacher-btn teacher-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDeleteExamAssignment} disabled={examAssignLoading}>
                                        {examAssignLoading ? 'Đang xóa...' : `Xóa ${deleteExamLabel}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* EXTEND DEADLINE MODAL */}
            {
                extendDeadlineTarget && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <div className="teacher-modal-header">
                                <h2 className="teacher-modal-title" style={{ color: '#f59e0b' }}>
                                    <CalendarClock size={24} /> Gia hạn Deadline
                                </h2>
                                <button className="teacher-modal-close" onClick={closeExtendDeadlineModal}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div>
                                <p style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '1rem', lineHeight: '1.5', fontWeight: 700 }}>
                                    {extendDeadlineTarget.type === 'exam' ? (allExams.find(e => e.id === extendDeadlineTarget.item.examId)?.name || extendDeadlineTarget.item.examName) : (() => {
                                        const item = extendDeadlineTarget.item;
                                        let topic = null;
                                        if (item.isTeacherTopic) topic = teacherTopics.find(t => t.id === item.topicId);
                                        else if (item.isGrammar) topic = grammarExercises.find(t => t.id === item.topicId);
                                        else topic = topics.find(t => t.id === item.topicId);
                                        return topic ? topic.name : item.topicName;
                                    })()}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px 12px', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <Clock size={15} />
                                    Deadline chung: {formatDate(extendDeadlineTarget.item.dueDate)}
                                </div>

                                {/* Mode toggle — reuse existing assign mode toggle design */}
                                <div className="teacher-assign-mode-toggle" style={{ marginBottom: '20px' }}>
                                    <button
                                        className={`teacher-assign-mode-btn ${extendDeadlineMode === 'all' ? 'active' : ''}`}
                                        onClick={() => setExtendDeadlineMode('all')}
                                        style={extendDeadlineMode === 'all' ? { color: '#d97706' } : {}}
                                    >
                                        <Users size={16} /> Cả lớp
                                    </button>
                                    <button
                                        className={`teacher-assign-mode-btn ${extendDeadlineMode === 'individual' ? 'active' : ''}`}
                                        onClick={() => setExtendDeadlineMode('individual')}
                                        style={extendDeadlineMode === 'individual' ? { color: '#d97706' } : {}}
                                    >
                                        <User size={16} /> Cá nhân
                                    </button>
                                </div>

                                {extendDeadlineMode === 'all' ? (
                                    <div className="teacher-form-group" style={{ marginBottom: 0 }}>
                                        <label className="teacher-form-label">
                                            <CalendarClock size={16} /> Deadline mới cho tất cả
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="teacher-input"
                                            value={extendDeadlineDate}
                                            onChange={e => setExtendDeadlineDate(e.target.value)}
                                            style={{ paddingLeft: '16px' }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                            Chọn học viên và đặt deadline riêng:
                                        </p>
                                        <div className="teacher-student-select-list">
                                            {students.map(s => {
                                                const isSelected = !!extendIndividualDates[s.uid];
                                                const existingOverride = extendDeadlineTarget.item.studentDeadlines?.[s.uid];
                                                return (
                                                    <div key={s.uid}
                                                        className={`teacher-student-select-item ${isSelected ? 'selected' : ''}`}
                                                        style={isSelected ? { borderColor: '#f59e0b', background: '#fffbeb', flexDirection: 'column', alignItems: 'stretch' } : { flexDirection: 'column', alignItems: 'stretch' }}
                                                        onClick={() => {
                                                            if (!isSelected) {
                                                                let prefill = extendDeadlineDate;
                                                                if (existingOverride) {
                                                                    const d = existingOverride.toDate ? existingOverride.toDate() : new Date(existingOverride);
                                                                    prefill = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                                }
                                                                setExtendIndividualDates(prev => ({ ...prev, [s.uid]: prefill }));
                                                            } else {
                                                                setExtendIndividualDates(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[s.uid];
                                                                    return next;
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div className="teacher-student-select-checkbox" style={isSelected ? { background: '#f59e0b', borderColor: '#f59e0b' } : {}}>
                                                                {isSelected && <Check size={14} color="white" />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div className="teacher-student-select-name">{s.displayName || s.email?.split('@')[0]}</div>
                                                                {existingOverride && (
                                                                    <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
                                                                        ⏰ Đã có deadline riêng
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <input
                                                                type="datetime-local"
                                                                className="teacher-input"
                                                                value={extendIndividualDates[s.uid] || ''}
                                                                onChange={e => { e.stopPropagation(); setExtendIndividualDates(prev => ({ ...prev, [s.uid]: e.target.value })); }}
                                                                onClick={e => e.stopPropagation()}
                                                                style={{ marginTop: '8px', paddingLeft: '16px', fontSize: '0.9rem' }}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="teacher-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="teacher-btn teacher-btn-secondary" style={{ flex: 1 }} onClick={closeExtendDeadlineModal} disabled={extendDeadlineLoading}>
                                    Hủy
                                </button>
                                <button
                                    className="teacher-btn teacher-btn-primary"
                                    style={{ backgroundColor: '#f59e0b', flex: 1, boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}
                                    onClick={handleExtendDeadline}
                                    disabled={extendDeadlineLoading || (extendDeadlineMode === 'all' ? !extendDeadlineDate : Object.keys(extendIndividualDates).length === 0)}
                                >
                                    {extendDeadlineLoading ? 'Đang cập nhật...' : (extendDeadlineMode === 'individual' ? `Gia hạn (${Object.keys(extendIndividualDates).length})` : 'Gia hạn')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* EXAM ASSIGN MODAL */}
            {
                isExamAssignModalOpen && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal" style={{ overflow: examPickerOpen ? 'visible' : 'auto' }}>
                            <div className="teacher-modal-header">
                                <h2 className="teacher-modal-title" style={{ color: '#0f172a' }}>
                                    <Plus size={24} color="#8b5cf6" /> Giao Bài Tập & Kiểm Tra
                                </h2>
                                <button className="teacher-modal-close" onClick={() => setIsExamAssignModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleCreateExamAssignment}>
                                <div className="teacher-form-group">
                                    <label className="teacher-form-label">
                                        <GraduationCap size={16} /> Chọn bài tập và kiểm tra
                                    </label>
                                    {/* Hidden input for form validation */}
                                    <input type="hidden" required value={examAssignmentForm.examId} />

                                    <div style={{ position: 'relative' }}>
                                        {/* Trigger Button */}
                                        <div className="teacher-input-wrapper" onClick={() => { setExamPickerOpen(!examPickerOpen); setExamSearch(''); }}>
                                            <span className="teacher-input-icon"><GraduationCap size={18} /></span>
                                            <div className={`topic-picker-trigger ${!examAssignmentForm.examId ? 'placeholder' : ''} ${examPickerOpen ? 'open' : ''}`}>
                                                {(() => {
                                                    if (!examAssignmentForm.examId) return '-- Chọn một bài tập và kiểm tra --';
                                                    const selected = allExams.find(e => e.id === examAssignmentForm.examId);
                                                    return selected ? selected.name : examAssignmentForm.examId;
                                                })()}
                                            </div>
                                            <div style={{ position: 'absolute', right: '16px', pointerEvents: 'none', color: '#94a3b8' }}>
                                                <ChevronDown size={18} style={{ transition: 'transform 0.2s', transform: examPickerOpen ? 'rotate(180deg)' : 'none' }} />
                                            </div>
                                        </div>

                                        {/* Picker Panel */}
                                        {examPickerOpen && (
                                            <div className="topic-picker-panel">
                                                <div className="topic-picker-search-wrapper" style={{ padding: '8px 10px 4px 10px' }}>
                                                    <Search size={14} className="topic-picker-search-icon" />
                                                    <input
                                                        type="text"
                                                        className="topic-picker-search"
                                                        placeholder="Tìm kiếm..."
                                                        value={examSearch}
                                                        onChange={e => setExamSearch(e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        autoFocus
                                                        style={{ padding: '7px 10px 7px 32px', fontSize: '0.82rem' }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', padding: '2px 16px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, marginRight: '2px' }}>Loại</span>
                                                    {[{ v: 'all', l: 'Tất cả' }, { v: 'homework', l: 'Bài tập' }, { v: 'test', l: 'Kiểm tra' }].map(tab => (
                                                        <button
                                                            key={tab.v}
                                                            type="button"
                                                            className={`topic-picker-tab ${examPickerTypeFilter === tab.v ? 'active' : ''}`}
                                                            onClick={e => { e.stopPropagation(); setExamPickerTypeFilter(tab.v); }}
                                                            style={{
                                                                padding: '3px 10px', fontSize: '0.72rem', borderRadius: '6px',
                                                                ...(examPickerTypeFilter === tab.v && tab.v === 'homework' ? { color: '#7c3aed', background: '#f5f3ff' } : {}),
                                                                ...(examPickerTypeFilter === tab.v && tab.v === 'test' ? { color: '#dc2626', background: '#fef2f2' } : {})
                                                            }}
                                                        >
                                                            {tab.l}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', padding: '2px 16px 6px 16px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, marginRight: '2px' }}>Nguồn</span>
                                                    {[{ v: 'all', l: 'Tất cả' }, { v: 'mine', l: 'Tự soạn' }, { v: 'shared', l: 'Chính thức' }].map(tab => (
                                                        <button
                                                            key={tab.v}
                                                            type="button"
                                                            className={`topic-picker-tab ${examPickerSourceFilter === tab.v ? 'active' : ''}`}
                                                            onClick={e => { e.stopPropagation(); setExamPickerSourceFilter(tab.v); }}
                                                            style={{ padding: '3px 10px', fontSize: '0.72rem', borderRadius: '6px' }}
                                                        >
                                                            {tab.l}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="topic-picker-list">
                                                    {(() => {
                                                        const searchLower = examSearch.toLowerCase().trim();
                                                        const filtered = allExams.filter(e => {
                                                            const matchesType = examPickerTypeFilter === 'all' ||
                                                                (examPickerTypeFilter === 'homework' ? e.examType !== 'test' : e.examType === 'test');
                                                            const matchesSource = examPickerSourceFilter === 'all' ||
                                                                (examPickerSourceFilter === 'mine' ? e.isOwner : !e.isOwner);
                                                            const matchesSearch = !searchLower || e.name.toLowerCase().includes(searchLower);
                                                            return matchesType && matchesSource && matchesSearch;
                                                        });

                                                        if (filtered.length === 0) {
                                                            return <div className="topic-picker-empty">Không tìm thấy bài tập và kiểm tra nào.</div>;
                                                        }

                                                        // Build exam folder lookup from exam_folders + teacher_exam_folders
                                                        // These folders contain examIds arrays (exams don't have folderId)
                                                        const allExamFolders = new Map();
                                                        const examToFolderMap = {}; // examId -> folderId (reverse map)
                                                        (examFoldersData || []).forEach(f => {
                                                            allExamFolders.set(f.id, { id: f.id, name: f.name, order: f.order || 0 });
                                                            (f.examIds || []).forEach(eid => { examToFolderMap[eid] = f.id; });
                                                        });
                                                        (teacherExamFoldersData || []).forEach(f => {
                                                            if (!allExamFolders.has(f.id)) allExamFolders.set(f.id, { id: f.id, name: f.name, order: f.order || 0 });
                                                            (f.examIds || []).forEach(eid => { if (!examToFolderMap[eid]) examToFolderMap[eid] = f.id; });
                                                        });

                                                        // Group by folder using reverse map
                                                        const folderGroups = {};
                                                        const noFolderItems = [];
                                                        filtered.forEach(e => {
                                                            const fid = examToFolderMap[e.id] || e.folderId;
                                                            if (fid) {
                                                                if (!folderGroups[fid]) folderGroups[fid] = [];
                                                                folderGroups[fid].push(e);
                                                            } else {
                                                                noFolderItems.push(e);
                                                            }
                                                        });

                                                        // Sort items inside each folder by createdAt newest first
                                                        const sortExams = (arr) => arr.sort((a, b) => {
                                                            const ta = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                                                            const tb = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                                                            return tb - ta;
                                                        });

                                                        // Build ordered folder list
                                                        const orderedFolderIds = Object.keys(folderGroups).sort((a, b) => {
                                                            const fa = allExamFolders.get(a);
                                                            const fb = allExamFolders.get(b);
                                                            return (fa?.order || 0) - (fb?.order || 0);
                                                        });

                                                        const isSearching = !!searchLower;

                                                        const renderExamItem = (e) => {
                                                            const isSelected = examAssignmentForm.examId === e.id;
                                                            const hasIncompleteTime = (e.timingMode === 'section' && (e.sections || []).some(s => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) || (e.timingMode === 'question' && e.cachedQuestionTimeMissingCount > 0);
                                                            return (
                                                                <div
                                                                    key={e.id}
                                                                    className={`topic-picker-item ${isSelected ? 'selected' : ''} ${hasIncompleteTime ? 'disabled' : ''}`}
                                                                    style={{
                                                                        ...(isSelected ? { background: '#f5f3ff', color: '#7c3aed' } : {}),
                                                                        ...(hasIncompleteTime ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                                                                    }}
                                                                    onClick={e_ev => {
                                                                        e_ev.stopPropagation();
                                                                        if (hasIncompleteTime) return;
                                                                        setExamAssignmentForm({ ...examAssignmentForm, examId: e.id });
                                                                        setExamPickerOpen(false);
                                                                        setExamSearch('');
                                                                    }}
                                                                >
                                                                    <span className="topic-picker-badge" style={{ background: e.examType === 'test' ? '#fef2f2' : '#f5f3ff', color: e.examType === 'test' ? '#dc2626' : '#7c3aed', border: `1px solid ${e.examType === 'test' ? '#fecaca' : '#ddd6fe'}`, fontWeight: 700 }}>{e.examType === 'test' ? 'Kiểm tra' : 'Bài tập'}</span>
                                                                    <span className="topic-picker-item-name">{e.name}</span>
                                                                    {hasIncompleteTime && (
                                                                        <span style={{ fontSize: '0.6rem', color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fecaca', marginLeft: '4px' }}>⚠ Chưa hẹn giờ</span>
                                                                    )}
                                                                    {isSelected && <Check size={16} className="topic-picker-check" style={{ color: '#7c3aed' }} />}
                                                                </div>
                                                            );
                                                        };

                                                        return (
                                                            <>
                                                                {orderedFolderIds.map(folderId => {
                                                                    const folder = allExamFolders.get(folderId);
                                                                    const folderItems = sortExams(folderGroups[folderId]);
                                                                    const isExpanded = isSearching || expandedExamPickerFolders.has(folderId);
                                                                    return (
                                                                        <div key={folderId} className="picker-folder-group">
                                                                            <div
                                                                                className={`picker-folder-header ${isExpanded ? 'expanded' : ''}`}
                                                                                onClick={e => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedExamPickerFolders(prev => {
                                                                                        const next = new Set(prev);
                                                                                        if (next.has(folderId)) next.delete(folderId);
                                                                                        else next.add(folderId);
                                                                                        return next;
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <div className="picker-folder-header-left">
                                                                                    <FolderOpen size={15} />
                                                                                    <span>{folder?.name || 'Thư mục'}</span>
                                                                                    <span className="picker-folder-count">{folderItems.length}</span>
                                                                                </div>
                                                                                <ChevronDown size={16} className={`picker-folder-chevron ${isExpanded ? 'expanded' : ''}`} />
                                                                            </div>
                                                                            {isExpanded && (
                                                                                <div className="picker-folder-items">
                                                                                    {folderItems.map(renderExamItem)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {noFolderItems.length > 0 && (
                                                                    <div className="picker-folder-group">
                                                                        {orderedFolderIds.length > 0 && (
                                                                            <div
                                                                                className={`picker-folder-header no-folder ${isSearching || expandedExamPickerFolders.has('__none__') ? 'expanded' : ''}`}
                                                                                onClick={e => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedExamPickerFolders(prev => {
                                                                                        const next = new Set(prev);
                                                                                        if (next.has('__none__')) next.delete('__none__');
                                                                                        else next.add('__none__');
                                                                                        return next;
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <div className="picker-folder-header-left">
                                                                                    <FileText size={15} />
                                                                                    <span>Không có thư mục</span>
                                                                                    <span className="picker-folder-count">{noFolderItems.length}</span>
                                                                                </div>
                                                                                <ChevronDown size={16} className={`picker-folder-chevron ${isSearching || expandedExamPickerFolders.has('__none__') ? 'expanded' : ''}`} />
                                                                            </div>
                                                                        )}
                                                                        {(orderedFolderIds.length === 0 || isSearching || expandedExamPickerFolders.has('__none__')) && (
                                                                            <div className="picker-folder-items">
                                                                                {sortExams(noFolderItems).map(renderExamItem)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="teacher-form-group">
                                    <label className="teacher-form-label">
                                        <Users size={16} /> Đối tượng giao
                                    </label>
                                    <div className="teacher-assign-mode-toggle">
                                        <button
                                            type="button"
                                            className={`teacher-assign-mode-btn ${examAssignmentMode === 'all' ? 'active' : ''}`}
                                            style={examAssignmentMode === 'all' ? { background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' } : {}}
                                            onClick={() => { setExamAssignmentMode('all'); setSelectedStudentIds([]); }}
                                        >
                                            <Users size={16} /> Cả lớp
                                        </button>
                                        <button
                                            type="button"
                                            className={`teacher-assign-mode-btn ${examAssignmentMode === 'individual' ? 'active' : ''}`}
                                            style={examAssignmentMode === 'individual' ? { background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' } : {}}
                                            onClick={() => setExamAssignmentMode('individual')}
                                        >
                                            <User size={16} /> Cá nhân
                                        </button>
                                    </div>

                                    {examAssignmentMode === 'individual' && (
                                        <div style={{ marginTop: '12px' }}>
                                            {students.length === 0 ? (
                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '12px' }}>
                                                    Lớp chưa có học viên nào.
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="teacher-student-select-all">
                                                        <span className="teacher-student-select-count">
                                                            Đã chọn {selectedStudentIds.length}/{students.length}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            style={{ color: '#7c3aed' }}
                                                            onClick={() => {
                                                                if (selectedStudentIds.length === students.length) {
                                                                    setSelectedStudentIds([]);
                                                                } else {
                                                                    setSelectedStudentIds(students.map(s => s.uid));
                                                                }
                                                            }}
                                                        >
                                                            {selectedStudentIds.length === students.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                        </button>
                                                    </div>
                                                    <div className="teacher-student-select-list">
                                                        {students.map(s => {
                                                            const isSelected = selectedStudentIds.includes(s.uid);
                                                            return (
                                                                <div
                                                                    key={s.uid}
                                                                    className={`teacher-student-select-item ${isSelected ? 'selected' : ''}`}
                                                                    style={isSelected ? { borderColor: '#ddd6fe', background: '#f5f3ff' } : {}}
                                                                    onClick={() => toggleStudentSelection(s.uid)}
                                                                >
                                                                    <div className="teacher-student-select-checkbox" style={isSelected ? { background: '#7c3aed', borderColor: '#7c3aed' } : {}}>
                                                                        {isSelected && <Check size={14} />}
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                                        <span className="teacher-student-select-name">
                                                                            {s.displayName || s.email?.split('@')[0]}
                                                                        </span>
                                                                        <span className="teacher-student-select-email">{s.email}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Scheduled Start Toggle */}
                                <div className="teacher-form-group">
                                    <label className="teacher-form-label">
                                        ⏰ Thời điểm bắt đầu
                                    </label>
                                    <div className="teacher-assign-mode-toggle">
                                        <button
                                            type="button"
                                            className={`teacher-assign-mode-btn ${!examAssignmentForm.scheduledStart ? 'active' : ''}`}
                                            onClick={() => setExamAssignmentForm({ ...examAssignmentForm, scheduledStart: '' })}
                                            style={!examAssignmentForm.scheduledStart ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderColor: '#059669' } : {}}
                                        >
                                            Bắt đầu ngay
                                        </button>
                                        <button
                                            type="button"
                                            className={`teacher-assign-mode-btn ${examAssignmentForm.scheduledStart ? 'active' : ''}`}
                                            onClick={() => setExamAssignmentForm({ ...examAssignmentForm, scheduledStart: 'pending' })}
                                            style={examAssignmentForm.scheduledStart ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', borderColor: '#d97706' } : {}}
                                        >
                                            Hẹn ngày...
                                        </button>
                                    </div>
                                    {examAssignmentForm.scheduledStart && (
                                        <div style={{ marginTop: '8px' }}>
                                            <div className="teacher-input-wrapper">
                                                <span className="teacher-input-icon">📅</span>
                                                <input
                                                    type="datetime-local"
                                                    className="teacher-input"
                                                    value={examAssignmentForm.scheduledStart === 'pending' ? '' : examAssignmentForm.scheduledStart}
                                                    onChange={e => setExamAssignmentForm({ ...examAssignmentForm, scheduledStart: e.target.value })}
                                                    style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
                                                />
                                            </div>
                                            {examAssignmentForm.scheduledStart && examAssignmentForm.scheduledStart !== 'pending' && examAssignmentForm.dueDate && new Date(examAssignmentForm.scheduledStart) >= new Date(examAssignmentForm.dueDate) && (
                                                <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0', fontWeight: 600 }}>⚠ Ngày bắt đầu phải trước hạn nộp!</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="teacher-form-group">
                                    <label className="teacher-form-label">
                                        <Clock size={16} /> Hạn hoàn thành
                                    </label>
                                    <div className="teacher-input-wrapper">
                                        <span className="teacher-input-icon"><Clock size={18} /></span>
                                        <input
                                            type="datetime-local"
                                            required
                                            className="teacher-input"
                                            value={examAssignmentForm.dueDate}
                                            onChange={e => setExamAssignmentForm({ ...examAssignmentForm, dueDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="teacher-modal-actions">
                                    <button type="button" className="teacher-btn teacher-btn-secondary" onClick={() => setIsExamAssignModalOpen(false)} disabled={examAssignLoading}>
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={examAssignLoading || (examAssignmentMode === 'individual' && selectedStudentIds.length === 0) || examAssignmentForm.scheduledStart === 'pending' || (examAssignmentForm.scheduledStart && examAssignmentForm.scheduledStart !== 'pending' && examAssignmentForm.dueDate && new Date(examAssignmentForm.scheduledStart) >= new Date(examAssignmentForm.dueDate))}
                                        className="teacher-btn teacher-btn-primary"
                                        style={{ background: '#8b5cf6' }}
                                    >
                                        {examAssignLoading ? 'Đang giao...' : 'Giao bài'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* EXAM PROGRESS MODAL (SUBMISSIONS DETAIL) */}
            {
                selectedExamAssignment && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal wide">
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setSelectedExamAssignment(null)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="teacher-modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                <div>
                                    <h2 className="teacher-modal-title" style={{ color: '#0f172a', display: 'flex', alignItems: 'flex-start', gap: '8px', margin: 0, paddingRight: '40px' }}>
                                        <BarChart3 size={24} color="#8b5cf6" style={{ minWidth: '24px', flexShrink: 0, marginTop: '2px' }} />
                                        <span style={{ fontSize: '1.2rem', lineHeight: '1.3' }}>{allExams.find(e => e.id === selectedExamAssignment.examId)?.name || selectedExamAssignment.examName}</span>
                                    </h2>
                                    <p style={{ margin: '4px 0 12px 32px', color: '#64748b', fontSize: '0.85rem' }}>Hạn: {formatDate(selectedExamAssignment.dueDate)}</p>
                                </div>
                                {examSubmissions.some(s => s.status === 'graded' && !s.resultsReleased) && (
                                    <div style={{ display: 'flex', width: '100%' }}>
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            style={{ background: '#10b981', padding: '10px 16px', fontSize: '0.9rem', width: '100%', justifyContent: 'center' }}
                                            onClick={() => {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: 'Gửi tất cả kết quả',
                                                    message: 'Bạn có chắc chắn muốn gửi tất cả kết quả đã chấm cho học sinh không?',
                                                    type: 'primary',
                                                    onConfirm: async () => {
                                                        try {
                                                            const releaserName = user?.displayName || user?.email || (user?.role === 'admin' ? 'Admin' : 'Giáo viên');
                                                            const unreleased = examSubmissions.filter(s => s.status === 'graded' && !s.resultsReleased);
                                                            await Promise.all(unreleased.map(s => releaseExamSubmissionResults(s.id, user?.uid, releaserName)));
                                                            const updated = await getExamSubmissionsForAssignment(selectedExamAssignment.id);
                                                            setExamSubmissions(updated);
                                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                        } catch (e) {
                                                            alert('Lỗi: ' + e.message);
                                                        }
                                                    }
                                                });
                                            }}
                                        >
                                            <Send size={18} /> Gửi tất cả kết quả
                                        </button>
                                    </div>
                                )}
                            </div>

                            {examSubmissionsLoading ? (
                                <div className="admin-empty-state">Đang tải danh sách bài làm...</div>
                            ) : examSubmissions.length === 0 ? (
                                <div className="admin-empty-state">Chưa có học sinh nào nộp bài.</div>
                            ) : (
                                <>

                                    {/* Per-question accuracy chart */}
                                    {examPopupQuestions.length > 0 && (() => {
                                        const studentUids = new Set(students.map(s => s.uid));
                                        const releasedSubs = examSubmissions.filter(s => s.resultsReleased && studentUids.has(s.studentId));
                                        if (releasedSubs.length === 0) return null;
                                        const questionAccuracyData = examPopupQuestions
                                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                                            .map((q, idx) => {
                                                let scoreSum = 0;
                                                let totalCount = 0;
                                                releasedSubs.forEach(sub => {
                                                    const result = sub.results?.[q.id];
                                                    if (result) {
                                                        const maxS = result.maxScore || q.points || 1;
                                                        const s = result.teacherOverride?.score ?? result.score ?? 0;
                                                        totalCount++;
                                                        scoreSum += (s / maxS);
                                                    }
                                                });
                                                const pct = totalCount > 0 ? Math.round((scoreSum / totalCount) * 100) : 0;
                                                return {
                                                    name: `C${idx + 1}`,
                                                    fullName: `Câu ${idx + 1}`,
                                                    pct,
                                                    totalCount
                                                };
                                            });
                                        return (
                                            <div style={{ marginBottom: '24px', background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '16px', textAlign: 'center' }}>
                                                    Tỉ lệ đúng theo từng câu
                                                </h3>
                                                <div className="teacher-chart-scroll-wrapper">
                                                    <div style={{ height: '280px', minWidth: Math.max(questionAccuracyData.length * 50, 400) + 'px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart
                                                                data={questionAccuracyData}
                                                                margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                <XAxis
                                                                    dataKey="name"
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                                                    dy={10}
                                                                    interval={0}
                                                                />
                                                                <YAxis
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                                                    dx={-10}
                                                                    domain={[0, 100]}
                                                                    tickFormatter={(v) => `${v}%`}
                                                                />
                                                                <Tooltip
                                                                    cursor={{ fill: '#f8fafc' }}
                                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                                                                    formatter={(value, name, props) => [`${value}%`, 'Điểm TB']}
                                                                    labelFormatter={(value, payload) => payload?.[0]?.payload?.fullName || value}
                                                                />
                                                                <Bar
                                                                    dataKey="pct"
                                                                    name="Tỉ lệ đúng"
                                                                    radius={[6, 6, 0, 0]}
                                                                    barSize={36}
                                                                    animationDuration={1500}
                                                                >
                                                                    {questionAccuracyData.map((entry, index) => (
                                                                        <Cell key={index} fill={entry.pct >= 80 ? '#10b981' : entry.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px', fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                                    <span>🟢 ≥80%</span>
                                                    <span>🟡 50-79%</span>
                                                    <span>🔴 &lt;50%</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="teacher-table-responsive">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Học viên</th>
                                                    <th>Trạng thái</th>
                                                    <th>Kết quả</th>
                                                    <th className="text-right">Hành động</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students
                                                    .filter(s => {
                                                        if (selectedExamAssignment.targetType === 'individual') {
                                                            return selectedExamAssignment.targetId === s.uid;
                                                        }
                                                        return true;
                                                    })
                                                    .sort((a, b) => {
                                                        const subA = examSubmissions.find(s => s.studentId === a.uid);
                                                        const subB = examSubmissions.find(s => s.studentId === b.uid);
                                                        const scoreA = subA?.totalScore ?? -1;
                                                        const scoreB = subB?.totalScore ?? -1;
                                                        return scoreB - scoreA;
                                                    })
                                                    .map(student => {
                                                        const sub = examSubmissions.find(s => s.studentId === student.uid);
                                                        const subHasAiError = sub?.results && (
                                                            Object.values(sub.results).some(r => r.feedback && (r.feedback.includes('Lỗi khi chấm') || r.feedback.includes('chấm thủ công') || r.feedback.includes('chưa được AI chấm')))
                                                            || Object.entries(sub.results).some(([qId, r]) => (r.score === 0 || r.score === undefined) && !r.feedback && !r.teacherOverride && Object.values(sub.answers || {}).some(sec => sec?.[qId]?.answer?.hasRecording))
                                                        );
                                                        const statusMap = {
                                                            'in_progress': { label: 'Đang làm', color: '#f59e0b', bg: '#fef3c7' },
                                                            'submitted': { label: 'Đã nộp', color: '#3b82f6', bg: '#eff6ff' },
                                                            'graded': { label: 'AI đã chấm', color: '#10b981', bg: '#ecfdf4' },
                                                            'released': { label: 'Đã trả kết quả', color: '#7c3aed', bg: '#f5f3ff' }
                                                        };
                                                        const statusKey = sub ? (sub.status === 'graded' && sub.resultsReleased ? 'released' : sub.status) : 'none';
                                                        let status = sub ? (statusMap[statusKey] || statusMap['submitted']) : (() => {
                                                            // Check student-specific deadline first, then fall back to general dueDate
                                                            const studentDl = selectedExamAssignment?.studentDeadlines?.[student.uid];
                                                            const effectiveDl = studentDl || selectedExamAssignment?.dueDate;
                                                            const dl = effectiveDl ? (effectiveDl.toDate ? effectiveDl.toDate() : new Date(effectiveDl)) : null;
                                                            const deadlinePassed = dl && dl.getTime() <= Date.now();
                                                            return deadlinePassed
                                                                ? { label: 'Không hoàn thành', color: '#ef4444', bg: '#fef2f2' }
                                                                : { label: 'Chưa làm', color: '#94a3b8', bg: '#f8fafc' };
                                                        })();
                                                        if (subHasAiError && sub?.status === 'graded' && !sub?.resultsReleased) {
                                                            status = { label: 'AI chấm sót', color: '#ea580c', bg: '#fff7ed' };
                                                        }
                                                        // Follow-up status overrides
                                                        if (sub && sub.resultsReleased && sub.followUpRequested && Object.keys(sub.followUpRequested).length > 0) {
                                                            const fuReq = sub.followUpRequested;
                                                            const fuAns = sub.followUpAnswers || {};
                                                            const fuRes = sub.followUpResults || {};
                                                            const hasAllAnswers = Object.keys(fuReq).every(qId => Object.values(fuAns).some(sec => sec?.[qId]));
                                                            const hasAllGraded = Object.keys(fuReq).every(qId => fuRes[qId]);
                                                            if (sub.followUpResultsReleased) {
                                                                status = { label: 'Đã trả bài sửa', color: '#059669', bg: '#ecfdf5' };
                                                            } else if (hasAllGraded) {
                                                                status = { label: 'AI đã chấm bài sửa', color: '#0891b2', bg: '#ecfeff' };
                                                            } else if (hasAllAnswers) {
                                                                status = { label: 'Đã nộp bài sửa', color: '#6d28d9', bg: '#f5f3ff' };
                                                            } else {
                                                                status = { label: 'Chờ bài sửa', color: '#d97706', bg: '#fffbeb' };
                                                            }
                                                        }

                                                        return (
                                                            <tr key={student.uid}>
                                                                <td data-label="Học viên">
                                                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                                                                        {student.displayName || student.email.split('@')[0]}
                                                                    </div>
                                                                </td>
                                                                <td data-label="Trạng thái">
                                                                    <span style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        padding: '6px 14px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 800,
                                                                        color: status.color,
                                                                        background: status.bg,
                                                                        boxShadow: `0 2px 4px ${status.bg}80`
                                                                    }}>
                                                                        {status.label}
                                                                    </span>
                                                                    {sub?.releasedByName && statusKey === 'released' && (
                                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '6px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <Check size={12} /> Đã gửi bởi {sub.releasedByName}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td data-label="Kết quả">
                                                                    {sub && (sub.status === 'graded' || sub.resultsReleased) && sub.totalScore !== undefined ? (
                                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                                                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#6366f1', letterSpacing: '-0.02em' }}>
                                                                                {Math.round(sub.totalScore * 10) / 10}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>
                                                                                /{sub.maxTotalScore}
                                                                            </div>
                                                                        </div>
                                                                    ) : sub && (sub.status === 'submitted' || sub.status === 'in_progress') ? (
                                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>
                                                                                /{sub.maxTotalScore || '...'}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontStyle: 'italic', fontWeight: 600 }}>Chưa nộp bài</div>
                                                                    )}
                                                                    {sub?.tabSwitchCount > 0 && (
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '4px', padding: '2px 8px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.68rem', fontWeight: 700, color: '#92400e' }}>
                                                                            ⚠ Rời {sub.tabSwitchCount} lần
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td data-label="Thao tác" className="text-right">
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                                                                        {sub && (sub.status === 'submitted' || (sub.status === 'graded' && !sub.resultsReleased && (settings?.allowRetryAiGrading || subHasAiError))) && (
                                                                            <button
                                                                                className="admin-action-btn"
                                                                                style={{ color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a' }}
                                                                                title="Yêu cầu AI chấm lại"
                                                                                onClick={() => {
                                                                                    setConfirmModal({
                                                                                        isOpen: true,
                                                                                        title: 'AI chấm lại',
                                                                                        message: `Yêu cầu AI chấm lại bài của ${student.displayName || student.email.split('@')[0]}? Quá trình này có thể mất vài giây.`,
                                                                                        type: 'primary',
                                                                                        onConfirm: async () => {
                                                                                            try {
                                                                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                                                const [examData, questionsData] = await Promise.all([
                                                                                                    getExam(sub.examId),
                                                                                                    getExamQuestions(sub.examId)
                                                                                                ]);
                                                                                                await gradeExamSubmission(
                                                                                                    sub.id, sub, questionsData,
                                                                                                    examData?.sections || [],
                                                                                                    examData?.teacherTitle || '',
                                                                                                    examData?.studentTitle || ''
                                                                                                );
                                                                                                const updated = await getExamSubmissionsForAssignment(selectedExamAssignment.id);
                                                                                                setExamSubmissions(updated);
                                                                                            } catch (e) {
                                                                                                alert('Lỗi khi AI chấm: ' + e.message);
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <Sparkles size={18} />
                                                                            </button>
                                                                        )}
                                                                        {sub && sub.status === 'graded' && !sub.resultsReleased && (
                                                                            <button
                                                                                className="admin-action-btn"
                                                                                style={{ color: '#10b981', background: '#ecfdf4', border: '1px solid #bbf7d0' }}
                                                                                title="Gửi kết quả cho học sinh"
                                                                                onClick={() => {
                                                                                    setConfirmModal({
                                                                                        isOpen: true,
                                                                                        title: 'Gửi kết quả',
                                                                                        message: `Gửi kết quả bài làm cho học sinh ${student.displayName || student.email.split('@')[0]}?`,
                                                                                        type: 'primary',
                                                                                        onConfirm: async () => {
                                                                                            try {
                                                                                                const releaserName = user?.displayName || user?.email || (user?.role === 'admin' ? 'Admin' : 'Giáo viên');
                                                                                                await releaseExamSubmissionResults(sub.id, user?.uid, releaserName);
                                                                                                const updated = await getExamSubmissionsForAssignment(selectedExamAssignment.id);
                                                                                                setExamSubmissions(updated);
                                                                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                                            } catch (e) {
                                                                                                alert('Lỗi: ' + e.message);
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <Send size={18} />
                                                                            </button>
                                                                        )}
                                                                        {sub ? (
                                                                            <>
                                                                                <Link
                                                                                    to={isAdminView ? `/admin/exam-submissions/${selectedExamAssignment.id}/${student.uid}` : `/teacher/exam-submissions/${selectedExamAssignment.id}/${student.uid}`}
                                                                                    className="admin-action-btn"
                                                                                    style={{ color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe' }}
                                                                                    title="Xem chi tiết & Sửa điểm"
                                                                                >
                                                                                    <List size={18} />
                                                                                </Link>
                                                                                <button
                                                                                    className="admin-action-btn"
                                                                                    style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca' }}
                                                                                    title="Cho phép làm lại"
                                                                                    onClick={() => {
                                                                                        setConfirmModal({
                                                                                            isOpen: true,
                                                                                            title: 'Xin xác nhận',
                                                                                            message: `Bạn có chắc chắn muốn xóa bài làm của học viên ${student.displayName || student.email.split('@')[0]} để làm lại từ đầu không?`,
                                                                                            type: 'danger',
                                                                                            onConfirm: async () => {
                                                                                                try {
                                                                                                    // Delete ALL submissions for this student on this assignment (in case of duplicates)
                                                                                                    const allSubs = await getExamSubmissionsForAssignment(selectedExamAssignment.id);
                                                                                                    const studentSubs = allSubs.filter(s => s.studentId === student.uid);
                                                                                                    await Promise.all(studentSubs.map(s => deleteExamSubmission(s.id)));

                                                                                                    // Auto-extend deadline if it has passed (so student can actually redo)
                                                                                                    const studentDl = selectedExamAssignment?.studentDeadlines?.[student.uid];
                                                                                                    const effectiveDl = studentDl || selectedExamAssignment?.dueDate;
                                                                                                    const dlDate = effectiveDl ? (effectiveDl.toDate ? effectiveDl.toDate() : new Date(effectiveDl)) : null;
                                                                                                    if (dlDate && dlDate.getTime() <= Date.now()) {
                                                                                                        const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h from now
                                                                                                        await updateExamAssignmentStudentDeadline(selectedExamAssignment.id, student.uid, newDeadline);
                                                                                                    }

                                                                                                    const updated = await getExamSubmissionsForAssignment(selectedExamAssignment.id);
                                                                                                    setExamSubmissions(updated);
                                                                                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                                                } catch (e) {
                                                                                                    alert('Lỗi: ' + e.message);
                                                                                                }
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <RefreshCw size={18} />
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic', fontWeight: 600 }}>Chưa có bài nộp</span>
                                                                        )}
                                                                        {/* Red flag indicators */}
                                                                        {(() => {
                                                                            const count = redFlagCounts[student.uid] || 0;
                                                                            return (
                                                                                <span className="exam-popup-flags" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                                    {[1, 2, 3].map(i => {
                                                                                        const isFilled = i <= count;
                                                                                        const isNext = i === count + 1 && count < 3;
                                                                                        const flagColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                                                                        return (
                                                                                            <span
                                                                                                key={i}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    if (isNext && !isStaff) {
                                                                                                        setRedFlagModalStudent(student);
                                                                                                        setRedFlagForm({ violationType: '', note: '' });
                                                                                                        getRedFlagsForStudentInGroup(student.uid, groupId).then(setAddModalFlags);
                                                                                                    } else if (isFilled) {
                                                                                                        setRedFlagViewIndex(i);
                                                                                                        setRedFlagHistoryStudent(student);
                                                                                                        setRedFlagHistoryLoading(true);
                                                                                                        getRedFlagsForStudentInGroup(student.uid, groupId).then(setRedFlagHistory).finally(() => setRedFlagHistoryLoading(false));
                                                                                                    }
                                                                                                }}
                                                                                                style={{
                                                                                                    width: '20px', height: '20px', borderRadius: '5px',
                                                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                                    fontSize: '0.65rem',
                                                                                                    background: isFilled ? (i >= 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'transparent',
                                                                                                    border: isFilled ? `1.5px solid ${flagColor}40` : '1.5px solid transparent',
                                                                                                    cursor: (isFilled || (isNext && !isStaff)) ? 'pointer' : 'default',
                                                                                                    opacity: isFilled ? 1 : 0.3,
                                                                                                    filter: !isFilled ? 'grayscale(1)' : 'none',
                                                                                                    transition: 'all 0.2s'
                                                                                                }}
                                                                                                title={isFilled ? `Xem cờ đỏ lần ${i}` : isNext ? `Đánh cờ đỏ lần ${i}` : ''}
                                                                                            >
                                                                                                🚩
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {/* The 'Đóng cửa sổ' button was removed per request */}
                        </div>
                    </div>
                )
            }
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                confirmText="Xác nhận"
            />

            {/* RED FLAG MODAL — Add New Flag */}
            {redFlagModalStudent && (() => {
                const currentCount = redFlagCounts[redFlagModalStudent.uid] || 0;
                const nextFlag = currentCount + 1;
                const isThirdFlag = nextFlag >= 3;
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setRedFlagModalStudent(null)}>
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
                            width: '90%', maxWidth: addModalFlags.length > 0 ? '780px' : '480px', borderRadius: '20px', overflow: 'hidden',
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
                                        {redFlagModalStudent.displayName || redFlagModalStudent.email}
                                    </div>
                                </div>
                                <button onClick={() => setRedFlagModalStudent(null)} style={{
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
                                        <button onClick={() => setRedFlagModalStudent(null)} style={{
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
                                                    await addRedFlag({
                                                        studentId: redFlagModalStudent.uid,
                                                        studentName: redFlagModalStudent.displayName || redFlagModalStudent.email?.split('@')[0] || '',
                                                        studentEmail: redFlagModalStudent.email || '',
                                                        groupId,
                                                        groupName: group?.name || '',
                                                        violationType: redFlagForm.violationType,
                                                        violationLabel: vt?.label || redFlagForm.violationType,
                                                        note: redFlagForm.note.trim(),
                                                        flaggedBy: user?.uid,
                                                        flaggedByName: user?.displayName || user?.email?.split('@')[0] || '',
                                                        flaggedByRole: user?.role || 'teacher'
                                                    });
                                                    const counts = await getRedFlagCountsForGroup(groupId);
                                                    setRedFlagCounts(counts);
                                                    setRedFlagModalStudent(null);
                                                } catch (err) {
                                                    console.error('Error adding red flag:', err);
                                                    alert('Lỗi khi đánh cờ đỏ. Vui lòng thử lại.');
                                                }
                                                setRedFlagLoading(false);
                                            }}
                                        >
                                            {redFlagLoading ? 'Đang xử lý...' : (isThirdFlag ? '🔴 Xác nhận — Mất đảm bảo đầu ra' : '🚩 Xác nhận đánh cờ đỏ')}
                                        </button>
                                    </div>
                                </div>

                                {/* Right: History */}
                                {addModalFlags.length > 0 && (
                                    <div className="rfm-history" style={{ padding: '20px 16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Lịch sử cờ đỏ</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {[...addModalFlags].sort((a, b) => { const ta = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0)); const tb = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0)); return tb - ta; }).map(f => {
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

            {/* RED FLAG HISTORY MODAL */}
            {redFlagHistoryStudent && (() => {
                const historyCount = redFlagCounts[redFlagHistoryStudent.uid] || 0;
                const isTerminated = historyCount >= 3;
                const activeFlags = redFlagHistory.filter(f => !f.removed);
                const removedFlags = redFlagHistory.filter(f => f.removed);
                const viewIdx = redFlagViewIndex;
                const flagsToShow = viewIdx != null ? activeFlags.filter(f => f.flagNumber === viewIdx) : activeFlags;
                const removedToShow = removedFlags;
                const headerTitle = viewIdx != null ? `🚩 Cờ đỏ lần ${viewIdx}` : `🚩 Lịch sử cờ đỏ (${historyCount}/3)`;
                const roleLabels = { admin: 'QTV', teacher: 'GV', staff: 'NV' };
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                        onClick={() => { setRedFlagHistoryStudent(null); setRedFlagViewIndex(null); }}>
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
                                        {headerTitle}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                        {redFlagHistoryStudent.displayName || redFlagHistoryStudent.email}
                                    </div>
                                </div>
                                <button onClick={() => { setRedFlagHistoryStudent(null); setRedFlagViewIndex(null); }} style={{
                                    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
                                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#fff'
                                }}><X size={18} /></button>
                            </div>

                            {/* Flag navigation tabs */}
                            {historyCount > 1 && (
                                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}>
                                    {[1, 2, 3].map(i => {
                                        const hasFlag = i <= historyCount;
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
                                {redFlagHistoryLoading ? (
                                    <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Đang tải...</div>
                                ) : flagsToShow.length === 0 && removedToShow.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>{viewIdx ? 'Cờ này đã được gỡ.' : 'Chưa có cờ đỏ nào.'}</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {isTerminated && viewIdx == null && (
                                            <div style={{
                                                padding: '14px 16px', borderRadius: '14px',
                                                background: '#fef2f2', border: '1.5px solid #fecaca',
                                                display: 'flex', alignItems: 'flex-start', gap: '10px'
                                            }}>
                                                <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>
                                                        Không còn đảm bảo đầu ra
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                        Học viên vẫn được tham gia lớp cho đến hết khóa nhưng không còn đảm bảo CLĐR.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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
                                                        {flag.violationLabel}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '12px', borderLeft: `3px solid ${border}`, lineHeight: 1.5, marginBottom: '10px' }}>
                                                        {flag.note}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                                        👤 {roleLabels[flag.flaggedByRole] || 'GV'} {flag.flaggedByName}
                                                    </div>

                                                    {/* Remove button */}
                                                    {!isStaff && (
                                                        removingFlagId === flag.id ? (
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
                                                                                const [updatedHistory, updatedCounts] = await Promise.all([
                                                                                    getRedFlagsForStudentInGroup(redFlagHistoryStudent.uid, groupId),
                                                                                    getRedFlagCountsForGroup(groupId)
                                                                                ]);
                                                                                setRedFlagHistory(updatedHistory);
                                                                                setRedFlagCounts(updatedCounts);
                                                                                setRemovingFlagId(null);
                                                                                setRemoveReasonText('');
                                                                            } catch (err) {
                                                                                console.error('Error removing flag:', err);
                                                                                alert('Lỗi khi gỡ cờ đỏ.');
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
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Removed flags */}
                                        {removedToShow.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                                                    Cờ đã gỡ
                                                </div>
                                                {[...removedToShow].sort((a, b) => { const ta = a.removedAt?.toDate ? a.removedAt.toDate() : (a.removedAt ? new Date(a.removedAt) : new Date(0)); const tb = b.removedAt?.toDate ? b.removedAt.toDate() : (b.removedAt ? new Date(b.removedAt) : new Date(0)); return tb - ta; }).map(flag => {
                                                    const removedDate = flag.removedAt?.toDate ? flag.removedAt.toDate() : (flag.removedAt ? new Date(flag.removedAt) : null);
                                                    return (
                                                        <div key={flag.id} style={{
                                                            padding: '12px 14px', borderRadius: '12px',
                                                            background: 'var(--bg-input, #f1f5f9)', border: '1px solid var(--border-color, #e2e8f0)',
                                                            opacity: 0.6
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
                                                                    🚩 {flag.violationLabel}
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
        </div >
    );
}
