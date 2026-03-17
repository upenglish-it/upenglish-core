import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getExam, getExamQuestions, getExamSubmission, saveExamSubmission, gradeExamSubmission, getExamAssignment, uploadAudioAnswer } from '../services/examService';
import { useAuth } from '../contexts/AuthContext';
import { Clock, ChevronRight, ChevronLeft, Send, AlertTriangle, Check } from 'lucide-react';
import { evaluateAudioAnswer } from '../services/aiService';
import './TakeExamPage.css';
import ConfirmModal from '../components/common/ConfirmModal';
import { renderFormattedText } from '../utils/textFormatting';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import { useAntiCopy } from '../hooks/useAntiCopy';
const hasContent = (html) => {
    if (!html) return false;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    if (stripped.length > 0) return true;
    return /<(img|iframe|video|audio|embed|object)/i.test(html);
};

const parseContextHtml = (html) => {
    if (!html) return '';
    const regex = /<iframe[^>]*>.*?<\/iframe>|<a[^>]*href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^"]*)"[^>]*>.*?<\/a>|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^\s<"]*)/gi;
    let parsed = html.replace(regex, (match, aUrl, aVideoId, rawUrl, rawVideoId) => {
        if (match.toLowerCase().startsWith('<iframe')) return match;
        const videoId = aVideoId || rawVideoId;
        if (videoId) {
            return `<iframe class="ql-video" style="width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; border: none; height: auto;" src="https://www.youtube.com/embed/${videoId}?showinfo=0" frameborder="0" allowfullscreen></iframe>`;
        }
        return match;
    });
    return parsed.replace(/&nbsp;/g, ' ');
};

const sanitizeHtml = (html, isFillInBlank = false) => {
    if (!html) return '';
    let cleaned = html.replace(/&nbsp;/g, ' ').replace(/<p><\/p>/g, '');
    if (isFillInBlank) {
        cleaned = cleaned
            .replace(/<p><br><\/p>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<div[^>]*>/gi, '');
    }
    return cleaned.trim();
};

const MemoizedContextRender = memo(({ htmlContent }) => {
    if (!htmlContent) return null;
    return (
        <div className="exam-context">
            <div className="exam-context-content ql-editor" dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }} />
        </div>
    );
});

export default function TakeExamPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    useAntiCopy();

    const assignmentId = searchParams.get('assignmentId');
    const examId = searchParams.get('examId');
    const variationSeed = parseInt(searchParams.get('seed') || '0', 10);

    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const answersRef = useRef(answers);
    const [timeLeft, setTimeLeft] = useState(null);
    const [confirmSubmitSection, setConfirmSubmitSection] = useState(false);
    const [confirmSubmitAll, setConfirmSubmitAll] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [assignment, setAssignment] = useState(null);
    const [globalTimeLeft, setGlobalTimeLeft] = useState(null);
    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [showStartPopup, setShowStartPopup] = useState(false);
    const timerRef = useRef(null);
    const globalTimerRef = useRef(null);

    // Section-level timer state
    const [sectionTimers, setSectionTimers] = useState({}); // { sectionId: remainingSeconds }
    const sectionTimerRef = useRef(null);
    const [sectionExpired, setSectionExpired] = useState({}); // { sectionId: true }

    // Question-level timer state
    const [questionTimers, setQuestionTimers] = useState({}); // { questionId: remainingSeconds }
    const questionTimerRef = useRef(null);
    const [questionExpired, setQuestionExpired] = useState({}); // { questionId: true }
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

    // Toast for auto-advance notifications
    const [toastMessage, setToastMessage] = useState(null);
    const toastTimerRef = useRef(null);

    // Audio recording state (per-question, stored in refs)
    const examAudioBlobsRef = useRef({}); // { questionId: Blob }
    const examMediaRecordersRef = useRef({}); // { questionId: MediaRecorder }
    const examAudioChunksRef = useRef({}); // { questionId: [] }
    const audioProcessingRef = useRef({}); // { questionId: Promise } — tracks in-flight audio processing
    const [recordingQuestionId, setRecordingQuestionId] = useState(null);
    const [gradingAudioQuestionId, setGradingAudioQuestionId] = useState(null);

    // Tab switch detection
    const tabSwitchCountRef = useRef(0);
    const tabWarningShownRef = useRef(false);
    const [tabWarningVisible, setTabWarningVisible] = useState(false);

    // Auto-dismiss tab warning banner after 5 seconds
    useEffect(() => {
        if (!tabWarningVisible) return;
        const timer = setTimeout(() => setTabWarningVisible(false), 5000);
        return () => clearTimeout(timer);
    }, [tabWarningVisible]);

    const currentSectionSafeContext = exam?.sections?.[currentSectionIdx]?.context;
    const parsedContext = useMemo(() => {
        return parseContextHtml(currentSectionSafeContext);
    }, [currentSectionSafeContext]);

    useEffect(() => {
        loadData();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (globalTimerRef.current) clearInterval(globalTimerRef.current);
            if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
            if (questionTimerRef.current) clearInterval(questionTimerRef.current);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [examData, questionsData, assignmentData] = await Promise.all([
                getExam(examId),
                getExamQuestions(examId),
                getExamAssignment(assignmentId)
            ]);
            setExam(examData);
            setQuestions(questionsData);
            setAssignment(assignmentData);

            // Check for existing submission
            let sub = await getExamSubmission(assignmentId, user?.uid);

            // Check if deadline has passed — use student-specific deadline if available
            const now = new Date();
            const studentSpecificDeadline = assignmentData?.studentDeadlines?.[user?.uid];
            const dueDate = studentSpecificDeadline
                ? (studentSpecificDeadline.toDate ? studentSpecificDeadline.toDate() : new Date(studentSpecificDeadline))
                : (assignmentData?.dueDate ? (assignmentData.dueDate.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate)) : null);
            if (dueDate && dueDate < now) {
                if (sub && sub.status === 'in_progress') {
                    // Force submit existing work
                    await saveExamSubmission({
                        id: sub.id, answers: sub.answers || {},
                        status: 'submitted',
                        submittedAt: new Date().toISOString()
                    });
                    gradeExamSubmission(sub.id, { ...sub, answers: sub.answers || {} }, questionsData, examData?.sections || [], assignmentData?.teacherTitle || '', assignmentData?.studentTitle || '').catch(e => console.error(e));
                    setLoading(false);
                    setInfoModal({
                        isOpen: true,
                        title: '⏰ Hết hạn nộp bài',
                        message: 'Hạn chót bài thi đã qua! Hệ thống đã tự động nộp bài của bạn.',
                        onConfirm: () => navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`)
                    });
                    return;
                }

                setLoading(false);
                setInfoModal({
                    isOpen: true,
                    title: 'Hết hạn',
                    message: 'Rất tiếc, bài tập và kiểm tra này đã hết hạn!',
                    onConfirm: () => navigate(-1)
                });
                return;
            }

            if (!sub) {
                setShowStartPopup(true);
            } else {
                if (sub.status === 'in_progress' && sub.examEndTime) {
                    const endTime = sub.examEndTime?.toDate ? sub.examEndTime.toDate() : new Date(sub.examEndTime);
                    if (endTime <= now) {
                        // Time has expired — force submit client-side (in case Cloud Function hasn't run yet)
                        await saveExamSubmission({
                            id: sub.id, answers: sub.answers || {},
                            status: 'submitted',
                            submittedAt: new Date().toISOString(),
                            autoSubmitted: true
                        });
                        gradeExamSubmission(sub.id, { ...sub, answers: sub.answers || {} }, questionsData, examData?.sections || [], assignmentData?.teacherTitle || '', assignmentData?.studentTitle || '').catch(e => console.error('Auto-grade failed:', e));
                        setLoading(false);
                        setInfoModal({
                            isOpen: true,
                            title: '⏰ Hết giờ làm bài!',
                            message: 'Thời gian làm bài đã hết. Hệ thống đã tự động nộp bài của bạn.',
                            onConfirm: () => navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`)
                        });
                        return;
                    }
                }

                // Also check if submission was already auto-submitted by Cloud Function
                if (sub.status === 'submitted' || sub.status === 'graded') {
                    setLoading(false);
                    navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`);
                    return;
                }

                setSubmission(sub);
                setAnswers(sub.answers || {});
                // Restore tab switch count from saved submission
                tabSwitchCountRef.current = sub.tabSwitchCount || 0;

                // Timer — compute remaining time from examEndTime
                const timingMode = examData.timingMode || 'exam';
                if (timingMode === 'exam') {
                    if (sub.examEndTime) {
                        const endTime = sub.examEndTime?.toDate ? sub.examEndTime.toDate() : new Date(sub.examEndTime);
                        const remaining = Math.floor((endTime - new Date()) / 1000);
                        setTimeLeft(Math.max(0, remaining));
                    } else {
                        // Legacy fallback for submissions without examEndTime
                        const limitMinutes = examData.timeLimitMinutes || 60;
                        if (limitMinutes) {
                            const startTime = sub.startedAt?.toDate ? sub.startedAt.toDate() : new Date(sub.startedAt);
                            const endTime = new Date(startTime.getTime() + limitMinutes * 60 * 1000);
                            const remaining = Math.floor((endTime - new Date()) / 1000);
                            setTimeLeft(remaining);
                        }
                    }
                } else if (timingMode === 'section') {
                    // Restore section timers from submission or initialize
                    const savedSTimers = sub.sectionTimers || {};
                    const savedSExpired = sub.sectionExpired || {};
                    const sections = examData.sections || [];
                    const initTimers = {};
                    const initExpired = {};
                    sections.forEach(s => {
                        if (savedSExpired[s.id]) {
                            initExpired[s.id] = true;
                            initTimers[s.id] = 0;
                        } else if (savedSTimers[s.id] !== undefined) {
                            initTimers[s.id] = savedSTimers[s.id];
                        } else {
                            initTimers[s.id] = (s.timeLimitMinutes || 10) * 60;
                        }
                    });
                    setSectionTimers(initTimers);
                    setSectionExpired(initExpired);
                } else if (timingMode === 'question') {
                    // Restore question timers from submission or initialize
                    const savedQTimers = sub.questionTimers || {};
                    const savedQExpired = sub.questionExpired || {};
                    const initTimers = {};
                    const initExpired = {};
                    questionsData.forEach(q => {
                        if (savedQExpired[q.id]) {
                            initExpired[q.id] = true;
                            initTimers[q.id] = 0;
                        } else if (savedQTimers[q.id] !== undefined) {
                            initTimers[q.id] = savedQTimers[q.id];
                        } else {
                            initTimers[q.id] = q.timeLimitSeconds || 60;
                        }
                    });
                    setQuestionTimers(initTimers);
                    setQuestionExpired(initExpired);
                }

                // Absolute deadline timer
                if (dueDate) {
                    const globalRemaining = Math.max(0, Math.floor((dueDate - new Date()) / 1000));
                    if (globalRemaining <= 0) {
                        setGlobalTimeLeft(0);
                    } else {
                        setGlobalTimeLeft(globalRemaining);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading exam:', error);
        }
        setLoading(false);
    }

    // Global Deadline countdown
    useEffect(() => {
        if (globalTimeLeft === null) return;
        if (globalTimeLeft <= 0) {
            handleSubmitAll(true);
            return;
        }
        globalTimerRef.current = setInterval(() => {
            setGlobalTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(globalTimerRef.current);
                    handleSubmitAll(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(globalTimerRef.current);
    }, [globalTimeLeft]);

    // Timer countdown
    useEffect(() => {
        if (timeLeft === null) return;
        if (timeLeft <= 0) {
            handleSubmitAll(true);
            return;
        }
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmitAll(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft]);

    // Toast helper
    function showToast(msg) {
        setToastMessage(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    }

    // Section timer countdown (only for section timing mode)
    useEffect(() => {
        if ((exam?.timingMode || 'exam') !== 'section') return;
        if (!exam?.sections?.length) return;
        const currentSid = exam.sections[currentSectionIdx]?.id;
        if (!currentSid || sectionExpired[currentSid]) return;
        if (sectionTimers[currentSid] === undefined) return;
        if (sectionTimers[currentSid] <= 0) {
            // Section just expired
            setSectionExpired(prev => ({ ...prev, [currentSid]: true }));
            // Auto-advance
            const sections = exam.sections || [];
            const nextIdx = sections.findIndex((s, i) => i > currentSectionIdx && !sectionExpired[s.id]);
            if (nextIdx >= 0) {
                showToast(`⏰ Hết giờ section "${sections[currentSectionIdx]?.title}"! Chuyển sang section tiếp theo.`);
                setCurrentSectionIdx(nextIdx);
                window.scrollTo(0, 0);
            } else {
                // All sections expired → auto submit
                handleSubmitAll(true);
            }
            return;
        }
        if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
        sectionTimerRef.current = setInterval(() => {
            setSectionTimers(prev => {
                const current = prev[currentSid];
                if (current <= 1) {
                    clearInterval(sectionTimerRef.current);
                    return { ...prev, [currentSid]: 0 };
                }
                return { ...prev, [currentSid]: current - 1 };
            });
        }, 1000);
        return () => clearInterval(sectionTimerRef.current);
    }, [currentSectionIdx, sectionTimers[exam?.sections?.[currentSectionIdx]?.id], sectionExpired, exam?.timingMode]);

    // Question timer countdown (only for question timing mode)
    useEffect(() => {
        if ((exam?.timingMode || 'exam') !== 'question') return;
        const sections = exam?.sections || [];
        const currentSid = sections[currentSectionIdx]?.id;
        if (!currentSid) return;
        const sqQuestions = questions.filter(q => q.sectionId === currentSid).sort((a, b) => (a.order || 0) - (b.order || 0));
        const currentQ = sqQuestions[currentQuestionIdx];
        if (!currentQ) return;
        const qId = currentQ.id;
        if (questionExpired[qId]) return;
        if (questionTimers[qId] === undefined) return;
        if (questionTimers[qId] <= 0) {
            // Question just expired
            setQuestionExpired(prev => ({ ...prev, [qId]: true }));
            // Auto-advance to next non-expired question
            let nextQIdx = -1;
            for (let i = currentQuestionIdx + 1; i < sqQuestions.length; i++) {
                if (!questionExpired[sqQuestions[i].id]) { nextQIdx = i; break; }
            }
            if (nextQIdx >= 0) {
                showToast(`⏰ Hết giờ câu ${currentQuestionIdx + 1}! Chuyển sang câu tiếp theo.`);
                setCurrentQuestionIdx(nextQIdx);
                window.scrollTo(0, 0);
            } else {
                // Check next sections
                let found = false;
                for (let si = currentSectionIdx + 1; si < sections.length; si++) {
                    const nextSQ = questions.filter(q => q.sectionId === sections[si].id).sort((a, b) => (a.order || 0) - (b.order || 0));
                    const nextAvailQ = nextSQ.findIndex(q => !questionExpired[q.id]);
                    if (nextAvailQ >= 0) {
                        showToast(`⏰ Hết giờ! Chuyển sang section tiếp theo.`);
                        setCurrentSectionIdx(si);
                        setCurrentQuestionIdx(nextAvailQ);
                        window.scrollTo(0, 0);
                        found = true;
                        break;
                    }
                }
                if (!found) handleSubmitAll(true);
            }
            return;
        }
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        questionTimerRef.current = setInterval(() => {
            setQuestionTimers(prev => {
                const current = prev[qId];
                if (current <= 1) {
                    clearInterval(questionTimerRef.current);
                    return { ...prev, [qId]: 0 };
                }
                return { ...prev, [qId]: current - 1 };
            });
        }, 1000);
        return () => clearInterval(questionTimerRef.current);
    }, [currentSectionIdx, currentQuestionIdx, questionTimers, questionExpired, exam?.timingMode]);

    async function handleStartExam() {
        setLoading(true);
        try {
            // Filter out orphan questions not belonging to any active section
            const validSectionIds = new Set((exam.sections || []).map(s => s.id));
            const validQuestions = questions.filter(q => q.sectionId && validSectionIds.has(q.sectionId));
            const variationMap = {};
            validQuestions.forEach(q => {
                // Only pick from valid (non-empty) variations
                const validIndices = (q.variations || []).map((v, i) => i).filter(i => {
                    const v = q.variations[i];
                    if (!v) return false;
                    // Check if variation has meaningful content
                    const hasText = v.text && v.text.replace(/<[^>]*>/g, '').trim().length > 0;
                    const hasOptions = Array.isArray(v.options) && v.options.some(o => o);
                    const hasPairs = Array.isArray(v.pairs) && v.pairs.length > 0;
                    const hasItems = Array.isArray(v.items) && v.items.length > 0;
                    return hasText || hasOptions || hasPairs || hasItems;
                });
                if (validIndices.length > 0) {
                    variationMap[q.id] = validIndices[variationSeed % validIndices.length];
                } else {
                    variationMap[q.id] = 0; // fallback to first
                }
            });
            // Compute examEndTime for server-side auto-submit
            const startedAtDate = new Date();
            const timingMode = exam.timingMode || 'exam';
            let totalSeconds = 0;
            if (timingMode === 'exam') {
                totalSeconds = (exam.timeLimitMinutes || 60) * 60;
            } else if (timingMode === 'section') {
                (exam.sections || []).forEach(s => { totalSeconds += (s.timeLimitMinutes || 10) * 60; });
            } else if (timingMode === 'question') {
                validQuestions.forEach(q => { totalSeconds += (q.timeLimitSeconds || 60); });
            }
            const examEndTime = new Date(startedAtDate.getTime() + totalSeconds * 1000);

            const newSubId = await saveExamSubmission({
                examId, assignmentId, studentId: user?.uid,
                status: 'in_progress',
                startedAt: startedAtDate.toISOString(),
                examEndTime,
                variationMap,
                answers: {},
                results: {},
                totalScore: null, maxTotalScore: null
            });
            const sub = { id: newSubId, status: 'in_progress', variationMap, answers: {}, startedAt: new Date().toISOString() };
            setSubmission(sub);
            setAnswers({});
            setShowStartPopup(false);

            if (timingMode === 'exam') {
                setTimeLeft(totalSeconds);
            } else if (timingMode === 'section') {
                const initTimers = {};
                (exam.sections || []).forEach(s => {
                    initTimers[s.id] = (s.timeLimitMinutes || 10) * 60;
                });
                setSectionTimers(initTimers);
                setSectionExpired({});
            } else if (timingMode === 'question') {
                const initTimers = {};
                validQuestions.forEach(q => {
                    initTimers[q.id] = q.timeLimitSeconds || 60;
                });
                setQuestionTimers(initTimers);
                setQuestionExpired({});
                setCurrentQuestionIdx(0);
            }

        } catch (error) {
            console.error('Error starting exam:', error);
            setInfoModal({
                isOpen: true,
                title: '❌ Có lỗi xảy ra',
                message: 'Không thể bắt đầu bài tập và kiểm tra. Vui lòng thử lại.',
                onConfirm: null
            });
        }
        setLoading(false);
    }

    function formatTime(seconds) {
        if (seconds === null) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function setAnswer(sectionId, questionId, answer) {
        const currentRef = answersRef.current;
        const updated = {
            ...currentRef,
            [sectionId]: {
                ...(currentRef[sectionId] || {}),
                [questionId]: { answer, submittedAt: new Date().toISOString() }
            }
        };
        answersRef.current = updated;
        setAnswers(updated);
    }

    // Auto-save: debounced 3s after each answer change + periodic backup every 30s
    const autoSaveTimerRef = useRef(null);
    useEffect(() => {
        if (!submission?.id) return;
        // Debounced save: 3 seconds after last answer change
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired });
            } catch (e) { console.error('Auto-save failed:', e); }
        }, 3000);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    }, [answers, submission?.id]);

    // Save answers on page unload (tab close / navigate away)
    useEffect(() => {
        if (!submission?.id) return;
        const handleBeforeUnload = () => {
            // Use sendBeacon for reliable save on unload (navigator.sendBeacon is fire-and-forget)
            // Fallback: synchronous save via answersRef
            try {
                const isTest = exam?.examType === 'test';
                saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired, ...(isTest ? { tabSwitchCount: tabSwitchCountRef.current } : {}) })
                    .catch(() => {});
            } catch (e) { /* ignore */ }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        // Also handle visibility change (mobile: switching apps) + tab switch tracking (tests only)
        const isTest = exam?.examType === 'test';
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && submission?.id) {
                // Increment tab switch count (only for tests)
                if (isTest) tabSwitchCountRef.current += 1;
                saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired, ...(isTest ? { tabSwitchCount: tabSwitchCountRef.current } : {}) })
                    .catch(() => {});
            } else if (document.visibilityState === 'visible' && submission?.id && isTest) {
                // Show warning banner once after 2+ switches (tests only)
                if (tabSwitchCountRef.current > 2 && !tabWarningShownRef.current) {
                    tabWarningShownRef.current = true;
                    setTabWarningVisible(true);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [submission?.id]);

    async function handleNextSection() {
        try {
            await saveExamSubmission({ id: submission.id, answers, sectionTimers, sectionExpired, questionTimers, questionExpired });
        } catch (e) { console.error(e); }
        setCurrentSectionIdx(prev => prev + 1);
        if ((exam.timingMode || 'exam') === 'question') setCurrentQuestionIdx(0);
        setConfirmSubmitSection(false);
        window.scrollTo(0, 0);
    }

    async function handleSubmitAll(forced = false) {
        setSubmitting(true);
        try {
            // If a recording is currently active, stop it so the audio is captured before submit
            if (recordingQuestionId && examMediaRecordersRef.current[recordingQuestionId]) {
                const activeRecorder = examMediaRecordersRef.current[recordingQuestionId];
                if (activeRecorder.state === 'recording' || activeRecorder.state === 'paused') {
                    activeRecorder.stop(); // triggers onstop → starts processing promise
                    setRecordingQuestionId(null);
                    // Give onstop a moment to fire and register the processing promise
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // Wait for any in-flight audio processing to complete
            const pendingAudio = Object.values(audioProcessingRef.current);
            if (pendingAudio.length > 0) {
                await Promise.allSettled(pendingAudio);
            }

            // Use ref to get the freshest answers (state might be stale after await)
            const freshAnswers = answersRef.current;

            await saveExamSubmission({
                id: submission.id, answers: freshAnswers,
                status: 'submitted',
                submittedAt: new Date().toISOString()
            });
            // Trigger AI grading in background
            gradeExamSubmission(submission.id, { ...submission, answers: freshAnswers }, questions, exam?.sections || [], assignment?.teacherTitle || '', assignment?.studentTitle || '')
                .catch(e => console.error('Grading error:', e));
            // Notify group teachers about submission
            if (assignment?.targetType === 'group' && assignment?.targetId) {
                import('../services/notificationService').then(({ createNotificationForGroupTeachers }) => {
                    createNotificationForGroupTeachers(assignment.targetId, {
                        type: 'exam_submitted',
                        title: '📩 Học viên nộp bài',
                        message: `${user?.displayName || user?.email || 'Học viên'} đã nộp bài "${exam?.name || 'Bài tập và Kiểm tra'}".`,
                        link: `/teacher/exam-submissions/${assignmentId}`
                    }).catch(e => console.error('Notification error:', e));
                }).catch(console.error);
            }

            if (forced) {
                setInfoModal({
                    isOpen: true,
                    title: '⏰ Hết giờ!',
                    message: 'Thời gian làm bài đã hết. Bài của bạn đã được tự động nộp.',
                    onConfirm: () => navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`)
                });
            } else {
                navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`);
            }
        } catch (error) {
            console.error('Submit error:', error);
        }
        setSubmitting(false);
        setConfirmSubmitAll(false);
    }

    if (loading) return (
        <div className="exam-loading"><div className="exam-loading-spinner"></div><p>Đang tải bài tập và kiểm tra...</p></div>
    );
    if (!exam) return (
        <div className="exam-loading"><p>Không tìm thấy bài tập và kiểm tra.</p></div>
    );
    if (showStartPopup) {
        return (
            <div className="exam-modal-overlay">
                <div className="exam-modal animate-slide-up" style={{ padding: '24px 20px', borderRadius: '24px', maxWidth: '400px', textAlign: 'center' }}>
                    <div style={{ width: '56px', height: '56px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#4f46e5' }}>
                        {exam.icon ? <span style={{ fontSize: '1.8rem' }}>{exam.icon}</span> : <Clock size={28} />}
                    </div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>{exam.name}</h2>

                    {/* Compact info rows */}
                    <div style={{ textAlign: 'left', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: exam.examType === 'test' ? '#fef2f2' : '#f5f3ff' }}>
                            <span style={{ fontSize: '0.95rem' }}>{exam.examType === 'test' ? '📝' : '📚'}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{exam.examType === 'test' ? 'Bài kiểm tra' : 'Bài tập'}</span>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: 'auto' }}>{questions.filter(q => (exam.sections || []).some(s => s.id === q.sectionId)).length} câu • {(exam.sections || []).length} section</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#fffbeb' }}>
                            <span style={{ fontSize: '0.95rem' }}>⏱️</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                                {(() => {
                                    const tm = exam.timingMode || 'exam';
                                    if (tm === 'exam') return `${exam.timeLimitMinutes || 60} phút • tự nộp khi hết giờ`;
                                    if (tm === 'section') return 'Giờ theo section • tự chuyển khi hết';
                                    return 'Giờ theo câu • tự chuyển khi hết';
                                })()}
                            </span>
                        </div>

                        {exam.examType === 'test' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#fef2f2' }}>
                                <span style={{ fontSize: '0.95rem' }}>👁️</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Ghi nhận khi rời trang</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f0fdf4' }}>
                            <span style={{ fontSize: '0.95rem' }}>🔒</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Chỉ có 1 lần làm bài duy nhất</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ padding: '14px', borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)' }}
                            onClick={handleStartExam}
                        >
                            Bắt đầu làm bài
                        </button>
                        <button
                            className="btn"
                            style={{ padding: '12px', borderRadius: '14px', fontWeight: 700, color: '#64748b', background: 'transparent', fontSize: '0.9rem' }}
                            onClick={() => navigate(-1)}
                        >
                            Thoát ra
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (submission?.status === 'submitted' || submission?.status === 'graded') {
        navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`);
        return null;
    }

    const sections = exam.sections || [];
    const timingMode = exam.timingMode || 'exam';
    const currentSection = sections[currentSectionIdx];
    const sectionQuestions = questions.filter(q => q.sectionId === currentSection?.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    const isLastSection = currentSectionIdx === sections.length - 1;
    const currentSectionAnswers = answers[currentSection?.id] || {};

    // For question mode: which question to show
    const currentQuestionForDisplay = timingMode === 'question' ? sectionQuestions[currentQuestionIdx] : null;

    // Compute active timer display
    const displayTimer = (() => {
        if (timingMode === 'exam') return timeLeft;
        if (timingMode === 'section' && currentSection) return sectionTimers[currentSection.id] ?? null;
        if (timingMode === 'question' && currentQuestionForDisplay) return questionTimers[currentQuestionForDisplay.id] ?? null;
        return null;
    })();

    // Can go back to previous section?
    const canGoPrevSection = (() => {
        if (currentSectionIdx <= 0) return false;
        if (timingMode === 'section') {
            const prevSid = sections[currentSectionIdx - 1]?.id;
            return prevSid && !sectionExpired[prevSid];
        }
        if (timingMode === 'question') {
            // Can go back to prev section if any question in that section is not expired
            const prevSid = sections[currentSectionIdx - 1]?.id;
            if (!prevSid) return false;
            const prevSQ = questions.filter(q => q.sectionId === prevSid);
            return prevSQ.some(q => !questionExpired[q.id]);
        }
        return true; // exam mode always allows
    })();

    // Can go to prev question? (question mode only)
    const canGoPrevQuestion = (() => {
        if (timingMode !== 'question') return false;
        if (currentQuestionIdx <= 0) return canGoPrevSection;
        const prevQ = sectionQuestions[currentQuestionIdx - 1];
        return prevQ && !questionExpired[prevQ.id];
    })();


    return (
        <div className="exam-page">
            {/* Toast notification */}
            {toastMessage && (
                <div style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000, padding: '12px 24px', borderRadius: '16px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s ease', maxWidth: '90vw', textAlign: 'center' }}>
                    {toastMessage}
                </div>
            )}
            {/* Tab switch warning banner */}
            {tabWarningVisible && (
                <div style={{
                    position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 10001,
                    padding: '8px 14px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#fff', fontWeight: 600, fontSize: '0.75rem',
                    boxShadow: '0 4px 16px rgba(220, 38, 38, 0.3)',
                    maxWidth: '92vw', textAlign: 'left',
                    animation: 'fadeIn 0.3s ease',
                    display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.3
                }}>
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>⚠️</span>
                    <span>Ghi nhận rời trang hơn 2 lần. GV sẽ được thông báo.</span>
                    <button onClick={() => setTabWarningVisible(false)} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px',
                        width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff', flexShrink: 0, marginLeft: '2px', fontSize: '0.8rem', lineHeight: 1
                    }}>✕</button>
                </div>
            )}
            {/* Top bar with timer */}
            <div className="exam-topbar">
                <div className="exam-topbar-left">
                    <span className="exam-title">
                        <span style={{ flexShrink: 0 }}>{exam.icon || '📋'}</span>
                        <span className="exam-title-text">{exam.name}</span>
                    </span>
                </div>
                <div className="exam-topbar-center">
                    <span className="exam-section-indicator">
                        {timingMode === 'question' ? (
                            `Câu ${currentQuestionIdx + 1}/${sectionQuestions.length} • Section ${currentSectionIdx + 1}/${sections.length}`
                        ) : (
                            `Section ${currentSectionIdx + 1}/${sections.length}`
                        )}
                    </span>
                </div>
                <div className="exam-topbar-right">
                    <div className={`exam-timer ${displayTimer !== null && displayTimer < (timingMode === 'question' ? 10 : 300) ? 'warning' : ''}`}>
                        <Clock size={16} />
                        <span>{formatTime(displayTimer)}</span>
                    </div>
                </div>
            </div>

            {/* Section header */}
            <div className="exam-section-header">
                <h2>{currentSection?.title || `Section ${currentSectionIdx + 1}`}</h2>
                <div className="exam-section-progress">
                    {Object.keys(currentSectionAnswers).length}/{sectionQuestions.length} câu đã trả lời
                </div>
            </div>

            {/* Context */}
            {hasContent(currentSection?.context) && (
                <MemoizedContextRender htmlContent={parsedContext} />
            )}
            {currentSection?.contextAudioUrl && (
                <div style={{ margin: '0 auto', maxWidth: '800px', padding: '12px 20px' }}>
                    <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
                        </div>
                        <audio controls src={currentSection.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                    </div>
                </div>
            )}


            {/* Questions */}
            <div className="exam-questions">
                {(timingMode === 'question' ? (currentQuestionForDisplay ? [currentQuestionForDisplay] : []) : sectionQuestions).map((q, idx) => {
                    const realIdx = timingMode === 'question' ? currentQuestionIdx : idx;
                    const varIdx = submission?.variationMap?.[q.id] || 0;
                    let variation = q.variations?.[varIdx];
                    // Fallback: if selected variation is empty, find first valid one
                    if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, '').trim().length === 0))) {
                        variation = q.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, '').trim().length > 0)) || q.variations?.[0];
                    }
                    const currentAnswer = currentSectionAnswers[q.id]?.answer;

                    return (
                        <div key={q.id} className="exam-question-card">
                            <div className="exam-question-header">
                                <span className="exam-question-number">Câu {realIdx + 1}</span>
                                <span className="exam-question-points">{q.points || 1} điểm</span>
                                {currentAnswer !== undefined && <Check size={16} strokeWidth={3} className="exam-question-done" />}
                            </div>
                            {!((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && /\{\{.+?\}\}/.test(variation?.text || '')) && q.type !== 'fill_in_blank_typing' && (
                                <div className="exam-question-text ql-editor" style={{ padding: 0 }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(variation?.text || '(Câu hỏi)') }} />
                            )}


                            {/* Multiple choice */}
                            {q.type === 'multiple_choice' && (
                                <div className="exam-options">
                                    {(variation?.options || []).map((opt, oIdx) => {
                                        if (!opt) return null;
                                        return (
                                            <button key={oIdx}
                                                className={`exam-option ${currentAnswer === opt ? 'selected' : ''}`}
                                                style={isImageOption(opt) ? { padding: '8px', justifyContent: 'center' } : {}}
                                                onClick={() => setAnswer(currentSection.id, q.id, opt)}>
                                                <span className="exam-option-letter">{String.fromCharCode(65 + oIdx)}</span>
                                                <span>{isImageOption(opt) ? <OptionContent opt={opt} /> : opt}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Fill in blank - Word Bank + Drag & Drop */}
                            {(q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && (() => {
                                // New format: {{word}} markers in text
                                const rawText = variation?.text || '';
                                const hasMarkers = /\{\{.+?\}\}/.test(rawText);

                                if (!hasMarkers) {
                                    // Legacy: simple text input for old-format questions
                                    return (
                                        <input type="text" className="exam-input"
                                            placeholder="Nhập câu trả lời..."
                                            value={currentAnswer || ''}
                                            onChange={e => setAnswer(currentSection.id, q.id, e.target.value)} />
                                    );
                                }

                                // Extract blanks from {{word}} markers
                                const blankRegex = /\{\{(.+?)\}\}/g;
                                const correctAnswers = [];
                                let m;
                                while ((m = blankRegex.exec(rawText)) !== null) {
                                    correctAnswers.push(m[1].replace(/&nbsp;/g, ' '));
                                }

                                // Parse text into parts: plain text and blank slots
                                const parts = rawText.split(/(\{\{.+?\}\})/g);

                                // Build word bank: correct answers + distractors, shuffled
                                const distractors = (variation?.distractors || []).map(d => d.replace(/&nbsp;/g, ' '));
                                const allWords = [...correctAnswers, ...distractors];
                                const shuffledPool = allWords.sort((a, b) => {
                                    const ha = (a + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                    const hb = (b + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                    return ha - hb;
                                });

                                // Current answers: object { "0": "word", "1": "word" }
                                const filledAnswers = (typeof currentAnswer === 'object' && currentAnswer !== null) ? currentAnswer : {};
                                const usedWords = Object.values(filledAnswers).filter(Boolean);
                                const pool = shuffledPool.filter(w => {
                                    const usedCount = usedWords.filter(u => u === w).length;
                                    const totalCount = shuffledPool.filter(sw => sw === w).length;
                                    return usedCount < totalCount;
                                });

                                // Re-filter pool for available words (handling duplicates)
                                const poolAvailable = [];
                                const usedTracker = {};
                                usedWords.forEach(w => { usedTracker[w] = (usedTracker[w] || 0) + 1; });
                                const wordCounts = {};
                                shuffledPool.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
                                const addedToPool = {};
                                shuffledPool.forEach(w => {
                                    const available = (wordCounts[w] || 0) - (usedTracker[w] || 0);
                                    const already = addedToPool[w] || 0;
                                    if (already < available) {
                                        poolAvailable.push(w);
                                        addedToPool[w] = already + 1;
                                    }
                                });

                                const handleDragStart = (e, word, source, sourceIdx) => {
                                    e.dataTransfer.setData('text', word);
                                    e.dataTransfer.setData('source', source);
                                    e.dataTransfer.setData('sourceIdx', sourceIdx ?? '');
                                };

                                const handleDropOnSlot = (e, slotIdx) => {
                                    e.preventDefault();
                                    const word = e.dataTransfer.getData('text');
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    const newAnswer = { ...(typeof currentAnswer === 'object' && currentAnswer ? currentAnswer : {}) };
                                    // If from another slot, clear that slot
                                    if (source === 'slot' && sourceIdx !== '') {
                                        delete newAnswer[sourceIdx];
                                    }
                                    // If this slot already has a word, it goes back to pool automatically
                                    newAnswer[String(slotIdx)] = word;
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDropOnPool = (e) => {
                                    e.preventDefault();
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    if (source === 'slot' && sourceIdx !== '') {
                                        const newAnswer = { ...(typeof currentAnswer === 'object' && currentAnswer ? currentAnswer : {}) };
                                        delete newAnswer[sourceIdx];
                                        setAnswer(currentSection.id, q.id, newAnswer);
                                    }
                                };

                                const handleDragOver = (e) => e.preventDefault();

                                let blankSlotIdx = 0;

                                return (
                                    <div className="exam-fill-blank-modern">
                                        {/* Sentence with blanks */}
                                        <div className="exam-fill-sentence" style={{ lineHeight: 2.2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                            {(() => {
                                                // Normalize Quill HTML to inline with preserved line breaks:
                                                const normalizedText = rawText
                                                    .replace(/<p><br><\/p>/gi, '\n')
                                                    .replace(/<\/p>/gi, '\n')
                                                    .replace(/<\/div>/gi, '\n')
                                                    .replace(/<br\s*\/?>/gi, '\n')
                                                    .replace(/<p[^>]*>/gi, '')
                                                    .replace(/<div[^>]*>/gi, '');
                                                // Split on {{word}} markers
                                                const segments = normalizedText.split(/(\{\{.+?\}\})/g);
                                                let slotCounter = 0;
                                                return segments.map((seg, sIdx) => {
                                                    const blankMatch = seg.match(/^\{\{(.+?)\}\}$/);
                                                    if (blankMatch) {
                                                        const idx = slotCounter++;
                                                        const filledWord = filledAnswers[String(idx)];
                                                        return (
                                                            <span key={sIdx}
                                                                className={`exam-fill-slot ${filledWord ? 'filled' : 'empty'}`}
                                                                style={{ display: 'inline-flex', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                                                                onDrop={e => handleDropOnSlot(e, idx)}
                                                                onDragOver={handleDragOver}
                                                            >
                                                                {filledWord ? (
                                                                    <span
                                                                        draggable
                                                                        className="exam-fill-chip in-slot"
                                                                        onDragStart={e => handleDragStart(e, filledWord, 'slot', idx)}
                                                                        onClick={() => {
                                                                            const newAnswer = { ...(typeof currentAnswer === 'object' && currentAnswer ? currentAnswer : {}) };
                                                                            delete newAnswer[String(idx)];
                                                                            setAnswer(currentSection.id, q.id, newAnswer);
                                                                        }}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        {filledWord}
                                                                    </span>
                                                                ) : (
                                                                    <span className="exam-fill-slot-placeholder">({idx + 1})</span>
                                                                )}
                                                            </span>
                                                        );
                                                    }
                                                    // Regular HTML segment - render inline
                                                    const trimSeg = seg.trim();
                                                    return trimSeg ? <span key={sIdx} dangerouslySetInnerHTML={{ __html: trimSeg }} /> : null;
                                                });
                                            })()}
                                        </div>


                                        {/* Word Bank */}
                                        <div className="exam-fill-bank-container"
                                            onDrop={handleDropOnPool}
                                            onDragOver={handleDragOver}
                                        >
                                            <div className="exam-fill-bank-title">Word Bank</div>
                                            <div className="exam-fill-bank">
                                                {poolAvailable.length === 0 ? (
                                                    <div className="exam-fill-bank-empty">Đã sử dụng hết các từ</div>
                                                ) : (
                                                    poolAvailable.map((w, i) => (
                                                        <span key={i}
                                                            draggable
                                                            className="exam-fill-chip"
                                                            onDragStart={e => handleDragStart(e, w, 'pool', null)}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                const newAnswer = { ...(typeof currentAnswer === 'object' && currentAnswer ? currentAnswer : {}) };
                                                                let firstEmptyIdx = -1;
                                                                for (let bi = 0; bi < correctAnswers.length; bi++) {
                                                                    if (!newAnswer[String(bi)]) {
                                                                        firstEmptyIdx = bi;
                                                                        break;
                                                                    }
                                                                }
                                                                if (firstEmptyIdx !== -1) {
                                                                    newAnswer[String(firstEmptyIdx)] = w;
                                                                    setAnswer(currentSection.id, q.id, newAnswer);
                                                                }
                                                            }}
                                                        >
                                                            {w}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Fill in blank typing - inline text inputs */}
                            {q.type === 'fill_in_blank_typing' && (() => {
                                const rawText = variation?.text || '';
                                const hasMarkers = /\{\{.+?\}\}/.test(rawText);
                                if (!hasMarkers) {
                                    return (
                                        <input type="text" className="exam-input"
                                            placeholder="Nhập câu trả lời..."
                                            value={currentAnswer || ''}
                                            onChange={e => setAnswer(currentSection.id, q.id, e.target.value)} />
                                    );
                                }

                                const blankRegex = /\{\{(.+?)\}\}/g;
                                const correctAnswers = [];
                                let m;
                                while ((m = blankRegex.exec(rawText)) !== null) {
                                    correctAnswers.push(m[1].replace(/&nbsp;/g, ' '));
                                }

                                const normalizedText = rawText
                                    .replace(/<p><br><\/p>/gi, '\n')
                                    .replace(/<\/p>/gi, '\n')
                                    .replace(/<\/div>/gi, '\n')
                                    .replace(/<br\s*\/?>/gi, '\n')
                                    .replace(/<p[^>]*>/gi, '')
                                    .replace(/<div[^>]*>/gi, '');
                                const segments = normalizedText.split(/(\{\{.+?\}\})/g);

                                const filledAnswers = (typeof currentAnswer === 'object' && currentAnswer !== null) ? currentAnswer : {};
                                let slotCounter = 0;

                                return (
                                    <div className="exam-fill-blank-modern">
                                        <div className="exam-fill-sentence" style={{ lineHeight: 2.2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                            {segments.map((seg, sIdx) => {
                                                const blankMatch = seg.match(/^\{\{(.+?)\}\}$/);
                                                if (blankMatch) {
                                                    const idx = slotCounter++;
                                                    const filled = filledAnswers[String(idx)] || '';
                                                    return (
                                                        <span key={sIdx} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '2px 4px' }}>
                                                            <input
                                                                type="text"
                                                                value={filled}
                                                                placeholder={`(${idx + 1})`}
                                                                onChange={e => {
                                                                    const newAnswer = { ...filledAnswers, [String(idx)]: e.target.value };
                                                                    setAnswer(currentSection.id, q.id, newAnswer);
                                                                }}
                                                                style={{
                                                                    display: 'inline-block',
                                                                    minWidth: '80px',
                                                                    maxWidth: '180px',
                                                                    width: `${Math.max(80, (filled.length + 2) * 12)}px`,
                                                                    padding: '6px 12px',
                                                                    fontSize: '1rem',
                                                                    fontWeight: 600,
                                                                    borderRadius: '8px',
                                                                    border: '2px solid #e2e8f0',
                                                                    background: '#fff',
                                                                    color: '#1e293b',
                                                                    outline: 'none',
                                                                    textAlign: 'center',
                                                                    fontFamily: 'inherit',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                                                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
                                                            />
                                                        </span>
                                                    );
                                                }
                                                const trimSeg = seg.trim();
                                                return trimSeg ? <span key={sIdx} dangerouslySetInnerHTML={{ __html: trimSeg }} /> : null;
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Essay */}
                            {q.type === 'essay' && (
                                <textarea className="exam-textarea"
                                    placeholder="Viết câu trả lời..."
                                    rows={4}
                                    value={currentAnswer || ''}
                                    onChange={e => setAnswer(currentSection.id, q.id, e.target.value)} />
                            )}

                            {/* Audio Recording */}
                            {q.type === 'audio_recording' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                                    <button
                                        type="button"
                                        disabled={gradingAudioQuestionId === q.id}
                                        onClick={async () => {
                                            const isRec = recordingQuestionId === q.id;
                                            if (isRec) {
                                                // Stop recording
                                                examMediaRecordersRef.current[q.id]?.stop();
                                                setRecordingQuestionId(null);
                                            } else {
                                                try {
                                                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                                    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                                                        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/aac';
                                                    const recorder = new MediaRecorder(stream, { mimeType });
                                                    examAudioChunksRef.current[q.id] = [];
                                                    recorder.ondataavailable = (e) => {
                                                        if (e.data.size > 0) {
                                                            if (!examAudioChunksRef.current[q.id]) examAudioChunksRef.current[q.id] = [];
                                                            examAudioChunksRef.current[q.id].push(e.data);
                                                        }
                                                    };
                                                    recorder.onstop = () => {
                                                        const blob = new Blob(examAudioChunksRef.current[q.id] || [], { type: mimeType });
                                                        examAudioBlobsRef.current[q.id] = blob;
                                                        stream.getTracks().forEach(t => t.stop());
                                                        // Save answer immediately so it's not lost if student submits early
                                                        setAnswer(currentSection.id, q.id, {
                                                            transcript: '(Đang xử lý...)',
                                                            hasRecording: true
                                                        });
                                                        // Track async processing so handleSubmitAll can wait for it
                                                        const processingPromise = (async () => {
                                                            setGradingAudioQuestionId(q.id);
                                                            try {
                                                                const [audioUrl, gradeResult] = await Promise.all([
                                                                    submission?.id
                                                                        ? uploadAudioAnswer(blob, submission.id, q.id)
                                                                        : Promise.resolve(null),
                                                                    evaluateAudioAnswer(
                                                                        blob,
                                                                        variation?.text || q.purpose || '',
                                                                        q.purpose || '',
                                                                        q.specialRequirement || '',
                                                                        q.points || 10,
                                                                        currentSection?.context || '',
                                                                        assignment?.teacherTitle || '',
                                                                        assignment?.studentTitle || ''
                                                                    )
                                                                ]);
                                                                setAnswer(currentSection.id, q.id, {
                                                                    transcript: gradeResult.transcript || '',
                                                                    aiScore: gradeResult.score,
                                                                    aiFeedback: gradeResult.feedback || '',
                                                                    audioUrl: audioUrl || '',
                                                                    hasRecording: true
                                                                });
                                                            } catch (err) {
                                                                console.error('Audio processing error:', err);
                                                                let audioUrl = '';
                                                                try {
                                                                    if (submission?.id) audioUrl = await uploadAudioAnswer(blob, submission.id, q.id);
                                                                } catch (_) { }
                                                                setAnswer(currentSection.id, q.id, {
                                                                    transcript: '(Lỗi chấm bài)',
                                                                    audioUrl,
                                                                    hasRecording: true
                                                                });
                                                            }
                                                            setGradingAudioQuestionId(null);
                                                            delete audioProcessingRef.current[q.id];
                                                        })();
                                                        audioProcessingRef.current[q.id] = processingPromise;
                                                    };
                                                    examMediaRecordersRef.current[q.id] = recorder;
                                                    recorder.start();
                                                    setRecordingQuestionId(q.id);
                                                    // Clear previous blob
                                                    delete examAudioBlobsRef.current[q.id];
                                                } catch (err) {
                                                    console.error('Mic error:', err);
                                                    setInfoModal({
                                                        isOpen: true,
                                                        title: '🎤 Không thể truy cập micro',
                                                        message: 'Vui lòng cấp quyền micro cho trình duyệt và thử lại.',
                                                        onConfirm: null
                                                    });
                                                }
                                            }
                                        }}
                                        style={{
                                            width: '64px', height: '64px', borderRadius: '50%',
                                            border: 'none', cursor: gradingAudioQuestionId === q.id ? 'wait' : 'pointer',
                                            background: recordingQuestionId === q.id
                                                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                            color: '#fff', fontSize: '1.5rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: recordingQuestionId === q.id
                                                ? '0 0 0 6px rgba(239,68,68,0.2)'
                                                : '0 4px 15px rgba(99,102,241,0.3)',
                                            transition: 'all 0.3s ease',
                                            animation: recordingQuestionId === q.id ? 'pulse 1.5s infinite' : 'none'
                                        }}
                                    >
                                        {gradingAudioQuestionId === q.id ? '⏳' : (recordingQuestionId === q.id ? '⏹' : '🎤')}
                                    </button>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                                        {gradingAudioQuestionId === q.id
                                            ? 'Đang chấm bài...'
                                            : recordingQuestionId === q.id
                                                ? '🔴 Đang ghi âm... Bấm để dừng'
                                                : currentAnswer?.hasRecording
                                                    ? '✅ Đã ghi âm và chấm điểm. Bấm lại để ghi mới.'
                                                    : 'Bấm nút micro để ghi âm câu trả lời'}
                                    </p>
                                    {currentAnswer?.transcript && (
                                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', width: '100%', maxWidth: '500px' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>📝 Transcript:</div>
                                            <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>{currentAnswer.transcript}</div>
                                        </div>
                                    )}
                                    {examAudioBlobsRef.current[q.id] && (
                                        <audio controls src={URL.createObjectURL(examAudioBlobsRef.current[q.id])} style={{
                                            width: '100%', maxWidth: '400px', borderRadius: '8px'
                                        }} />
                                    )}
                                </div>
                            )}

                            {/* Matching - Drag and Drop */}
                            {q.type === 'matching' && (() => {
                                const pairs = variation?.pairs || [];
                                // Build the current matched answers: array of {text} indexed by pair
                                const matched = currentAnswer || [];
                                // Pool: right-side options not yet matched
                                const allRights = pairs.map(p => p.right || '');
                                const usedRights = matched.map(m => m?.text).filter(Boolean);
                                // Shuffle pool once based on question id (stable across re-renders via sort)
                                const pool = allRights.filter(r => !usedRights.includes(r))
                                    .sort((a, b) => {
                                        const ha = (a + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                        const hb = (b + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                        return ha - hb;
                                    });

                                const handleDragStart = (e, text, source, sourceIdx) => {
                                    e.dataTransfer.setData('text', text);
                                    e.dataTransfer.setData('source', source); // 'pool' or 'slot'
                                    e.dataTransfer.setData('sourceIdx', sourceIdx ?? '');
                                };

                                const handleDropOnSlot = (e, pIdx) => {
                                    e.preventDefault();
                                    const text = e.dataTransfer.getData('text');
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    const newAnswer = [...(currentAnswer || [])];
                                    while (newAnswer.length <= Math.max(pIdx, pairs.length - 1)) newAnswer.push({ text: '' });
                                    // If dropped from another slot, clear that slot first
                                    if (source === 'slot' && sourceIdx !== '') {
                                        newAnswer[parseInt(sourceIdx)] = { text: '' };
                                    }
                                    // If slot already has something, swap it back to pool (handled by re-render)
                                    newAnswer[pIdx] = { text };
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDropOnPool = (e) => {
                                    e.preventDefault();
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    if (source === 'slot' && sourceIdx !== '') {
                                        const newAnswer = [...(currentAnswer || [])];
                                        newAnswer[parseInt(sourceIdx)] = { text: '' };
                                        setAnswer(currentSection.id, q.id, newAnswer);
                                    }
                                };

                                const handleDragOver = (e) => e.preventDefault();

                                return (
                                    <div className="exam-matching-modern">
                                        <div className="exam-match-main">
                                            <div className="exam-match-header">
                                                <div className="exam-match-header-left">Từ khóa</div>
                                                <div className="exam-match-header-right">Vị trí ghép</div>
                                            </div>
                                            {pairs.map((pair, pIdx) => {
                                                const slotValue = matched[pIdx]?.text || '';
                                                return (
                                                    <div key={pIdx} className="exam-match-row">
                                                        <div className="exam-match-term-box">
                                                            <div className="exam-match-term">{pair.left}</div>
                                                        </div>
                                                        <div className="exam-match-connector">
                                                            <div className="exam-match-line"></div>
                                                        </div>
                                                        <div className={`exam-match-slot ${slotValue ? 'filled' : 'empty'}`}
                                                            onDrop={e => handleDropOnSlot(e, pIdx)}
                                                            onDragOver={handleDragOver}>
                                                            {slotValue ? (
                                                                <span
                                                                    draggable
                                                                    className="exam-match-chip matched"
                                                                    onDragStart={e => handleDragStart(e, slotValue, 'slot', pIdx)}>
                                                                    {slotValue}
                                                                </span>
                                                            ) : (
                                                                <span className="exam-match-slot-placeholder">Thả tại đây</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="exam-match-pool-container">
                                            <div className="exam-match-pool-title">Danh sách đáp án</div>
                                            <div className="exam-match-pool"
                                                onDrop={handleDropOnPool}
                                                onDragOver={handleDragOver}>
                                                {pool.length === 0 ? (
                                                    <div className="exam-match-pool-empty">Đã ghép hết các mục</div>
                                                ) : (
                                                    <div className="exam-match-pool-items">
                                                        {pool.map((opt, oIdx) => (
                                                            <span key={oIdx}
                                                                draggable
                                                                className="exam-match-chip"
                                                                onDragStart={e => handleDragStart(e, opt, 'pool', null)}>
                                                                {opt}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Categorization - Drag and Drop */}
                            {q.type === 'categorization' && (() => {
                                const items = variation?.items || [];
                                const groups = variation?.groups || [];
                                const currentAnswer = currentSectionAnswers[q.id]?.answer || {}; // { itemText: groupName }

                                // Pool: items not yet categorized
                                const uncategorizedItems = items.filter(item => !currentAnswer[item.text]);

                                const handleDragStart = (e, itemText, sourceGroup) => {
                                    e.dataTransfer.setData('itemText', itemText);
                                    e.dataTransfer.setData('sourceGroup', sourceGroup || 'pool');
                                };

                                const handleDropOnGroup = (e, groupName) => {
                                    e.preventDefault();
                                    const itemText = e.dataTransfer.getData('itemText');
                                    const newAnswer = { ...currentAnswer };
                                    newAnswer[itemText] = groupName;
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDropOnPool = (e) => {
                                    e.preventDefault();
                                    const itemText = e.dataTransfer.getData('itemText');
                                    const newAnswer = { ...currentAnswer };
                                    delete newAnswer[itemText];
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDragOver = (e) => e.preventDefault();

                                return (
                                    <div className="exam-cat-dnd">
                                        <div className="exam-cat-pool" onDrop={handleDropOnPool} onDragOver={handleDragOver}>
                                            <div className="exam-cat-pool-title">Mục cần phân loại</div>
                                            <div className="exam-cat-pool-items">
                                                {uncategorizedItems.length === 0 && <div className="exam-cat-pool-empty">Đã phân loại hết các mục</div>}
                                                {uncategorizedItems.map((item, iIdx) => (
                                                    <div key={iIdx}
                                                        draggable
                                                        className="exam-cat-chip"
                                                        onDragStart={e => handleDragStart(e, item.text, null)}>
                                                        {item.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="exam-cat-groups">
                                            {groups.map((group, gIdx) => {
                                                const assignedItems = Object.entries(currentAnswer).filter(([_, g]) => g === group);
                                                return (
                                                    <div key={gIdx}
                                                        className={`exam-cat-group ${assignedItems.length > 0 ? 'active' : ''}`}
                                                        onDrop={e => handleDropOnGroup(e, group)}
                                                        onDragOver={handleDragOver}>
                                                        <div className="exam-cat-group-title">{group}</div>
                                                        <div className="exam-cat-group-items">
                                                            {assignedItems.map(([text, _]) => (
                                                                <div key={text}
                                                                    draggable
                                                                    className="exam-cat-chip assigned"
                                                                    onDragStart={e => handleDragStart(e, text, group)}>
                                                                    {text}
                                                                </div>
                                                            ))}
                                                            {assignedItems.length === 0 &&
                                                                <div className="exam-cat-group-placeholder">Kéo vào đây</div>
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Ordering - Drag and Drop / Tap to order */}
                            {q.type === 'ordering' && (() => {
                                const correctItems = variation?.items || [];
                                // Shuffle items deterministically based on question id
                                const shuffledItems = [...correctItems].sort((a, b) => {
                                    const ha = (a + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                    const hb = (b + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                    return ha - hb;
                                });
                                // Current answer: array of strings in the order the student picked
                                const orderedAnswer = Array.isArray(currentAnswer) ? currentAnswer : [];
                                const usedItems = new Set(orderedAnswer);
                                const availableItems = shuffledItems.filter(item => !usedItems.has(item));

                                const handleSelectItem = (item) => {
                                    const newAnswer = [...orderedAnswer, item];
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleRemoveItem = (idx) => {
                                    const newAnswer = orderedAnswer.filter((_, i) => i !== idx);
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDragStart = (e, item, source, sourceIdx) => {
                                    e.dataTransfer.setData('text', item);
                                    e.dataTransfer.setData('source', source);
                                    e.dataTransfer.setData('sourceIdx', String(sourceIdx ?? ''));
                                };

                                const handleDropOnSlot = (e, slotIdx) => {
                                    e.preventDefault();
                                    const item = e.dataTransfer.getData('text');
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    let newAnswer = [...orderedAnswer];
                                    // Remove from source if from answer
                                    if (source === 'answer' && sourceIdx !== '') {
                                        newAnswer = newAnswer.filter((_, i) => i !== parseInt(sourceIdx));
                                    }
                                    // Insert at slotIdx
                                    newAnswer.splice(slotIdx, 0, item);
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                };

                                const handleDropOnPool = (e) => {
                                    e.preventDefault();
                                    const source = e.dataTransfer.getData('source');
                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                    if (source === 'answer' && sourceIdx !== '') {
                                        const newAnswer = orderedAnswer.filter((_, i) => i !== parseInt(sourceIdx));
                                        setAnswer(currentSection.id, q.id, newAnswer);
                                    }
                                };

                                const handleDragOver = (e) => e.preventDefault();

                                return (
                                    <div className="exam-ordering-container">
                                        {/* Answer zone */}
                                        <div className="exam-ordering-answer-zone">
                                            <div className="exam-ordering-answer-title">Thứ tự của bạn:</div>
                                            <div className="exam-ordering-answer-list">
                                                {orderedAnswer.length === 0 && (
                                                    <div className="exam-ordering-placeholder"
                                                        onDrop={e => handleDropOnSlot(e, 0)}
                                                        onDragOver={handleDragOver}>
                                                        Nhấn vào các thẻ bên dưới theo đúng thứ tự
                                                    </div>
                                                )}
                                                {orderedAnswer.map((item, idx) => (
                                                    <div key={`ans-${idx}`}
                                                        className="exam-ordering-chip answer"
                                                        draggable
                                                        onDragStart={e => handleDragStart(e, item, 'answer', idx)}
                                                        onDrop={e => handleDropOnSlot(e, idx)}
                                                        onDragOver={handleDragOver}
                                                        onClick={() => handleRemoveItem(idx)}
                                                        style={{ cursor: 'pointer' }}>
                                                        <span className="exam-ordering-chip-number">{idx + 1}</span>
                                                        <span>{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Pool */}
                                        <div className="exam-ordering-pool"
                                            onDrop={handleDropOnPool}
                                            onDragOver={handleDragOver}>
                                            <div className="exam-ordering-pool-title">Các mục cần sắp xếp</div>
                                            <div className="exam-ordering-pool-items">
                                                {availableItems.length === 0 && orderedAnswer.length > 0 && (
                                                    <div className="exam-ordering-pool-empty">Đã sắp xếp hết các mục</div>
                                                )}
                                                {availableItems.map((item, idx) => (
                                                    <div key={`pool-${idx}`}
                                                        className="exam-ordering-chip pool"
                                                        draggable
                                                        onDragStart={e => handleDragStart(e, item, 'pool', null)}
                                                        onClick={() => handleSelectItem(item)}
                                                        style={{ cursor: 'pointer' }}>
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })}
            </div>

            {/* Section/Question navigation */}
            <div className="exam-footer">
                <div className="exam-footer-inner">
                    <div className="exam-footer-left">
                        {timingMode === 'question' ? (
                            canGoPrevQuestion && (
                                <button className="exam-btn exam-btn-secondary" onClick={() => {
                                    if (currentQuestionIdx > 0) {
                                        setCurrentQuestionIdx(prev => prev - 1);
                                    } else if (canGoPrevSection) {
                                        // Go to last non-expired question of prev section
                                        const prevSid = sections[currentSectionIdx - 1]?.id;
                                        const prevSQ = questions.filter(q => q.sectionId === prevSid).sort((a, b) => (a.order || 0) - (b.order || 0));
                                        let lastAvail = prevSQ.length - 1;
                                        while (lastAvail >= 0 && questionExpired[prevSQ[lastAvail].id]) lastAvail--;
                                        setCurrentSectionIdx(prev => prev - 1);
                                        setCurrentQuestionIdx(Math.max(0, lastAvail));
                                    }
                                    window.scrollTo(0, 0);
                                }}>
                                    <ChevronLeft size={16} /> Câu trước
                                </button>
                            )
                        ) : (
                            canGoPrevSection && (
                                <button className="exam-btn exam-btn-secondary" onClick={() => { setCurrentSectionIdx(prev => prev - 1); window.scrollTo(0, 0); }}>
                                    <ChevronLeft size={16} /> Phần trước
                                </button>
                            )
                        )}
                    </div>
                    <div className="exam-footer-center">
                        <button className="exam-btn exam-btn-primary exam-btn-submit" onClick={() => setConfirmSubmitAll(true)}>
                            <Send size={16} /> Nộp bài
                        </button>
                    </div>
                    <div className="exam-footer-right">
                        {timingMode === 'question' ? (
                            (() => {
                                // Find next available question
                                let hasNext = false;
                                for (let i = currentQuestionIdx + 1; i < sectionQuestions.length; i++) {
                                    if (!questionExpired[sectionQuestions[i].id]) { hasNext = true; break; }
                                }
                                if (!hasNext && !isLastSection) hasNext = true; // can go to next section
                                return hasNext ? (
                                    <button className="exam-btn exam-btn-primary" onClick={() => {
                                        let nextQIdx = -1;
                                        for (let i = currentQuestionIdx + 1; i < sectionQuestions.length; i++) {
                                            if (!questionExpired[sectionQuestions[i].id]) { nextQIdx = i; break; }
                                        }
                                        if (nextQIdx >= 0) {
                                            setCurrentQuestionIdx(nextQIdx);
                                            window.scrollTo(0, 0);
                                        } else if (!isLastSection) {
                                            setConfirmSubmitSection(true);
                                        }
                                    }}>
                                        Câu tiếp theo <ChevronRight size={16} />
                                    </button>
                                ) : null;
                            })()
                        ) : (
                            !isLastSection && (
                                <button className="exam-btn exam-btn-primary" onClick={() => setConfirmSubmitSection(true)}>
                                    Phần tiếp theo <ChevronRight size={16} />
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm next section */}
            {confirmSubmitSection && (
                <div className="exam-modal-overlay">
                    <div className="exam-modal">
                        <h3>Chuyển section?</h3>
                        <p>Bạn đã trả lời {Object.keys(currentSectionAnswers).length}/{sectionQuestions.length} câu. Chuyển sang section tiếp theo?</p>
                        <div className="exam-modal-actions">
                            <button className="exam-btn exam-btn-secondary" onClick={() => setConfirmSubmitSection(false)}>Quay lại</button>
                            <button className="exam-btn exam-btn-primary" onClick={handleNextSection}>Tiếp tục</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm submit all */}
            {confirmSubmitAll && (
                <div className="exam-modal-overlay">
                    <div className="exam-modal">
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <AlertTriangle size={40} color="#f59e0b" />
                        </div>
                        <h3>Nộp bài tập và kiểm tra?</h3>
                        <p>Sau khi nộp, bạn không thể sửa câu trả lời.</p>
                        <div className="exam-modal-actions">
                            <button className="exam-btn exam-btn-secondary" onClick={() => setConfirmSubmitAll(false)}>Quay lại</button>
                            <button className="exam-btn exam-btn-primary exam-btn-submit" onClick={() => handleSubmitAll(false)} disabled={submitting}>
                                {submitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Info Modal */}
            <ConfirmModal
                isOpen={infoModal.isOpen}
                title={infoModal.title}
                message={infoModal.message}
                onConfirm={infoModal.onConfirm || (() => setInfoModal({ ...infoModal, isOpen: false }))}
                onCancel={() => setInfoModal({ ...infoModal, isOpen: false })}
                confirmText="Đóng"
                type="primary"
            />
        </div>
    );
}
