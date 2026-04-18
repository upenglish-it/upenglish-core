import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getExam, getExamQuestions, getExamSubmission, saveExamSubmission, gradeExamSubmission, getExamAssignment, uploadAudioAnswer } from '../services/examService';
import { saveAudioToCache, removeAudioFromCache, retryPendingUploads, clearAllForSubmission } from '../services/audioOfflineService';
import { useAuth } from '../contexts/AuthContext';
import { Clock, ChevronRight, ChevronLeft, Send, AlertTriangle, Check, BookOpen, X } from 'lucide-react';

import './TakeExamPage.css';
import ConfirmModal from '../components/common/ConfirmModal';
import { renderFormattedText } from '../utils/textFormatting';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import { useAntiCopy } from '../hooks/useAntiCopy';

// Decode HTML entities (&#39; → ', &amp; → &, &nbsp; → space, etc.) and strip HTML tags
const decodeHtmlEntities = (str) => {
    if (!str) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value
        .replace(/<[^>]*>/g, '')   // strip HTML tags (e.g. <strong> from Quill)
        .replace(/\u00a0/g, ' '); // non-breaking space → regular space
};

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
        // Convert structural HTML to <br> for line breaks, but keep formatting tags (bold, italic, etc.)
        cleaned = cleaned
            .replace(/<p><br><\/p>/gi, '<br>')
            .replace(/<\/p>/gi, '<br>')
            .replace(/<\/div>/gi, '<br>')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<div[^>]*>/gi, '');
        // Remove trailing <br> tags
        cleaned = cleaned.replace(/(<br\s*\/?\s*>)+$/gi, '');
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
    const [resolvedExamId, setResolvedExamId] = useState(examId || null);
    const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const answersRef = useRef(answers);
    const [timeLeft, setTimeLeft] = useState(null);
    const [confirmSubmitSection, setConfirmSubmitSection] = useState(false);
    const [confirmSubmitAll, setConfirmSubmitAll] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(''); // Dynamic status message for overlay
    const submitCalledRef = useRef(false); // Guard against multiple simultaneous auto-submit calls
    const submissionRef = useRef(null); // Mirrors submission.id for use in unmount cleanup
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

    // Refs that always hold latest timer values (for use in closures like beforeunload/visibilitychange)
    const sectionTimersLatest = useRef(sectionTimers);
    const sectionExpiredLatest = useRef(sectionExpired);
    const questionTimersLatest = useRef(questionTimers);
    const questionExpiredLatest = useRef(questionExpired);
    const currentSectionIdxRef = useRef(0);
    const currentQuestionIdxRef = useRef(0);
    useEffect(() => { sectionTimersLatest.current = sectionTimers; }, [sectionTimers]);
    useEffect(() => { sectionExpiredLatest.current = sectionExpired; }, [sectionExpired]);
    useEffect(() => { questionTimersLatest.current = questionTimers; }, [questionTimers]);
    useEffect(() => { questionExpiredLatest.current = questionExpired; }, [questionExpired]);
    useEffect(() => { currentSectionIdxRef.current = currentSectionIdx; }, [currentSectionIdx]);
    useEffect(() => { currentQuestionIdxRef.current = currentQuestionIdx; }, [currentQuestionIdx]);
    useEffect(() => { submissionRef.current = submission?.id || null; }, [submission?.id]);

    // Toast for auto-advance notifications
    const [toastMessage, setToastMessage] = useState(null);
    const toastTimerRef = useRef(null);

    // Audio recording state (per-question, stored in refs)
    const examAudioBlobsRef = useRef({}); // { questionId: Blob }
    const examMediaRecordersRef = useRef({}); // { questionId: MediaRecorder }
    const examAudioChunksRef = useRef({}); // { questionId: [] }
    const audioProcessingRef = useRef({}); // { questionId: Promise } — tracks in-flight audio processing
    const [recordingQuestionId, setRecordingQuestionId] = useState(null);
    const recordingQuestionIdRef = useRef(null); // Mirrors state for use in closures (visibilitychange)
    useEffect(() => { recordingQuestionIdRef.current = recordingQuestionId; }, [recordingQuestionId]);
    const [uploadingAudioQuestionId, setUploadingAudioQuestionId] = useState(null);



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

    // Sticky context panel state
    const [contextPanelOpen, setContextPanelOpen] = useState(false);
    const [showContextFab, setShowContextFab] = useState(false);
    const contextSectionRef = useRef(null);

    // Floating mini timer: visible when topbar scrolls out of view (e.g. mobile keyboard open)
    const topbarRef = useRef(null);
    const [showFloatingTimer, setShowFloatingTimer] = useState(false);

    useEffect(() => {
        const el = topbarRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowFloatingTimer(!entry.isIntersecting),
            { threshold: 0 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [exam]);

    // Show FAB when user scrolls past the original context section
    useEffect(() => {
        const sectionHasContext = hasContent(exam?.sections?.[currentSectionIdx]?.context) || !!exam?.sections?.[currentSectionIdx]?.contextAudioUrl;
        if (!sectionHasContext) { setShowContextFab(false); return; }

        const checkVisibility = () => {
            const el = contextSectionRef.current;
            if (!el) return;
            // Show FAB when the bottom of the context element scrolls above the topbar (~80px)
            const rect = el.getBoundingClientRect();
            setShowContextFab(rect.bottom < 80);
        };

        window.addEventListener('scroll', checkVisibility, { passive: true });
        checkVisibility();

        return () => window.removeEventListener('scroll', checkVisibility);
    }, [currentSectionIdx, exam?.sections]);

    // Close context panel when switching sections
    useEffect(() => {
        setContextPanelOpen(false);
    }, [currentSectionIdx]);

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
            if (periodicTimerSaveRef.current) clearInterval(periodicTimerSaveRef.current);
            // Save timers on component unmount (covers SPA navigation where beforeunload won't fire)
            if (submissionRef.current) {
                saveExamSubmission({ id: submissionRef.current, answers: answersRef.current, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdxRef.current, lastActiveQuestionIdx: currentQuestionIdxRef.current }).catch(() => {});
            }
        };
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            if (!assignmentId && !examId) {
                setResolvedExamId(null);
                setExam(null);
                setQuestions([]);
                setAssignment(null);
                setLoading(false);
                return;
            }

            const assignmentData = assignmentId ? await getExamAssignment(assignmentId) : null;
            const effectiveExamId = examId || assignmentData?.examId || null;

            if (!effectiveExamId) {
                setResolvedExamId(null);
                setExam(null);
                setQuestions([]);
                setAssignment(assignmentData);
                setLoading(false);
                return;
            }

            const [examData, questionsData] = await Promise.all([
                getExam(effectiveExamId),
                getExamQuestions(effectiveExamId)
            ]);
            setResolvedExamId(effectiveExamId);
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
                    // Retry pending audio uploads from IndexedDB before force-submitting
                    let finalAnswers = { ...(sub.answers || {}) };
                    try {
                        await retryPendingUploads(sub.id, uploadAudioAnswer, (questionId, audioUrl) => {
                            const q = questionsData.find(qd => qd.id === questionId);
                            const sectionId = q?.sectionId;
                            if (sectionId) {
                                finalAnswers = {
                                    ...finalAnswers,
                                    [sectionId]: {
                                        ...(finalAnswers[sectionId] || {}),
                                        [questionId]: { answer: { audioUrl, hasRecording: true }, submittedAt: new Date().toISOString() }
                                    }
                                };
                            }
                        });
                    } catch (e) { console.warn('[AudioOffline] Retry on deadline submit:', e); }
                    // Force submit existing work
                    await saveExamSubmission({
                        id: sub.id, answers: finalAnswers,
                        status: 'submitted',
                        submittedAt: new Date().toISOString()
                    });
                    gradeExamSubmission(sub.id, { ...sub, answers: finalAnswers }, questionsData, examData?.sections || [], assignmentData?.teacherTitle || '', assignmentData?.studentTitle || '').catch(e => console.error(e));
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
                    message: `Rất tiếc, ${examData?.examType === 'test' ? 'bài kiểm tra' : 'bài tập'} này đã hết hạn!`,
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
                        // Retry pending audio uploads from IndexedDB first
                        let finalAnswers = { ...(sub.answers || {}) };
                        try {
                            await retryPendingUploads(sub.id, uploadAudioAnswer, (questionId, audioUrl) => {
                                const q = questionsData.find(qd => qd.id === questionId);
                                const sectionId = q?.sectionId;
                                if (sectionId) {
                                    finalAnswers = {
                                        ...finalAnswers,
                                        [sectionId]: {
                                            ...(finalAnswers[sectionId] || {}),
                                            [questionId]: { answer: { audioUrl, hasRecording: true }, submittedAt: new Date().toISOString() }
                                        }
                                    };
                                }
                            });
                        } catch (e) { console.warn('[AudioOffline] Retry on time-expired submit:', e); }
                        await saveExamSubmission({
                            id: sub.id, answers: finalAnswers,
                            status: 'submitted',
                            submittedAt: new Date().toISOString(),
                            autoSubmitted: true
                        });
                        gradeExamSubmission(sub.id, { ...sub, answers: finalAnswers }, questionsData, examData?.sections || [], assignmentData?.teacherTitle || '', assignmentData?.studentTitle || '').catch(e => console.error('Auto-grade failed:', e));
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

                // Retry any pending audio uploads from previous session — AWAIT to ensure audio is recovered
                try {
                    const retryCount = await retryPendingUploads(sub.id, uploadAudioAnswer, async (questionId, audioUrl) => {
                        // Find which section this question belongs to
                        const q = questionsData.find(qd => qd.id === questionId);
                        const sectionId = q?.sectionId;
                        if (sectionId) {
                            const updated = {
                                ...answersRef.current,
                                [sectionId]: {
                                    ...(answersRef.current[sectionId] || {}),
                                    [questionId]: { answer: { audioUrl, hasRecording: true }, submittedAt: new Date().toISOString() }
                                }
                            };
                            answersRef.current = updated;
                            setAnswers(updated);
                            await saveExamSubmission({ id: sub.id, answers: updated });
                        }
                    });
                    if (retryCount > 0) console.log(`[AudioOffline] Retried ${retryCount} pending audio upload(s)`);
                } catch (e) { console.warn('[AudioOffline] Retry on resume failed:', e); }

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
                    // Compute elapsed time since last save to deduct from active section
                    const savedAt = sub.timersSavedAt ? new Date(sub.timersSavedAt) : null;
                    const elapsedSinceSave = savedAt ? Math.max(0, Math.floor((new Date() - savedAt) / 1000)) : 0;
                    const lastActiveIdx = sub.lastActiveSectionIdx ?? 0;
                    const activeSectionId = sections[lastActiveIdx]?.id;
                    const initTimers = {};
                    const initExpired = {};
                    sections.forEach(s => {
                        if (savedSExpired[s.id]) {
                            initExpired[s.id] = true;
                            initTimers[s.id] = 0;
                        } else if (savedSTimers[s.id] !== undefined) {
                            // Deduct elapsed time only from the section that was active when saved
                            const deduction = (s.id === activeSectionId) ? elapsedSinceSave : 0;
                            const remaining = Math.max(0, savedSTimers[s.id] - deduction);
                            initTimers[s.id] = remaining;
                            if (remaining <= 0) initExpired[s.id] = true;
                        } else {
                            initTimers[s.id] = (s.timeLimitMinutes || 10) * 60;
                        }
                    });
                    setSectionTimers(initTimers);
                    setSectionExpired(initExpired);
                    // Navigate to first section with time remaining AND unanswered questions
                    const savedAnswers = sub.answers || {};
                    let bestSectionIdx = lastActiveIdx; // fallback
                    for (let i = 0; i < sections.length; i++) {
                        const s = sections[i];
                        if (initExpired[s.id]) continue; // no time left
                        if (initTimers[s.id] <= 0) continue;
                        const sectionQs = questionsData.filter(q => q.sectionId === s.id);
                        const sectionAnswers = savedAnswers[s.id] || {};
                        const hasUnanswered = sectionQs.some(q => !sectionAnswers[q.id]);
                        if (hasUnanswered) { bestSectionIdx = i; break; }
                    }
                    if (bestSectionIdx >= 0 && bestSectionIdx < sections.length) {
                        setCurrentSectionIdx(bestSectionIdx);
                    }
                } else if (timingMode === 'question') {
                    // Restore question timers from submission or initialize
                    const savedQTimers = sub.questionTimers || {};
                    const savedQExpired = sub.questionExpired || {};
                    // Compute elapsed time since last save to deduct from active question
                    const savedAt = sub.timersSavedAt ? new Date(sub.timersSavedAt) : null;
                    const elapsedSinceSave = savedAt ? Math.max(0, Math.floor((new Date() - savedAt) / 1000)) : 0;
                    const lastActiveSIdx = sub.lastActiveSectionIdx ?? 0;
                    const lastActiveQIdx = sub.lastActiveQuestionIdx ?? 0;
                    const sections = examData.sections || [];
                    const activeSectionQs = questionsData.filter(q => q.sectionId === sections[lastActiveSIdx]?.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                    const activeQuestionId = activeSectionQs[lastActiveQIdx]?.id;
                    const initTimers = {};
                    const initExpired = {};
                    questionsData.forEach(q => {
                        if (savedQExpired[q.id]) {
                            initExpired[q.id] = true;
                            initTimers[q.id] = 0;
                        } else if (savedQTimers[q.id] !== undefined) {
                            // Deduct elapsed time only from the question that was active when saved
                            const deduction = (q.id === activeQuestionId) ? elapsedSinceSave : 0;
                            const remaining = Math.max(0, savedQTimers[q.id] - deduction);
                            initTimers[q.id] = remaining;
                            if (remaining <= 0) initExpired[q.id] = true;
                        } else {
                            initTimers[q.id] = q.timeLimitSeconds || 60;
                        }
                    });
                    setQuestionTimers(initTimers);
                    setQuestionExpired(initExpired);
                    // Navigate to first section with time + unanswered questions
                    const savedAnswers = sub.answers || {};
                    let bestSIdx = lastActiveSIdx;
                    let bestQIdx = lastActiveQIdx;
                    let found = false;
                    for (let si = 0; si < sections.length && !found; si++) {
                        const s = sections[si];
                        const sectionQs = questionsData.filter(q => q.sectionId === s.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        const sectionAnswers = savedAnswers[s.id] || {};
                        for (let qi = 0; qi < sectionQs.length; qi++) {
                            const q = sectionQs[qi];
                            if (initExpired[q.id] || initTimers[q.id] <= 0) continue;
                            if (!sectionAnswers[q.id]) { bestSIdx = si; bestQIdx = qi; found = true; break; }
                        }
                    }
                    if (bestSIdx >= 0 && bestSIdx < sections.length) {
                        setCurrentSectionIdx(bestSIdx);
                    }
                    setCurrentQuestionIdx(bestQIdx >= 0 ? bestQIdx : 0);
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
            setTimeout(() => handleSubmitAll(true), 500);
            return;
        }
        globalTimerRef.current = setInterval(() => {
            setGlobalTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(globalTimerRef.current);
                    setTimeout(() => handleSubmitAll(true), 500);
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
            setTimeout(() => handleSubmitAll(true), 500);
            return;
        }
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setTimeout(() => handleSubmitAll(true), 500);
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
            // Section just expired — stop any active recording in this section
            if (recordingQuestionId && examMediaRecordersRef.current[recordingQuestionId]) {
                const sectionQIds = new Set(questions.filter(q => q.sectionId === currentSid).map(q => q.id));
                if (sectionQIds.has(recordingQuestionId)) {
                    const activeRecorder = examMediaRecordersRef.current[recordingQuestionId];
                    if (activeRecorder.state === 'recording' || activeRecorder.state === 'paused') {
                        activeRecorder.stop(); // triggers onstop → upload + save answer
                        setRecordingQuestionId(null);
                    }
                }
            }
            setSectionExpired(prev => ({ ...prev, [currentSid]: true }));
            // Auto-advance
            const sections = exam.sections || [];
            const nextIdx = sections.findIndex((s, i) => i > currentSectionIdx && !sectionExpired[s.id]);
            if (nextIdx >= 0) {

                setCurrentSectionIdx(nextIdx);
                window.scrollTo(0, 0);
            } else {
                // All sections expired → auto submit (delay to let onstop fire for any stopped recorder)
                setTimeout(() => handleSubmitAll(true), 500);
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
            // Question just expired — stop recording if active for this question
            if (recordingQuestionId === qId && examMediaRecordersRef.current[qId]) {
                const activeRecorder = examMediaRecordersRef.current[qId];
                if (activeRecorder.state === 'recording' || activeRecorder.state === 'paused') {
                    activeRecorder.stop(); // triggers onstop → upload + save answer
                    setRecordingQuestionId(null);
                }
            }
            setQuestionExpired(prev => ({ ...prev, [qId]: true }));
            // Auto-advance to next non-expired question
            let nextQIdx = -1;
            for (let i = currentQuestionIdx + 1; i < sqQuestions.length; i++) {
                if (!questionExpired[sqQuestions[i].id]) { nextQIdx = i; break; }
            }
            if (nextQIdx >= 0) {

                setCurrentQuestionIdx(nextQIdx);
                window.scrollTo(0, 0);
            } else {
                // Check next sections
                let found = false;
                for (let si = currentSectionIdx + 1; si < sections.length; si++) {
                    const nextSQ = questions.filter(q => q.sectionId === sections[si].id).sort((a, b) => (a.order || 0) - (b.order || 0));
                    const nextAvailQ = nextSQ.findIndex(q => !questionExpired[q.id]);
                    if (nextAvailQ >= 0) {

                        setCurrentSectionIdx(si);
                        setCurrentQuestionIdx(nextAvailQ);
                        window.scrollTo(0, 0);
                        found = true;
                        break;
                    }
                }
                if (!found) setTimeout(() => handleSubmitAll(true), 500); // delay to let onstop fire for any stopped recorder
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
            // Simple hash function for per-student variation selection
            function simpleHash(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash |= 0; // Convert to 32bit integer
                }
                return Math.abs(hash);
            }

            const variationMap = {};
            const studentId = user?.uid || '';
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
                if (validIndices.length > 1) {
                    // Multiple variations: use student-specific hash for unique selection per student
                    const perStudentHash = simpleHash(studentId + ':' + q.id);
                    variationMap[q.id] = validIndices[perStudentHash % validIndices.length];
                } else if (validIndices.length === 1) {
                    variationMap[q.id] = validIndices[0];
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

            // Build initial timer data to persist immediately
            const initialTimerData = {};
            if (timingMode === 'section') {
                const initST = {};
                (exam.sections || []).forEach(s => { initST[s.id] = (s.timeLimitMinutes || 10) * 60; });
                initialTimerData.sectionTimers = initST;
                initialTimerData.sectionExpired = {};
                initialTimerData.lastActiveSectionIdx = 0;
            } else if (timingMode === 'question') {
                const initQT = {};
                validQuestions.forEach(q => { initQT[q.id] = q.timeLimitSeconds || 60; });
                initialTimerData.questionTimers = initQT;
                initialTimerData.questionExpired = {};
                initialTimerData.lastActiveSectionIdx = 0;
                initialTimerData.lastActiveQuestionIdx = 0;
            }
            const newSubId = await saveExamSubmission({
                examId: resolvedExamId, assignmentId, studentId: user?.uid,
                status: 'in_progress',
                startedAt: startedAtDate.toISOString(),
                examEndTime,
                variationMap,
                answers: {},
                results: {},
                totalScore: null, maxTotalScore: null,
                timersSavedAt: startedAtDate.toISOString(),
                ...initialTimerData
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
                message: `Không thể bắt đầu ${exam?.examType === 'test' ? 'bài kiểm tra' : 'bài tập'}. Vui lòng thử lại.`,
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

    // Auto-save: debounced 5s after each answer change (onBlur + visibilitychange handle immediate saves)
    const autoSaveTimerRef = useRef(null);
    useEffect(() => {
        if (!submission?.id) return;
        // Debounced save: 5 seconds after last answer change
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdxRef.current, lastActiveQuestionIdx: currentQuestionIdxRef.current });
            } catch (e) { console.error('Auto-save failed:', e); }
        }, 5000);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    }, [answers, submission?.id]);

    // Periodic timer auto-save every 30s (independent of answer changes)
    const periodicTimerSaveRef = useRef(null);
    useEffect(() => {
        if (!submission?.id) return;
        const timingMode = exam?.timingMode || 'exam';
        if (timingMode === 'exam') return; // exam mode uses absolute examEndTime, no need
        periodicTimerSaveRef.current = setInterval(() => {
            saveExamSubmission({ id: submission.id, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdxRef.current, lastActiveQuestionIdx: currentQuestionIdxRef.current }).catch(() => {});
        }, 30000);
        return () => { if (periodicTimerSaveRef.current) clearInterval(periodicTimerSaveRef.current); };
    }, [submission?.id, exam?.timingMode]);

    // Save answers on page unload (tab close / navigate away)
    useEffect(() => {
        if (!submission?.id) return;
        const handleBeforeUnload = () => {
            // Stop any active recording so the blob is captured to IndexedDB before page unloads
            try {
                const activeQId = recordingQuestionIdRef.current;
                if (activeQId && examMediaRecordersRef.current[activeQId]) {
                    const recorder = examMediaRecordersRef.current[activeQId];
                    if (recorder.state === 'recording' || recorder.state === 'paused') {
                        recorder.stop(); // triggers onstop → blob → IndexedDB cache
                        recordingQuestionIdRef.current = null;
                    }
                }
            } catch (_) { /* ignore */ }
            // Firestore offline persistence queues this write to local IndexedDB even if tab is killed
            try {
                const isTest = exam?.examType === 'test';
                saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdxRef.current, lastActiveQuestionIdx: currentQuestionIdxRef.current, ...(isTest ? { tabSwitchCount: tabSwitchCountRef.current } : {}) })
                    .catch(() => {});
            } catch (e) { /* ignore */ }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        // Also handle visibility change (mobile: switching apps) + tab switch tracking (tests only)
        const isTest = exam?.examType === 'test';
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && submission?.id) {
                // Auto-stop any active recording before the OS kills the MediaRecorder
                const activeQId = recordingQuestionIdRef.current;
                if (activeQId && examMediaRecordersRef.current[activeQId]) {
                    const recorder = examMediaRecordersRef.current[activeQId];
                    if (recorder.state === 'recording' || recorder.state === 'paused') {
                        recorder.stop(); // triggers onstop → blob → IndexedDB cache → upload
                        setRecordingQuestionId(null);
                        recordingQuestionIdRef.current = null;
                    }
                }
                // Increment tab switch count (only for tests)
                if (isTest) tabSwitchCountRef.current += 1;
                saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdxRef.current, lastActiveQuestionIdx: currentQuestionIdxRef.current, ...(isTest ? { tabSwitchCount: tabSwitchCountRef.current } : {}) })
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

    // Helper: stop any active recording so audio is captured before navigating away
    async function stopActiveRecording() {
        const activeQId = recordingQuestionIdRef.current; // Use ref, not state (state may be stale)
        if (activeQId && examMediaRecordersRef.current[activeQId]) {
            const activeRecorder = examMediaRecordersRef.current[activeQId];
            if (activeRecorder.state === 'recording' || activeRecorder.state === 'paused') {
                activeRecorder.stop(); // triggers onstop → upload + save answer
                setRecordingQuestionId(null);
                recordingQuestionIdRef.current = null;
                // Give onstop a moment to fire and register the processing promise
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    async function handleNextSection() {
        await stopActiveRecording();
        const totalSections = (exam?.sections || []).length;
        const nextIdx = Math.min(currentSectionIdx + 1, totalSections - 1);
        try {
            await saveExamSubmission({ id: submission.id, answers, sectionTimers, sectionExpired, questionTimers, questionExpired, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: nextIdx, lastActiveQuestionIdx: 0 });
        } catch (e) { console.error(e); }
        setCurrentSectionIdx(nextIdx);
        if ((exam.timingMode || 'exam') === 'question') setCurrentQuestionIdx(0);
        setConfirmSubmitSection(false);
        window.scrollTo(0, 0);
    }

    async function handleSubmitAll(forced = false) {
        // Guard: prevent multiple simultaneous calls from different timers
        if (submitCalledRef.current) return;
        // Guard: submission not yet created (e.g. user dismissed overdue modal without navigating away)
        if (!submission?.id) {
            navigate(-1);
            return;
        }
        submitCalledRef.current = true;
        setSubmitting(true);
        try {
            setSubmitStatus('Đang xử lý bài ghi âm...');
            await stopActiveRecording();

            // Wait for any in-flight audio processing to complete
            const pendingAudio = Object.values(audioProcessingRef.current);
            if (pendingAudio.length > 0) {
                setSubmitStatus('Đang tải file thu âm lên...');
                await Promise.allSettled(pendingAudio);
            }

            // Retry loop: check for missing audioUrl and retry up to 3 times
            const MAX_AUDIO_RETRIES = 3;
            const RETRY_DELAY_MS = 5000;
            for (let retry = 0; retry < MAX_AUDIO_RETRIES; retry++) {
                // Scan all answers for hasRecording without audioUrl
                const currentAnswers = answersRef.current;
                let missingAudioCount = 0;
                for (const sectionId of Object.keys(currentAnswers)) {
                    for (const questionId of Object.keys(currentAnswers[sectionId])) {
                        const ans = currentAnswers[sectionId][questionId];
                        if (ans?.answer?.hasRecording && !ans?.answer?.audioUrl) {
                            missingAudioCount++;
                        }
                    }
                }

                if (missingAudioCount === 0) break; // All audio uploaded successfully

                console.log(`[AudioRetry] Attempt ${retry + 1}/${MAX_AUDIO_RETRIES}: ${missingAudioCount} audio(s) missing URL`);
                setSubmitStatus(`Đang tải lại ${missingAudioCount} file thu âm... (lần ${retry + 1}/${MAX_AUDIO_RETRIES})`);

                // Wait before retrying to give network time to recover
                if (retry > 0) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                }

                // Retry from IndexedDB cache
                if (submission?.id) {
                    try {
                        await retryPendingUploads(submission.id, uploadAudioAnswer, async (questionId, audioUrl) => {
                            const q = questions.find(qd => qd.id === questionId);
                            const sectionId = q?.sectionId;
                            if (sectionId) {
                                const updated = {
                                    ...answersRef.current,
                                    [sectionId]: {
                                        ...(answersRef.current[sectionId] || {}),
                                        [questionId]: { answer: { audioUrl, hasRecording: true }, submittedAt: new Date().toISOString() }
                                    }
                                };
                                answersRef.current = updated;
                            }
                        });
                    } catch (e) { console.warn(`[AudioOffline] Retry ${retry + 1} failed:`, e); }
                }

                // Also re-wait for any new in-flight uploads
                const newPending = Object.values(audioProcessingRef.current);
                if (newPending.length > 0) {
                    await Promise.allSettled(newPending);
                }
            }

            setSubmitStatus('Đang lưu bài...');

            // Use ref to get the freshest answers (state might be stale after await)
            const freshAnswers = answersRef.current;

            // Attempt to save with retry
            let saved = false;
            let lastError = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await saveExamSubmission({
                        id: submission.id, answers: freshAnswers,
                        status: 'submitted',
                        submittedAt: new Date().toISOString()
                    });
                    saved = true;
                    break;
                } catch (err) {
                    lastError = err;
                    console.error(`Submit attempt ${attempt + 1} failed:`, err);
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Wait 1s, 2s
                    }
                }
            }

            if (!saved) {
                throw lastError || new Error('Không thể nộp bài sau 3 lần thử');
            }

            // Clean up IndexedDB audio cache after successful submission
            clearAllForSubmission(submission.id).catch(() => {});

            // Notify group teachers about submission (fire-and-forget, OK to lose)
            if (assignment?.targetType === 'group' && assignment?.targetId) {
                import('../services/notificationService').then(({ createNotificationForGroupTeachers }) => {
                    createNotificationForGroupTeachers(assignment.targetId, {
                        type: 'exam_submitted',
                        title: '📩 Học viên nộp bài',
                        message: `${user?.displayName || user?.email || 'Học viên'} đã nộp bài "${exam?.name || 'Bài tập và Kiểm tra'}".`,
                        link: `/teacher/exam-submissions/${assignmentId}`
                    }).catch(e => console.error('Notification error:', e));
                }).catch(console.error);

                // Check 50% milestone and notify teachers (fire-and-forget)
                // Only run for teacher/admin — students lack Firestore permissions to query other submissions
                if (user?.role === 'teacher' || user?.role === 'admin') {
                    import('../services/examService').then(({ checkAndNotifyHalfSubmitted }) => {
                        checkAndNotifyHalfSubmitted(assignmentId, assignment.targetId, exam?.name || 'Bài tập và Kiểm tra', exam?.examType || 'exercise')
                            .catch(e => console.error('Half-submitted check error:', e));
                    }).catch(console.error);
                }
            }

            setConfirmSubmitAll(false);

            // AI grading — fire-and-forget (runs in background after navigation)
            // React Router SPA navigation does NOT abort in-flight JS promises
            gradeExamSubmission(submission.id, { ...submission, answers: freshAnswers }, questions, exam?.sections || [], assignment?.teacherTitle || '', assignment?.studentTitle || '')
                .catch(gradeErr => console.error('Grading error:', gradeErr));

            // Navigate to result page immediately — don't wait for grading
            navigate(`/exam-result?assignmentId=${assignmentId}&studentId=${user?.uid}`);
        } catch (error) {
            console.error('Submit error:', error);
            // Show error to user — do NOT close the confirm modal silently
            setInfoModal({
                isOpen: true,
                title: '❌ Lỗi nộp bài',
                message: 'Không thể nộp bài lúc này. Vui lòng kiểm tra kết nối mạng và thử lại. Bài làm của bạn vẫn được lưu tự động.',
                onConfirm: null
            });
        }
        setSubmitting(false);
        submitCalledRef.current = false;
    }

    if (loading) return (
        <div className="exam-loading"><div className="exam-loading-spinner"></div><p>Đang tải bài...</p></div>
    );
    if (!exam) return (
        <div className="exam-loading"><p>Không tìm thấy bài.</p></div>
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

                        {exam.examType === 'test' && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px dashed #fdba74' }}>
                                <span style={{ fontSize: '0.95rem', flexShrink: 0, marginTop: '1px' }}>🔕</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9a3412', lineHeight: 1.4 }}>Hãy chuyển điện thoại sang <strong>chế độ im lặng</strong> — các thông báo có thể bị ghi nhận như bạn đã rời khỏi trang làm bài và làm tăng chỉ số cảnh báo gian lận</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#eff6ff', border: '1px dashed #93c5fd' }}>
                            <span style={{ fontSize: '0.95rem', flexShrink: 0, marginTop: '1px' }}>📶</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e40af', lineHeight: 1.4 }}>Đảm bảo bạn có <strong>kết nối mạng ổn định</strong> trước khi bắt đầu làm bài</span>
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
    // Safety clamp: prevent out-of-bounds section index
    const safeSectionIdx = Math.min(currentSectionIdx, Math.max(sections.length - 1, 0));
    if (safeSectionIdx !== currentSectionIdx && sections.length > 0) {
        // Index went out of bounds (e.g. stale closure advanced past last section)
        setCurrentSectionIdx(safeSectionIdx);
    }
    const currentSection = sections[safeSectionIdx];
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
            {/* Submission overlay — blocks all interaction while submitting */}
            {submitting && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '20px', padding: '24px'
                }}>
                    <div style={{
                        width: '64px', height: '64px',
                        border: '4px solid rgba(255,255,255,0.15)',
                        borderTopColor: '#818cf8',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>
                            Đang nộp bài...
                        </p>
                        {submitStatus && (
                            <p style={{ color: '#c4b5fd', fontSize: '0.85rem', fontWeight: 500, margin: '0 0 8px', lineHeight: 1.4 }}>
                                {submitStatus}
                            </p>
                        )}
                        <p style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                            ⚠️ Vui lòng không tắt ứng dụng<br />hoặc chuyển sang trang khác
                        </p>
                    </div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
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
            <div className="exam-topbar" ref={topbarRef}>
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

            {/* Floating mini timer — visible when topbar is scrolled out of view */}
            {displayTimer !== null && (
                <div className={`exam-floating-timer ${showFloatingTimer ? 'visible' : ''} ${displayTimer < (timingMode === 'question' ? 10 : 300) ? 'warning' : ''}`}>
                    {formatTime(displayTimer)}
                </div>
            )}

            {/* Section header */}
            <div className="exam-section-header">
                <h2>{currentSection?.title || `Section ${currentSectionIdx + 1}`}</h2>
                <div className="exam-section-progress">
                    {Object.keys(currentSectionAnswers).length}/{sectionQuestions.length} câu đã trả lời
                </div>
            </div>

            {/* Context */}
            {hasContent(currentSection?.context) && (
                <div ref={contextSectionRef}>
                    <MemoizedContextRender htmlContent={parsedContext} />
                </div>
            )}
            {currentSection?.contextAudioUrl && (
                <div ref={!hasContent(currentSection?.context) ? contextSectionRef : undefined} style={{ margin: '0 auto', maxWidth: '800px', padding: '12px 20px' }}>
                    <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
                        </div>
                        <audio controls src={currentSection.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                    </div>
                </div>
            )}

            {/* Floating Context FAB + Overlay Panel */}
            {(hasContent(currentSection?.context) || currentSection?.contextAudioUrl) && (
                <>
                    {/* FAB button */}
                    <button
                        className={`exam-context-fab ${showContextFab || contextPanelOpen ? 'visible' : ''}`}
                        onClick={() => setContextPanelOpen(prev => !prev)}
                        aria-label="Xem ngữ cảnh"
                    >
                        {contextPanelOpen ? <X size={18} /> : <BookOpen size={18} />}
                        <span className="exam-context-fab-label">{contextPanelOpen ? 'Đóng' : 'Ngữ cảnh'}</span>
                    </button>

                    {/* Overlay panel — always in DOM to preserve scroll position */}
                    <div className={`exam-context-overlay ${contextPanelOpen ? 'open' : ''}`}>
                        <div className="exam-context-overlay-header">
                            <span>📖 Ngữ cảnh</span>
                            <button className="exam-context-overlay-close" onClick={() => setContextPanelOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="exam-context-overlay-body">
                            {hasContent(currentSection?.context) && (
                                <div className="exam-context-content ql-editor" dangerouslySetInnerHTML={{ __html: sanitizeHtml(parsedContext) }} />
                            )}
                            {currentSection?.contextAudioUrl && (
                                <div style={{ padding: '12px 0', marginTop: '8px' }}>
                                    <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
                                        </div>
                                        <audio controls src={currentSection.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Backdrop */}
                    {contextPanelOpen && (
                        <div className="exam-context-overlay-backdrop" onClick={() => setContextPanelOpen(false)} />
                    )}
                </>
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
                                <span className="exam-question-points">{(() => {
                                    const perItem = q.points || 1;
                                    let count = 1;
                                    if (q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing') {
                                        count = (variation?.text || '').match(/\{\{.+?\}\}/g)?.length || 1;
                                    } else if (q.type === 'matching') {
                                        count = (variation?.pairs || []).length || 1;
                                    } else if (q.type === 'categorization') {
                                        count = (variation?.items || []).length || 1;
                                    }
                                    return `${perItem * count} điểm`;
                                })()}</span>
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
                                    correctAnswers.push(decodeHtmlEntities(m[1]));
                                }

                                // Parse text into parts: plain text and blank slots
                                const parts = rawText.split(/(\{\{.+?\}\})/g);

                                // Build word bank: correct answers + distractors, shuffled
                                const distractors = (variation?.distractors || []).map(d => decodeHtmlEntities(d));
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
                                            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                                            onChange={e => setAnswer(currentSection.id, q.id, e.target.value)}
                                            onBlur={() => {
                                                if (submission?.id) {
                                                    saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired })
                                                        .catch(() => {});
                                                }
                                            }} />
                                    );
                                }

                                const blankRegex = /\{\{(.+?)\}\}/g;
                                const correctAnswers = [];
                                let m;
                                while ((m = blankRegex.exec(rawText)) !== null) {
                                    correctAnswers.push(decodeHtmlEntities(m[1]));
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
                                                        <span key={sIdx} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '2px 4px', maxWidth: '100%' }}>
                                                            <input
                                                                type="text"
                                                                value={filled}
                                                                placeholder={`(${idx + 1})`}
                                                                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                                                                onChange={e => {
                                                                    const newAnswer = { ...filledAnswers, [String(idx)]: e.target.value };
                                                                    setAnswer(currentSection.id, q.id, newAnswer);
                                                                }}
                                                                style={{
                                                                    display: 'inline-block',
                                                                    boxSizing: 'border-box',
                                                                    minWidth: '60px',
                                                                    maxWidth: '100%',
                                                                    width: `${Math.max(6, Math.ceil(filled.length * 0.8) + 1)}ch`,
                                                                    padding: '6px 8px',
                                                                    fontSize: '1rem',
                                                                    fontWeight: 600,
                                                                    borderRadius: '8px',
                                                                    border: '2px solid #e2e8f0',
                                                                    background: '#fff',
                                                                    color: '#1e293b',
                                                                    outline: 'none',
                                                                    textAlign: 'left',
                                                                    fontFamily: 'inherit',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                                                                onBlur={e => {
                                                                    e.target.style.borderColor = '#e2e8f0';
                                                                    if (submission?.id) {
                                                                        saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired })
                                                                            .catch(() => {});
                                                                    }
                                                                }}
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
                                    style={{ minHeight: '120px', resize: 'none', overflow: 'hidden' }}
                                    value={currentAnswer || ''}
                                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                                    onChange={e => {
                                        setAnswer(currentSection.id, q.id, e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onBlur={() => {
                                        if (submission?.id) {
                                            saveExamSubmission({ id: submission.id, answers: answersRef.current, sectionTimers, sectionExpired, questionTimers, questionExpired })
                                                .catch(() => {});
                                        }
                                    }}
                                    ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
                            )}

                            {/* Audio Recording */}
                            {q.type === 'audio_recording' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                                    <button
                                        type="button"
                                        disabled={currentAnswer?.hasRecording && recordingQuestionId !== q.id}
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
                                                        // Save answer immediately so it's not lost
                                                        setAnswer(currentSection.id, q.id, {
                                                            hasRecording: true
                                                        });
                                                        // Cache blob to IndexedDB first (offline safety net)
                                                        if (submission?.id) {
                                                            saveAudioToCache(submission.id, q.id, blob, mimeType).catch(() => {});
                                                        }
                                                        // Upload audio to Storage silently in background (AI grading happens later)
                                                        const processingPromise = (async () => {
                                                            try {
                                                                const audioUrl = submission?.id
                                                                    ? await uploadAudioAnswer(blob, submission.id, q.id)
                                                                    : null;
                                                                setAnswer(currentSection.id, q.id, {
                                                                    audioUrl: audioUrl || '',
                                                                    hasRecording: true
                                                                });
                                                                // Upload succeeded — remove from IndexedDB cache
                                                                if (submission?.id) {
                                                                    removeAudioFromCache(submission.id, q.id).catch(() => {});
                                                                }
                                                            } catch (err) {
                                                                console.error('Audio upload error (blob cached in IndexedDB for retry):', err);
                                                                setAnswer(currentSection.id, q.id, {
                                                                    audioUrl: '',
                                                                    hasRecording: true
                                                                });
                                                            }
                                                            delete audioProcessingRef.current[q.id];
                                                        })();
                                                        audioProcessingRef.current[q.id] = processingPromise;

                                                        // Auto-advance after recording: wait for upload to complete, THEN advance
                                                        // This prevents the race condition where exam submits before audio is uploaded
                                                        // NOTE: Capture section index at recording time — only auto-advance if still on that section
                                                        const capturedSectionId = currentSection?.id;
                                                        const capturedSectionIdx = currentSectionIdx;
                                                        const capturedSectionQuestions = sectionQuestions;
                                                        const capturedTotalSections = sections.length;
                                                        processingPromise.finally(() => {
                                                            if (timingMode === 'question') {
                                                                // Question mode: advance to next question in section
                                                                const qIdx = capturedSectionQuestions.findIndex(sq => sq.id === q.id);
                                                                if (qIdx < capturedSectionQuestions.length - 1) {
                                                                    setCurrentQuestionIdx(qIdx + 1);
                                                                    window.scrollTo(0, 0);
                                                                } else {
                                                                    // Last question in section — advance to next section or submit
                                                                    setCurrentSectionIdx(prev => {
                                                                        // Guard: only act if still on the section where recording was made
                                                                        if (prev !== capturedSectionIdx) return prev; // Already moved past — no-op
                                                                        if (prev >= capturedTotalSections - 1) {
                                                                            // At last section — auto submit
                                                                            handleSubmitAll(true);
                                                                            return prev;
                                                                        }
                                                                        setCurrentQuestionIdx(0);
                                                                        window.scrollTo(0, 0);
                                                                        return prev + 1;
                                                                    });
                                                                }
                                                            } else {
                                                                // Section/Exam mode: check if all questions in current section are answered
                                                                const allAnswered = capturedSectionQuestions.every(sq => {
                                                                    const ans = answersRef.current[capturedSectionId]?.[sq.id];
                                                                    if (sq.type === 'audio_recording') return ans?.answer?.hasRecording || (sq.id === q.id); // just recorded this one
                                                                    if (sq.type === 'essay' || sq.type === 'fill_in_blank_typing') return ans?.answer && String(ans.answer).trim().length > 0;
                                                                    return ans?.answer !== undefined && ans?.answer !== null && ans?.answer !== '';
                                                                });
                                                                if (allAnswered) {
                                                                    setCurrentSectionIdx(prev => {
                                                                        // Guard: only act if still on the section where recording was made
                                                                        if (prev !== capturedSectionIdx) return prev; // Already moved past — no-op
                                                                        if (prev >= capturedTotalSections - 1) {
                                                                            // At last section — auto submit
                                                                            handleSubmitAll(true);
                                                                            return prev;
                                                                        }
                                                                        window.scrollTo(0, 0);
                                                                        return prev + 1;
                                                                    });
                                                                }
                                                            }
                                                        });
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
                                            border: 'none',
                                            background: recordingQuestionId === q.id
                                                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                                : (currentAnswer?.hasRecording
                                                    ? '#cbd5e1'
                                                    : 'linear-gradient(135deg, #6366f1, #4f46e5)'),
                                            color: '#fff', fontSize: '1.5rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: recordingQuestionId === q.id
                                                ? '0 0 0 6px rgba(239,68,68,0.2)'
                                                : (currentAnswer?.hasRecording ? 'none' : '0 4px 15px rgba(99,102,241,0.3)'),
                                            transition: 'all 0.3s ease',
                                            animation: recordingQuestionId === q.id ? 'pulse 1.5s infinite' : 'none',
                                            cursor: (currentAnswer?.hasRecording && recordingQuestionId !== q.id) ? 'not-allowed' : 'pointer',
                                            opacity: (currentAnswer?.hasRecording && recordingQuestionId !== q.id) ? 0.5 : 1
                                        }}
                                    >
                                        {recordingQuestionId === q.id ? '⏹' : '🎤'}
                                    </button>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                                        {recordingQuestionId === q.id
                                                ? '🔴 Đang ghi âm... Bấm để dừng'
                                                : currentAnswer?.hasRecording
                                                    ? '✅ Đã ghi âm câu trả lời'
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
                            {/* Matching - Drag to reorder right column */}
                            {q.type === 'matching' && (() => {
                                const pairs = variation?.pairs || [];
                                const allRights = pairs.map(p => p.right || '');

                                // Initialize answer with shuffled rights if not yet set
                                let currentSlots = Array.isArray(currentAnswer) && currentAnswer.length === pairs.length
                                    ? currentAnswer
                                    : null;

                                if (!currentSlots) {
                                    const shuffled = [...allRights].sort((a, b) => {
                                        const ha = (a + q.id + 'salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                        const hb = (b + q.id + 'salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                        return ha - hb;
                                    });
                                    currentSlots = shuffled.map(t => ({ text: t }));
                                    setTimeout(() => setAnswer(currentSection.id, q.id, currentSlots), 0);
                                }

                                // Helper: apply shift animations using actual row heights
                                const applyShiftClasses = (qId, fromIdx, hoverIdx) => {
                                    const allRows = document.querySelectorAll(`[data-match-q="${qId}"] .exam-match-swap-row`);
                                    const chips = document.querySelectorAll(`[data-match-q="${qId}"] .exam-match-swap-right`);
                                    chips.forEach((chip, idx) => {
                                        chip.classList.remove('drag-hover');
                                        chip.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
                                        if (hoverIdx === null || hoverIdx === fromIdx) {
                                            chip.style.transform = '';
                                            return;
                                        }
                                        if (idx === hoverIdx && idx !== fromIdx) {
                                            chip.classList.add('drag-hover');
                                        }
                                        // Calculate shift distance = height of the source row + gap
                                        const sourceRowH = allRows[fromIdx] ? allRows[fromIdx].getBoundingClientRect().height + 12 : 60;
                                        if (fromIdx < hoverIdx && idx > fromIdx && idx <= hoverIdx) {
                                            // Dragging down → items shift UP
                                            chip.style.transform = `translateY(-${sourceRowH}px)`;
                                        } else if (fromIdx > hoverIdx && idx >= hoverIdx && idx < fromIdx) {
                                            // Dragging up → items shift DOWN
                                            chip.style.transform = `translateY(${sourceRowH}px)`;
                                        } else {
                                            chip.style.transform = '';
                                        }
                                    });
                                };

                                const clearShiftClasses = (qId) => {
                                    const chips = document.querySelectorAll(`[data-match-q="${qId}"] .exam-match-swap-right`);
                                    chips.forEach(r => {
                                        r.classList.remove('drag-hover');
                                        r.style.transform = '';
                                        r.style.transition = '';
                                    });
                                };

                                const addSettleAnimation = (qId, fromIdx, toIdx) => {
                                    const rows = document.querySelectorAll(`[data-match-q="${qId}"] .exam-match-swap-right`);
                                    const min = Math.min(fromIdx, toIdx);
                                    const max = Math.max(fromIdx, toIdx);
                                    for (let i = min; i <= max; i++) {
                                        if (rows[i]) {
                                            rows[i].classList.add('just-settled');
                                            setTimeout(() => rows[i]?.classList.remove('just-settled'), 400);
                                        }
                                    }
                                };

                                // Desktop HTML5 drag
                                const handleDragStart = (e, pIdx) => {
                                    e.dataTransfer.setData('fromIdx', String(pIdx));
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.target.style.opacity = '0.4';
                                    window._desktopDragFrom = pIdx;
                                    window._desktopDragQId = q.id;
                                };
                                const handleDragEnd = (e) => {
                                    e.target.style.opacity = '1';
                                    clearShiftClasses(q.id);
                                    window._desktopDragFrom = null;
                                };
                                const handleDragOver = (e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                };
                                const handleDragEnter = (e, toIdx) => {
                                    if (window._desktopDragFrom !== null && window._desktopDragQId === q.id) {
                                        applyShiftClasses(q.id, window._desktopDragFrom, toIdx);
                                    }
                                };
                                const handleDrop = (e, toIdx) => {
                                    e.preventDefault();
                                    const fromIdx = parseInt(e.dataTransfer.getData('fromIdx'));
                                    if (isNaN(fromIdx) || fromIdx === toIdx) return;
                                    clearShiftClasses(q.id);
                                    const newAnswer = [...currentSlots];
                                    const [moved] = newAnswer.splice(fromIdx, 1);
                                    newAnswer.splice(toIdx, 0, moved);
                                    setAnswer(currentSection.id, q.id, newAnswer);
                                    setTimeout(() => addSettleAnimation(q.id, fromIdx, toIdx), 50);
                                };


                                const handleTouchStart = (e, pIdx) => {
                                    const touch = e.touches[0];
                                    const target = e.currentTarget;
                                    const rect = target.getBoundingClientRect();

                                    // Create floating clone
                                    const clone = target.cloneNode(true);
                                    clone.className = 'exam-match-drag-clone';
                                    clone.style.cssText = `
                                        position: fixed; z-index: 9999;
                                        width: ${rect.width}px;
                                        left: ${touch.clientX - rect.width / 2}px;
                                        top: ${touch.clientY - 25}px;
                                        pointer-events: none;
                                        opacity: 0.9;
                                        transform: scale(1.08);
                                        transition: none;
                                    `;
                                    document.body.appendChild(clone);

                                    // Mark source
                                    target.classList.add('dragging-source');

                                    window._matchDrag = {
                                        fromIdx: pIdx,
                                        clone,
                                        sourceEl: target,
                                        qId: q.id,
                                        sectionId: currentSection.id,
                                        slots: currentSlots,
                                        hoverIdx: null
                                    };

                                    // Register non-passive listeners for preventDefault
                                    document.addEventListener('touchmove', handleTouchMove, { passive: false });
                                    document.addEventListener('touchend', handleTouchEnd);
                                };

                                const handleTouchMove = (e) => {
                                    const drag = window._matchDrag;
                                    if (!drag) return;
                                    e.preventDefault();
                                    const touch = e.touches[0];
                                    const rect = drag.clone.getBoundingClientRect();
                                    drag.clone.style.left = `${touch.clientX - rect.width / 2}px`;
                                    drag.clone.style.top = `${touch.clientY - 25}px`;

                                    // Find which row we're hovering over (use rows, not chips - chips are transformed)
                                    const rows = document.querySelectorAll(`[data-match-q="${drag.qId}"] .exam-match-swap-row`);
                                    let newHover = null;
                                    rows.forEach((row, idx) => {
                                        const r = row.getBoundingClientRect();
                                        if (touch.clientY >= r.top && touch.clientY <= r.bottom) {
                                            newHover = idx;
                                        }
                                    });

                                    if (newHover !== drag.hoverIdx) {
                                        drag.hoverIdx = newHover;
                                        applyShiftClasses(drag.qId, drag.fromIdx, newHover);
                                    }
                                };

                                const handleTouchEnd = (e) => {
                                    const drag = window._matchDrag;
                                    if (!drag) return;

                                    // Remove listeners
                                    document.removeEventListener('touchmove', handleTouchMove);
                                    document.removeEventListener('touchend', handleTouchEnd);

                                    // Cleanup
                                    drag.clone.remove();
                                    drag.sourceEl.classList.remove('dragging-source');
                                    clearShiftClasses(drag.qId);

                                    // Insert at new position
                                    if (drag.hoverIdx !== null && drag.hoverIdx !== drag.fromIdx) {
                                        const newAnswer = [...drag.slots];
                                        const [moved] = newAnswer.splice(drag.fromIdx, 1);
                                        newAnswer.splice(drag.hoverIdx, 0, moved);
                                        setAnswer(drag.sectionId, q.id, newAnswer);
                                        setTimeout(() => addSettleAnimation(drag.qId, drag.fromIdx, drag.hoverIdx), 50);
                                    }

                                    window._matchDrag = null;
                                };

                                return (
                                    <div className="exam-matching-swap" data-match-q={q.id}>
                                        <div className="exam-match-swap-instruction">
                                            Kéo thả đáp án bên phải để sắp xếp lại
                                        </div>
                                        <div className="exam-match-swap-pairs">
                                            {pairs.map((pair, pIdx) => {
                                                const slotValue = currentSlots[pIdx]?.text || '';
                                                return (
                                                    <div key={pIdx} className="exam-match-swap-row"
                                                        onDragOver={handleDragOver}
                                                        onDragEnter={e => handleDragEnter(e, pIdx)}
                                                        onDrop={e => handleDrop(e, pIdx)}>
                                                        <div className="exam-match-swap-num">{pIdx + 1}</div>
                                                        <div className="exam-match-swap-left">
                                                            {pair.left}
                                                        </div>
                                                        <div className="exam-match-swap-divider">—</div>
                                                        <div
                                                            className="exam-match-swap-right"
                                                            draggable
                                                            onDragStart={e => handleDragStart(e, pIdx)}
                                                            onDragEnd={handleDragEnd}
                                                            onTouchStart={e => handleTouchStart(e, pIdx)}
                                                        >
                                                            <span className="exam-match-swap-grip">⠿</span>
                                                            <span className="exam-match-swap-value">{slotValue}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                                const shuffledItems = correctItems.map((item, i) => ({ item, i })).sort((a, b) => {
                                    // Better hash: use a seed-based mixing function for proper distribution
                                    const hashStr = (str) => {
                                        let h = 0x811c9dc5;
                                        for (let j = 0; j < str.length; j++) {
                                            h ^= str.charCodeAt(j);
                                            h = Math.imul(h, 0x01000193);
                                        }
                                        return h >>> 0;
                                    };
                                    const ha = hashStr(a.item + '|' + a.i + '|' + q.id);
                                    const hb = hashStr(b.item + '|' + b.i + '|' + q.id);
                                    return ha - hb;
                                }).map(x => x.item);
                                // Current answer: array of strings in the order the student picked
                                const orderedAnswer = Array.isArray(currentAnswer) ? currentAnswer : [];
                                // Count-based filtering to handle duplicate items (e.g. two "I"s)
                                const usedCounts = {};
                                orderedAnswer.forEach(item => { usedCounts[item] = (usedCounts[item] || 0) + 1; });
                                const remainingCounts = { ...usedCounts };
                                const availableItems = shuffledItems.filter(item => {
                                    if ((remainingCounts[item] || 0) > 0) {
                                        remainingCounts[item]--;
                                        return false;
                                    }
                                    return true;
                                });

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
                                <button className="exam-btn exam-btn-secondary" onClick={async () => {
                                    await stopActiveRecording();
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
                                        // Persist timer state for section switch
                                        saveExamSubmission({ id: submission.id, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: currentSectionIdx - 1, lastActiveQuestionIdx: Math.max(0, lastAvail) }).catch(() => {});
                                    }
                                    window.scrollTo(0, 0);
                                }}>
                                    <ChevronLeft size={16} /> Câu trước
                                </button>
                            )
                        ) : (
                            canGoPrevSection && (
                                <button className="exam-btn exam-btn-secondary" onClick={async () => { await stopActiveRecording(); const prevIdx = currentSectionIdx - 1; setCurrentSectionIdx(prevIdx); saveExamSubmission({ id: submission.id, sectionTimers: sectionTimersLatest.current, sectionExpired: sectionExpiredLatest.current, questionTimers: questionTimersLatest.current, questionExpired: questionExpiredLatest.current, timersSavedAt: new Date().toISOString(), lastActiveSectionIdx: prevIdx, lastActiveQuestionIdx: currentQuestionIdxRef.current }).catch(() => {}); window.scrollTo(0, 0); }}>
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
                                    <button className="exam-btn exam-btn-primary" onClick={async () => {
                                        await stopActiveRecording();
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
            {confirmSubmitSection && (() => {
                const sectionTimeRemaining = timingMode === 'section' && currentSection ? sectionTimers[currentSection.id] : null;
                const hasTimeLeft = sectionTimeRemaining !== null && sectionTimeRemaining > 0;
                const formatTime = (s) => {
                    const m = Math.floor(s / 60);
                    const sec = s % 60;
                    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
                };
                return (
                    <div className="exam-modal-overlay">
                        <div className="exam-modal">
                            <h3>Chuyển section?</h3>
                            <p>Bạn đã trả lời {Object.keys(currentSectionAnswers).length}/{sectionQuestions.length} câu. Chuyển sang section tiếp theo?</p>
                            {hasTimeLeft && (
                                <div style={{
                                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px',
                                    padding: '10px 16px', marginBottom: '20px', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>
                                        ⏱ Thời gian còn lại: <strong>{formatTime(sectionTimeRemaining)}</strong>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
                                        Bạn vẫn có thể quay lại section này vì còn thời gian
                                    </div>
                                </div>
                            )}
                            <div className="exam-modal-actions">
                                <button className="exam-btn exam-btn-secondary" onClick={() => setConfirmSubmitSection(false)}>Quay lại</button>
                                <button className="exam-btn exam-btn-primary" onClick={handleNextSection}>Tiếp tục</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Confirm submit all */}
            {confirmSubmitAll && (() => {
                // Compute unanswered count across ALL sections
                const allSections = exam?.sections || [];
                let totalQuestions = 0;
                let answeredQuestions = 0;
                allSections.forEach(s => {
                    const sQs = questions.filter(q => q.sectionId === s.id);
                    totalQuestions += sQs.length;
                    const sAns = answers[s.id] || {};
                    sQs.forEach(q => { if (sAns[q.id]) answeredQuestions++; });
                });
                const unansweredCount = totalQuestions - answeredQuestions;

                // Format remaining time
                const fmtTime = (s) => {
                    if (s === null || s === undefined) return null;
                    const m = Math.floor(s / 60);
                    const sec = s % 60;
                    return `${m} phút ${sec < 10 ? '0' : ''}${sec} giây`;
                };
                const timeStr = fmtTime(displayTimer);

                return (
                    <div className="exam-modal-overlay">
                        <div className="exam-modal">
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <AlertTriangle size={40} color="#f59e0b" />
                            </div>
                            <h3>Nộp {exam?.examType === 'test' ? 'bài kiểm tra' : 'bài tập'}?</h3>
                            {timeStr && (
                                <div style={{
                                    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
                                    padding: '12px 16px', marginBottom: '12px', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 700 }}>
                                        ⏱ Bạn còn <strong>{timeStr}</strong>
                                    </div>
                                </div>
                            )}
                            {unansweredCount > 0 ? (
                                <p style={{ color: '#dc2626', fontWeight: 600 }}>
                                    ⚠️ Bạn chưa hoàn thành <strong>{unansweredCount}/{totalQuestions}</strong> câu. Bạn có chắc muốn nộp bài?
                                </p>
                            ) : (
                                <p>Bạn đã hoàn thành tất cả {totalQuestions} câu. Sau khi nộp, bạn không thể sửa câu trả lời.</p>
                            )}
                            <div className="exam-modal-actions">
                                <button className="exam-btn exam-btn-secondary" onClick={() => setConfirmSubmitAll(false)}>Quay lại</button>
                                <button className="exam-btn exam-btn-primary exam-btn-submit" onClick={() => handleSubmitAll(false)} disabled={submitting}>
                                    {submitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
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
