import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, PenLine, FolderOpen, BarChart3, LogOut, Sparkles, Trophy, Flame, Settings, X, PlayCircle, Plus, BrainCircuit, Shield, Clock, Users, Home, ClipboardList, ChevronDown, FileCheck, Sun, Moon, AlertTriangle, Medal, Lock, Check, CheckCheck, XCircle, Heart, Loader, MessageSquareText, Send, Paperclip, Image as ImageIcon } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { getRecentLists } from '../services/recentService';
import { getAllWordProgressMap, getReviewCounts, getLearnedWordsForTopic, getWordProgressMapForTopic } from '../services/spacedRepetition';
import { getStudentGrammarProgressSummary, getUserOverallGrammarStats } from '../services/grammarSpacedRepetition';
import { getSavedWords, toggleSavedWord, getCustomListById } from '../services/savedService';
import { getAdminTopic, getAdminTopics, getAdminTopicWords, getFolders, getGrammarFolders, getUserLearningStats } from '../services/adminService';
import { getAssignmentsForGroups, getStudentTopicProgressSummary, getSharedAndPublicTeacherTopics, getStudentsInGroup, getGroupById, getTeacherTopic, getTeacherTopicWords } from '../services/teacherService';
import { getGrammarExercise } from '../services/grammarService';
import { getAndUpdateUserStreak } from '../services/userService';
import { readUserStorageDoc, writeUserStorageDoc } from '../services/userStorageService';
import { getCurrentMilestone, getNextMilestone } from '../config/streakMilestones';
import wordData from '../data/wordData';
import './DashboardPage.css';
import './TopicSelectPage.css';
import BrandLogo from '../components/common/BrandLogo';
import logo from '../assets/logo.png';
import { getExamAssignmentsForStudent, getExamSubmissionsForStudent, getExamSubmissionsForAssignments, getExam, getExamAssignmentsForGroup } from '../services/examService';
import { getStudentSentReports } from '../services/skillReportService';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import ProgressModal from './ProgressPage';
import { getRedFlagsForStudent } from '../services/redFlagService';
import { getActiveRatingPeriod, getTeachersForStudent, getStudentRatingsForPeriod } from '../services/teacherRatingService';
import { getStudentRewardPoints } from '../services/rewardPointsService';
import { submitFeedback } from '../services/feedbackService';
import { prepareFeedbackImage } from '../services/feedbackImageService';
import { usersService } from '../models';

const LEVEL_OPTIONS = [
    { value: 'A1', label: 'A1', desc: 'Beginner' },
    { value: 'A2', label: 'A2', desc: 'Elementary' },
    { value: 'B1', label: 'B1', desc: 'Intermediate' },
    { value: 'B2', label: 'B2', desc: 'Upper-Inter' },
    { value: 'C1', label: 'C1', desc: 'Advanced' },
    { value: 'C2', label: 'C2', desc: 'Proficiency' },
];

function isLikelyTeacherTopicId(topicId) {
    const normalized = String(topicId || '').trim();
    return normalized.startsWith('t-');
}

// Helper: resolve effective dueDate for a student (checks per-student overrides first)
function getEffectiveDueDate(a, uid) {
    if (a.studentDeadlines && a.studentDeadlines[uid]) {
        const sd = a.studentDeadlines[uid];
        return sd.toDate ? sd.toDate() : new Date(sd);
    }
    return a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
}

export default function DashboardPage() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState(() => localStorage.getItem('userCefrLevel') || 'A2');
    const [teacherTitle, setTeacherTitle] = useState('');
    const [studentTitle, setStudentTitle] = useState('');
    const [customTeacher, setCustomTeacher] = useState('');
    const [customStudent, setCustomStudent] = useState('');
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light');
    const [recentLists, setRecentLists] = useState([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(false);
    const [reviewStats, setReviewStats] = useState({ incompleteCount: 0, dueCount: 0, totalCount: 0 });
    const [assignments, setAssignments] = useState([]);
    const [assignmentsProgress, setAssignmentsProgress] = useState({});
    const [activeAssignmentTab, setActiveAssignmentTab] = useState('pending');
    const [showAllAssignments, setShowAllAssignments] = useState(false);
    const [showOverdueAssignments, setShowOverdueAssignments] = useState(false);
    const [showAllExams, setShowAllExams] = useState(false);
    const [showOverdueExams, setShowOverdueExams] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState(() => {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam === 'assignments') return 'assignments';
        if (tabParam === 'exams') return 'exams';
        return 'learning';
    });
    const reportsRef = useRef(null);
    const [grammarReviewStats, setGrammarReviewStats] = useState({ totalCount: 0 });
    const [examAssignments, setExamAssignments] = useState([]);
    const [examSubmissions, setExamSubmissions] = useState([]);
    const [examDetails, setExamDetails] = useState({});
    const [examsLoading, setExamsLoading] = useState(false);
    const [showExamAlert, setShowExamAlert] = useState(false);
    const [urgentExam, setUrgentExam] = useState(null);
    const [newResult, setNewResult] = useState(null);
    const [showAlertType, setShowAlertType] = useState(null); // 'urgent' or 'result'

    // Skill Reports
    const [skillReports, setSkillReports] = useState([]);
    const [viewingSkillReport, setViewingSkillReport] = useState(null);
    const [selectedGroupFilter, setSelectedGroupFilter] = useState('all'); // 'all' or groupId

    // Overview Stats
    const [wordsLearned, setWordsLearned] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [celebrationMilestone, setCelebrationMilestone] = useState(null);

    // Ranking & Progress Modal
    const [classRanks, setClassRanks] = useState([]); // [{ groupId, groupName, rank, total }]
    const [isProgressOpen, setIsProgressOpen] = useState(false);

    // Red Flags (student side)
    const [studentRedFlags, setStudentRedFlags] = useState([]); // all flags for this student

    // Teacher Rating Period
    const [activeRatingPeriod, setActiveRatingPeriod] = useState(null);
    const [allTeachersRated, setAllTeachersRated] = useState(false);
    const [showRatingPopup, setShowRatingPopup] = useState(false);

    // Reward Points (student dashboard)
    const [totalRewardPoints, setTotalRewardPoints] = useState(0);

    // Word Selection Modal for Vocab Assignments
    const [wordSelectData, setWordSelectData] = useState(null); // { words, topicId, topicName, icon, color, isTeacherTopic, progressMap, learnedWords, savedWordsStatus }
    const [selectedWordsForAssignment, setSelectedWordsForAssignment] = useState(new Set());
    const [loadingWordSelect, setLoadingWordSelect] = useState(false);
    const PREFERENCES_DOC_TYPE = 'preferences';
    const MILESTONE_DOC_TYPE = 'milestone_shown';

    // --- Drag-to-scroll for recent slider ---
    const sliderRef = useRef(null);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const dragStateRef = useRef({ startX: 0, scrollLeft: 0, lastX: 0, lastTime: 0, velocity: 0, hasMoved: false });
    const momentumRef = useRef(null);

    const handleSliderMouseDown = useCallback((e) => {
        const slider = sliderRef.current;
        if (!slider) return;
        // Only respond to left mouse button
        if (e.button !== 0) return;

        const ds = dragStateRef.current;
        ds.startX = e.pageX;
        ds.scrollLeft = slider.scrollLeft;
        ds.lastX = e.pageX;
        ds.lastTime = Date.now();
        ds.velocity = 0;
        ds.hasMoved = false;
        slider.style.scrollBehavior = 'auto';

        // Cancel any ongoing momentum
        if (momentumRef.current) {
            cancelAnimationFrame(momentumRef.current);
            momentumRef.current = null;
        }

        const handleMouseMove = (e) => {
            e.preventDefault();
            const ds = dragStateRef.current;
            const dx = e.pageX - ds.startX;
            slider.scrollLeft = ds.scrollLeft - dx * 1.5;

            // Track velocity for momentum
            const now = Date.now();
            const dt = now - ds.lastTime;
            if (dt > 0) {
                ds.velocity = (e.pageX - ds.lastX) / dt;
            }
            ds.lastX = e.pageX;
            ds.lastTime = now;

            if (!ds.hasMoved && Math.abs(dx) > 5) {
                ds.hasMoved = true;
                setIsDraggingSlider(true);
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            slider.style.scrollBehavior = '';

            const ds = dragStateRef.current;

            // Apply momentum / inertia
            let vel = ds.velocity * 1.5;
            const decel = 0.95;

            const applyMomentum = () => {
                if (Math.abs(vel) < 0.05) {
                    momentumRef.current = null;
                    setIsDraggingSlider(false);
                    return;
                }
                slider.scrollLeft -= vel * 16;
                vel *= decel;
                momentumRef.current = requestAnimationFrame(applyMomentum);
            };

            if (Math.abs(vel) > 0.1) {
                momentumRef.current = requestAnimationFrame(applyMomentum);
            } else {
                setIsDraggingSlider(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, []);

    // Build groupId â†’ groupName map (from AuthContext, properly aligned even with hidden groups)
    const groupIdToName = useMemo(() => {
        return user?.groupIdToNameMap || {};
    }, [user?.groupIdToNameMap]);


    // Handle ?scrollTo=reports query param â€” auto-scroll to skill reports section
    useEffect(() => {
        const scrollTo = searchParams.get('scrollTo');
        if (scrollTo === 'reports' && reportsRef.current) {
            setTimeout(() => {
                reportsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 600); // wait for data to load
        }
    }, [searchParams, skillReports]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    // Load level from user settings on mount
    useEffect(() => {
        if (!user?.uid) return;
        readUserStorageDoc(user.uid, PREFERENCES_DOC_TYPE)
            .then((prefs) => {
                if (prefs?.cefrLevel) {
                    const lvl = prefs.cefrLevel;
                    setSelectedLevel(lvl);
                    localStorage.setItem('userCefrLevel', lvl);
                }
            })
            .catch(err => console.warn('Could not load settings:', err));

        usersService.findOne(user.uid)
            .then((userData) => {
                if (userData?.teacherTitle) setTeacherTitle(userData.teacherTitle);
                if (userData?.studentTitle) setStudentTitle(userData.studentTitle);
            })
            .catch(err => console.warn('Could not load user settings:', err));
    }, [user?.uid]);


    useEffect(() => {
        if (!user?.uid) return;
        getRecentLists(user.uid).then(async (lists) => {
            // Filter out lists that no longer exist
            const validated = await Promise.all(
                lists.map(async (list) => {
                    if (list.isGrammar) {
                        try {
                            const exercise = await getGrammarExercise(list.id);
                            return exercise ? { ...list, ...exercise } : null;
                        } catch {
                            return null;
                        }
                    }
                    if (list.isTeacherTopic || isLikelyTeacherTopicId(list.id)) {
                        try {
                            const topic = await getTeacherTopic(list.id);
                            return topic ? { ...list, ...topic, isTeacherTopic: true } : null;
                        } catch {
                            return null;
                        }
                    }

                    if (list.type === 'ai' || list.type === 'custom') {
                        try {
                            const customList = await getCustomListById(user.uid, list.id);
                            return customList ? list : null;
                        } catch {
                            return null;
                        }
                    }
                    if (list.type === 'topic') {
                        try {
                            const topic = await getAdminTopic(list.id);
                            return topic ? { ...list, ...topic } : null;
                        } catch {
                            return null;
                        }
                    }
                    return list; // 'saved' always exists
                })
            );
            const filtered = validated.filter(Boolean).slice(0, 8);
            setRecentLists(filtered);
        }).catch(err => console.warn(err));

        getReviewCounts(user.uid).then(setReviewStats).catch(console.warn);

        // Fetch grammar review count
        import('../services/grammarSpacedRepetition').then(module => {
            module.getDueGrammarReviewIds(user.uid).then(ids => {
                setGrammarReviewStats({ totalCount: ids.length });
            }).catch(console.warn);
        });

        const studentGroupIds = user.visibleGroupIds || user.groupIds || [];

        import('../services/grammarService').then(grammarModule => {
            if (studentGroupIds.length > 0) {
                const topicAccess = user?.mergedTopicAccess || user?.topicAccess || [];

                Promise.all([
                    getAssignmentsForGroups(studentGroupIds, user.uid),
                    getAdminTopics(),
                    getSharedAndPublicTeacherTopics(topicAccess),
                    grammarModule.getGrammarExercises() // Fetch grammar exercises as well
                ])
                    .then(async ([asgns, adminTopics, teacherTopics, grammarExercises]) => {
                        // Create a map of lively fetched topics
                        const allItems = [...adminTopics, ...teacherTopics, ...grammarExercises];
                        const itemMap = {};
                        allItems.forEach(t => {
                            itemMap[t.id] = {
                                name: t.name,
                                icon: t.icon,
                                color: t.color
                            };
                        });

                        // Build a set of grammar exercise IDs for auto-detection
                        const grammarExerciseIds = new Set(grammarExercises.map(g => g.id));

                        // Map updated names and icons into assignments and filter orphans
                        const updatedAsgns = asgns.map(a => ({
                            ...a,
                            topicName: itemMap[a.topicId]?.name || a.topicName,
                            topicIcon: itemMap[a.topicId]?.icon,
                            topicColor: itemMap[a.topicId]?.color,
                            // Auto-detect isGrammar if the topicId matches a grammar exercise
                            isGrammar: a.isGrammar || grammarExerciseIds.has(a.topicId)
                        })).filter(a => {
                            if (itemMap[a.topicId] === undefined) return false;
                            // Hide assignments with scheduledStart in the future
                            if (a.scheduledStart) {
                                const startDate = a.scheduledStart.toDate ? a.scheduledStart.toDate() : new Date(a.scheduledStart);
                                if (startDate > new Date()) return false;
                            }
                            return true;
                        });

                        setAssignments(updatedAsgns);

                        const topicIds = updatedAsgns.map(a => a.topicId);
                        if (topicIds.length > 0) {
                            try {
                                const vocabTopicIds = updatedAsgns.filter(a => !a.isGrammar).map(a => a.topicId);
                                const grammarTopicIds = updatedAsgns.filter(a => a.isGrammar).map(a => a.topicId);

                                const [vocabProgress, grammarProgress] = await Promise.all([
                                    vocabTopicIds.length > 0 ? getStudentTopicProgressSummary(user.uid, vocabTopicIds) : Promise.resolve({}),
                                    grammarTopicIds.length > 0 ? getStudentGrammarProgressSummary(user.uid, grammarTopicIds) : Promise.resolve({})
                                ]);

                                setAssignmentsProgress({ ...vocabProgress, ...grammarProgress });
                            } catch (err) {
                                console.warn('Could not load assignment progress', err);
                            }
                        }
                    })
                    .catch(console.warn);
            }

            // Fetch Overview Stats
            getAndUpdateUserStreak(user.uid)
                .then(streak => {
                    setCurrentStreak(streak);
                    localStorage.setItem('userStreak', String(streak));
                    // Force light theme if student doesn't meet streak requirement
                    const isStudent = !(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff');
                    if (isStudent && streak < 5) {
                        setTheme('light');
                    } else if (isStudent && streak < 18 && localStorage.getItem('appTheme') === 'silver') {
                        setTheme('light');
                    } else if (isStudent && streak < 30 && localStorage.getItem('appTheme') === 'gold') {
                        setTheme('light');
                    } else if (isStudent && streak < 40 && localStorage.getItem('appTheme') === 'diamond') {
                        setTheme('light');
                    } else if (isStudent && streak < 60 && localStorage.getItem('appTheme') === 'ruby') {
                        setTheme('light');
                    }
                    // Check for new milestone celebration (Firestore-backed)
                    const currentMs = getCurrentMilestone(streak);
                    if (currentMs) {
                        // Quick local check first to avoid flash
                        const localLastShown = parseInt(localStorage.getItem('lastMilestoneShown') || '0', 10);
                        if (currentMs.threshold > localLastShown) {
                            // Verify with Firestore (source of truth)
                            readUserStorageDoc(user.uid, MILESTONE_DOC_TYPE).then((milestoneDoc) => {
                                const storedLastShown = milestoneDoc?.lastThreshold || 0;
                                // Sync localStorage with stored server value
                                localStorage.setItem('lastMilestoneShown', String(Math.max(storedLastShown, localLastShown)));
                                if (currentMs.threshold > storedLastShown) {
                                    setCelebrationMilestone(currentMs);
                                    localStorage.setItem('lastMilestoneShown', String(currentMs.threshold));
                                    writeUserStorageDoc(user.uid, MILESTONE_DOC_TYPE, {
                                        lastThreshold: currentMs.threshold,
                                        updatedAt: new Date().toISOString(),
                                    }).catch(console.warn);
                                }
                            }).catch(console.warn);
                        }
                    }
                })
                .catch(console.warn);

            getAllWordProgressMap(user.uid).then(progressMap => {
                // Count words where stepsCompleted is 6
                let learnedCount = 0;
                for (const key in progressMap) {
                    if (progressMap[key].stepsCompleted && progressMap[key].stepsCompleted >= 6) {
                        learnedCount++;
                    }
                }
                setWordsLearned(learnedCount);
            }).catch(console.warn);
        });

        // Fetch Exam Data for Badge & Popup
        const fetchExamsSummary = async () => {
            if (!user?.uid) return;
            setExamsLoading(true);
            try {
                const [assigns, subs] = await Promise.all([
                    getExamAssignmentsForStudent(user.uid, studentGroupIds),
                    getExamSubmissionsForStudent(user.uid)
                ]);
                // Filter out exam assignments with scheduledStart in the future
                const now2 = new Date();
                const visibleAssigns = assigns.filter(a => {
                    if (a.scheduledStart) {
                        const startDate = a.scheduledStart.toDate ? a.scheduledStart.toDate() : new Date(a.scheduledStart);
                        if (startDate > now2) return false;
                    }
                    return true;
                });
                setExamAssignments(visibleAssigns);
                setExamSubmissions(subs);

                const subsMap = {};
                subs.forEach(s => {
                    const existing = subsMap[s.assignmentId];
                    if (!existing) {
                        subsMap[s.assignmentId] = s;
                    } else {
                        const isExistingDone = existing.status === 'submitted' || existing.status === 'grading' || existing.status === 'graded';
                        const isNewDone = s.status === 'submitted' || s.status === 'grading' || s.status === 'graded';
                        if (!isExistingDone && isNewDone) {
                            subsMap[s.assignmentId] = s;
                        } else if ((isExistingDone && isNewDone) || (!isExistingDone && !isNewDone)) {
                            // Keep newest
                            const existingTime = existing.submittedAt || existing.startedAt || existing.createdAt;
                            const newTime = s.submittedAt || s.startedAt || s.createdAt;
                            if (newTime > existingTime) subsMap[s.assignmentId] = s;
                        }
                    }
                });

                const now = new Date();
                const pending = assigns.filter(a => {
                    const sub = subsMap[a.id];
                    const hasSubmitted = sub && (sub.status === 'submitted' || sub.status === 'graded' || sub.status === 'grading');
                    const due = getEffectiveDueDate(a, user.uid);
                    const isOverdue = due && due < now;
                    return !hasSubmitted && !isOverdue;
                });

                // Check for alert
                const hasAlerted = sessionStorage.getItem(`exam_alert_shown_${user.uid}`);
                if (!hasAlerted) {
                    // Scenario 1: Urgent unfinished test (only for examType === 'test')
                    if (pending.length > 0) {
                        for (const exam of pending) {
                            const details = await getExam(exam.examId);
                            if (details?.examType === 'test') {
                                setUrgentExam({ ...details, ...exam });
                                setShowAlertType('urgent');
                                setShowExamAlert(true);
                                sessionStorage.setItem(`exam_alert_shown_${user.uid}`, 'true');
                                break;
                            }
                        }
                    }
                    // Scenario 2: New graded test results (only if no urgent test alert was shown)
                    if (!sessionStorage.getItem(`exam_alert_shown_${user.uid}`)) {
                        const unviewedResults = subs.filter(s => s.status === 'graded' && s.resultsReleased && !s.viewedByStudent);
                        // Find first test result (skip homework/practice)
                        for (const sub of unviewedResults) {
                            const subDetails = await getExam(sub.examId);
                            if (subDetails?.examType === 'test') {
                                setNewResult({ ...sub, examName: subDetails?.name, examIcon: subDetails?.icon, examColor: subDetails?.color });
                                setShowAlertType('result');
                                setShowExamAlert(true);
                                sessionStorage.setItem(`exam_alert_shown_${user.uid}`, 'true');
                                break;
                            }
                        }
                    }
                }

                // Fetch all details for the list (lazy load others later? No, let's keep it simple for now)
                const uniqueExamIds = [...new Set(assigns.map(a => a.examId))];
                const details = {};
                await Promise.all(uniqueExamIds.map(async (eid) => {
                    try {
                        details[eid] = await getExam(eid);
                    } catch (e) { console.error(e); }
                }));
                setExamDetails(details);
            } catch (err) {
                console.warn('Could not load exams summary:', err);
            }
            setExamsLoading(false);
        };
        fetchExamsSummary();

        // Fetch skill reports
        getStudentSentReports(user.uid).then(setSkillReports).catch(console.warn);

        // Fetch red flags for this student
        getRedFlagsForStudent(user.uid).then(setStudentRedFlags).catch(console.warn);

        // Check for active rating period
        getActiveRatingPeriod().then(async (period) => {
            setActiveRatingPeriod(period);
            if (period && user?.uid) {
                try {
                    const [teacherList, ratings] = await Promise.all([
                        getTeachersForStudent(user.uid).catch(() => []),
                        getStudentRatingsForPeriod(period.id, user.uid).catch(() => []),
                    ]);
                    const ratedKeys = new Set(ratings.map(r => `${r.teacherId}_${r.groupId || ''}`));
                    const allRated = teacherList.length > 0 && teacherList.every(t => ratedKeys.has(`${t.uid}_${t.ratingGroupId || ''}`));
                    setAllTeachersRated(allRated);
                    // Show rating popup once per session if not all rated
                    if (!allRated && !sessionStorage.getItem(`rating_popup_shown_${user.uid}`)) {
                        setShowRatingPopup(true);
                        sessionStorage.setItem(`rating_popup_shown_${user.uid}`, 'true');
                    }
                } catch (e) {
                    console.warn('Error checking teacher ratings:', e);
                }
            }
        }).catch(console.warn);
    }, [user?.uid, user?.groupIds, user?.visibleGroupIds]);

    // Compute class ranking per group (cached for 6 hours to minimize Firestore reads)
    useEffect(() => {
        const rankGroupIds = user?.visibleGroupIds || user?.groupIds || [];
        if (!user?.uid || rankGroupIds.length === 0) return;
        if (user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff') return;

        const RANK_CACHE_KEY = `class_ranks_${user.uid}`;
        const RANK_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

        // Try to load from cache first
        try {
            const cached = JSON.parse(localStorage.getItem(RANK_CACHE_KEY));
            if (cached && cached.groupIds?.join(',') === rankGroupIds.join(',') && Date.now() - cached.ts < RANK_CACHE_TTL) {
                setClassRanks(cached.ranks);
                return;
            }
        } catch { /* cache miss, recompute */ }

        computeAllRanks();

        async function computeRankForGroup(groupId) {
            try {
                const students = await getStudentsInGroup(groupId);
                if (!students || students.length === 0) return null;

                const groupAssignments = await getAssignmentsForGroups([groupId], user.uid).catch(() => []);
                const vocabTopicIds = groupAssignments.filter(a => !a.isGrammar).map(a => a.topicId);

                const examAssigns = await getExamAssignmentsForGroup(groupId).catch(() => []);
                let examSubs = [];
                if (examAssigns.length > 0) {
                    examSubs = await getExamSubmissionsForAssignments(examAssigns.map(a => a.id)).catch(() => []);
                }

                const scores = await Promise.all(students.map(async (student) => {
                    let total = 0;
                    let count = 0;

                    if (vocabTopicIds.length > 0) {
                        try {
                            const summary = await getStudentTopicProgressSummary(student.uid, vocabTopicIds);
                            let tc = 0, tw = 0;
                            Object.values(summary).forEach(p => { tc += p.totalCorrect || 0; tw += p.totalWrong || 0; });
                            if (tc + tw > 0) { total += (tc / (tc + tw)) * 100; count++; }
                        } catch { /* ignore */ }
                    }

                    try {
                        const gStats = await getUserOverallGrammarStats(student.uid);
                        const gAtt = (gStats.totalCorrect || 0) + (gStats.totalWrong || 0);
                        if (gAtt > 0) { total += ((gStats.totalCorrect || 0) / gAtt) * 100; count++; }
                    } catch { /* ignore */ }

                    const studentSubs = examSubs.filter(s => s.studentId === student.uid && s.status === 'graded');
                    let ets = 0, emts = 0;
                    studentSubs.forEach(s => { ets += s.totalScore || 0; emts += s.maxTotalScore || 0; });
                    if (emts > 0) { total += (ets / emts) * 100; count++; }

                    return { uid: student.uid, score: count > 0 ? total / count : 0 };
                }));

                scores.sort((a, b) => b.score - a.score);
                const myIndex = scores.findIndex(s => s.uid === user.uid);
                if (myIndex >= 0) {
                    return { groupId, groupName: groupIdToName[groupId] || groupId, rank: myIndex + 1, total: scores.length };
                }
            } catch (err) {
                console.warn(`Could not compute rank for group ${groupId}:`, err);
            }
            return null;
        }

        async function computeAllRanks() {
            const results = await Promise.all(rankGroupIds.map(gid => computeRankForGroup(gid)));
            const ranks = results.filter(Boolean);
            setClassRanks(ranks);
            try {
                localStorage.setItem(RANK_CACHE_KEY, JSON.stringify({ ranks, groupIds: rankGroupIds, ts: Date.now() }));
            } catch { /* localStorage full, ignore */ }
        }
    }, [user?.uid, user?.visibleGroupIds, user?.groupIds, groupIdToName]);

    // Fetch reward points for student (centralized)
    useEffect(() => {
        if (!user?.uid) return;
        if (user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff') return;
        getStudentRewardPoints(user.uid).then(setTotalRewardPoints).catch(() => {});
    }, [user?.uid, user?.role]);

    const handleLevelSelect = async (level) => {
        setSelectedLevel(level);
        localStorage.setItem('userCefrLevel', level);
        // Persist to user settings
        if (user?.uid) {
            try {
                await writeUserStorageDoc(user.uid, PREFERENCES_DOC_TYPE, { cefrLevel: level });
            } catch (err) {
                console.warn('Could not save level to settings:', err);
            }
        }
    };

    const saveHonorific = async (field, value) => {
        if (field === 'teacherTitle') setTeacherTitle(value);
        else setStudentTitle(value);
        if (user?.uid) {
            try {
                await usersService.update(user.uid, { [field]: value });
            } catch (err) {
                console.warn('Could not save honorific:', err);
            }
        }
    };

    const actions = [
        { id: 'topics', icon: BookOpen, title: 'BÃ i há»c tá»« vá»±ng', description: 'Há»c tá»« vá»±ng theo chá»§ Ä‘á»', color: 'var(--color-primary)', path: '/topics' },
        { id: 'grammar', icon: PenLine, title: 'BÃ i há»c ká»¹ nÄƒng', description: 'Luyá»‡n táº­p cÃ¡c bÃ i ká»¹ nÄƒng', color: '#d97706', path: '/grammar-topics' },
        { id: 'saved', icon: FolderOpen, title: 'Danh sÃ¡ch cÃ¡ nhÃ¢n', description: 'Tiáº¿p tá»¥c há»c danh sÃ¡ch cÃ¡ nhÃ¢n', color: 'var(--color-warning)', path: '/saved-lists' },
    ];

    const createActions = [
        { id: 'ai-gen', icon: Sparkles, title: 'Táº¡o danh sÃ¡ch tá»«', description: 'DÃ¹ng AI táº¡o bá»™ tá»« theo chá»§ Ä‘á»', color: 'var(--color-primary-light)', path: '/generate-list', isAI: true },
        { id: 'custom', icon: PenLine, title: 'Tá»± táº¡o bÃ i há»c', description: 'Tá»± nháº­p tá»« muá»‘n há»c', color: 'var(--color-secondary)', path: '/custom-input' },
    ];

    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

    // Feedback modal state
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackSuccess, setFeedbackSuccess] = useState(false);
    const [feedbackImageBlob, setFeedbackImageBlob] = useState(null);
    const [feedbackImagePreviewUrl, setFeedbackImagePreviewUrl] = useState('');
    const [feedbackImageName, setFeedbackImageName] = useState('');
    const [feedbackPreparingImage, setFeedbackPreparingImage] = useState(false);
    const [feedbackImageError, setFeedbackImageError] = useState('');
    const feedbackImageInputRef = useRef(null);

    const FEEDBACK_CATEGORIES = [
        { value: 'suggestion', label: 'Äá» xuáº¥t', emoji: 'ðŸ’¡', color: '#4f46e5', bg: '#eff6ff' },
        { value: 'complaint', label: 'Khiáº¿u náº¡i', emoji: 'âš ï¸', color: '#dc2626', bg: '#fef2f2' },
    ];

    useEffect(() => () => {
        if (feedbackImagePreviewUrl) {
            URL.revokeObjectURL(feedbackImagePreviewUrl);
        }
    }, [feedbackImagePreviewUrl]);

    const clearFeedbackImage = () => {
        if (feedbackImagePreviewUrl) {
            URL.revokeObjectURL(feedbackImagePreviewUrl);
        }
        setFeedbackImageBlob(null);
        setFeedbackImagePreviewUrl('');
        setFeedbackImageName('');
        setFeedbackImageError('');
        if (feedbackImageInputRef.current) {
            feedbackImageInputRef.current.value = '';
        }
    };

    const closeFeedbackModal = () => {
        if (feedbackSending) return;
        clearFeedbackImage();
        setFeedbackMessage('');
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
    };

    const handleFeedbackImageSelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFeedbackPreparingImage(true);
        setFeedbackImageError('');

        try {
            const { blob, previewUrl } = await prepareFeedbackImage(file);
            if (feedbackImagePreviewUrl) {
                URL.revokeObjectURL(feedbackImagePreviewUrl);
            }
            setFeedbackImageBlob(blob);
            setFeedbackImagePreviewUrl(previewUrl);
            setFeedbackImageName(file.name || 'attachment.webp');
        } catch (error) {
            console.error('Error preparing feedback image:', error);
            setFeedbackImageError(error.message || 'Không thể xử lý ảnh. Vui lòng thử ảnh khác.');
            event.target.value = '';
        }

        setFeedbackPreparingImage(false);
    };

    const handleSendFeedback = async () => {
        if (!feedbackMessage.trim() || feedbackSending || feedbackPreparingImage) return;
        setFeedbackSending(true);
        try {
            await submitFeedback({
                message: feedbackMessage,
                category: feedbackCategory,
                senderUid: user.uid,
                senderName: user.displayName || '',
                senderEmail: user.email || '',
                senderRole: user.role || 'user',
                imageBlob: feedbackImageBlob,
                imageName: feedbackImageName,
            });
            setFeedbackSuccess(true);
            setFeedbackMessage('');
            clearFeedbackImage();
            setTimeout(() => {
                setFeedbackSuccess(false);
                setShowFeedbackModal(false);
            }, 1800);
        } catch (err) {
            console.error('Error sending feedback:', err);
            alert('CÃ³ lá»—i xáº£y ra. Vui lÃ²ng thá»­ láº¡i.');
        }
        setFeedbackSending(false);
    };

    const handleContinueLearning = async (listInfo) => {
        if (!user?.uid || isLoadingRecent) return;

        if (listInfo.forceTopicSelect) {
            navigate('/topics', { state: { folderId: listInfo.id } });
            return;
        }

        if (listInfo.forceGrammarSelect) {
            navigate('/grammar-topics', { state: { folderId: listInfo.id } });
            return;
        }

        if (listInfo.isGrammar) {
            navigate('/grammar-learn', {
                state: {
                    exerciseId: listInfo.id,
                    exerciseName: listInfo.name,
                    icon: listInfo.icon || 'âœï¸',
                    color: listInfo.color || '#d97706'
                }
            });
            return;
        }

        try {
            setIsLoadingRecent(true);
            let words = [];
            if (listInfo.type === 'topic') {
                if (listInfo.isTeacherTopic || isLikelyTeacherTopicId(listInfo.id)) {
                    words = await getTeacherTopicWords(listInfo.id);
                } else {
                    words = await getAdminTopicWords(listInfo.id);
                }
            } else if (listInfo.type === 'saved') {
                words = await getSavedWords(user.uid);
            } else {
                const customList = await getCustomListById(user.uid, listInfo.id);
                words = customList?.words || [];
            }

            if (!words || words.length === 0) {
                alert('Danh sÃ¡ch nÃ y hiá»‡n khÃ´ng cÃ³ tá»« vá»±ng nÃ o.');
                setIsLoadingRecent(false);
                return;
            }

            const pMap = await getAllWordProgressMap(user.uid);
            const wordsToLearn = words.map(w => ({
                ...w,
                stepsCompleted: pMap[w.word]?.stepsCompleted ?? 0,
                stepMastery: pMap[w.word]?.stepMastery ?? null
            }));

            navigate('/learn', {
                state: {
                    words: wordsToLearn,
                    topicId: listInfo.id,
                    topicName: listInfo.name,
                    listType: listInfo.type,
                    icon: listInfo.icon,
                    color: listInfo.color,
                    isTeacherTopic: listInfo.isTeacherTopic || false
                }
            });
        } catch (err) {
            console.error('Failed to load recent list', err);
            setIsLoadingRecent(false);
        }
    };

    // --- Word Selection Modal Handlers ---
    const TOTAL_STEPS = 6;

    const handleOpenWordSelect = async (a) => {
        if (!user?.uid || loadingWordSelect) return;
        setLoadingWordSelect(true);
        try {
            let words = [];
            if (a.isTeacherTopic) {
                words = await getTeacherTopicWords(a.topicId);
            } else {
                words = await getAdminTopicWords(a.topicId);
            }

            if (!words || words.length === 0) {
                alert('Danh sÃ¡ch nÃ y hiá»‡n khÃ´ng cÃ³ tá»« vá»±ng nÃ o.');
                setLoadingWordSelect(false);
                return;
            }

            const [learned, pMap, saved] = await Promise.all([
                getLearnedWordsForTopic(user.uid, a.topicId),
                getWordProgressMapForTopic(user.uid, a.topicId),
                getSavedWords(user.uid)
            ]);

            const savedMap = {};
            saved.forEach(w => { savedMap[w.word] = true; });

            setWordSelectData({
                words,
                topicId: a.topicId,
                topicName: a.topicName,
                icon: a.topicIcon || 'ðŸ“š',
                color: a.topicColor || 'var(--color-primary)',
                isTeacherTopic: a.isTeacherTopic,
                progressMap: pMap,
                learnedWords: learned,
                savedWordsStatus: savedMap
            });
            setSelectedWordsForAssignment(new Set());
        } catch (err) {
            console.error('Failed to load word selection data', err);
        }
        setLoadingWordSelect(false);
    };

    const handleConfirmWordSelect = async () => {
        if (!wordSelectData || selectedWordsForAssignment.size === 0) return;
        const { words, topicId, topicName, icon, color, isTeacherTopic, progressMap } = wordSelectData;

        const wordsToLearn = words
            .filter(w => selectedWordsForAssignment.has(w.word))
            .map(w => ({
                ...w,
                stepsCompleted: progressMap[w.word]?.stepsCompleted ?? 0,
                stepMastery: progressMap[w.word]?.stepMastery ?? null
            }));

        if (wordsToLearn.length === 0) return;
        setWordSelectData(null);

        navigate('/learn', {
            state: {
                words: wordsToLearn,
                topicId,
                topicName,
                listType: 'topic',
                icon,
                color,
                isTeacherTopic: isTeacherTopic || false,
                skipWelcome: true
            }
        });
    };

    const toggleWordForAssignment = (word) => {
        setSelectedWordsForAssignment(prev => {
            const next = new Set(prev);
            if (next.has(word)) next.delete(word);
            else next.add(word);
            return next;
        });
    };

    const wsSelectAllUnlearned = () => {
        if (!wordSelectData) return;
        const incomplete = new Set();
        wordSelectData.words.forEach(w => {
            const stepsCompleted = wordSelectData.progressMap[w.word]?.stepsCompleted ?? 0;
            if (stepsCompleted < TOTAL_STEPS) incomplete.add(w.word);
        });
        setSelectedWordsForAssignment(incomplete);
    };

    const wsSelectAll = () => {
        if (!wordSelectData) return;
        setSelectedWordsForAssignment(new Set(wordSelectData.words.map(w => w.word)));
    };

    const wsDeselectAll = () => {
        setSelectedWordsForAssignment(new Set());
    };

    const handleWsToggleSave = async (e, wordObj) => {
        e.stopPropagation();
        if (!user?.uid || !wordSelectData) return;
        const currentStatus = wordSelectData.savedWordsStatus[wordObj.word];
        setWordSelectData(prev => ({
            ...prev,
            savedWordsStatus: { ...prev.savedWordsStatus, [wordObj.word]: !currentStatus }
        }));
        try {
            const newStatus = await toggleSavedWord(user.uid, wordObj);
            setWordSelectData(prev => prev ? ({
                ...prev,
                savedWordsStatus: { ...prev.savedWordsStatus, [wordObj.word]: newStatus }
            }) : null);
        } catch (err) {
            console.error('Failed to toggle saved word', err);
            setWordSelectData(prev => prev ? ({
                ...prev,
                savedWordsStatus: { ...prev.savedWordsStatus, [wordObj.word]: currentStatus }
            }) : null);
        }
    };

    // --- Process Pending Deep Link ---
    useEffect(() => {
        if (!user?.uid) {
            return;
        }

        if (isLoadingRecent) {
            return;
        }

        const processDeepLink = async () => {
            const pendingLinkStr = sessionStorage.getItem('pendingDeepLink');
            if (pendingLinkStr) {
                sessionStorage.removeItem('pendingDeepLink'); // Immediately remove to prevent loop
                try {
                    const { shareId, shareType } = JSON.parse(pendingLinkStr);

                    let listInfo = null;

                    if (shareType === 'teacher_topic') {
                        const data = await getTeacherTopic(shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: true, isGrammar: false, icon: data.icon, color: data.color };
                        }
                    } else if (shareType === 'admin_topic') {
                        const data = await getAdminTopic(shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: false, isGrammar: false, icon: data.icon, color: data.color };
                        }
                    } else if (shareType === 'teacher_grammar') {
                        const data = await getGrammarExercise(shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: true, isGrammar: true, icon: data.icon, color: data.color };
                        }
                    } else if (shareType === 'admin_grammar') {
                        const data = await getGrammarExercise(shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: false, isGrammar: true, icon: data.icon, color: data.color };
                        }
                    } else if (shareType === 'admin_folder') {
                        const folders = await getFolders();
                        const data = folders.find(folder => folder.id === shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: false, isGrammar: false, icon: 'ðŸ“', color: '#6366f1', forceTopicSelect: true };
                        }
                    } else if (shareType === 'admin_grammar_folder' || shareType === 'grammar_folder') {
                        const folders = await getGrammarFolders();
                        const data = folders.find(folder => folder.id === shareId);
                        if (data) {
                            listInfo = { id: shareId, type: 'topic', name: data.name, isTeacherTopic: false, isGrammar: true, icon: 'ðŸ“', color: '#f59e0b', forceGrammarSelect: true };
                        }
                    }

                    if (listInfo) {
                        handleContinueLearning(listInfo);
                    }
                } catch (e) {
                    console.error("DashboardPage: Error processing pending deep link:", e);
                }
            }
        };

        processDeepLink();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, isLoadingRecent]);

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div className="container flex-between" style={{ position: 'relative' }}>
                    {/* Left Side: Settings */}
                    <div style={{ zIndex: 10 }}>
                        <div className="app-header-actions-group">
                            <button className="app-header-action-btn" onClick={() => setIsSettingsOpen(true)} title="Cài đặt">
                                <Settings size={18} />
                                <span className="hidden-mobile">Cài đặt</span>
                            </button>
                        </div>
                    </div>

                    {/* Center: Logo */}
                    <div className="dashboard-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                        <BrandLogo size="1.2rem" />
                    </div>

                    {/* Right Side: Panel Navigation & Logout */}
                    <div style={{ display: 'flex', gap: '8px', zIndex: 10 }}>
                        <div className="app-header-actions-group">
                            {(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff') && (
                                <>
                                    {(user?.role === 'admin' || user?.role === 'staff') && (
                                        <button className="app-header-action-btn" onClick={() => { sessionStorage.removeItem('viewMode'); navigate('/admin'); }} title="Chuyển tới Admin Panel">
                                            <Shield size={16} />
                                            <span className="hidden-mobile">Quản trị</span>
                                        </button>
                                    )}
                                    {user?.role === 'teacher' && (
                                        <button className="app-header-action-btn" onClick={() => { sessionStorage.removeItem('viewMode'); navigate('/teacher/groups'); }} title="Chuyển tới Teacher Panel">
                                            <Users size={16} />
                                            <span className="hidden-mobile">Giáo viên</span>
                                        </button>
                                    )}
                                    <div className="app-header-divider"></div>
                                </>
                            )}
                            <button className="app-header-action-btn text-danger" onClick={signOut} title="Đăng xuất">
                                <LogOut size={18} />
                                <span className="hidden-mobile">Đăng xuất</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Settings Bottom Sheet Modal */}
            {isSettingsOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
                    <div className="settings-modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <button className="settings-modal-close" onClick={() => setIsSettingsOpen(false)}>
                            <X size={20} />
                        </button>
                        <div className="settings-modal-header">
                            <h3>⚙️ Thiết lập</h3>
                        </div>
                        <div className="settings-section">
                            <label className="settings-section-label">Trình độ hiện tại (CEFR)</label>
                            <p className="settings-section-desc">AI sẽ tạo ví dụ phù hợp với level bạn đang học</p>
                            <div className="settings-level-grid">
                                {LEVEL_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`settings-level-pill ${selectedLevel === opt.value ? 'settings-level-pill--active' : ''}`}
                                        onClick={() => handleLevelSelect(opt.value)}
                                    >
                                        <span className="settings-level-pill-value">{opt.label}</span>
                                        <span className="settings-level-pill-desc">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(user?.role === 'admin' || user?.role === 'teacher') && (
                            <div className="settings-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                <label className="settings-section-label">Thiết lập xưng hô (Dành cho AI)</label>
                                <p className="settings-section-desc">Chọn cách xưng hô để AI chấm bài và nhận xét đúng phong cách của bạn</p>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>Tự xưng {teacherTitle && <span style={{ color: '#4f46e5' }}>({teacherTitle})</span>}</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {['thầy', 'cô', 'anh', 'chị'].map(t => (
                                            <button key={t} className={`settings-level-pill ${teacherTitle === t ? 'settings-level-pill--active' : ''}`} onClick={() => { saveHonorific('teacherTitle', t); setCustomTeacher(''); }} style={{ flex: 1, padding: '12px', fontSize: '0.95rem', fontWeight: 600 }}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <input type="text" placeholder="Hoặc nhập khác..." value={customTeacher} onChange={e => setCustomTeacher(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customTeacher.trim()) saveHonorific('teacherTitle', customTeacher.trim()); }} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border-color)', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                                        {customTeacher.trim() && <button className="settings-level-pill settings-level-pill--active" style={{ padding: '10px 16px' }} onClick={() => saveHonorific('teacherTitle', customTeacher.trim())}>Lưu</button>}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>Gọi học sinh {studentTitle && <span style={{ color: '#4f46e5' }}>({studentTitle})</span>}</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {['em', 'con', 'báº¡n'].map(t => (
                                            <button key={t} className={`settings-level-pill ${studentTitle === t ? 'settings-level-pill--active' : ''}`} onClick={() => { saveHonorific('studentTitle', t); setCustomStudent(''); }} style={{ flex: 1, padding: '12px', fontSize: '0.95rem', fontWeight: 600 }}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <input type="text" placeholder="Hoáº·c nháº­p khÃ¡c..." value={customStudent} onChange={e => setCustomStudent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customStudent.trim()) saveHonorific('studentTitle', customStudent.trim()); }} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border-color)', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                                        {customStudent.trim() && <button className="settings-level-pill settings-level-pill--active" style={{ padding: '10px 16px' }} onClick={() => saveHonorific('studentTitle', customStudent.trim())}>LÆ°u</button>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {(() => {
                            const isStudent = !(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff');
                            // TEMP: unlock all themes for test user
                            const isTestUser = user?.email === 'ngheuac@gmail.com';
                            const darkUnlocked = !isStudent || isTestUser || currentStreak >= 5;
                            const silverUnlocked = !isStudent || isTestUser || currentStreak >= 18;
                            const goldUnlocked = !isStudent || isTestUser || currentStreak >= 30;
                            const diamondUnlocked = !isStudent || isTestUser || currentStreak >= 40;
                            const rubyUnlocked = !isStudent || isTestUser || currentStreak >= 60;
                            const nextUnlock = !darkUnlocked
                                ? `Äáº¡t streak 5 ngÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ giao diá»‡n tá»‘i (hiá»‡n táº¡i: ${currentStreak} ngÃ y)`
                                : !silverUnlocked
                                    ? `Äáº¡t streak 18 ngÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ NÃºt Báº¡c (hiá»‡n táº¡i: ${currentStreak} ngÃ y)`
                                    : !goldUnlocked
                                        ? `Äáº¡t streak 30 ngÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ NÃºt VÃ ng (hiá»‡n táº¡i: ${currentStreak} ngÃ y)`
                                        : !diamondUnlocked
                                            ? `Äáº¡t streak 40 ngÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ Kim CÆ°Æ¡ng (hiá»‡n táº¡i: ${currentStreak} ngÃ y)`
                                            : !rubyUnlocked
                                                ? `Äáº¡t streak 60 ngÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ NÃºt Ruby (hiá»‡n táº¡i: ${currentStreak} ngÃ y)`
                                                : 'Chá»n giao diá»‡n yÃªu thÃ­ch';
                            return (
                                <div className="settings-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                    <label className="settings-section-label">Giao diá»‡n</label>
                                    <p className="settings-section-desc">{nextUnlock}</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {/* Ruby Button */}
                                        {rubyUnlocked ? (
                                            <button
                                                className={`settings-level-pill ${theme === 'ruby' ? 'settings-level-pill--active' : ''}`}
                                                onClick={() => setTheme('ruby')}
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', minWidth: '90px' }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>ðŸ”´</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt Ruby</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="settings-level-pill"
                                                disabled
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', opacity: 0.45, cursor: 'not-allowed', minWidth: '90px' }}
                                            >
                                                <Lock size={14} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt Ruby</span>
                                            </button>
                                        )}
                                        {/* Diamond Button */}
                                        {diamondUnlocked ? (
                                            <button
                                                className={`settings-level-pill ${theme === 'diamond' ? 'settings-level-pill--active' : ''}`}
                                                onClick={() => setTheme('diamond')}
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', minWidth: '90px' }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>ðŸ’Ž</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kim CÆ°Æ¡ng</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="settings-level-pill"
                                                disabled
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', opacity: 0.45, cursor: 'not-allowed', minWidth: '90px' }}
                                            >
                                                <Lock size={14} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kim CÆ°Æ¡ng</span>
                                            </button>
                                        )}
                                        {/* Gold Button */}
                                        {goldUnlocked ? (
                                            <button
                                                className={`settings-level-pill ${theme === 'gold' ? 'settings-level-pill--active' : ''}`}
                                                onClick={() => setTheme('gold')}
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', minWidth: '90px' }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>ðŸ¥‡</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt VÃ ng</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="settings-level-pill"
                                                disabled
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', opacity: 0.45, cursor: 'not-allowed', minWidth: '90px' }}
                                            >
                                                <Lock size={14} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt VÃ ng</span>
                                            </button>
                                        )}
                                        {/* Silver Button */}
                                        {silverUnlocked ? (
                                            <button
                                                className={`settings-level-pill ${theme === 'silver' ? 'settings-level-pill--active' : ''}`}
                                                onClick={() => setTheme('silver')}
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', minWidth: '90px' }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>ðŸ¥ˆ</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt Báº¡c</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="settings-level-pill"
                                                disabled
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', opacity: 0.45, cursor: 'not-allowed', minWidth: '90px' }}
                                            >
                                                <Lock size={14} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>NÃºt Báº¡c</span>
                                            </button>
                                        )}
                                        {/* Dark */}
                                        {darkUnlocked ? (
                                            <button
                                                className={`settings-level-pill ${theme === 'dark' ? 'settings-level-pill--active' : ''}`}
                                                onClick={() => setTheme('dark')}
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px' }}
                                            >
                                                <Moon size={18} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Tá»‘i</span>
                                            </button>
                                        ) : (
                                            <button
                                                className="settings-level-pill"
                                                disabled
                                                style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px', opacity: 0.45, cursor: 'not-allowed' }}
                                            >
                                                <Lock size={16} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Tá»‘i</span>
                                            </button>
                                        )}
                                        {/* Light */}
                                        <button
                                            className={`settings-level-pill ${theme === 'light' ? 'settings-level-pill--active' : ''}`}
                                            onClick={() => setTheme('light')}
                                            style={{ flex: 1, flexDirection: 'row', gap: '8px', padding: '12px' }}
                                        >
                                            <Sun size={18} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>SÃ¡ng</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* The account/logout section has been moved to the header */}
                    </div>
                </div>
            )}

            <main className="dashboard-main container">
                <section className="dashboard-welcome animate-slide-up">
                    <div className="dashboard-welcome-main">
                        <Avatar src={user?.photoURL} alt={user?.displayName} size={80} className="dashboard-avatar" />
                        <div className="dashboard-welcome-content">
                            <h1 className="dashboard-welcome-name">
                                {user?.displayName || user?.email?.split('@')[0] || 'Há»c ViÃªn'}
                            </h1>
                            {/* Milestone title badge */}
                            {(() => {
                                const isStudent = !(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff');
                                if (!isStudent) return null;
                                const milestone = getCurrentMilestone(currentStreak);
                                const nextMs = getNextMilestone(currentStreak);
                                if (milestone) {
                                    return (
                                        <div className="dashboard-milestone-row">
                                            <div className="dashboard-milestone-info">
                                                <span className="dashboard-milestone-title" style={{ color: milestone.color }}>{milestone.title}</span>
                                                <span className="dashboard-milestone-subtitle">{milestone.subtitle}</span>
                                            </div>
                                            <span className="dashboard-milestone-emoji">{milestone.emoji}</span>
                                        </div>
                                    );
                                } else if (nextMs) {
                                    return (
                                        <div className="dashboard-milestone-row dashboard-milestone-locked">
                                            <div className="dashboard-milestone-info">
                                                <span className="dashboard-milestone-subtitle">Äáº¡t {nextMs.threshold} ngÃ y Ä‘á»ƒ nháº­n danh hiá»‡u!</span>
                                            </div>
                                            <span className="dashboard-milestone-emoji">ðŸŽ¯</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <div className="dashboard-welcome-tags">
                                {user?.groupNames && user.groupNames.length > 0 && user.groupNames.map((name, i) => (
                                    <span key={i} className="dashboard-welcome-tag">
                                        <Users size={13} />
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-progress-card" onClick={() => setIsProgressOpen(true)}>
                        {(() => { const hasFlags = studentRedFlags.filter(f => !f.removed).length > 0; return (
                        <div className={`dashboard-progress-stats${hasFlags ? ' has-flags' : ''}`}>
                            {classRanks.length > 0 ? (
                                <div className="dashboard-progress-item">
                                    <div className="dashboard-stat-icon-wrapper warning">
                                        <Medal size={22} />
                                    </div>
                                    <div className="dashboard-stat-info">
                                        {classRanks.length === 1 ? (
                                            <>
                                                <span className="dashboard-stat-value">#{classRanks[0].rank}</span>
                                                <span className="dashboard-stat-label">Top {classRanks[0].total}</span>
                                            </>
                                        ) : (
                                            <div className="dashboard-multi-rank">
                                                {classRanks.map(r => (
                                                    <div key={r.groupId} className="dashboard-rank-row">
                                                        <span className="dashboard-rank-value">#{r.rank}</span>
                                                        <span className="dashboard-rank-group">{r.groupName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="dashboard-progress-item">
                                    <div className="dashboard-stat-icon-wrapper warning">
                                        <Medal size={22} />
                                    </div>
                                    <div className="dashboard-stat-info">
                                        <span className="dashboard-stat-value">â€”</span>
                                        <span className="dashboard-stat-label">Xáº¿p háº¡ng</span>
                                    </div>
                                </div>
                            )}
                            {/* Red flag subtle indicator */}
                            {(() => {
                                const activeFlags = studentRedFlags.filter(f => !f.removed);
                                if (activeFlags.length === 0) return null;
                                const maxPerGroup = {};
                                activeFlags.forEach(f => {
                                    maxPerGroup[f.groupId] = (maxPerGroup[f.groupId] || 0) + 1;
                                });
                                const maxCount = Math.max(...Object.values(maxPerGroup));
                                const isTerminated = maxCount >= 3;
                                return (
                                    <>
                                        <div className="dashboard-progress-divider dashboard-divider-flags" />
                                        <div className="dashboard-progress-item dashboard-flags-item">
                                            <div className="dashboard-stat-icon-wrapper" style={{
                                                background: isTerminated ? 'rgba(220,38,38,0.12)' : maxCount === 2 ? 'rgba(234,88,12,0.12)' : 'rgba(202,138,4,0.12)'
                                            }}>
                                                <span style={{ fontSize: '18px' }}>ðŸš©</span>
                                            </div>
                                            <div className="dashboard-stat-info">
                                                <span className="dashboard-stat-value" style={{
                                                    color: isTerminated ? '#dc2626' : maxCount === 2 ? '#ea580c' : '#ca8a04'
                                                }}>{maxCount}/3</span>
                                                <span className="dashboard-stat-label">Cá» Ä‘á»</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            {totalRewardPoints > 0 && (
                                <>
                                    <div className="dashboard-progress-divider" />
                                    <div className="dashboard-progress-item">
                                        <div className="dashboard-stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
                                            <span style={{ fontSize: '20px' }}>â­</span>
                                        </div>
                                        <div className="dashboard-stat-info">
                                            <span className="dashboard-stat-value" style={{ color: '#f59e0b' }}>{totalRewardPoints}</span>
                                            <span className="dashboard-stat-label">Äiá»ƒm thÆ°á»Ÿng</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="dashboard-progress-divider dashboard-divider-streak" />
                            <div className="dashboard-progress-item dashboard-streak-item">
                                <div className="dashboard-stat-icon-wrapper error">
                                    <Flame size={22} />
                                </div>
                                <div className="dashboard-stat-info">
                                    <span className="dashboard-stat-value">{currentStreak}</span>
                                    <span className="dashboard-stat-label">NgÃ y streak</span>
                                </div>
                            </div>

                        </div>
                        ); })()}
                        <div className="dashboard-progress-cta">
                            <span>Xem tiáº¿n trÃ¬nh</span>
                            <span className="dashboard-progress-arrow">â€º</span>
                        </div>
                    </div>
                </section>

                {/* MAIN TABS */}
                {(() => {
                    if (user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff') return null;

                    const newAssignmentsCount = assignments.filter(a => {
                        const prog = assignmentsProgress[a.topicId];
                        const isDone = prog && prog.total > 0 && prog.learned === prog.total;
                        if (isDone) return false;
                        const due = getEffectiveDueDate(a, user.uid);
                        const isOverdue = due && due < new Date();
                        if (isOverdue) return false;
                        return true;
                    }).length;

                    return (
                        <>
                        {activeRatingPeriod && !allTeachersRated && (() => {
                            const rEnd = new Date(activeRatingPeriod.ratingEndDate + 'T23:59:59');
                            const daysLeft = Math.ceil((rEnd - new Date()) / (1000 * 60 * 60 * 24));
                            const numberOfGroups = (user?.visibleGroupIds || user?.groupIds || []).length;
                            // Tiered bonus matching TeacherRatingFormPage logic
                            let baseDays = 1;
                            if (activeRatingPeriod.ratingStartDate && activeRatingPeriod.ratingEndDate) {
                                const rStart = new Date(activeRatingPeriod.ratingStartDate + 'T00:00:00');
                                const totalMs = rEnd - rStart;
                                const elapsed = Date.now() - rStart;
                                const progress = Math.max(0, Math.min(1, elapsed / totalMs));
                                if (progress <= 1 / 3) baseDays = 3;
                                else if (progress <= 2 / 3) baseDays = 2;
                                else baseDays = 1;
                            }
                            const streakPerGroup = baseDays;
                            return (
                                <div
                                    onClick={() => navigate('/rate-teacher')}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        color: 'white',
                                        marginBottom: '12px',
                                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                                        transition: 'transform 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <span style={{ fontSize: '1.3rem' }}>â­</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', display: 'block' }}>ÄÃ¡nh giÃ¡ GiÃ¡o viÃªn</span>
                                        <span style={{ fontSize: '0.72rem', opacity: 0.95, display: 'block', marginTop: '2px' }}>ðŸ”¥ HoÃ n thÃ nh Ä‘á»ƒ nháº­n +{streakPerGroup} ngÃ y streak/lá»›p!</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.9, whiteSpace: 'nowrap' }}>{daysLeft > 0 ? `${daysLeft} ngÃ y` : 'Cuá»‘i ká»³!'}</span>
                                    <span style={{ fontSize: '0.85rem' }}>â†’</span>
                                </div>
                            );
                        })()}
                        <div className="dashboard-nav-pill">
                            <button
                                onClick={() => setActiveMainTab('learning')}
                                className={`dashboard-nav-item ${activeMainTab === 'learning' ? 'active' : ''}`}
                            >
                                <Home size={18} />
                                Há»c
                            </button>
                            <button
                                onClick={() => setActiveMainTab('assignments')}
                                className={`dashboard-nav-item ${activeMainTab === 'assignments' ? 'active' : ''}`}
                            >
                                <ClipboardList size={18} />
                                BÃ i luyá»‡n
                                {newAssignmentsCount > 0 && (
                                    <span className="dashboard-nav-badge-round">
                                        {newAssignmentsCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveMainTab('exams')}
                                className={`dashboard-nav-item ${activeMainTab === 'exams' ? 'active' : ''}`}
                            >
                                <FileCheck size={18} />
                                BÃ i táº­p & KT
                                {(examAssignments.length > 0) && (() => {
                                    const subsMap = {};
                                    examSubmissions.forEach(s => {
                                        const existing = subsMap[s.assignmentId];
                                        if (!existing) {
                                            subsMap[s.assignmentId] = s;
                                        } else {
                                            const isExistingDone = existing.status === 'submitted' || existing.status === 'grading' || existing.status === 'graded';
                                            const isNewDone = s.status === 'submitted' || s.status === 'grading' || s.status === 'graded';
                                            if (!isExistingDone && isNewDone) subsMap[s.assignmentId] = s;
                                        }
                                    });
                                    const now = new Date();
                                    const activeCount = examAssignments.filter(a => {
                                        const sub = subsMap[a.id];
                                        const hasSubmitted = sub && (sub.status === 'submitted' || sub.status === 'graded' || sub.status === 'grading');
                                        const due = getEffectiveDueDate(a, user.uid);
                                        const isOverdue = due && due < now;

                                        // Not submitted and not overdue â†’ active
                                        if (!hasSubmitted && !isOverdue) return true;

                                        // Submitted but has pending follow-ups â†’ active
                                        const fuRequested = sub?.followUpRequested || {};
                                        const fuAnswers = sub?.followUpAnswers || {};
                                        const hasPendingFollowUp = Object.keys(fuRequested).some(qId => {
                                            return !Object.values(fuAnswers).some(sec => sec?.[qId]);
                                        });
                                        if (hasSubmitted && hasPendingFollowUp) return true;

                                        // Has new results not yet viewed â†’ active
                                        if (sub?.status === 'graded' && sub?.resultsReleased && !sub?.viewedByStudent) return true;

                                        // Has new follow-up results not yet viewed â†’ active
                                        if (sub?.followUpResultsReleased && !sub?.followUpResultsViewedByStudent) return true;

                                        return false;
                                    }).length;

                                    if (activeCount === 0) return null;
                                    return (
                                        <span className="dashboard-nav-badge-round">
                                            {activeCount}
                                        </span>
                                    );
                                })()}
                            </button>
                        </div>
                        </>
                    );
                })()}

                {/* Exam Alert Modal */}
                {/* Priority Popup System: Exam Alert â†’ Teacher Rating â†’ Milestone */}
                {/* Priority 1: Exam Alert */}
                {showExamAlert && (
                    <div className="settings-modal-backdrop" style={{ zIndex: 3000, alignItems: 'center' }}>
                        <div className="settings-modal animate-slide-up" style={{ padding: '32px', borderRadius: '32px', maxWidth: '450px', paddingBottom: '32px' }}>
                            {showAlertType === 'urgent' && urgentExam && (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                        <div style={{ width: '80px', height: '80px', background: 'var(--bg-input)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-error)', border: '1px solid var(--border-color)' }}>
                                            <AlertTriangle size={40} />
                                        </div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-error)', margin: '0 0 8px' }}>ThÃ´ng bÃ¡o kháº©n!</h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            Báº¡n cÃ³ {urgentExam.examType === 'test' ? 'bÃ i kiá»ƒm tra' : 'bÃ i táº­p'} <strong>{urgentExam.name}</strong> chÆ°a hoÃ n thÃ nh. HÃ£y lÃ m ngay trÆ°á»›c khi háº¿t háº¡n!
                                        </p>
                                    </div>

                                    <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${urgentExam.color || '#6366f1'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            {urgentExam.icon || 'ðŸ“‹'}
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{urgentExam.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-error)', fontWeight: 600 }}>
                                                â± Háº¡n: {urgentExam.dueDate ? (urgentExam.dueDate.toDate ? urgentExam.dueDate.toDate() : new Date(urgentExam.dueDate)).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '16px', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.3)' }}
                                            onClick={() => {
                                                setShowExamAlert(false);
                                                navigate(`/exam?examId=${urgentExam.examId}&assignmentId=${urgentExam.id}&seed=${urgentExam.variationSeed || 0}`);
                                            }}
                                        >
                                            LÃ m bÃ i ngay
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ padding: '14px', borderRadius: '16px', fontWeight: 700, color: 'var(--text-secondary)', background: 'transparent' }}
                                            onClick={() => setShowExamAlert(false)}
                                        >
                                            Äá»ƒ sau
                                        </button>
                                    </div>
                                </>
                            )}

                            {showAlertType === 'result' && newResult && (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                        <div style={{ width: '80px', height: '80px', background: 'var(--bg-input)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-success)', border: '1px solid var(--border-color)' }}>
                                            <Trophy size={40} />
                                        </div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>ÄÃ£ cÃ³ Ä‘iá»ƒm!</h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            GiÃ¡o viÃªn Ä‘Ã£ cháº¥m xong {newResult.examType === 'test' ? 'bÃ i kiá»ƒm tra' : 'bÃ i táº­p'} <strong>{newResult.examName}</strong>. HÃ£y xem káº¿t quáº£ cá»§a báº¡n nhÃ©!
                                        </p>
                                    </div>

                                    <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${newResult.examColor || '#10b981'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            {newResult.examIcon || 'ðŸŽ‰'}
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{newResult.examName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600 }}>
                                                âœ¨ ÄÃ£ cháº¥m xong
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '16px', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)' }}
                                            onClick={() => {
                                                setShowExamAlert(false);
                                                navigate(`/exam-result?assignmentId=${newResult.assignmentId}&studentId=${user?.uid}`);
                                            }}
                                        >
                                            Xem káº¿t quáº£
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ padding: '14px', borderRadius: '16px', fontWeight: 700, color: 'var(--text-secondary)', background: 'transparent' }}
                                            onClick={() => setShowExamAlert(false)}
                                        >
                                            ÄÃ³ng
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Priority 2: Teacher Rating Popup (only when Exam Alert is dismissed) */}
                {!showExamAlert && showRatingPopup && activeRatingPeriod && !allTeachersRated && (() => {
                    const rEnd = new Date(activeRatingPeriod.ratingEndDate + 'T23:59:59');
                    const daysLeft = Math.ceil((rEnd - new Date()) / (1000 * 60 * 60 * 24));
                    let baseDays = 1;
                    if (activeRatingPeriod.ratingStartDate && activeRatingPeriod.ratingEndDate) {
                        const rStart = new Date(activeRatingPeriod.ratingStartDate + 'T00:00:00');
                        const totalMs = rEnd - rStart;
                        const elapsed = Date.now() - rStart;
                        const progress = Math.max(0, Math.min(1, elapsed / totalMs));
                        if (progress <= 1 / 3) baseDays = 3;
                        else if (progress <= 2 / 3) baseDays = 2;
                        else baseDays = 1;
                    }
                    return (
                        <div className="settings-modal-backdrop" style={{ zIndex: 3000, alignItems: 'center' }} onClick={() => setShowRatingPopup(false)}>
                            <div className="settings-modal animate-slide-up" style={{ padding: '32px', borderRadius: '32px', maxWidth: '450px', paddingBottom: '32px' }} onClick={e => e.stopPropagation()}>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2.2rem' }}>
                                        â­
                                    </div>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>ÄÃ¡nh giÃ¡ GiÃ¡o viÃªn</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                        Ká»³ Ä‘Ã¡nh giÃ¡ giÃ¡o viÃªn Ä‘ang má»Ÿ! HÃ£y Ä‘Ã¡nh giÃ¡ Ä‘á»ƒ giÃºp cáº£i thiá»‡n cháº¥t lÆ°á»£ng giáº£ng dáº¡y.
                                    </p>
                                </div>

                                <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', padding: '14px 18px', borderRadius: '16px', border: '1.5px solid #f59e0b', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Flame size={20} color="#ea580c" />
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400e' }}>+{baseDays} ngÃ y streak/lá»›p</span>
                                    <span style={{ fontSize: '0.78rem', color: '#a16207' }}>â€¢ CÃ²n {daysLeft > 0 ? `${daysLeft} ngÃ y` : 'hÃ´m nay!'}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '16px', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)' }}
                                        onClick={() => {
                                            setShowRatingPopup(false);
                                            navigate('/rate-teacher');
                                        }}
                                    >
                                        ÄÃ¡nh giÃ¡ ngay
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ padding: '14px', borderRadius: '16px', fontWeight: 700, color: 'var(--text-secondary)', background: 'transparent' }}
                                        onClick={() => setShowRatingPopup(false)}
                                    >
                                        Äá»ƒ sau
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {activeMainTab === 'learning' && (reviewStats.totalCount > 0 || grammarReviewStats.totalCount > 0) && (
                    <section className="dashboard-reviews-container animate-slide-up" style={{
                        animationDelay: '0.05s',
                        marginBottom: 'var(--space-xl)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 'var(--space-md)',
                        maxWidth: '980px',
                        margin: '0 auto var(--space-xl)'
                    }}>
                        {reviewStats.totalCount > 0 && (
                            <div className="review-card glass-card">
                                <div className="review-card-icon">
                                    <BrainCircuit size={28} />
                                </div>
                                <div className="review-card-content">
                                    <h3>Tá»« vá»±ng</h3>
                                    <p><strong>{reviewStats.totalCount}</strong> tá»« cáº§n Ã´n</p>
                                </div>
                                <button
                                    className="btn btn-primary review-card-btn"
                                    onClick={() => navigate('/review')}
                                >
                                    Ã”n ngay
                                </button>
                            </div>
                        )}

                        {grammarReviewStats.totalCount > 0 && (
                            <div className="review-card glass-card">
                                <div className="review-card-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                                    <PenLine size={28} />
                                </div>
                                <div className="review-card-content">
                                    <h3>Ká»¹ nÄƒng</h3>
                                    <p><strong>{grammarReviewStats.totalCount}</strong> cÃ¢u cáº§n lÃ m</p>
                                </div>
                                <button
                                    className="btn btn-primary review-card-btn"
                                    style={{ background: 'var(--color-warning)', color: '#fff', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                                    onClick={() => navigate('/grammar-review')}
                                >
                                    Ã”n ngay
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {activeMainTab === 'assignments' && assignments.length > 0 && (() => {
                    const mappedAssignments = assignments.map(a => {
                        const due = getEffectiveDueDate(a, user.uid);
                        const isOverdue = due && due < new Date();
                        const timeDiff = due ? due.getTime() - new Date().getTime() : Infinity;
                        const isDueSoon = timeDiff > 0 && timeDiff <= 48 * 60 * 60 * 1000; // < 48 hours

                        const prog = assignmentsProgress[a.topicId];
                        const isDone = prog && prog.total > 0 && prog.learned === prog.total;

                        let percent = 0;
                        if (prog && prog.total > 0) {
                            if (isDone) {
                                percent = 100;
                            } else {
                                const isGrammar = a.isGrammar;
                                const totalSteps = isGrammar ? prog.total : prog.total * 6; // Grammar exercises use 1 step per question or simply learned vs total
                                const completedSteps = isGrammar ? (prog.learned + (prog.learning > 0 ? prog.learning * 0.5 : 0)) : (prog.completedSteps || 0); // Grammar progress logic approximation

                                percent = Math.round((completedSteps / totalSteps) * 100);
                                // Cap at 99% if not fully mastered yet to clearly indicate it's pending
                                if (percent >= 100) percent = 99;
                            }
                        }

                        const hasZeroProgress = !prog || (prog.learned === 0 && (prog.learning ?? 0) === 0 && (prog.completedSteps ?? 0) === 0);
                        const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                        const isRecentlyAssigned = Date.now() - msA < 3 * 24 * 60 * 60 * 1000;
                        const isNew = hasZeroProgress && isRecentlyAssigned;

                        return { ...a, due, isOverdue, isDueSoon, prog, percent, isNew, isDone };
                    });

                    const pendingAssignments = mappedAssignments
                        .filter(a => !a.isDone && !a.isOverdue)
                        .sort((a, b) => {
                            if (a.due && !b.due) return -1;
                            if (!a.due && b.due) return 1;
                            if (a.due && b.due) {
                                return a.due.getTime() - b.due.getTime();
                            }
                            const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                            const msB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                            return msB - msA;
                        });

                    const overdueAssignments = mappedAssignments
                        .filter(a => !a.isDone && a.isOverdue)
                        .sort((a, b) => {
                            const dA = a.due ? a.due.getTime() : 0;
                            const dB = b.due ? b.due.getTime() : 0;
                            return dB - dA; // most recently expired first
                        });

                    const completedAssignments = mappedAssignments
                        .filter(a => a.isDone)
                        .sort((a, b) => {
                            const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                            const msB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                            return msB - msA;
                        });

                    const AssignmentCard = ({ a, isCompleted }) => (
                        <div key={a.id} className="glass-card" onClick={() => { if (a.isOverdue && !a.isDone) return; if (a.isGrammar) { handleContinueLearning({ id: a.topicId, type: 'topic', name: a.topicName, isTeacherTopic: a.isTeacherTopic, isGrammar: a.isGrammar }); } else { handleOpenWordSelect(a); } }} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px', borderRadius: '20px', position: 'relative', overflow: 'hidden', opacity: isCompleted ? 0.7 : (a.isOverdue && !a.isDone) ? 0.6 : 1, filter: (a.isOverdue && !a.isDone) ? 'grayscale(0.5)' : 'none', cursor: (a.isOverdue && !a.isDone) ? 'not-allowed' : 'pointer' }}>
                            {groupIdToName[a.groupId] && Object.keys(groupIdToName).length > 1 && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span className="dashboard-group-chip">
                                        <Users size={11} />
                                        {groupIdToName[a.groupId]}
                                    </span>
                                </div>
                            )}
                            {!a.isDone && a.isNew && (
                                <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)', zIndex: 2 }}>
                                    Má»›i
                                </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {a.isGrammar ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#d97706', background: 'rgba(245, 158, 11, 0.15)', padding: '4px 8px', borderRadius: '12px' }}>
                                        {a.topicIcon ? <span style={{ fontSize: '1rem' }}>{a.topicIcon}</span> : <PenLine size={12} />}
                                        Ká»¹ nÄƒng
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '4px 8px', borderRadius: '12px' }}>
                                        {a.topicIcon ? <span style={{ fontSize: '1rem' }}>{a.topicIcon}</span> : <BookOpen size={12} />}
                                        Tá»« vá»±ng
                                    </span>
                                )}
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>{a.topicName}</h3>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: (a.isOverdue && !a.isDone) ? '#ef4444' : a.isDueSoon ? '#ef4444' : 'var(--text-secondary)', fontWeight: (a.isOverdue || a.isDueSoon) ? 600 : 400 }}>
                                <Clock size={14} />
                                <span>
                                    {(() => {
                                        if (!a.due) return 'KhÃ´ng cÃ³ háº¡n';
                                        if (a.isOverdue) return 'ÄÃ£ háº¿t háº¡n';
                                        const diff = a.due.getTime() - Date.now();
                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                        if (hours < 1) return `CÃ²n ${minutes} phÃºt`;
                                        if (hours < 48) return `CÃ²n ${hours} giá» ${minutes > 0 ? minutes + ' phÃºt' : ''}`;
                                        const days = Math.floor(hours / 24);
                                        return `CÃ²n ${days} ngÃ y`;
                                    })()}
                                </span>
                            </p>
                            {/* Progress Bar */}
                            {a.prog && a.prog.total > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', zIndex: 1 }}>
                                    <div style={{ flex: 1, height: '8px', background: 'var(--bg-glass)', borderRadius: '4px', overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}>
                                        <div style={{ width: `${a.percent}%`, background: '#10b981', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} title={`Tiáº¿n Ä‘á»™: ${a.percent}%`} />
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: a.isDone ? '#10b981' : 'var(--text-primary)', minWidth: '40px', textAlign: 'right' }}>
                                        {a.percent}%
                                    </div>
                                </div>
                            )}
                        </div>
                    );

                    const filteredPending = selectedGroupFilter === 'all' ? pendingAssignments : pendingAssignments.filter(a => a.groupId === selectedGroupFilter);
                    const filteredOverdue = selectedGroupFilter === 'all' ? overdueAssignments : overdueAssignments.filter(a => a.groupId === selectedGroupFilter);
                    const filteredCompleted = selectedGroupFilter === 'all' ? completedAssignments : completedAssignments.filter(a => a.groupId === selectedGroupFilter);

                    return (
                        <section className="dashboard-assignments animate-slide-up" style={{ animationDelay: '0.08s', marginBottom: 'var(--space-xl)' }}>
                            {Object.keys(groupIdToName).length > 1 && (
                                <div className="dashboard-group-filter">
                                    <button
                                        className={`dashboard-group-filter-btn${selectedGroupFilter === 'all' ? ' active' : ''}`}
                                        onClick={() => setSelectedGroupFilter('all')}
                                    >
                                        Táº¥t cáº£
                                    </button>
                                    {Object.entries(groupIdToName).map(([gid, gname]) => (
                                        <button
                                            key={gid}
                                            className={`dashboard-group-filter-btn${selectedGroupFilter === gid ? ' active' : ''}`}
                                            onClick={() => setSelectedGroupFilter(gid)}
                                        >
                                            {gname}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="dashboard-recent-header flex-between" style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0' }}>ðŸ“‹ Cáº§n lÃ m ({filteredPending.length})</h3>
                            </div>
                            <div style={{ marginBottom: '32px' }}>
                                {filteredPending.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--bg-glass-card)', borderRadius: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', fontSize: '0.95rem' }}>
                                        ðŸŽ‰ Tuyá»‡t vá»i! Báº¡n khÃ´ng cÃ³ bÃ i luyá»‡n nÃ o Ä‘ang chá».
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {filteredPending.map(a => <AssignmentCard key={a.id} a={a} isCompleted={false} />)}
                                    </div>
                                )}
                            </div>

                            {filteredOverdue.length > 0 && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                                    <div
                                        className="dashboard-recent-header flex-between"
                                        style={{ cursor: 'pointer', marginBottom: showOverdueAssignments ? '16px' : '0' }}
                                        onClick={() => setShowOverdueAssignments(!showOverdueAssignments)}
                                    >
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>â° KhÃ´ng hoÃ n thÃ nh ({filteredOverdue.length})</h3>
                                        <ChevronDown size={20} style={{ transform: showOverdueAssignments ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', color: 'var(--text-secondary)' }} />
                                    </div>

                                    {showOverdueAssignments && (
                                        <div style={{ display: 'grid', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
                                            {filteredOverdue.map(a => <AssignmentCard key={a.id} a={a} isCompleted={false} />)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {filteredCompleted.length > 0 && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                    <div
                                        className="dashboard-recent-header flex-between"
                                        style={{ cursor: 'pointer', marginBottom: showAllAssignments ? '16px' : '0' }}
                                        onClick={() => setShowAllAssignments(!showAllAssignments)}
                                    >
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>âœ… ÄÃ£ hoÃ n thÃ nh ({filteredCompleted.length})</h3>
                                        <ChevronDown size={20} style={{ transform: showAllAssignments ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', color: 'var(--text-secondary)' }} />
                                    </div>

                                    {showAllAssignments && (
                                        <div style={{ display: 'grid', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
                                            {filteredCompleted.map(a => <AssignmentCard key={a.id} a={a} isCompleted={true} />)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    );
                })()}

                {activeMainTab === 'assignments' && assignments.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--bg-glass-card)', borderRadius: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', fontSize: '1rem' }}>
                        ðŸŽ‰ Báº¡n chÆ°a cÃ³ bÃ i luyá»‡n nÃ o Ä‘Æ°á»£c giao!
                    </div>
                )}

                {activeMainTab === 'exams' && (() => {
                    const now = new Date();
                    const subsMap = {};
                    examSubmissions.forEach(s => {
                        const existing = subsMap[s.assignmentId];
                        if (!existing) {
                            subsMap[s.assignmentId] = s;
                        } else {
                            const isExistingDone = existing.status === 'submitted' || existing.status === 'grading' || existing.status === 'graded';
                            const isNewDone = s.status === 'submitted' || s.status === 'grading' || s.status === 'graded';
                            if (!isExistingDone && isNewDone) subsMap[s.assignmentId] = s;
                        }
                    });

                    const active = [];
                    const overdue = [];
                    const completed = [];

                    examAssignments.forEach(a => {
                        const sub = subsMap[a.id];
                        const isSubmitted = sub && (sub.status === 'submitted' || sub.status === 'grading' || sub.status === 'graded');

                        // Check if there are pending follow-up requests
                        const fuRequested = sub?.followUpRequested || {};
                        const fuAnswers = sub?.followUpAnswers || {};
                        const hasPendingFollowUp = Object.keys(fuRequested).some(qId => {
                            return !Object.values(fuAnswers).some(sec => sec?.[qId]);
                        });

                        const isDone = isSubmitted && !hasPendingFollowUp;
                        const due = getEffectiveDueDate(a, user.uid);
                        const isOverdue = due && due < now;

                        // Check if follow-up results were released but student hasn't viewed
                        const hasNewFollowUpResults = sub?.followUpResultsReleased && !sub?.followUpResultsViewedByStudent;
                        // Check if first-answer results were released but student hasn't viewed
                        const hasNewResults = sub?.status === 'graded' && sub?.resultsReleased && !sub?.viewedByStudent;

                        if (isDone && !hasNewFollowUpResults && !hasNewResults) {
                            completed.push({ ...a, sub });
                        } else if (isDone && hasNewFollowUpResults) {
                            active.push({ ...a, sub, hasPendingFollowUp: false, hasNewFollowUpResults });
                        } else if (isDone && hasNewResults) {
                            active.push({ ...a, sub, hasPendingFollowUp: false, hasNewResults });
                        } else if (isOverdue && !isSubmitted) {
                            overdue.push({ ...a, sub });
                        } else {
                            active.push({ ...a, sub, hasPendingFollowUp });
                        }
                    });

                    const renderExamCard = (a, type) => {
                        const examInfo = examDetails[a.examId];
                        const sub = a.sub;
                        const isOverdue = type === 'overdue';
                        const isDone = type === 'completed';
                        const isGraded = sub?.status === 'graded' && sub?.resultsReleased;
                        const percent = sub?.maxTotalScore ? Math.round((sub.totalScore / sub.maxTotalScore) * 100) : null;
                        const due = getEffectiveDueDate(a, user.uid);

                        const timeDiff = due ? due.getTime() - new Date().getTime() : Infinity;
                        const isDueSoon = timeDiff > 0 && timeDiff <= 48 * 60 * 60 * 1000;

                        const hasZeroProgress = !sub;
                        const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                        const isRecentlyAssigned = Date.now() - msA < 3 * 24 * 60 * 60 * 1000;
                        const isNew = hasZeroProgress && isRecentlyAssigned;

                        return (
                            <div key={a.id} className="glass-card" onClick={() => { if (isOverdue && !isDone && !a.hasPendingFollowUp && !a.hasNewFollowUpResults && !a.hasNewResults) return; if (isDone || a.hasPendingFollowUp || a.hasNewFollowUpResults || a.hasNewResults) navigate(`/exam-result?assignmentId=${a.id}&studentId=${user?.uid}`); else navigate(`/exam?examId=${a.examId}&assignmentId=${a.id}&seed=${a.variationSeed || 0}`); }} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px', borderRadius: '20px', position: 'relative', overflow: 'hidden', opacity: (isOverdue && !isDone && !a.hasPendingFollowUp && !a.hasNewFollowUpResults && !a.hasNewResults) ? 0.6 : 1, filter: (isOverdue && !isDone && !a.hasPendingFollowUp && !a.hasNewFollowUpResults && !a.hasNewResults) ? 'grayscale(0.5)' : 'none', marginBottom: '12px', cursor: (isOverdue && !isDone && !a.hasPendingFollowUp && !a.hasNewFollowUpResults && !a.hasNewResults) ? 'not-allowed' : 'pointer' }}>
                                {/* Floating badges */}
                                {!isDone && isNew && (
                                    <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)', zIndex: 2 }}>
                                        Má»›i
                                    </span>
                                )}

                                {/* Group chip */}
                                {a.targetType === 'group' && groupIdToName[a.targetId] && Object.keys(groupIdToName).length > 1 && (
                                    <div style={{ marginBottom: '4px' }}>
                                        <span className="dashboard-group-chip">
                                            <Users size={11} />
                                            {groupIdToName[a.targetId]}
                                        </span>
                                    </div>
                                )}
                                {/* Type tag + Score/Status on same row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: examInfo?.examType === 'test' ? '#dc2626' : '#6366f1', background: examInfo?.examType === 'test' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(99, 102, 241, 0.15)', padding: '4px 8px', borderRadius: '12px', flexShrink: 0 }}>
                                        {examInfo?.icon ? <span style={{ fontSize: '1rem' }}>{examInfo.icon}</span> : <FileCheck size={12} />}
                                        {examInfo?.examType === 'test' ? 'Kiá»ƒm tra' : 'BÃ i táº­p'}
                                    </span>
                                    {a.hasNewFollowUpResults ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#7c3aed', background: 'rgba(139, 92, 246, 0.12)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                            ðŸ“ Káº¿t quáº£ bÃ i sá»­a
                                        </span>
                                    ) : a.hasNewResults ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', background: 'rgba(239, 68, 68, 0.12)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                            ðŸŽ‰ Má»›i cÃ³ Ä‘iá»ƒm
                                        </span>
                                    ) : a.hasPendingFollowUp ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#d97706', background: 'rgba(245, 158, 11, 0.12)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                            âœï¸ Cáº§n sá»­a bÃ i
                                        </span>
                                    ) : isDone ? (
                                        isGraded ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, color: percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444', background: percent >= 80 ? 'rgba(16, 185, 129, 0.12)' : percent >= 50 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                                âœ… {Math.round(sub.totalScore * 10) / 10}/{sub.maxTotalScore}
                                            </span>
                                        ) : (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                                â³ Äang cháº¥m
                                            </span>
                                        )
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, color: (isOverdue && !isDone) ? '#ef4444' : isDueSoon ? '#ef4444' : 'var(--text-secondary)', background: (isOverdue && !isDone) ? 'rgba(239, 68, 68, 0.12)' : isDueSoon ? 'rgba(239, 68, 68, 0.12)' : 'rgba(128, 128, 128, 0.1)', padding: '6px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                            <Clock size={14} />
                                            {(() => {
                                                if (!due) return 'KhÃ´ng cÃ³ háº¡n';
                                                if (isOverdue) return 'ÄÃ£ háº¿t háº¡n';
                                                const diff = due.getTime() - Date.now();
                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                if (hours < 1) return `CÃ²n ${minutes} phÃºt`;
                                                if (hours < 48) return `CÃ²n ${hours}g ${minutes > 0 ? minutes + 'p' : ''}`;
                                                const days = Math.floor(hours / 24);
                                                return `CÃ²n ${days} ngÃ y`;
                                            })()}
                                        </span>
                                    )}
                                </div>
                                {/* Exam name */}
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>{examInfo?.name || 'BÃ i táº­p vÃ  Kiá»ƒm tra'}</h3>
                            </div>
                        );
                    };

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {Object.keys(groupIdToName).length > 1 && (
                                <div className="dashboard-group-filter">
                                    <button
                                        className={`dashboard-group-filter-btn${selectedGroupFilter === 'all' ? ' active' : ''}`}
                                        onClick={() => setSelectedGroupFilter('all')}
                                    >
                                        Táº¥t cáº£
                                    </button>
                                    {Object.entries(groupIdToName).map(([gid, gname]) => (
                                        <button
                                            key={gid}
                                            className={`dashboard-group-filter-btn${selectedGroupFilter === gid ? ' active' : ''}`}
                                            onClick={() => setSelectedGroupFilter(gid)}
                                        >
                                            {gname}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {(() => {
                                const fActive = selectedGroupFilter === 'all' ? active : active.filter(a => a.targetType === 'group' && a.targetId === selectedGroupFilter);
                                const fOverdue = selectedGroupFilter === 'all' ? overdue : overdue.filter(a => a.targetType === 'group' && a.targetId === selectedGroupFilter);
                                const fCompleted = selectedGroupFilter === 'all' ? completed : completed.filter(a => a.targetType === 'group' && a.targetId === selectedGroupFilter);
                                return (
                                    <>
                                        {fActive.length > 0 && (
                                            <section>
                                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>ðŸ“‹ Cáº§n lÃ m ({fActive.length})</h3>
                                                {fActive.map(a => renderExamCard(a, 'active'))}
                                            </section>
                                        )}
                                        {fOverdue.length > 0 && (
                                            <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                                <div
                                                    className="dashboard-recent-header flex-between"
                                                    style={{ cursor: 'pointer', marginBottom: showOverdueExams ? '12px' : '0' }}
                                                    onClick={() => setShowOverdueExams(!showOverdueExams)}
                                                >
                                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>â° KhÃ´ng hoÃ n thÃ nh ({fOverdue.length})</h3>
                                                    <ChevronDown size={20} style={{ transform: showOverdueExams ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', color: 'var(--text-secondary)' }} />
                                                </div>
                                                {showOverdueExams && fOverdue.map(a => renderExamCard(a, 'overdue'))}
                                            </section>
                                        )}
                                        {(() => {
                                            const newlyGraded = fCompleted.filter(a => a.sub?.status === 'graded' && a.sub?.resultsReleased && !a.sub?.viewedByStudent);
                                            const restCompleted = fCompleted.filter(a => !(a.sub?.status === 'graded' && a.sub?.resultsReleased && !a.sub?.viewedByStudent));

                                            return (
                                                <>
                                                    {newlyGraded.length > 0 && (
                                                        <section style={{ marginBottom: '16px' }}>
                                                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                ðŸŽ‰ Má»›i cÃ³ Ä‘iá»ƒm ({newlyGraded.length})
                                                            </h3>
                                                            {newlyGraded.map(a => renderExamCard(a, 'completed'))}
                                                        </section>
                                                    )}
                                                    {restCompleted.length > 0 && (
                                                        <section>
                                                            <div
                                                                className="dashboard-recent-header flex-between"
                                                                style={{ cursor: 'pointer', marginBottom: showAllExams ? '12px' : '0' }}
                                                                onClick={() => setShowAllExams(!showAllExams)}
                                                            >
                                                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>âœ… ÄÃ£ hoÃ n thÃ nh ({restCompleted.length})</h3>
                                                                <ChevronDown size={20} style={{ transform: showAllExams ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', color: 'var(--text-secondary)' }} />
                                                            </div>
                                                            {showAllExams && restCompleted.map(a => renderExamCard(a, 'completed'))}
                                                        </section>
                                                    )}
                                                </>
                                            );
                                        })()}
                                        {fActive.length === 0 && fOverdue.length === 0 && fCompleted.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--bg-glass-card)', borderRadius: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', fontSize: '1rem' }}>
                                                ðŸ“‹ Báº¡n chÆ°a cÃ³ bÃ i táº­p vÃ  kiá»ƒm tra nÃ o!
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    );
                })()}

                {activeMainTab === 'learning' && recentLists.length > 0 && (
                    <section className="dashboard-recent animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="dashboard-recent-header flex-between">
                            <h2 className="text-md font-semibold text-secondary">Há»c gáº§n Ä‘Ã¢y</h2>
                        </div>
                        <div className={`dashboard-recent-slider${isDraggingSlider ? ' is-dragging' : ''}`}
                            ref={sliderRef}
                            onMouseDown={handleSliderMouseDown}
                        >
                            {recentLists.map(list => (
                                <div key={list.id} className="recent-list-card" onClick={() => handleContinueLearning(list)}>
                                    <div className="recent-list-icon" style={{ background: `${list.color || 'var(--color-primary)'}20` }}>
                                        <span className="recent-list-emoji">{list.icon}</span>
                                    </div>
                                    <div className="recent-list-info">
                                        <h4>{list.name}</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            {list.isGrammar ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 800, color: '#d97706', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '6px', lineHeight: 1 }}>
                                                    <PenLine size={9} /> Ká»¹ nÄƒng
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 800, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '6px', lineHeight: 1 }}>
                                                    <BookOpen size={9} /> Tá»« vá»±ng
                                                </span>
                                            )}
                                            <p style={{ margin: 0 }}>{list.wordCount} {list.isGrammar ? 'cÃ¢u' : 'tá»«'}</p>
                                        </div>
                                    </div>
                                    <button className="recent-list-play">
                                        <PlayCircle size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}


                {activeMainTab === 'learning' && (
                    <section className="dashboard-actions-section">
                        <div className="dashboard-recent-header flex-between" style={{ marginBottom: 'var(--space-md)' }}>
                            <h2 className="text-md font-semibold text-secondary">KhÃ¡m phÃ¡</h2>
                        </div>
                        <div className="dashboard-actions">
                            {actions.map((action, index) => (
                                <button key={action.id} className="dashboard-action-card glass-card"
                                    onClick={() => action.onClick ? action.onClick() : navigate(action.path)} style={{ animationDelay: `${index * 0.1}s`, '--item-color': action.color }}>
                                    <div className="dashboard-action-icon" style={{ background: `${action.color}20`, color: action.color }}>
                                        <action.icon size={28} />
                                    </div>
                                    <div className="dashboard-action-info">
                                        <h3>{action.title}</h3>
                                        <p>{action.description}</p>
                                    </div>
                                    <span className="dashboard-action-arrow">â†’</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* SKILL REPORT CARDS */}
                <div ref={reportsRef} />
                {skillReports.length > 0 && activeMainTab === 'learning' && (() => {
                    const filteredSkillReports = selectedGroupFilter === 'all'
                        ? skillReports
                        : skillReports.filter(r => r.groupId === selectedGroupFilter);
                    return (
                        <section className="dashboard-actions-section">
                            <div className="dashboard-recent-header flex-between" style={{ marginBottom: 'var(--space-md)' }}>
                                <h2 className="text-md font-semibold text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    ðŸ“Š BÃ¡o cÃ¡o ká»¹ nÄƒng
                                </h2>
                            </div>
                            {Object.keys(groupIdToName).length > 1 && (
                                <div className="dashboard-group-filter" style={{ marginBottom: '12px' }}>
                                    <button
                                        className={`dashboard-group-filter-btn${selectedGroupFilter === 'all' ? ' active' : ''}`}
                                        onClick={() => setSelectedGroupFilter('all')}
                                    >
                                        Táº¥t cáº£
                                    </button>
                                    {Object.entries(groupIdToName).map(([gid, gname]) => (
                                        <button
                                            key={gid}
                                            className={`dashboard-group-filter-btn${selectedGroupFilter === gid ? ' active' : ''}`}
                                            onClick={() => setSelectedGroupFilter(gid)}
                                        >
                                            {gname}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {filteredSkillReports.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--bg-glass-card)', borderRadius: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', fontSize: '0.95rem' }}>
                                    KhÃ´ng cÃ³ bÃ¡o cÃ¡o ká»¹ nÄƒng cho lá»›p nÃ y.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {filteredSkillReports.slice(0, 3).map(report => {
                                        const dateLabel = report.startDate && report.endDate
                                            ? `${report.startDate} â†’ ${report.endDate}`
                                            : (report.sentAt?.toDate ? report.sentAt.toDate().toLocaleDateString('vi-VN') : 'Gáº§n Ä‘Ã¢y');
                                        const reportGroupName = groupIdToName[report.groupId];
                                        const reportTitle = report.periodLabel || 'ÄÃ¡nh giÃ¡ ká»¹ nÄƒng';
                                        return (
                                            <div
                                                key={report.id}
                                                className="glass-card"
                                                style={{ cursor: 'pointer', animationDelay: '0s', '--item-color': '#8b5cf6', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', overflow: 'hidden', animation: 'slideUp var(--transition-slow) ease both' }}
                                                onClick={() => setViewingSkillReport(viewingSkillReport?.id === report.id ? null : report)}
                                            >
                                                <div className="dashboard-action-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                                                    <Sparkles size={28} />
                                                </div>
                                                <div className="dashboard-action-info">
                                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        {reportGroupName && Object.keys(groupIdToName).length > 1 && (
                                                            <span className="dashboard-group-chip">
                                                                <Users size={11} />
                                                                {reportGroupName}
                                                            </span>
                                                        )}
                                                        {reportTitle}
                                                    </h3>
                                                    <p>{dateLabel}</p>
                                                </div>
                                                <span className="dashboard-action-arrow">â†’</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    );
                })()}

                {/* Skill Report Viewer Modal */}
                {viewingSkillReport && (
                    <div className="settings-modal-backdrop" onClick={() => setViewingSkillReport(null)}>
                        <div className="settings-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '80vh', overflow: 'auto' }}>
                            <button className="settings-modal-close" onClick={() => setViewingSkillReport(null)}>
                                <X size={20} />
                            </button>
                            <div className="settings-modal-header">
                                <h3>ðŸ“Š BÃ¡o cÃ¡o ká»¹ nÄƒng</h3>
                            </div>

                            {viewingSkillReport.skillData && (() => {
                                const SKILL_LABELS = { listening: 'Listening', speaking: 'Speaking', reading: 'Reading', writing: 'Writing', grammar: 'Grammar', vocabulary: 'Vocabulary' };
                                const radarData = Object.entries(viewingSkillReport.skillData.skills).map(([key, val]) => ({
                                    skill: SKILL_LABELS[key] || key,
                                    score: val.score ?? 0,
                                    fullMark: 100,
                                }));
                                return (
                                    <div style={{ marginBottom: '16px' }}>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                                <PolarGrid stroke="#e2e8f0" />
                                                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                <Radar name="Ká»¹ nÄƒng" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                                                <Tooltip formatter={(val) => [`${val}/100`, 'Äiá»ƒm']} />
                                            </RadarChart>
                                        </ResponsiveContainer>

                                        {/* Skill score summary */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
                                            {Object.entries(viewingSkillReport.skillData.skills).map(([key, val]) => {
                                                const EMOJIS = { listening: 'ðŸŽ§', speaking: 'ðŸ—£ï¸', reading: 'ðŸ“–', writing: 'âœï¸', grammar: 'ðŸ“', vocabulary: 'ðŸ“š' };
                                                const color = val.score === null ? '#cbd5e1' : val.score >= 70 ? '#16a34a' : val.score >= 50 ? '#ca8a04' : '#ef4444';
                                                return (
                                                    <div key={key} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                                        <span style={{ fontSize: '1rem' }}>{EMOJIS[key]}</span>
                                                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{SKILL_LABELS[key]}</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 900, color }}>{val.score ?? 'â€”'}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Red flags in report */}
                            {viewingSkillReport.redFlagsSummary?.length > 0 && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: '12px', marginBottom: '12px',
                                    background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
                                    border: '1.5px solid #fecaca',
                                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
                                }}>
                                    <span style={{ fontSize: '1rem' }}>ðŸš©</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>
                                            Cá» Ä‘á» ({viewingSkillReport.redFlagsSummary.length})
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {viewingSkillReport.redFlagsSummary.map((f, i) => (
                                                <span key={i} style={{
                                                    padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
                                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                                                }}>
                                                    {f.violationLabel || f.violationType}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {viewingSkillReport.aiReport?.overallLevel && (
                                <div style={{ padding: '8px 12px', background: '#eef2ff', borderRadius: '10px', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 700, color: '#4f46e5' }}>
                                    TrÃ¬nh Ä‘á»™ Æ°á»›c tÃ­nh: {viewingSkillReport.aiReport.overallLevel}
                                </div>
                            )}

                            <div className="sp-report-html" style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '14px', borderRadius: '12px' }}
                                dangerouslySetInnerHTML={{ __html: (viewingSkillReport.finalReport || viewingSkillReport.aiReport?.detailedReport || 'KhÃ´ng cÃ³ ná»™i dung.').replace(/&nbsp;/g, ' ') }}
                            />
                        </div>
                    </div>
                )}

            </main >

            {/* Progress Modal */}
            <ProgressModal isOpen={isProgressOpen} onClose={() => setIsProgressOpen(false)} redFlags={studentRedFlags.filter(f => !f.removed)} groupIdToName={groupIdToName} />

            {/* Streak Milestone Celebration Popup */}
            {/* Priority 3: Milestone Celebration (only when higher-priority popups are dismissed) */}
            {!showExamAlert && !showRatingPopup && celebrationMilestone && (
                <div className="milestone-celebration-backdrop" onClick={() => setCelebrationMilestone(null)}>
                    <div className="milestone-celebration-modal" onClick={e => e.stopPropagation()}>
                        {/* Confetti particles */}
                        <div className="milestone-confetti">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="milestone-confetti-piece" style={{
                                    '--delay': `${Math.random() * 2}s`,
                                    '--x': `${Math.random() * 100}%`,
                                    '--rotation': `${Math.random() * 360}deg`,
                                    '--color': ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899'][i % 6]
                                }} />
                            ))}
                        </div>
                        <div className="milestone-celebration-emoji">{celebrationMilestone.emoji}</div>
                        <h2 className="milestone-celebration-title" style={{ color: celebrationMilestone.color }}>
                            {celebrationMilestone.title}
                        </h2>
                        <p className="milestone-celebration-subtitle">"{celebrationMilestone.subtitle}"</p>
                        <p className="milestone-celebration-streak">
                            ðŸ”¥ {currentStreak} ngÃ y streak liÃªn tá»¥c!
                        </p>
                        {celebrationMilestone.themeName && (
                            <p style={{
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: celebrationMilestone.color,
                                background: `${celebrationMilestone.color}15`,
                                border: `1.5px solid ${celebrationMilestone.color}40`,
                                padding: '10px 16px',
                                borderRadius: '14px',
                                margin: '0 0 8px',
                                textAlign: 'center',
                            }}>
                                ðŸŽ¨ Báº¡n vá»«a má»Ÿ khoÃ¡: <strong>{celebrationMilestone.themeName}</strong>
                            </p>
                        )}
                        {(() => {
                            const nextMs = getNextMilestone(currentStreak);
                            if (!nextMs) return null;
                            const daysLeft = nextMs.threshold - currentStreak;
                            return (
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary, #64748b)',
                                    margin: '4px 0 8px',
                                    textAlign: 'center',
                                    lineHeight: 1.5,
                                }}>
                                    Má»‘c tiáº¿p theo: <strong style={{ color: nextMs.color }}>{nextMs.emoji} {nextMs.title}</strong> â€” cÃ²n {daysLeft} ngÃ y{nextMs.themeName ? ` (má»Ÿ khoÃ¡ ${nextMs.themeName})` : ''}
                                </p>
                            );
                        })()}
                        <button className="milestone-celebration-btn" onClick={() => setCelebrationMilestone(null)}
                            style={{ background: `linear-gradient(135deg, ${celebrationMilestone.color}, ${celebrationMilestone.color}dd)` }}>
                            Tuyá»‡t vá»i! ðŸŽ‰
                        </button>
                    </div>
                </div>
            )}

            {/* Word Selection Modal for Vocab Assignments */}
            {wordSelectData && (
                <div className="topic-modal-backdrop" onClick={() => setWordSelectData(null)}>
                    <div className="topic-wordlist-panel" onClick={(e) => e.stopPropagation()}>
                        {/* Panel Header */}
                        <div className="wordlist-header">
                            <div className="wordlist-header-info">
                                <span className="wordlist-header-icon" style={{ background: `${wordSelectData.color}20` }}>
                                    {wordSelectData.icon}
                                </span>
                                <div>
                                    <h2 className="wordlist-title">{wordSelectData.topicName}</h2>
                                    <p className="wordlist-subtitle">
                                        {selectedWordsForAssignment.size} tá»« Ä‘Æ°á»£c chá»n
                                    </p>
                                </div>
                            </div>
                            <button className="topic-modal-close" onClick={() => setWordSelectData(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="wordlist-actions">
                            <button className="wordlist-action-btn" onClick={wsSelectAllUnlearned}>
                                <CheckCheck size={14} />
                                ChÆ°a hoÃ n thÃ nh
                            </button>
                            <button className="wordlist-action-btn" onClick={wsSelectAll}>
                                <Check size={14} />
                                Táº¥t cáº£
                            </button>
                            <button className="wordlist-action-btn wordlist-action-btn--danger" onClick={wsDeselectAll}>
                                <XCircle size={14} />
                                Bá» chá»n
                            </button>
                        </div>

                        {/* Word List */}
                        <div className="wordlist-scroll">
                            {wordSelectData.words.map((w, idx) => {
                                const isLearned = wordSelectData.learnedWords.has(w.word);
                                const isChecked = selectedWordsForAssignment.has(w.word);
                                const wordProgress = wordSelectData.progressMap[w.word];
                                const stepsCompleted = wordProgress?.stepsCompleted ?? 0;
                                return (
                                    <div
                                        key={w.word}
                                        role="button"
                                        tabIndex={0}
                                        className={`wordlist-item ${isChecked ? 'wordlist-item--selected' : ''} ${isLearned ? 'wordlist-item--learned' : ''}`}
                                        onClick={() => toggleWordForAssignment(w.word)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWordForAssignment(w.word); } }}
                                        style={{ animationDelay: `${idx * 0.03}s` }}
                                    >
                                        <div className={`wordlist-checkbox ${isChecked ? 'wordlist-checkbox--checked' : ''}`}>
                                            {isChecked && <Check size={14} />}
                                        </div>
                                        <div className="wordlist-item-content">
                                            <div className="wordlist-item-top">
                                                <span className="wordlist-item-word">{w.word}</span>
                                                {isLearned && (
                                                    <span className="wordlist-learned-badge">âœ“ ÄÃ£ há»c</span>
                                                )}
                                            </div>
                                            <span className="wordlist-item-meaning">{w.vietnameseMeaning}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
                                            <button
                                                className={`wordlist-bookmark-btn ${wordSelectData.savedWordsStatus[w.word] ? 'is-saved' : ''}`}
                                                onClick={(e) => handleWsToggleSave(e, w)}
                                                title={wordSelectData.savedWordsStatus[w.word] ? "Bá» lÆ°u tá»«" : "LÆ°u tá»« vá»±ng"}
                                            >
                                                <Heart size={16} fill={wordSelectData.savedWordsStatus[w.word] ? "currentColor" : "none"} className={wordSelectData.savedWordsStatus[w.word] ? "text-error" : ""} />
                                            </button>
                                            {/* 6 progress dots */}
                                            <div className="wordlist-progress-dots">
                                                {Array.from({ length: 6 }, (_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`wordlist-progress-dot ${i < stepsCompleted ? 'wordlist-progress-dot--filled' : ''}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sticky Start Button */}
                        <div className="wordlist-footer">
                            <button
                                className="btn btn-primary btn-lg btn-full topic-modal-start"
                                onClick={handleConfirmWordSelect}
                                disabled={selectedWordsForAssignment.size === 0}
                            >
                                {selectedWordsForAssignment.size > 0 ? `ðŸš€ Báº¯t Ä‘áº§u há»c ${selectedWordsForAssignment.size} tá»«` : 'ðŸš€ Báº¯t Ä‘áº§u há»c 0 tá»«'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading overlay for word selection */}
            {loadingWordSelect && (
                <div className="topic-modal-backdrop" style={{ zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <Loader size={32} className="spin" style={{ margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>Äang táº£i tá»« vá»±ng...</p>
                    </div>
                </div>
            )}

            {/* Multi-purpose FAB */}
            <div className="dashboard-fab-wrapper">
                <button
                    className={`dashboard-fab ${isCreateMenuOpen ? 'is-open' : ''}`}
                    onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                >
                    <Plus size={28} />
                </button>

                {isCreateMenuOpen && (
                    <>
                        <div className="dashboard-fab-overlay" onClick={() => setIsCreateMenuOpen(false)} />
                        <div className="dashboard-fab-menu">
                            {createActions.map(action => (
                                <button
                                    key={action.id}
                                    className="dashboard-fab-menu-item"
                                    onClick={() => { setIsCreateMenuOpen(false); navigate(action.path); }}
                                >
                                    <div className="dashboard-fab-menu-icon" style={{ background: `${action.color}20`, color: action.color }}>
                                        <action.icon size={22} />
                                    </div>
                                    <div className="dashboard-fab-menu-info">
                                        <span className="dashboard-fab-menu-title">
                                            {action.title}
                                            {action.isAI && (
                                                <span className="ai-badge-inline">
                                                    <Sparkles size={10} /> AI
                                                </span>
                                            )}
                                        </span>
                                        <span className="dashboard-fab-menu-desc">{action.description}</span>
                                    </div>
                                </button>
                            ))}
                            {/* Anonymous Feedback option â€” always show for students */}
                            {!(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'staff') && (
                                <button
                                    className="dashboard-fab-menu-item"
                                    onClick={() => { setIsCreateMenuOpen(false); setShowFeedbackModal(true); }}
                                >
                                    <div className="dashboard-fab-menu-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                                        <MessageSquareText size={22} />
                                    </div>
                                    <div className="dashboard-fab-menu-info">
                                        <span className="dashboard-fab-menu-title">GÃ³p Ã½ áº©n danh</span>
                                        <span className="dashboard-fab-menu-desc">Gá»­i pháº£n há»“i cho ban quáº£n lÃ½</span>
                                    </div>
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Feedback Modal */}
            {showFeedbackModal && (
                <div className="topic-modal-backdrop" onClick={closeFeedbackModal} style={{ zIndex: 2500 }}>
                    <div className="glass-card" onClick={e => e.stopPropagation()} style={{
                        maxWidth: '480px', width: '92%', margin: 'auto', padding: '28px 24px',
                        borderRadius: 'var(--radius-xl)', background: 'var(--bg-primary)',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                    }}>
                        {feedbackSuccess ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>âœ…</div>
                                <h3 style={{ color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>ÄÃ£ gá»­i thÃ nh cÃ´ng!</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cáº£m Æ¡n báº¡n Ä‘Ã£ gÃ³p Ã½ â¤ï¸</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <MessageSquareText size={22} color="#7c3aed" /> GÃ³p Ã½ áº©n danh
                                    </h3>
                                    <button onClick={closeFeedbackModal} style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
                                        borderRadius: '10px', color: 'var(--text-secondary)',
                                    }}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                    Pháº£n há»“i sáº½ Ä‘Æ°á»£c gá»­i áº©n danh Ä‘áº¿n ban quáº£n lÃ½. HÃ£y chia sáº» Ã½ kiáº¿n tháº­t lÃ²ng nhÃ©!
                                </p>

                                {/* Category Selection */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>PhÃ¢n loáº¡i</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {FEEDBACK_CATEGORIES.map(c => (
                                            <button
                                                key={c.value}
                                                onClick={() => setFeedbackCategory(c.value)}
                                                style={{
                                                    padding: '8px 14px', borderRadius: '12px', fontWeight: 600,
                                                    fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                                                    background: feedbackCategory === c.value ? c.bg : 'var(--bg-secondary)',
                                                    color: feedbackCategory === c.value ? c.color : 'var(--text-secondary)',
                                                    border: `2px solid ${feedbackCategory === c.value ? c.color : 'transparent'}`,
                                                }}
                                            >
                                                {c.emoji} {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message Input */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Ná»™i dung</label>
                                    <textarea
                                        value={feedbackMessage}
                                        onChange={e => setFeedbackMessage(e.target.value)}
                                        placeholder="Viáº¿t ná»™i dung gÃ³p Ã½ táº¡i Ä‘Ã¢y..."
                                        rows={4}
                                        style={{
                                            width: '100%', padding: '14px 16px', border: '1.5px solid var(--border-color)',
                                            borderRadius: '14px', fontSize: '0.92rem', outline: 'none', resize: 'vertical',
                                            lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box',
                                            background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ảnh đính kèm</label>
                                    </div>

                                    <input
                                        ref={feedbackImageInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFeedbackImageSelected}
                                        style={{ display: 'none' }}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => feedbackImageInputRef.current?.click()}
                                        disabled={feedbackSending || feedbackPreparingImage}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '14px',
                                            border: '1.5px dashed #c4b5fd',
                                            background: '#f5f3ff',
                                            color: '#6d28d9',
                                            fontSize: '0.88rem',
                                            fontWeight: 700,
                                            cursor: feedbackSending || feedbackPreparingImage ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            opacity: feedbackSending || feedbackPreparingImage ? 0.6 : 1,
                                        }}
                                    >
                                        {feedbackPreparingImage ? (
                                            <><Loader size={16} className="spin" /> Đang xử lý ảnh...</>
                                        ) : (
                                            <><Paperclip size={16} /> Chọn ảnh để đính kèm</>
                                        )}
                                    </button>

                                    {feedbackImageError && (
                                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#dc2626', lineHeight: 1.5 }}>
                                            {feedbackImageError}
                                        </p>
                                    )}

                                    {feedbackImagePreviewUrl && (
                                        <div style={{
                                            marginTop: '12px',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            background: 'var(--bg-primary)',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                padding: '10px 12px',
                                                borderBottom: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    <ImageIcon size={15} color="#7c3aed" />
                                                    <span style={{
                                                        fontSize: '0.8rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}>
                                                        {feedbackImageName || 'Ảnh đính kèm'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={clearFeedbackImage}
                                                    disabled={feedbackSending}
                                                    style={{
                                                        border: 'none',
                                                        background: 'none',
                                                        color: '#ef4444',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: feedbackSending ? 'not-allowed' : 'pointer',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    Xóa ảnh
                                                </button>
                                            </div>
                                            <img
                                                src={feedbackImagePreviewUrl}
                                                alt={feedbackImageName || 'Ảnh góp ý'}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    maxHeight: '260px',
                                                    objectFit: 'contain',
                                                    background: '#ffffff',
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Send Button */}
                                <button
                                    onClick={handleSendFeedback}
                                    disabled={!feedbackMessage.trim() || feedbackSending || feedbackPreparingImage}
                                    style={{
                                        width: '100%', padding: '14px', border: 'none', borderRadius: '14px',
                                        background: !feedbackMessage.trim() || feedbackPreparingImage ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                        color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: !feedbackMessage.trim() || feedbackPreparingImage ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s', opacity: feedbackSending ? 0.7 : 1,
                                    }}
                                >
                                    {feedbackSending ? (
                                        <><Loader size={18} className="spin" /> Äang gá»­i...</>
                                    ) : (
                                        <><Send size={18} /> Gá»­i pháº£n há»“i</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
