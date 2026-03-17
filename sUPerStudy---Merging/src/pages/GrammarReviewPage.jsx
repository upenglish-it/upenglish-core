import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { getGrammarQuestionsByIds } from '../services/grammarService';
import { getDueGrammarReviewIds, updateGrammarProgress } from '../services/grammarSpacedRepetition';
import { gradeGrammarSubmissionWithAI } from '../services/aiGrammarService';
import { evaluateAudioAnswer } from '../services/aiService';
import { ArrowLeft, CheckCircle, XCircle, BrainCircuit, PlayCircle, Award, Sparkles, BookOpen, Sun, Moon } from 'lucide-react';
import { useScrollToContent } from '../hooks/useScrollToContent';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import confetti from 'canvas-confetti';
import 'react-quill-new/dist/quill.snow.css';
import './LearnPage.css'; // Reusing LearnPage styles for consistency
import MarkdownText from '../components/common/MarkdownText';
import { useAntiCopy } from '../hooks/useAntiCopy';

export default function GrammarReviewPage() {
    const { user } = useAuth();
    const { settings } = useAppSettings();
    const navigate = useNavigate();
    useAntiCopy();

    const [questions, setQuestions] = useState([]);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light');
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: Small, 1: Medium, 2: Large

    const toggleTheme = () => {
        const streak = parseInt(localStorage.getItem('userStreak') || '0', 10);
        const themes = ['light'];
        if (streak >= 5) themes.push('dark');
        if (streak >= 15) themes.push('silver');
        if (streak >= 25) themes.push('gold');
        if (streak >= 35) themes.push('diamond');
        if (streak >= 50) themes.push('ruby');
        const currentIdx = themes.indexOf(theme);
        const next = themes[(currentIdx + 1) % themes.length];
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('appTheme', next);
    };

    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [feedback, setFeedback] = useState(null); // { isCorrect: bool, message: string, aiFeedback: string }
    const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, skipped: 0 }); // Track stats for summary

    const [currentQuestionData, setCurrentQuestionData] = useState(null);
    const contentRef = useScrollToContent(!!feedback);
    const activeWordRef = useRef(null);
    const batchIndicatorRef = useRef(null);

    // Audio recording state
    const [audioBlob, setAudioBlob] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        if (!user?.uid) {
            navigate('/');
            return;
        }
        loadData();
    }, [user?.uid]);

    async function loadData() {
        setLoading(true);
        try {
            const dueQuestions = await getDueGrammarReviewIds(user?.uid);

            if (dueQuestions.length === 0) {
                setQuestions([]);
                setOriginalQuestions([]);
                setLoading(false);
                return;
            }

            const pMap = {};
            dueQuestions.forEach(q => {
                pMap[q.questionId] = q;
            });

            const ids = dueQuestions.map(q => q.questionId);
            const rawQuestions = await getGrammarQuestionsByIds(ids);

            // Filter unpassed questions for the initial run
            const unpassed = rawQuestions.filter(q => {
                const prog = pMap[q.id];
                // In review mode, we actually want to review them even if passed, 
                // because Spaced Repetition decided they are due!
                // But specifically we show variations they haven't passed or we cycle.
                // For review, ALL due questions should be added to the queue initially.
                return true;
            });

            const initialQs = unpassed.length > 0 ? unpassed : [];

            setQuestions(initialQs);
            setOriginalQuestions(rawQuestions);
            setProgressMap(pMap);
            prepareNextQuestion(0, initialQs, pMap);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    function prepareNextQuestion(index, qs = questions, pm = progressMap) {
        if (index >= qs.length) {
            setCurrentIndex(index);
            setCurrentQuestionData(null);
            return;
        }

        const q = qs[index];
        const prog = pm[q.id] || {};

        let variationIndexToShow = 0;

        const passed = prog.variationsPassed || [];
        const attempted = prog.variationsAttemptedSession || [];

        // Helper: shuffle an array randomly (Fisher-Yates)
        const shuffled = (arr) => {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const allIdxs = [0, 1, 2, 3, 4].filter(v => q.variations[v] && (q.variations[v].text || q.variations[v].content));

        // Try to pick a random unpassed variation that hasn't been attempted this session
        const untriedIdxs = shuffled(allIdxs.filter(v => !passed.includes(v) && !attempted.includes(v)));
        let unseen = untriedIdxs[0];

        // If all unpassed have been attempted this session, fallback to a random unpassed one
        if (unseen === undefined) {
            const unpassedIdxs = shuffled(allIdxs.filter(v => !passed.includes(v)));
            unseen = unpassedIdxs[0];
        }

        variationIndexToShow = unseen !== undefined ? unseen : shuffled(allIdxs)[0] ?? 0; // if all passed or none found, pick random

        const variation = q.variations[variationIndexToShow];

        let initialAnswer = '';
        let extraData = {};

        if (q.type === 'matching') {
            const rights = variation.pairs ? variation.pairs.map(p => p.right) : [];
            initialAnswer = rights.map((text, index) => ({ id: `right-${index}`, text })).sort(() => Math.random() - 0.5);
        } else if (q.type === 'categorization') {
            const cols = { unassigned: [] };
            (variation.groups || []).forEach(g => {
                cols[g] = [];
            });
            (variation.items || []).forEach((item, index) => {
                cols.unassigned.push({ id: `item-${index}`, ...item, originalIndex: index });
            });
            initialAnswer = cols;
        } else if (q.type === 'ordering') {
            const shuffledItems = [...(variation.items || [])].sort(() => Math.random() - 0.5);
            initialAnswer = { pool: shuffledItems, answer: [] };
        } else if ((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && /\{\{.+?\}\}/.test(variation.text || '')) {
            initialAnswer = {};
            const blankRegex = /\{\{(.+?)\}\}/g;
            const correctWords = [];
            let bm;
            while ((bm = blankRegex.exec(variation.text || '')) !== null) { correctWords.push(bm[1].replace(/&nbsp;/g, ' ')); }
            const distractors = (variation.distractors || []).map(d => d.replace(/&nbsp;/g, ' '));
            const shuffled = [...correctWords, ...distractors].sort(() => Math.random() - 0.5);
            extraData.wordBank = shuffled;
            extraData.correctWords = correctWords;
        } else if (q.type === 'fill_in_blank_typing' && /\{\{.+?\}\}/.test(variation.text || '')) {
            initialAnswer = {};
            const blankRegex = /\{\{(.+?)\}\}/g;
            const correctWords = [];
            let bm;
            while ((bm = blankRegex.exec(variation.text || '')) !== null) { correctWords.push(bm[1].replace(/&nbsp;/g, ' ')); }
            extraData.correctWords = correctWords;
        }

        setCurrentQuestionData({
            questionRef: q,
            variationIndex: variationIndexToShow,
            variation: variation,
            ...extraData
        });
        setCurrentIndex(index);
        setCurrentAnswer(initialAnswer);
        setFeedback(null);
        setAudioBlob(null);
        setIsRecording(false);
    }

    async function handleCheckResponse(overrideAnswer) {
        if (isChecking) return;

        const answerToCheck = typeof overrideAnswer === 'string' ? overrideAnswer : currentAnswer;
        const { questionRef, variationIndex, variation } = currentQuestionData;

        // Ensure an answer is provided for text-based questions
        if (['essay'].includes(questionRef.type) && typeof answerToCheck === 'string' && !answerToCheck.trim()) {
            return;
        }
        if (['fill_in_blank', 'fill_in_blanks'].includes(questionRef.type) && typeof answerToCheck === 'string' && !answerToCheck.trim()) {
            return;
        }

        if (questionRef.type === 'categorization' && (answerToCheck?.unassigned?.length > 0)) {
            return;
        }
        if (questionRef.type === 'ordering' && (answerToCheck?.pool?.length > 0)) {
            return;
        }
        if (questionRef.type === 'matching' && (!Array.isArray(answerToCheck) || answerToCheck.length < (variation.pairs?.length || 0))) {
            return;
        }

        setIsChecking(true);
        if (typeof overrideAnswer === 'string') {
            setCurrentAnswer(overrideAnswer);
        }

        try {
            let isCorrect = false;
            let aiResponse = null;

            if (questionRef.type === 'multiple_choice') {
                // correctAnswer is an index (0, 1, 2, 3) pointing to the options array
                const correctAnswerText = variation.options[variation.correctAnswer];
                isCorrect = answerToCheck === correctAnswerText;
            } else if (questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks' || questionRef.type === 'fill_in_blank_typing') {
                const markerRegex = /\{\{(.+?)\}\}/g;
                const cWords = [];
                let cm;
                while ((cm = markerRegex.exec(variation.text || '')) !== null) { cWords.push(cm[1].replace(/&nbsp;/g, ' ')); }

                if (cWords.length > 0 && typeof answerToCheck === 'object' && answerToCheck !== null) {
                    let correctCount = 0;
                    cWords.forEach((cw, idx) => {
                        const sw = answerToCheck[String(idx)];
                        if (typeof sw === 'string' && sw.trim().toLowerCase() === cw.trim().toLowerCase()) {
                            correctCount++;
                        }
                    });
                    isCorrect = correctCount === cWords.length && cWords.length > 0;
                } else {
                    isCorrect = typeof answerToCheck === 'string' && answerToCheck.trim().toLowerCase() === variation.correctAnswer?.trim().toLowerCase();
                }
            } else if (questionRef.type === 'categorization') {
                let allCorrect = true;
                (variation.groups || []).forEach(g => {
                    const itemsInGroup = answerToCheck[g] || [];
                    itemsInGroup.forEach(item => {
                        if (item.group !== g) allCorrect = false;
                    });
                });
                isCorrect = allCorrect;
            } else if (questionRef.type === 'ordering') {
                const correctItems = variation.items || [];
                const studentOrder = answerToCheck?.answer || [];
                isCorrect = correctItems.length > 0 && correctItems.every((item, i) => studentOrder[i] === item);
            } else if (questionRef.type === 'matching') {
                let allCorrect = true;
                (variation.pairs || []).forEach((pair, i) => {
                    if (answerToCheck[i]?.text !== pair.right) allCorrect = false;
                });
                isCorrect = allCorrect;
            } else if (questionRef.type === 'essay') {
                // Use AI for essay or complex checks
                const gradeResult = await gradeGrammarSubmissionWithAI(
                    variation.text,
                    answerToCheck,
                    questionRef.purpose,
                    questionRef.type,
                    questionRef.specialRequirement || '',
                    (questionRef.context || '') + (questionRef.contextScript ? '\n\n[SCRIPT / TRANSCRIPT CỦA BÀI NGHE/VIDEO]:\n' + questionRef.contextScript : ''),
                    location.state?.teacherTitle || '', // Pass teacherTitle if available
                    location.state?.studentTitle || '' // Pass studentTitle if available
                );

                // If the score string indicates high confidence or correctness, we can parse it.
                // Assuming gradeResult.score is out of 10.
                const numericScore = parseInt(gradeResult.score, 10);
                isCorrect = numericScore >= 8;
                aiResponse = gradeResult.feedback;
            } else if (questionRef.type === 'audio_recording') {
                // Use AI to grade audio answer
                const gradeResult = await evaluateAudioAnswer(
                    audioBlob,
                    variation.text || questionRef.purpose,
                    questionRef.purpose,
                    questionRef.specialRequirement || '',
                    10,
                    (questionRef.context || '') + (questionRef.contextScript ? '\n\n[SCRIPT / TRANSCRIPT CỦA BÀI NGHE/VIDEO]:\n' + questionRef.contextScript : ''),
                    location.state?.teacherTitle || '', // Pass teacherTitle if available
                    location.state?.studentTitle || '' // Pass studentTitle if available
                );
                const numericScore = parseInt(gradeResult.score, 10);
                isCorrect = numericScore >= 8;
                aiResponse = gradeResult.feedback;
                if (gradeResult.transcript) {
                    aiResponse = `📝 Transcript: "${gradeResult.transcript}"\n\n${aiResponse}`;
                }
            }

            setSessionStats(prev => ({
                ...prev,
                correct: isCorrect ? prev.correct + 1 : prev.correct,
                wrong: !isCorrect ? prev.wrong + 1 : prev.wrong
            }));

            // Update Progress in DB
            await updateGrammarProgress(user.uid, questionRef.id, questionRef.exerciseId, isCorrect, variationIndex);

            setFeedback({
                isCorrect,
                message: isCorrect ? 'Chính xác!' : 'Chưa đúng, thử lại sau nhé.',
                aiFeedback: aiResponse || variation.explanation
            });

            // Update Progress in State
            setProgressMap(prev => {
                const currProg = prev[questionRef.id] || { variationsPassed: [], variationsAttemptedSession: [] };
                return {
                    ...prev,
                    [questionRef.id]: {
                        ...currProg,
                        variationsPassed: isCorrect && !currProg.variationsPassed?.includes(variationIndex) ? [...(currProg.variationsPassed || []), variationIndex] : currProg.variationsPassed,
                        variationsAttemptedSession: !currProg.variationsAttemptedSession?.includes(variationIndex) ? [...(currProg.variationsAttemptedSession || []), variationIndex] : currProg.variationsAttemptedSession
                    }
                };
            });

            // Reinsert to queue if wrong (spaced repetition)
            if (!isCorrect) {
                setQuestions(prev => {
                    const newQuestions = [...prev];
                    const reinsertOffset = Math.floor(Math.random() * 3) + 2; // Insert 2-4 positions later
                    const insertPos = Math.min(currentIndex + reinsertOffset, newQuestions.length);
                    newQuestions.splice(insertPos, 0, questionRef);
                    return newQuestions;
                });
            }

        } catch (error) {
            console.error(error);
            alert("Đã xảy ra lỗi khi chấm bài.");
        }
        setIsChecking(false);
    }

    function onDragEnd(result) {
        if (!result.destination) return;
        const { source, destination } = result;

        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (currentQuestionData?.questionRef?.type === 'matching') {
            // New layout: each Droppable is 'row-N', drag swaps items between rows
            const srcIdx = parseInt(source.droppableId.replace('row-', ''), 10);
            const dstIdx = parseInt(destination.droppableId.replace('row-', ''), 10);
            if (isNaN(srcIdx) || isNaN(dstIdx) || srcIdx === dstIdx) return;
            const newAnswer = Array.from(currentAnswer);
            const temp = newAnswer[srcIdx];
            newAnswer[srcIdx] = newAnswer[dstIdx];
            newAnswer[dstIdx] = temp;
            setCurrentAnswer(newAnswer);
            return;
        }

        const newAnswer = { ...currentAnswer };
        const sourceCol = [...(newAnswer[source.droppableId] || [])];
        const destCol = [...(newAnswer[destination.droppableId] || [])];

        const [removed] = sourceCol.splice(source.index, 1);

        if (source.droppableId === destination.droppableId) {
            sourceCol.splice(destination.index, 0, removed);
            newAnswer[source.droppableId] = sourceCol;
        } else {
            destCol.splice(destination.index, 0, removed);
            newAnswer[source.droppableId] = sourceCol;
            newAnswer[destination.droppableId] = destCol;
        }

        setCurrentAnswer(newAnswer);
    }

    function handleNext() {
        prepareNextQuestion(currentIndex + 1);
    }

    // Auto-check on Enter for simple inputs
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                if (feedback) {
                    e.preventDefault();
                    handleNext();
                } else if (!isChecking) {
                    const { questionRef } = currentQuestionData || {};
                    // Only auto-submit for non-essay questions
                    if (questionRef && questionRef.type !== 'essay' && currentAnswer && Object.keys(currentAnswer || {}).length > 0) {
                        e.preventDefault();
                        handleCheckResponse();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [feedback, isChecking, currentAnswer, currentQuestionData]);

    // Auto-scroll active indicator
    useEffect(() => {
        if (activeWordRef.current) {
            const el = activeWordRef.current;
            const timer = setTimeout(() => {
                el.scrollIntoView({
                    inline: 'center',
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }, 50);
            return () => clearTimeout(timer);
        }
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [currentIndex, currentQuestionData?.questionRef?.id]);

    async function handleSkip() {
        if (!isChecking && !feedback) {
            // Treat as correct answer to fast-forward
            setIsChecking(true);
            const { questionRef, variationIndex } = currentQuestionData;

            try {
                setSessionStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));

                // Update Progress in DB as correct
                await updateGrammarProgress(user.uid, questionRef.id, questionRef.exerciseId, true, variationIndex);

                setFeedback({
                    isCorrect: true,
                    message: 'Bỏ qua nhanh',
                    aiFeedback: 'Hệ thống đã tự động tính đúng câu này để bạn có thể xem lướt qua nhanh.'
                });

                // Update Progress in State as passed
                setProgressMap(prev => {
                    const currProg = prev[questionRef.id] || { variationsPassed: [], variationsAttemptedSession: [] };
                    return {
                        ...prev,
                        [questionRef.id]: {
                            ...currProg,
                            variationsPassed: !currProg.variationsPassed?.includes(variationIndex) ? [...(currProg.variationsPassed || []), variationIndex] : currProg.variationsPassed,
                            variationsAttemptedSession: !currProg.variationsAttemptedSession?.includes(variationIndex) ? [...(currProg.variationsAttemptedSession || []), variationIndex] : currProg.variationsAttemptedSession
                        }
                    };
                });

            } catch (error) {
                console.error(error);
            }
            setIsChecking(false);
        }
    }


    if (loading) return <div className="loading-screen"><div className="admin-empty-state">Đang tải bài luyện...</div></div>;

    const isInitiallyMastered = originalQuestions.length > 0 && questions.length === 0 && sessionStats.correct === 0 && sessionStats.wrong === 0 && sessionStats.skipped === 0;

    if (isInitiallyMastered) {
        return (
            <div className="learn-page">
                <div className="learn-complete animate-slide-up" style={{ justifyContent: 'center', gap: 'var(--space-xl)' }}>
                    <div className="learn-complete-icon">🎉</div>
                    <h2 className="learn-complete-title">Tuyệt vời!</h2>
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                        Bạn đã hoàn thành phiên ôn tập Kỹ năng.<br />
                    </p>
                    <div className="learn-complete-actions">
                        <button className="btn btn-primary" onClick={() => {
                            setQuestions([...originalQuestions]);
                            setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
                            prepareNextQuestion(0, [...originalQuestions], progressMap);
                        }}>
                            🔄 Ôn tập lại từ đầu
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Quay lại</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentQuestionData && currentIndex >= questions.length) {
        const totalAttempts = sessionStats.correct + sessionStats.wrong;
        const efficiency = totalAttempts > 0 ? Math.round((sessionStats.correct / totalAttempts) * 100) : 100;

        const ringColor = efficiency >= 90 ? 'var(--color-success)'
            : efficiency >= 70 ? 'var(--color-warning)'
                : 'var(--color-error)';

        const heading = efficiency >= 90 ? 'Xuất sắc!'
            : efficiency >= 70 ? 'Tốt lắm!'
                : efficiency >= 50 ? 'Khá tốt!'
                    : 'Cần cố gắng thêm!';

        const icon = efficiency >= 90 ? '🏆' : efficiency >= 70 ? '🎉' : efficiency >= 50 ? '👍' : '💪';

        if (efficiency >= 50) {
            setTimeout(() => {
                confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            }, 300);
        }

        return (
            <div className="learn-page">
                <div className="learn-complete animate-slide-up">
                    <div className="learn-complete-icon">{icon}</div>
                    <h1 className="learn-complete-title">{heading}</h1>
                    <p className="learn-complete-topic">Phiên ôn tập</p>

                    {/* Completion badge */}
                    <div style={{ textAlign: 'center', margin: 'var(--space-md) 0' }}>
                        <span style={{ background: 'var(--color-success)', color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✅ Hoàn thành 100% Kỹ năng
                        </span>
                    </div>

                    {/* Efficiency Score Ring */}
                    <div className="learn-complete-score">
                        <div className="learn-complete-score-ring">
                            <svg viewBox="0 0 100 100" className="learn-score-svg">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="42" fill="none"
                                    stroke={ringColor}
                                    strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={`${efficiency * 2.64} 264`}
                                    transform="rotate(-90 50 50)"
                                    className="learn-score-circle"
                                />
                            </svg>
                            <span className="learn-complete-pct">{efficiency}%</span>
                        </div>
                        <p className="learn-complete-detail" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                            Hiệu quả làm bài
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                            {sessionStats.correct} đúng / {totalAttempts} lần trả lời
                            {sessionStats.wrong > 0 && <span style={{ color: 'var(--color-error)' }}> • {sessionStats.wrong} lỗi sai</span>}
                            {sessionStats.skipped > 0 && <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Đã bỏ qua: {sessionStats.skipped} câu</span>}
                        </p>
                    </div>

                    <div className="learn-complete-actions" style={{ justifyContent: 'center', marginTop: '32px' }}>
                        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ minWidth: '150px' }}>
                            <ArrowLeft size={20} /> Về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentQuestionData) return null;

    const { questionRef, variation } = currentQuestionData;
    const progressPct = ((currentIndex) / questions.length) * 100;

    // Helper to auto-convert raw YouTube links (from copy-paste) into embedded videos
    const parseContextHtml = (html) => {
        if (!html) return '';

        // This regex matches an iframe, OR an anchor with a youtube link, OR a plain youtube URL.
        // It prevents replacing URLs that are already part of an iframe's src.
        const regex = /<iframe[^>]*>.*?<\/iframe>|<a[^>]*href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^"]*)"[^>]*>.*?<\/a>|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^\s<"]*)/gi;

        let parsed = html.replace(regex, (match, aUrl, aVideoId, rawUrl, rawVideoId) => {
            if (match.toLowerCase().startsWith('<iframe')) {
                return match; // Leave existing iframes untouched
            }
            const videoId = aVideoId || rawVideoId;
            if (videoId) {
                return `<iframe class="ql-video" style="width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; border: none; height: auto;" src="https://www.youtube.com/embed/${videoId}?showinfo=0" frameborder="0" allowfullscreen></iframe>`;
            }
            return match;
        });

        return parsed;
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

    return (
        <div className="learn-page" style={{ paddingBottom: feedback ? '160px' : '100px' }}>
            {/* Topbar matching LearnPage.jsx */}
            <div className="learn-topbar">
                <button className="btn btn-ghost learn-topbar-back" onClick={() => navigate(-1)}>
                    ✕
                </button>
                <div className="learn-progress-wrapper">
                    <div className="learn-topbar-title">Ôn tập Kỹ năng</div>
                    <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${progressPct}%`, transition: 'width 0.3s ease' }} />
                    </div>
                </div>
                <div className="learn-topbar-actions">
                    <span className="learn-topbar-count">
                        {currentIndex + 1}/{questions.length}
                    </span>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setFontSizeLevel(prev => (prev + 1) % 3)}
                        style={{ padding: '8px', color: 'var(--text-muted)' }}
                        title="Thay đổi kích thước chữ"
                    >
                        <span style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                            A{fontSizeLevel === 0 ? '-' : fontSizeLevel === 2 ? '+' : ''}
                        </span>
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={toggleTheme}
                        style={{ padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    {settings?.devBypassEnabled && (
                        <button
                            className="btn btn-ghost"
                            onClick={handleSkip}
                            disabled={!!feedback || isChecking}
                            style={{ padding: '8px', color: 'var(--text-muted)' }}
                            title="Bỏ qua câu này để làm sau"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                                <line x1="19" y1="5" x2="19" y2="19"></line>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Indicator row */}
            <div className="learn-batch-indicator" ref={batchIndicatorRef}>
                {originalQuestions.map((q, i) => {
                    const prog = progressMap[q.id] || {};
                    // If they have passed at least 1 variation, or passed it in this session => considered done
                    const isDoneSession = sessionStats.correct > 0 && prog.variationsAttemptedSession?.length > 0 && prog.variationsPassed?.length > 0;
                    const isDoneDb = prog.variationsPassed?.length > 0;
                    // Actually, if we just check if it's no longer in the "remaining" queue (except current):
                    // Since it drops out or stays, checking if we've passed it in the current run is better.
                    // A simple check: has variationsPassed length > 0.
                    const isDone = isDoneDb || isDoneSession;
                    const isActive = currentQuestionData?.questionRef?.id === q.id;

                    let dotClass = 'learn-mastery-dot';
                    if (isDone) dotClass += ' learn-mastery-dot--filled';
                    else if (prog.variationsAttemptedSession?.length > 0) dotClass += ' learn-mastery-dot--error'; // Attempted but failed this session

                    return (
                        <div
                            key={q.id}
                            className="learn-batch-word-wrapper"
                            ref={isActive ? activeWordRef : null}
                        >
                            <div className={`learn-batch-word ${isActive ? 'learn-batch-word--active' : ''} ${isDone ? 'learn-batch-word--done' : ''}`}>
                                <span>{i + 1}</span>
                                {isDone && <span className="learn-batch-check">✓</span>}
                            </div>
                            <div className="learn-mastery-dots" style={{ opacity: isActive ? 1 : 0.6 }}>
                                <div className={dotClass} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="learn-content animate-fade-in" ref={contentRef} data-font-size={fontSizeLevel}>
                <div className="learn-step" style={{ position: 'relative' }}>
                    {/* Mục tiêu removed as requested */}

                    <div className="learn-step-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px' }}>

                        {/* Context Area */}
                        {questionRef.hasContext && questionRef.context && (
                            <div className="learn-example glass-card--static" style={{ width: '100%', maxWidth: '100%', padding: '0', marginBottom: 'var(--space-lg)', overflow: 'hidden', border: 'none', background: 'transparent' }}>
                                <div
                                    className="ql-editor grammar-context-editor"
                                    style={{ padding: 0, fontSize: '1.2rem', lineHeight: 1.6, color: 'var(--text-primary)' }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseContextHtml(questionRef.context)) }}
                                />
                            </div>
                        )}
                        {questionRef.contextAudioUrl && (
                            <div style={{ width: '100%', maxWidth: '100%', marginBottom: 'var(--space-lg)', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success, #10b981)' }}>🎵 Audio ngữ cảnh</span>
                                </div>
                                <audio controls src={questionRef.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                            </div>
                        )}

                        {/* Question Text and Input Area Combined for Fill in Blank */}
                        {(questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks') && /\{\{.+?\}\}/.test(variation.text || '') ? (() => {
                            const textHtml = sanitizeHtml(variation.text || '', true);
                            const parts = textHtml.split(/(\{\{.+?\}\})/g);

                            const correctWords = currentQuestionData?.correctWords || [];
                            const wordBank = currentQuestionData?.wordBank || [];
                            const answer = currentAnswer || {};
                            const usedWords = Object.values(answer);
                            const availableWords = wordBank.filter(w => {
                                const usedCount = usedWords.filter(u => u === w).length;
                                const totalCount = wordBank.filter(bw => bw === w).length;
                                return usedCount < totalCount;
                            });

                            let blankCounter = 0;

                            const renderInlineText = () => {
                                return parts.map((part, index) => {
                                    if (part.startsWith('{{') && part.endsWith('}}')) {
                                        const idx = blankCounter++;
                                        const filled = answer[String(idx)];
                                        const isCorrect = feedback && filled && filled.trim().toLowerCase() === correctWords[idx]?.trim().toLowerCase();
                                        const isWrong = feedback && filled && !isCorrect;

                                        let classes = "learn-inline-blank";
                                        if (filled) classes += " filled";
                                        if (isCorrect) classes += " correct";
                                        if (isWrong) classes += " wrong";
                                        if (filled && !feedback) classes += " clickable";

                                        return (
                                            <span
                                                key={`blank-${idx}`}
                                                className={classes}
                                                draggable={!feedback && filled ? true : false}
                                                onDragStart={(e) => {
                                                    if (feedback || !filled) return;
                                                    e.dataTransfer.setData('text/plain', filled);
                                                    e.dataTransfer.setData('sourceIdx', String(idx));
                                                }}
                                                onDragOver={(e) => {
                                                    if (feedback) return;
                                                    e.preventDefault();
                                                    e.currentTarget.classList.add('drag-over');
                                                }}
                                                onDragEnter={(e) => {
                                                    if (feedback) return;
                                                    e.preventDefault();
                                                }}
                                                onDragLeave={(e) => {
                                                    e.currentTarget.classList.remove('drag-over');
                                                }}
                                                onDrop={(e) => {
                                                    if (feedback) return;
                                                    e.preventDefault();
                                                    e.currentTarget.classList.remove('drag-over');

                                                    const word = e.dataTransfer.getData('text/plain');
                                                    const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                                    if (word) {
                                                        const newAns = { ...answer };

                                                        // Swap if coming from another slot
                                                        if (sourceIdx !== '') {
                                                            if (filled) {
                                                                newAns[sourceIdx] = filled;
                                                            } else {
                                                                delete newAns[sourceIdx];
                                                            }
                                                        }

                                                        newAns[String(idx)] = word;
                                                        setCurrentAnswer(newAns);
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (filled && !feedback) {
                                                        const newAns = { ...answer };
                                                        delete newAns[String(idx)];
                                                        setCurrentAnswer(newAns);
                                                    }
                                                }}
                                            >
                                                {filled ? filled : <span className="learn-inline-blank-empty-text">({idx + 1})</span>}
                                            </span>
                                        );
                                    } else {
                                        // It's normal HTML part
                                        return <span key={`text-${index}`} dangerouslySetInnerHTML={{ __html: part }} />;
                                    }
                                });
                            };

                            return (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div className="grammar-question-container">
                                        <div className="grammar-question-text inline-blanks-container">
                                            {renderInlineText()}
                                        </div>
                                    </div>

                                    {/* Word bank */}
                                    {!feedback && (
                                        <div className="grammar-word-bank">
                                            {availableWords.length === 0 ? (
                                                <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem', alignSelf: 'center' }}>✓ Đã chọn hết</span>
                                            ) : availableWords.map((word, wi) => (
                                                <button key={wi} type="button"
                                                    className="grammar-word-bank-item"
                                                    draggable={true}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('text/plain', word);
                                                    }}
                                                    onClick={() => {
                                                        // Find first empty slot
                                                        const emptyIdx = correctWords.findIndex((_, i) => !answer[String(i)]);
                                                        if (emptyIdx !== -1) {
                                                            setCurrentAnswer({ ...answer, [String(emptyIdx)]: word });
                                                        }
                                                    }}
                                                >{word}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })() : (
                            // Legacy Non-Fill-In-Blank Question Text
                            // NOTE: fill_in_blank_typing renders its own inputs block below
                            questionRef.type !== 'fill_in_blank_typing' ? (
                                <div className="grammar-question-container">
                                    <div className="grammar-question-text"
                                        dangerouslySetInnerHTML={{
                                            __html: sanitizeHtml(variation.text || '')
                                        }}
                                    />
                                </div>
                            ) : null
                        )}

                        {/* Fill in Blank Typing - students type into input fields */}
                        {questionRef.type === 'fill_in_blank_typing' && /\{\{.+?\}\}/.test(variation.text || '') && (() => {
                            const textHtml = sanitizeHtml(variation.text || '', true);
                            const parts = textHtml.split(/(\{\{.+?\}\})/g);
                            const correctWords = currentQuestionData?.correctWords || [];
                            const answer = currentAnswer || {};
                            let blankCounter = 0;

                            const renderInlineInputs = () => {
                                return parts.map((part, index) => {
                                    if (part.startsWith('{{') && part.endsWith('}}')) {
                                        const idx = blankCounter++;
                                        const filled = answer[String(idx)] || '';
                                        const isCorrect = feedback && filled && filled.trim().toLowerCase() === correctWords[idx]?.trim().toLowerCase();
                                        const isWrong = feedback && filled && !isCorrect;
                                        const isEmpty = feedback && !filled;

                                        return (
                                            <span key={`blank-${idx}`} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '2px 4px' }}>
                                                <input
                                                    type="text"
                                                    value={filled}
                                                    disabled={!!feedback}
                                                    placeholder={`(${idx + 1})`}
                                                    onChange={e => {
                                                        if (feedback) return;
                                                        setCurrentAnswer({ ...answer, [String(idx)]: e.target.value });
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
                                                        border: feedback
                                                            ? (isCorrect ? '2px solid #10b981' : '2px solid #ef4444')
                                                            : '2px solid var(--border-color)',
                                                        background: feedback
                                                            ? (isCorrect ? '#ecfdf5' : '#fef2f2')
                                                            : 'var(--bg-input, #fff)',
                                                        color: feedback
                                                            ? (isCorrect ? '#065f46' : '#991b1b')
                                                            : 'var(--text-primary)',
                                                        outline: 'none',
                                                        textAlign: 'center',
                                                        fontFamily: 'inherit',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                />
                                                {isWrong && (
                                                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginLeft: '4px' }}>
                                                        ({correctWords[idx]})
                                                    </span>
                                                )}
                                                {isEmpty && (
                                                    <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginLeft: '4px' }}>
                                                        ({correctWords[idx]})
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    } else {
                                        return <span key={`text-${index}`} dangerouslySetInnerHTML={{ __html: part }} />;
                                    }
                                });
                            };

                            return (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div className="grammar-question-container">
                                        <div className="grammar-question-text inline-blanks-container">
                                            {renderInlineInputs()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Input Area (For non fill-in-blanks) */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
                            {questionRef.type === 'multiple_choice' && (
                                <div className="learn-options learn-options--vertical" style={{ width: '100%', maxWidth: '600px' }}>
                                    {variation.options && variation.options.map((opt, i) => {
                                        if (!opt) return null;
                                        const isSelected = currentAnswer === opt;
                                        const isActualCorrect = i === variation.correctAnswer;
                                        const showCorrect = feedback && isActualCorrect;
                                        const showWrong = feedback && !feedback.isCorrect && isSelected;

                                        let optionClass = 'learn-option';
                                        if (isSelected && !feedback) optionClass += ' learn-option--selected'; // We might need a slightly different style or just rely on default hover
                                        if (showCorrect) optionClass += ' learn-option--correct';
                                        if (showWrong) optionClass += ' learn-option--wrong';
                                        if (feedback && !showCorrect && !showWrong) optionClass += ' learn-option--dim';

                                        // Apply inline style for selected state before submission to give visual feedback
                                        const selectedStyle = isSelected && !feedback ? { borderColor: 'var(--color-primary)', background: 'rgba(108, 92, 231, 0.08)' } : {};

                                        return (
                                            <button
                                                key={i}
                                                className={optionClass}
                                                style={{ ...selectedStyle, ...(isImageOption(opt) ? { padding: '8px', justifyContent: 'center' } : {}) }}
                                                onClick={() => {
                                                    if (!feedback) {
                                                        handleCheckResponse(opt);
                                                    }
                                                }}
                                                disabled={!!feedback || isChecking}
                                            >
                                                <OptionContent opt={opt} />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Essay textarea */}
                            {questionRef.type === 'essay' && (
                                <textarea
                                    value={currentAnswer || ''}
                                    onChange={(e) => setCurrentAnswer(e.target.value)}
                                    disabled={!!feedback}
                                    placeholder="Nhập câu trả lời của bạn..."
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        minHeight: '150px',
                                        padding: '20px',
                                        fontSize: '1.2rem',
                                        borderRadius: '16px',
                                        border: `2px solid ${feedback ? (feedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)') : 'var(--border-color)'}`,
                                        outline: 'none',
                                        resize: 'vertical',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-body)'
                                    }}
                                />
                            )}

                            {/* Audio Recording */}
                            {questionRef.type === 'audio_recording' && (
                                <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    {!feedback && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (isRecording) {
                                                        mediaRecorderRef.current?.stop();
                                                        setIsRecording(false);
                                                    } else {
                                                        try {
                                                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                                            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                                                                : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/aac';
                                                            const recorder = new MediaRecorder(stream, { mimeType });
                                                            audioChunksRef.current = [];
                                                            recorder.ondataavailable = (e) => {
                                                                if (e.data.size > 0) audioChunksRef.current.push(e.data);
                                                            };
                                                            recorder.onstop = () => {
                                                                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                                                                setAudioBlob(blob);
                                                                stream.getTracks().forEach(t => t.stop());
                                                            };
                                                            mediaRecorderRef.current = recorder;
                                                            recorder.start();
                                                            setIsRecording(true);
                                                            setAudioBlob(null);
                                                        } catch (err) {
                                                            console.error('Microphone access error:', err);
                                                            alert('Không thể truy cập micro. Vui lòng kiểm tra quyền truy cập.');
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    width: '80px', height: '80px', borderRadius: '50%',
                                                    border: 'none', cursor: 'pointer',
                                                    background: isRecording
                                                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                                        : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #4f46e5))',
                                                    color: '#fff', fontSize: '2rem',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: isRecording
                                                        ? '0 0 0 8px rgba(239,68,68,0.2), 0 4px 20px rgba(239,68,68,0.4)'
                                                        : '0 4px 20px rgba(99,102,241,0.3)',
                                                    transition: 'all 0.3s ease',
                                                    animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                                                }}
                                            >
                                                {isRecording ? '⏹' : '🎤'}
                                            </button>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                                                {isRecording ? '🔴 Đang ghi âm... Bấm để dừng' : (audioBlob ? 'Đã ghi âm xong! Bấm Kiểm tra để gửi bài.' : 'Bấm nút micro để bắt đầu ghi âm')}
                                            </p>
                                        </>
                                    )}
                                    {audioBlob && (
                                        <audio controls src={URL.createObjectURL(audioBlob)} style={{
                                            width: '100%', maxWidth: '400px', borderRadius: '12px'
                                        }} />
                                    )}
                                </div>
                            )}

                            {/* Legacy fill-in-blank fallback (no markers) */}
                            {(questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks') && !/\{\{.+?\}\}/.test(variation.text || '') && (
                                <textarea
                                    value={currentAnswer || ''}
                                    onChange={(e) => setCurrentAnswer(e.target.value)}
                                    disabled={!!feedback}
                                    placeholder="Nhập câu trả lời của bạn..."
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        minHeight: '80px',
                                        padding: '20px',
                                        fontSize: '1.2rem',
                                        borderRadius: '16px',
                                        border: `2px solid ${feedback ? (feedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)') : 'var(--border-color)'}`,
                                        outline: 'none',
                                        resize: 'vertical',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-body)'
                                    }}
                                />
                            )}

                            {/* Ordering question */}
                            {questionRef.type === 'ordering' && currentAnswer && (() => {
                                const { pool = [], answer: orderedAnswer = [] } = currentAnswer;
                                const handleSelectItem = (item) => {
                                    if (feedback) return;
                                    setCurrentAnswer(prev => ({
                                        pool: prev.pool.filter(i => i !== item),
                                        answer: [...prev.answer, item]
                                    }));
                                };
                                const handleRemoveItem = (idx) => {
                                    if (feedback) return;
                                    const item = orderedAnswer[idx];
                                    setCurrentAnswer(prev => ({
                                        pool: [...prev.pool, item],
                                        answer: prev.answer.filter((_, i) => i !== idx)
                                    }));
                                };
                                const correctItems = variation?.items || [];
                                return (
                                    <div className="exam-ordering-container" style={{ width: '100%', maxWidth: '600px' }}>
                                        <div className="exam-ordering-answer-zone">
                                            <div className="exam-ordering-answer-title">Thứ tự của bạn:</div>
                                            <div className="exam-ordering-answer-list">
                                                {orderedAnswer.length === 0 && (
                                                    <div className="exam-ordering-placeholder">Nhấn vào các thẻ bên dưới theo đúng thứ tự</div>
                                                )}
                                                {orderedAnswer.map((item, idx) => {
                                                    const isCorrectPos = feedback ? item === correctItems[idx] : null;
                                                    return (
                                                        <div key={`ans-${idx}`}
                                                            className="exam-ordering-chip answer"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            style={{
                                                                cursor: feedback ? 'default' : 'pointer',
                                                                borderColor: isCorrectPos === true ? '#10b981' : isCorrectPos === false ? '#ef4444' : undefined,
                                                                background: isCorrectPos === true ? '#d1fae5' : isCorrectPos === false ? '#fee2e2' : undefined,
                                                                color: isCorrectPos === true ? '#065f46' : isCorrectPos === false ? '#991b1b' : undefined
                                                            }}>
                                                            <span className="exam-ordering-chip-number" style={{
                                                                background: isCorrectPos === true ? '#10b981' : isCorrectPos === false ? '#ef4444' : undefined
                                                            }}>{idx + 1}</span>
                                                            <span>{item}</span>
                                                            {isCorrectPos === false && (
                                                                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: '#059669' }}>Đúng: {correctItems[idx]}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="exam-ordering-pool">
                                            <div className="exam-ordering-pool-title">Các mục cần sắp xếp</div>
                                            <div className="exam-ordering-pool-items">
                                                {pool.length === 0 && orderedAnswer.length > 0 && (
                                                    <div className="exam-ordering-pool-empty">Đã sắp xếp hết các mục</div>
                                                )}
                                                {pool.map((item, idx) => (
                                                    <div key={`pool-${idx}`}
                                                        className="exam-ordering-chip pool"
                                                        onClick={() => handleSelectItem(item)}
                                                        style={{ cursor: feedback ? 'default' : 'pointer' }}>
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {questionRef.type === 'categorization' && currentAnswer && currentAnswer.unassigned && (
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '800px' }}>
                                        {/* Unassigned Pool */}
                                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '2px dashed var(--border-color)' }}>
                                            <div style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>Kéo các từ vào đúng nhóm</div>
                                            <Droppable droppableId="unassigned" direction="horizontal">
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '50px', justifyContent: 'center', background: snapshot.isDraggingOver ? 'rgba(108, 92, 231, 0.1)' : 'transparent', borderRadius: '12px', transition: 'background 0.2s', padding: '8px' }}
                                                    >
                                                        {(currentAnswer.unassigned || []).map((item, index) => (
                                                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!!feedback}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        style={{
                                                                            userSelect: 'none',
                                                                            padding: '9px 14px',
                                                                            margin: '0',
                                                                            background: snapshot.isDragging ? 'var(--color-primary)' : 'var(--bg-primary)',
                                                                            color: snapshot.isDragging ? '#fff' : 'var(--text-primary)',
                                                                            borderRadius: '8px',
                                                                            boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.2)' : '0 2px 5px rgba(0,0,0,0.05)',
                                                                            border: '1px solid var(--border-color)',
                                                                            fontWeight: 600,
                                                                            fontSize: '0.9rem',
                                                                            ...provided.draggableProps.style
                                                                        }}
                                                                    >
                                                                        {item.text}
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>

                                        {/* Group Columns */}
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${variation.groups.length}, 1fr)`, gap: '16px' }}>
                                            {(variation.groups || []).map(group => {
                                                const items = currentAnswer[group] || [];
                                                return (
                                                    <div key={group} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-input)', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                                                        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
                                                            {group}
                                                        </div>
                                                        <Droppable droppableId={group}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                    style={{ flex: 1, padding: '12px', minHeight: '150px', background: snapshot.isDraggingOver ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                                >
                                                                    {items.map((item, index) => {
                                                                        const isAnsCorrect = feedback && item.group === group;
                                                                        const isAnsWrong = feedback && item.group !== group;
                                                                        let borderColor = 'var(--border-color)';
                                                                        let bgColor = 'var(--bg-primary)';
                                                                        if (isAnsCorrect) { borderColor = 'var(--color-success)'; bgColor = 'rgba(16, 185, 129, 0.1)'; }
                                                                        if (isAnsWrong) { borderColor = 'var(--color-error)'; bgColor = 'rgba(239, 68, 68, 0.1)'; }

                                                                        return (
                                                                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!!feedback}>
                                                                                {(provided, snapshot) => (
                                                                                    <div
                                                                                        ref={provided.innerRef}
                                                                                        {...provided.draggableProps}
                                                                                        {...provided.dragHandleProps}
                                                                                        style={{
                                                                                            userSelect: 'none',
                                                                                            padding: '10px',
                                                                                            background: snapshot.isDragging ? 'var(--color-primary)' : bgColor,
                                                                                            color: snapshot.isDragging ? '#fff' : 'var(--text-primary)',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.2)' : 'none',
                                                                                            border: `2px solid ${borderColor}`,
                                                                                            fontWeight: 600,
                                                                                            fontSize: '0.9rem',
                                                                                            ...provided.draggableProps.style
                                                                                        }}
                                                                                    >
                                                                                        {item.text}
                                                                                        {isAnsWrong && (
                                                                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginTop: '4px' }}>
                                                                                                Đúng là: {item.group}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </Draggable>
                                                                        );
                                                                    })}
                                                                    {provided.placeholder}
                                                                </div>
                                                            )}
                                                        </Droppable>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </DragDropContext>
                            )}

                            {questionRef.type === 'matching' && currentAnswer && Array.isArray(currentAnswer) && (
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', width: '100%', maxWidth: '800px', alignItems: 'stretch' }}>
                                        {(variation.pairs || []).map((pair, i) => {
                                            const item = currentAnswer[i];
                                            const isAnsCorrect = feedback && item?.text === pair.right;
                                            const isAnsWrong = feedback && item?.text !== pair.right;
                                            let leftBorder = 'transparent';
                                            let leftBg = 'var(--bg-secondary)';
                                            if (isAnsCorrect) { leftBorder = 'var(--color-success)'; leftBg = 'rgba(16, 185, 129, 0.1)'; }
                                            if (isAnsWrong) { leftBorder = 'var(--color-error)'; leftBg = 'rgba(239, 68, 68, 0.1)'; }
                                            let rightBorder = 'var(--border-color)';
                                            let rightBg = 'var(--bg-primary)';
                                            if (isAnsCorrect) { rightBorder = 'var(--color-success)'; rightBg = 'rgba(16, 185, 129, 0.1)'; }
                                            if (isAnsWrong) { rightBorder = 'var(--color-error)'; rightBg = 'rgba(239, 68, 68, 0.1)'; }

                                            return (
                                                <React.Fragment key={`pair-${i}`}>
                                                    <div className="grammar-matching-item" style={{ minHeight: '100px', padding: '16px 18px', background: leftBg, border: `2px solid ${leftBorder}`, borderRadius: '12px', display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.0rem', boxSizing: 'border-box', height: 'auto', alignSelf: 'stretch' }}>
                                                        {pair.left}
                                                    </div>
                                                    <Droppable droppableId={`row-${i}`}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.droppableProps}
                                                                style={{ display: 'flex', alignItems: 'stretch', background: snapshot.isDraggingOver ? 'rgba(108, 92, 231, 0.05)' : 'transparent', borderRadius: '12px', transition: 'background 0.2s', minHeight: '100px' }}
                                                            >
                                                                {item && (
                                                                    <Draggable key={item.id} draggableId={item.id} index={0} isDragDisabled={!!feedback}>
                                                                        {(provided, snapshot) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                {...provided.dragHandleProps}
                                                                                style={{
                                                                                    userSelect: 'none',
                                                                                    minHeight: '100px',
                                                                                    padding: '16px 18px',
                                                                                    margin: '0',
                                                                                    width: '100%',
                                                                                    background: snapshot.isDragging ? 'var(--color-primary)' : rightBg,
                                                                                    color: snapshot.isDragging ? '#fff' : 'var(--text-primary)',
                                                                                    borderRadius: '12px',
                                                                                    boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                                                                                    border: `2px solid ${rightBorder}`,
                                                                                    fontWeight: 600,
                                                                                    fontSize: '1.0rem',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'space-between',
                                                                                    boxSizing: 'border-box',
                                                                                    ...provided.draggableProps.style
                                                                                }}
                                                                            >
                                                                                <span>{item.text}</span>
                                                                                <span style={{ color: snapshot.isDragging ? '#fff' : 'var(--text-muted)', cursor: 'grab' }}>
                                                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <line x1="8" y1="6" x2="21" y2="6"></line>
                                                                                        <line x1="8" y1="12" x2="21" y2="12"></line>
                                                                                        <line x1="8" y1="18" x2="21" y2="18"></line>
                                                                                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                                                                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                                                                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                                                                    </svg>
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                )}
                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    {/* Feedback details */}
                                    {feedback && !feedback.isCorrect && (
                                        <div style={{ marginTop: '24px', width: '100%', maxWidth: '800px', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <h4 style={{ color: 'var(--color-error)', marginBottom: '12px', fontSize: '1.1rem' }}>Đáp án đúng:</h4>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {(variation.pairs || []).map((pair, i) => (
                                                    <li key={`ans-${i}`} style={{ color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, flex: 1 }}>{pair.left}</span>
                                                        <span style={{ color: 'var(--text-muted)', padding: '0 16px' }}>&rarr;</span>
                                                        <span style={{ color: 'var(--color-success)', fontWeight: 600, flex: 1 }}>{pair.right}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </DragDropContext>
                            )}
                        </div>

            {/* Bottom Bar using shared styles */}
            {feedback ? (
                <div className={`learn-bottom-bar ${feedback.isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                    <div className="learn-bottom-bar-inner">
                        <div className="learn-bottom-bar-content">
                            <div className="learn-bottom-bar-title">{feedback.isCorrect ? 'Chính xác!' : 'Chưa đúng rồi'}</div>

                            {!feedback.isCorrect && questionRef.type === 'multiple_choice' && (
                                <div className="learn-bottom-bar-subtitle">
                                    Đáp án: {isImageOption(variation.options[variation.correctAnswer])
                                        ? <img src={variation.options[variation.correctAnswer]} alt="Đáp án" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, verticalAlign: 'middle' }} />
                                        : <strong>{variation.options[variation.correctAnswer]}</strong>}
                                </div>
                            )}

                            {!feedback.isCorrect && (questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks' || questionRef.type === 'fill_in_blank_typing') && (() => {
                                const markerRegex = /\{\{(.+?)\}\}/g;
                                const cw = [];
                                let m2;
                                while ((m2 = markerRegex.exec(variation.text || '')) !== null) { cw.push(m2[1].replace(/&nbsp;/g, ' ')); }
                                if (cw.length > 0) {
                                    return (
                                        <div className="learn-bottom-bar-subtitle">
                                            Đáp án: {cw.map((w, i) => <strong key={i} style={{ marginRight: '8px' }}>({i + 1}) {w}</strong>)}
                                        </div>
                                    );
                                }
                                return (
                                    <div className="learn-bottom-bar-subtitle">
                                        Đáp án: <strong>{variation.correctAnswer}</strong>
                                    </div>
                                );
                            })()}

                            {feedback.aiFeedback && (
                                <div style={{ marginTop: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5, display: 'flex', gap: '8px' }}>
                                    <Sparkles size={16} color="var(--color-primary-light)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ color: 'var(--color-primary-light)' }}>Giải thích: </strong>
                                        <MarkdownText>{feedback.aiFeedback}</MarkdownText>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                        <button className="btn btn-primary" onClick={handleNext}>Tiếp tục →</button>
                    </div>
                </div>
            ) : questionRef?.type !== 'multiple_choice' && (
                <div className="floating-bottom-btn-wrapper">
                    <button
                        className="btn btn-primary"
                        onClick={() => handleCheckResponse()}
                        disabled={
                            isChecking ||
                            (questionRef?.type === 'categorization' && (currentAnswer?.unassigned?.length > 0)) ||
                            (questionRef?.type === 'ordering' && (currentAnswer?.pool?.length > 0)) ||
                            (questionRef?.type === 'matching' && (!Array.isArray(currentAnswer) || currentAnswer.length < (variation?.pairs?.length || 0))) ||
                            (questionRef?.type === 'essay' && (!currentAnswer || (typeof currentAnswer === 'string' && !currentAnswer.trim()))) ||
                            (questionRef?.type === 'audio_recording' && !audioBlob) ||
                            (['fill_in_blank', 'fill_in_blanks'].includes(questionRef?.type) && typeof currentAnswer === 'string' && !currentAnswer?.trim()) ||
                            (['fill_in_blank', 'fill_in_blanks'].includes(questionRef?.type) && typeof currentAnswer === 'object' && currentAnswer !== null && Object.keys(currentAnswer).length < (currentQuestionData?.correctWords?.length || 1))
                        }
                        style={{
                            padding: '12px 24px',
                            minWidth: '120px',
                            borderRadius: '16px',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '1rem',
                            width: 'auto',
                            maxWidth: 'none'
                        }}
                    >
                        {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
                    </button>
                </div>
            )}
                    </div>
                </div>
            </div>
        </div>
    );
}
