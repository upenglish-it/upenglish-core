import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGrammarQuestions } from '../services/grammarService';
import { getGrammarProgress, updateGrammarProgress } from '../services/grammarSpacedRepetition';
import { gradeGrammarSubmissionWithAI, gradeFillInBlankBlanksWithAI } from '../services/aiGrammarService';
import { evaluateAudioAnswer } from '../services/aiService';
import { getPromptById } from '../services/promptService';
import { ArrowLeft, CheckCircle, XCircle, BrainCircuit, PlayCircle, Award, Sparkles, BookOpen } from 'lucide-react';
import { useScrollToContent } from '../hooks/useScrollToContent';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import confetti from 'canvas-confetti';
import 'react-quill-new/dist/quill.snow.css';
import { getRecentLists, logRecentList } from '../services/recentService';
import './LearnPage.css'; // Reusing LearnPage styles for consistency
import './TakeExamPage.css'; // Reusing exam matching styles
import { useAppSettings } from '../contexts/AppSettingsContext';
import LessonWelcomeScreen from '../components/learn/LessonWelcomeScreen';
import MarkdownText from '../components/common/MarkdownText';
import { useAntiCopy } from '../hooks/useAntiCopy';
import { normalizeForComparison } from '../utils/textNormalization';

// Decode HTML entities (&#39; → ', &amp; → &, &nbsp; → space, etc.) and strip HTML tags
const decodeHtmlEntities = (str) => {
    if (!str) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value
        .replace(/<[^>]*>/g, '')   // strip HTML tags (e.g. <strong> from Quill)
        .replace(/\u00a0/g, ' '); // non-breaking space → regular space
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
    return parsed;
};

const MemoizedContextRender = memo(({ htmlContent }) => {
    if (!htmlContent) return null;
    return (
        <div className="learn-example glass-card--static" style={{ width: '100%', maxWidth: '100%', padding: '0', margin: '0 0 var(--space-lg) 0', overflow: 'hidden', border: 'none', background: 'transparent' }}>
            <div
                className="ql-editor grammar-context-editor grammar-context-text"
                style={{ padding: 0, lineHeight: 1.6, color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        </div>
    );
});

export default function LearnGrammarPage() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { settings } = useAppSettings();
    useAntiCopy();
    const { exerciseId, exerciseName, icon, color } = location.state || {};

    const [questions, setQuestions] = useState([]);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(!location.state?.skipWelcome);
    const [jumpIndex, setJumpIndex] = useState(null); // For jump-to-unanswered
    const [jumpedQuestionIds, setJumpedQuestionIds] = useState(new Set()); // Track jumped questions to skip later
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: Small, 1: Medium, 2: Large

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

    // History tracking
    const [historyTimeline, setHistoryTimeline] = useState([]);
    const [reviewCursor, setReviewCursor] = useState(-1);

    const isReviewMode = reviewCursor !== -1;
    const computedDisplayQuestionData = isReviewMode ? historyTimeline[reviewCursor]?.questionData : currentQuestionData;

    const parsedContext = useMemo(() => {
        return parseContextHtml(computedDisplayQuestionData?.questionRef?.context);
    }, [computedDisplayQuestionData?.questionRef?.context]);

    useEffect(() => {
        if (!exerciseId || !user?.uid) {
            navigate('/');
            return;
        }
        loadData();
    }, [exerciseId, user?.uid]);

    async function loadData() {
        setLoading(true);
        try {
            const rawQuestions = await getGrammarQuestions(exerciseId);
            const pMap = {};

            // fetch progress for each question
            await Promise.all(rawQuestions.map(async (q) => {
                const prog = await getGrammarProgress(user.uid, q.id);
                if (prog) pMap[q.id] = prog;
            }));

            // Filter unpassed questions for the initial run
            const unpassed = rawQuestions.filter(q => {
                const prog = pMap[q.id];
                return !(prog && prog.variationsPassed && prog.variationsPassed.length > 0);
            });

            // If totally mastered, use empty array so the queue triggers the "thuan thuc" screen
            const initialQs = unpassed.length > 0 ? unpassed : [];

            setQuestions(initialQs);
            setOriginalQuestions(rawQuestions); // Keep original to allow Re-reviewing
            setProgressMap(pMap);

            if (user?.uid && exerciseId) {
                logRecentList(user.uid, {
                    id: exerciseId,
                    name: exerciseName || 'Bài học Kỹ năng',
                    type: 'topic',
                    icon: icon || '✍️',
                    color: color || '#d97706',
                    wordCount: rawQuestions.length,
                    isGrammar: true
                });
            }

            prepareNextQuestion(0, initialQs, pMap);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    function prepareNextQuestion(index, qs = questions, pm = progressMap) {
        // Skip questions that were already answered via jump
        let adjustedIndex = index;
        while (adjustedIndex < qs.length && jumpedQuestionIds.has(qs[adjustedIndex]?.id + '_jumped_' + adjustedIndex)) {
            adjustedIndex++;
        }
        if (adjustedIndex >= qs.length) {
            setCurrentIndex(adjustedIndex);
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
            // Shuffle items deterministically based on question id
            const fnvHash = (str) => {
                let h = 0x811c9dc5;
                for (let j = 0; j < str.length; j++) { h ^= str.charCodeAt(j); h = Math.imul(h, 0x01000193); }
                return h >>> 0;
            };
            const shuffledItems = (variation.items || []).map((item, i) => ({ item, i }))
                .sort((a, b) => fnvHash(a.item + '|' + a.i + '|' + q.id) - fnvHash(b.item + '|' + b.i + '|' + q.id))
                .map(x => x.item);
            initialAnswer = { pool: shuffledItems, answer: [] };
        } else if ((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && /\{\{.+?\}\}/.test(variation.text || '')) {
            // New format: initialize as object for word bank
            initialAnswer = {};
            // Prepare shuffled word bank
            const blankRegex = /\{\{(.+?)\}\}/g;
            const correctWords = [];
            let bm;
            while ((bm = blankRegex.exec(variation.text || '')) !== null) { correctWords.push(decodeHtmlEntities(bm[1])); }
            const distractors = (variation.distractors || []).map(d => decodeHtmlEntities(d));
            const shuffled = [...correctWords, ...distractors].sort(() => Math.random() - 0.5);
            extraData.wordBank = shuffled;
            extraData.correctWords = correctWords;
        } else if (q.type === 'fill_in_blank_typing' && /\{\{.+?\}\}/.test(variation.text || '')) {
            // Type-in-the-blank: initialize as object, extract correctWords but NO wordBank
            initialAnswer = {};
            const blankRegex = /\{\{(.+?)\}\}/g;
            const correctWords = [];
            let bm;
            while ((bm = blankRegex.exec(variation.text || '')) !== null) { correctWords.push(decodeHtmlEntities(bm[1])); }
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
        if (questionRef.type === 'audio_recording' && !audioBlob) {
            return;
        }
        // Legacy fill_in_blank with string answer
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
            let savedAiVerdicts = null;

            if (questionRef.type === 'multiple_choice') {
                // correctAnswer is an index (0, 1, 2, 3) pointing to the options array
                const correctAnswerText = variation.options[variation.correctAnswer];
                isCorrect = answerToCheck === correctAnswerText;
            } else if (questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks' || questionRef.type === 'fill_in_blank_typing') {
                // Check if new format with {{word}} markers
                const markerRegex = /\{\{(.+?)\}\}/g;
                const cWords = [];
                let cm;
                while ((cm = markerRegex.exec(variation.text || '')) !== null) { cWords.push(decodeHtmlEntities(cm[1])); }

                if (cWords.length > 0 && typeof answerToCheck === 'object' && answerToCheck !== null) {
                    let correctCount = 0;
                    cWords.forEach((cw, idx) => {
                        const sw = answerToCheck[String(idx)];
                        if (typeof sw === 'string' && normalizeForComparison(sw) === normalizeForComparison(cw)) {
                            correctCount++;
                        }
                    });
                    isCorrect = correctCount === cWords.length && cWords.length > 0;


                    // AI fallback: if exact match failed and teacher enabled AI grading
                    if (!isCorrect && questionRef.useAIGrading && questionRef.type === 'fill_in_blank_typing' && cWords.length > 0) {
                        try {
                            const blanksData = cWords.map((cw, idx) => {
                                const sw = answerToCheck[String(idx)] || '';
                                const exactOk = normalizeForComparison(sw) === normalizeForComparison(cw);
                                return { idx, expected: cw, studentAnswer: sw, exactMatch: exactOk };
                            });
                            const cleanText = (variation.text || '').replace(/<[^>]*>/g, ' ').replace(/\{\{.+?\}\}/g, '___');
                            const contextStr = (questionRef.context || '') + (questionRef.contextScript ? '\n\n[SCRIPT / TRANSCRIPT]:\n' + questionRef.contextScript : '');
                            const aiVerdicts = await gradeFillInBlankBlanksWithAI(cleanText, blanksData, contextStr);

                            if (aiVerdicts && aiVerdicts.length === cWords.length) {
                                savedAiVerdicts = aiVerdicts;
                                let aiCorrectCount = 0;
                                cWords.forEach((cw, idx) => {
                                    const sw = answerToCheck[String(idx)] || '';
                                    const exactOk = normalizeForComparison(sw) === normalizeForComparison(cw);
                                    if (exactOk || aiVerdicts[idx] === true) aiCorrectCount++;
                                });
                                isCorrect = aiCorrectCount === cWords.length;
                            }
                        } catch (aiErr) {
                            console.error('AI fallback grading failed:', aiErr);
                        }
                    }
                } else {
                    // Legacy format
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
                // Resolve prompt content from linked prompt if available, combine with specialRequirement
                let resolvedSpecialReq = questionRef.specialRequirement || '';
                if (questionRef.promptId) {
                    try {
                        const linkedPrompt = await getPromptById(questionRef.promptId);
                        if (linkedPrompt) {
                            resolvedSpecialReq = resolvedSpecialReq
                                ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${resolvedSpecialReq}`
                                : linkedPrompt.content;
                        }
                    } catch (e) { console.warn('Could not resolve linked prompt:', e); }
                }
                const gradeResult = await gradeGrammarSubmissionWithAI(
                    variation.text,
                    answerToCheck,
                    questionRef.purpose,
                    questionRef.type,
                    resolvedSpecialReq,
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
                // Resolve prompt content from linked prompt if available, combine with specialRequirement
                let resolvedAudioSpecialReq = questionRef.specialRequirement || '';
                if (questionRef.promptId) {
                    try {
                        const linkedPrompt = await getPromptById(questionRef.promptId);
                        if (linkedPrompt) {
                            resolvedAudioSpecialReq = resolvedAudioSpecialReq
                                ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${resolvedAudioSpecialReq}`
                                : linkedPrompt.content;
                        }
                    } catch (e) { console.warn('Could not resolve linked prompt for audio:', e); }
                }
                const gradeResult = await evaluateAudioAnswer(
                    audioBlob,
                    variation.text || questionRef.purpose,
                    questionRef.purpose,
                    resolvedAudioSpecialReq,
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
            const actualVariationCount = questionRef.variations ? questionRef.variations.filter(v => v && (v.text || v.content)).length : 4;
            await updateGrammarProgress(user.uid, questionRef.id, exerciseId, isCorrect, variationIndex, actualVariationCount);

            setFeedback({
                isCorrect,
                message: isCorrect ? 'Chính xác!' : 'Chưa đúng, thử lại sau nhé.',
                aiFeedback: aiResponse || variation.explanation,
                ...(savedAiVerdicts ? { aiVerdicts: savedAiVerdicts } : {})
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
                    // Always insert relative to the real currentIndex, not jumpIndex
                    const baseIndex = jumpIndex !== null ? currentIndex : currentIndex;
                    const reinsertOffset = Math.floor(Math.random() * 3) + 2; // Insert 2-4 positions later
                    const insertPos = Math.min(baseIndex + reinsertOffset, newQuestions.length);
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

        // (matching uses native drag, not DragDropContext)

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
        setHistoryTimeline(prev => [...prev, {
            questionData: currentQuestionData,
            answer: currentAnswer,
            feedback: feedback
        }]);

        if (jumpIndex !== null) {
            // Mark this jumped question so it's skipped during normal progression
            const jumpedQId = questions[jumpIndex]?.id + '_jumped_' + jumpIndex;
            setJumpedQuestionIds(prev => new Set([...prev, jumpedQId]));
            setJumpIndex(null);
            // Return to the real currentIndex position
            prepareNextQuestion(currentIndex);
        } else {
            prepareNextQuestion(currentIndex + 1);
        }
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
    }, [currentIndex, currentQuestionData?.questionRef?.id, reviewCursor, showWelcome]);

    async function handleSkip() {
        if (!isChecking && !feedback) {
            // Treat as correct answer to fast-forward
            setIsChecking(true);
            const { questionRef, variationIndex } = currentQuestionData;

            try {
                setSessionStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));

                // Update Progress in DB as correct
                const actualVariationCount = questionRef.variations ? questionRef.variations.filter(v => v && (v.text || v.content)).length : 4;
                await updateGrammarProgress(user.uid, questionRef.id, exerciseId, true, variationIndex, actualVariationCount);

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
                    <h2 className="learn-complete-title">Bạn đã thuần thục!</h2>
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                        Bạn đã hoàn tất tất cả câu hỏi trong bài luyện "{exerciseName}".<br />
                        <span style={{ fontSize: '0.85rem', opacity: 0.8, color: 'var(--color-primary)' }}>(Việc ôn tập lại sẽ không ảnh hưởng hoặc làm giảm tiến độ đã đạt được của bạn)</span>
                    </p>
                    <div className="learn-complete-actions">
                        <button className="btn btn-primary" onClick={() => {
                            setQuestions([...originalQuestions]);
                            setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
                            setShowWelcome(false);
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

    if (showWelcome && !loading) {
        return (
            <div className="learn-page">
                <LessonWelcomeScreen
                    topicName={exerciseName}
                    description={location.state?.exerciseDescription}
                    itemCount={originalQuestions.length}
                    itemType="câu hỏi"
                    icon={icon}
                    color={color}
                    onStart={() => setShowWelcome(false)}
                    onBack={() => navigate(-1)}
                />
            </div>
        );
    }
    const activeHistoryItem = isReviewMode ? historyTimeline[reviewCursor] : null;
    const displayQuestionData = isReviewMode ? activeHistoryItem.questionData : currentQuestionData;
    const displayAnswer = isReviewMode ? activeHistoryItem.answer : currentAnswer;
    const displayFeedback = isReviewMode ? activeHistoryItem.feedback : feedback;

    if (!isReviewMode && !currentQuestionData && currentIndex >= questions.length) {
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

        const passCount = originalQuestions.filter(q => {
            const attempts = historyTimeline.filter(h => h.questionData.questionRef.id === q.id);
            const isSkipped = attempts.some(h => h.feedback?.message === 'Bỏ qua nhanh');
            const wrongAttempts = attempts.filter(h => !h.feedback?.isCorrect && h.feedback?.message !== 'Bỏ qua nhanh').length;
            const correctAttempts = attempts.filter(h => h.feedback?.isCorrect && h.feedback?.message !== 'Bỏ qua nhanh').length;
            return wrongAttempts === 0 && !isSkipped && correctAttempts > 0;
        }).length;

        const failCount = originalQuestions.length - passCount;

        return (
            <div className="learn-page">
                <div className="learn-complete animate-slide-up">
                    <div className="learn-complete-header">
                        <div className="learn-complete-icon">{icon}</div>
                        <h1 className="learn-complete-title">{heading}</h1>
                        <p className="learn-complete-topic">{exerciseName}</p>

                        <div style={{ textAlign: 'center', margin: 'var(--space-md) 0' }}>
                            <span style={{ background: 'var(--color-success)', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                ✅ Hoàn thành 100% Kỹ năng
                            </span>
                        </div>
                    </div>

                    <div className="learn-complete-body">
                        <div className="learn-complete-stats-panel">
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

                            <div className="learn-complete-quick-stats">
                                <div className="learn-complete-stat-card learn-complete-stat-card--success">
                                    <span className="stat-card-num">{passCount}</span>
                                    <span className="stat-card-label">Hoàn hảo</span>
                                </div>
                                <div className={`learn-complete-stat-card ${failCount > 0 ? 'learn-complete-stat-card--error' : 'learn-complete-stat-card--success'}`}>
                                    <span className="stat-card-num">{failCount}</span>
                                    <span className="stat-card-label">Có lỗi</span>
                                </div>
                            </div>
                        </div>

                        <div className="learn-complete-words-panel">
                            <h3 className="learn-complete-words-title">Chi tiết từng câu hỏi</h3>
                            <div className="learn-complete-words">
                                {originalQuestions.map((q, i) => {
                                    const attempts = historyTimeline.filter(h => h.questionData.questionRef.id === q.id);
                                    const isSkipped = attempts.some(h => h.feedback?.message === 'Bỏ qua nhanh');
                                    const wrongAttempts = attempts.filter(h => !h.feedback?.isCorrect && h.feedback?.message !== 'Bỏ qua nhanh').length;

                                    const isPerfect = wrongAttempts === 0 && !isSkipped && attempts.length > 0;

                                    return (
                                        <div key={q.id} className={`learn-complete-word ${isPerfect ? 'learn-complete-word--pass' : 'learn-complete-word--fail'}`}>
                                            <span>{isPerfect ? '✅' : (isSkipped ? '⏭️' : '⚠️')}</span>
                                            <span className="learn-complete-word-text">Câu hỏi {i + 1}</span>
                                            <span className="learn-complete-word-score" style={{
                                                display: 'flex',
                                                gap: '8px',
                                                alignItems: 'center',
                                                fontSize: '0.8rem'
                                            }}>
                                                {isSkipped ? (
                                                    <span style={{ color: 'var(--text-muted)' }}>Đã bỏ qua</span>
                                                ) : wrongAttempts > 0 ? (
                                                    <span style={{ color: 'var(--color-error)' }}>{wrongAttempts} lỗi</span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-success)' }}>Hoàn hảo</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="learn-complete-actions" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ minWidth: '150px' }}>
                            <ArrowLeft size={20} /> Về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!displayQuestionData) return null;

    // Clean up HTML before rendering to ensure responsiveness
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

    const { questionRef, variation } = displayQuestionData;
    const completedCount = new Set(historyTimeline.filter(h => h.feedback?.isCorrect).map(h => h.questionData.questionRef.id)).size;
    const progressPct = (completedCount / originalQuestions.length) * 100;

    return (
        <div className="learn-page">
            {/* Topbar matching LearnPage.jsx */}
            <div className="learn-topbar">
                <button className="btn btn-ghost learn-topbar-back" onClick={() => navigate(-1)} title="Thoát">
                    ✕
                </button>
                
                <div className="learn-progress-wrapper">
                    <div className="learn-topbar-title" title={exerciseName}>
                        {exerciseName}
                    </div>
                    <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${progressPct}%`, transition: 'width 0.3s ease' }} />
                    </div>
                </div>
                <div className="learn-topbar-actions">
                    <span className="learn-topbar-count">
                        {completedCount}/{originalQuestions.length}
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

                    {/* DEV SKIP */}
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
                    const isActive = displayQuestionData?.questionRef?.id === q.id;

                    let dotClass = 'learn-mastery-dot';
                    if (isDone) dotClass += ' learn-mastery-dot--filled';
                    else if (prog.variationsAttemptedSession?.length > 0) dotClass += ' learn-mastery-dot--error'; // Attempted but failed this session

                    const hasHistory = historyTimeline.some(item => item.questionData.questionRef.id === q.id);

                    // Find the index of this question in the current questions array
                    const qIndexInQueue = questions.findIndex(qq => qq.id === q.id);
                    const isUnanswered = !hasHistory && qIndexInQueue !== -1;
                    const isCurrent = qIndexInQueue === currentIndex && jumpIndex !== null;
                    const isClickable = hasHistory || isUnanswered || isCurrent;

                    const handleIndicatorClick = () => {
                        if (isActive && !isReviewMode) return; // Already viewing this question
                        if (hasHistory) {
                            // Enter review mode: show last answer for this question
                            for (let j = historyTimeline.length - 1; j >= 0; j--) {
                                if (historyTimeline[j].questionData.questionRef.id === q.id) {
                                    setReviewCursor(j);
                                    return;
                                }
                            }
                        } else if (isCurrent) {
                            // Go back to the original currentIndex position
                            setJumpIndex(null);
                            prepareNextQuestion(currentIndex);
                        } else if (isUnanswered) {
                            // Jump to this unanswered question
                            setJumpIndex(qIndexInQueue);
                            prepareNextQuestion(qIndexInQueue);
                        }
                    };

                    return (
                        <div
                            key={q.id}
                            className="learn-batch-word-wrapper"
                            ref={isActive ? activeWordRef : null}
                        >
                            <div
                                className={`learn-batch-word ${isActive ? 'learn-batch-word--active' : ''} ${isDone ? 'learn-batch-word--done' : ''} ${isClickable ? 'learn-batch-word--clickable' : ''}`}
                                onClick={handleIndicatorClick}
                            >
                                <span>{i + 1}</span>
                                {isDone && <span className="learn-batch-check">✓</span>}
                            </div>
                            <div className="learn-mastery-dots" style={{ opacity: isActive ? 1 : 0.6 }}>
                                <div
                                    className={dotClass}
                                    onClick={handleIndicatorClick}
                                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="learn-content animate-fade-in" ref={contentRef} data-font-size={fontSizeLevel}>
                {isReviewMode && (
                    <div className="learn-review-banner">
                        <span className="learn-review-banner-text">📖 Bạn đang xem lại bài</span>
                        <button
                            className="btn btn-primary learn-review-banner-btn"
                            onClick={() => setReviewCursor(-1)}
                        >
                            ▶ Tiếp tục học
                        </button>
                    </div>
                )}
                <div className="learn-step" style={{ position: 'relative' }}>
                    {/* Mục tiêu removed as requested */}

                    <div className="learn-step-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px', width: '100%', marginTop: 0 }}>

                        {/* Context Area */}
                        {questionRef.hasContext && questionRef.context && parsedContext && (
                            <MemoizedContextRender htmlContent={sanitizeHtml(parsedContext)} />
                        )}
                        {questionRef.contextAudioUrl && (
                            <div style={{ width: '100%', maxWidth: '100%', marginBottom: 'var(--space-lg)' }}>
                                <audio controls src={questionRef.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                            </div>
                        )}

                        {/* Question Text and Input Area Combined for Fill in Blank */}
                        {(questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks') && /\{\{.+?\}\}/.test(variation.text || '') ? (() => { // fill_in_blank_typing is handled below and must not fall into this block
                            const textHtml = sanitizeHtml(variation.text || '', true);
                            const parts = textHtml.split(/(\{\{.+?\}\})/g);

                            const correctWords = displayQuestionData?.correctWords || [];
                            const wordBank = displayQuestionData?.wordBank || [];
                            const answer = displayAnswer || {};
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
                                        const isCorrect = displayFeedback && filled && normalizeForComparison(filled) === normalizeForComparison(correctWords[idx]);
                                        const isWrong = displayFeedback && filled && !isCorrect;

                                        let classes = "learn-inline-blank";
                                        if (filled) classes += " filled";
                                        if (isCorrect) classes += " correct";
                                        if (isWrong) classes += " wrong";
                                        if (filled && !displayFeedback && !isReviewMode) classes += " clickable";

                                        return (
                                            <span
                                                key={`blank-${idx}`}
                                                className={classes}
                                                draggable={!displayFeedback && !isReviewMode && filled ? true : false}
                                                onDragStart={(e) => {
                                                    if (displayFeedback || isReviewMode || !filled) return;
                                                    e.dataTransfer.setData('text/plain', filled);
                                                    e.dataTransfer.setData('sourceIdx', String(idx));
                                                }}
                                                onDragOver={(e) => {
                                                    if (displayFeedback || isReviewMode) return;
                                                    e.preventDefault();
                                                    e.currentTarget.classList.add('drag-over');
                                                }}
                                                onDragEnter={(e) => {
                                                    if (displayFeedback || isReviewMode) return;
                                                    e.preventDefault();
                                                }}
                                                onDragLeave={(e) => {
                                                    e.currentTarget.classList.remove('drag-over');
                                                }}
                                                onDrop={(e) => {
                                                    if (displayFeedback || isReviewMode) return;
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
                                                    if (filled && !displayFeedback && !isReviewMode) {
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
                                    {!displayFeedback && (
                                        <div className="grammar-word-bank">
                                            {availableWords.length === 0 ? (
                                                <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem', alignSelf: 'center' }}>✓ Đã chọn hết</span>
                                            ) : availableWords.map((word, wi) => (
                                                <button key={wi} type="button"
                                                    className="grammar-word-bank-item"
                                                    disabled={isReviewMode}
                                                    draggable={!isReviewMode}
                                                    onDragStart={(e) => {
                                                        if (isReviewMode) return;
                                                        e.dataTransfer.setData('text/plain', word);
                                                    }}
                                                    onClick={() => {
                                                        if (isReviewMode) return;
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
                            // NOTE: fill_in_blank_typing is intentionally excluded here — it renders its own inputs below
                            questionRef.type !== 'fill_in_blank_typing' ? (
                                <div className="grammar-question-container">
                                    <div className="grammar-question-text ql-editor" style={{ padding: 0 }}
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
                            const correctWords = displayQuestionData?.correctWords || [];
                            const answer = displayAnswer || {};
                            let blankCounter = 0;

                            const renderInlineInputs = () => {
                                return parts.map((part, index) => {
                                    if (part.startsWith('{{') && part.endsWith('}}')) {
                                        const idx = blankCounter++;
                                        const filled = answer[String(idx)] || '';
                                        const isCorrect = displayFeedback && filled && normalizeForComparison(filled) === normalizeForComparison(correctWords[idx]);
                                        const isWrong = displayFeedback && filled && !isCorrect;
                                        const isEmpty = displayFeedback && !filled;
                                        const isAIAccepted = isWrong && displayFeedback?.aiVerdicts?.[idx] === true;

                                        return (
                                            <span key={`blank-${idx}`} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '2px 4px', maxWidth: '100%' }}>
                                                <input
                                                    type="text"
                                                    value={filled}
                                                    disabled={!!displayFeedback || isReviewMode}
                                                    placeholder={`(${idx + 1})`}
                                                    onChange={e => {
                                                        if (displayFeedback || isReviewMode) return;
                                                        setCurrentAnswer({ ...answer, [String(idx)]: e.target.value });
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
                                                        border: displayFeedback
                                                            ? (isCorrect ? '2px solid #10b981' : isAIAccepted ? '2px solid #f59e0b' : '2px solid #ef4444')
                                                            : '2px solid var(--border-color)',
                                                        background: displayFeedback
                                                            ? (isCorrect ? '#ecfdf5' : isAIAccepted ? '#fef3c7' : '#fef2f2')
                                                            : 'var(--bg-input, #fff)',
                                                        color: displayFeedback
                                                            ? (isCorrect ? '#065f46' : isAIAccepted ? '#92400e' : '#991b1b')
                                                            : 'var(--text-primary)',
                                                        outline: 'none',
                                                        textAlign: 'left',
                                                        fontFamily: 'inherit',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                />
                                                {isWrong && !isAIAccepted && (
                                                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginLeft: '4px' }}>
                                                        ({correctWords[idx]})
                                                    </span>
                                                )}
                                                {isAIAccepted && (
                                                    <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600, marginLeft: '4px' }}>✓ AI ({correctWords[idx]})</span>
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
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
                            {questionRef.type === 'multiple_choice' && (
                                <div className="learn-options learn-options--vertical" style={{ width: '100%', maxWidth: '600px' }}>
                                    {variation.options && variation.options.map((opt, i) => {
                                        if (!opt) return null;
                                        const isSelected = displayAnswer === opt;
                                        const isActualCorrect = i === variation.correctAnswer;
                                        const showCorrect = displayFeedback && isActualCorrect;
                                        const showWrong = displayFeedback && !displayFeedback.isCorrect && isSelected;

                                        let optionClass = 'learn-option';
                                        if (isSelected && !displayFeedback) optionClass += ' learn-option--selected'; // We might need a slightly different style or just rely on default hover
                                        if (showCorrect) optionClass += ' learn-option--correct';
                                        if (showWrong) optionClass += ' learn-option--wrong';
                                        if (displayFeedback && !showCorrect && !showWrong) optionClass += ' learn-option--dim';

                                        // Apply inline style for selected state before submission to give visual feedback
                                        const selectedStyle = isSelected && !displayFeedback ? { borderColor: 'var(--color-primary)', background: 'rgba(108, 92, 231, 0.08)' } : {};

                                        return (
                                            <button
                                                key={i}
                                                className={optionClass}
                                                style={{ ...selectedStyle, ...(isImageOption(opt) ? { padding: '8px', justifyContent: 'center' } : {}) }}
                                                onClick={() => {
                                                    if (!displayFeedback && !isReviewMode) {
                                                        handleCheckResponse(opt);
                                                    }
                                                }}
                                                disabled={!!displayFeedback || isChecking || isReviewMode}
                                            >
                                                <OptionContent opt={opt} />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Essay: textarea */}
                            {questionRef.type === 'essay' && (
                                <textarea
                                    value={displayAnswer || ''}
                                    onChange={(e) => !isReviewMode && setCurrentAnswer(e.target.value)}
                                    disabled={!!displayFeedback || isReviewMode}
                                    placeholder="Nhập câu trả lời của bạn..."
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        minHeight: '150px',
                                        padding: '20px',
                                        fontSize: '1.2rem',
                                        borderRadius: '16px',
                                        border: `2px solid ${displayFeedback ? (displayFeedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)') : 'var(--border-color)'}`,
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
                                    {!displayFeedback && !isReviewMode && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (isRecording) {
                                                        // Stop recording
                                                        mediaRecorderRef.current?.stop();
                                                        setIsRecording(false);
                                                    } else {
                                                        // Start recording
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
                                                {isRecording ? '🔴 Đang ghi âm... Bấm để dừng' : (audioBlob ? 'Đã ghi âm xong! Bấm lại để ghi mới hoặc bấm Kiểm tra.' : 'Bấm nút micro để bắt đầu ghi âm')}
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
                                    value={displayAnswer || ''}
                                    onChange={(e) => !isReviewMode && setCurrentAnswer(e.target.value)}
                                    disabled={!!displayFeedback || isReviewMode}
                                    placeholder="Nhập câu trả lời của bạn..."
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        minHeight: '80px',
                                        padding: '20px',
                                        fontSize: '1.2rem',
                                        borderRadius: '16px',
                                        border: `2px solid ${displayFeedback ? (displayFeedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)') : 'var(--border-color)'}`,
                                        outline: 'none',
                                        resize: 'vertical',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-body)'
                                    }}
                                />
                            )}

                            {/* Ordering question */}
                            {questionRef.type === 'ordering' && displayAnswer && (() => {
                                const { pool = [], answer: orderedAnswer = [] } = displayAnswer;
                                const handleSelectItem = (item, poolIdx) => {
                                    if (isReviewMode || displayFeedback) return;
                                    setCurrentAnswer(prev => ({
                                        pool: prev.pool.filter((_, i) => i !== poolIdx),
                                        answer: [...prev.answer, item]
                                    }));
                                };
                                const handleRemoveItem = (idx) => {
                                    if (isReviewMode || displayFeedback) return;
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
                                                    const isCorrectPos = displayFeedback ? item === correctItems[idx] : null;
                                                    return (
                                                        <div key={`ans-${idx}`}
                                                            className={`exam-ordering-chip answer`}
                                                            onClick={() => handleRemoveItem(idx)}
                                                            style={{
                                                                cursor: displayFeedback ? 'default' : 'pointer',
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
                                                        onClick={() => handleSelectItem(item, idx)}
                                                        style={{ cursor: displayFeedback ? 'default' : 'pointer' }}>
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {questionRef.type === 'categorization' && displayAnswer && displayAnswer.unassigned && (
                                <DragDropContext onDragEnd={(res) => !isReviewMode && onDragEnd(res)}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '800px' }}>
                                        {/* Unassigned Pool */}
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--border-color)', boxSizing: 'border-box', overflow: 'hidden' }}>
                                            <div className="grammar-category-text" style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>Kéo các từ vào đúng nhóm</div>
                                            <Droppable droppableId="unassigned" isDropDisabled={isReviewMode}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '50px', justifyContent: 'center', alignItems: 'flex-start', background: snapshot.isDraggingOver ? 'rgba(108, 92, 231, 0.1)' : 'transparent', borderRadius: '12px', transition: 'background 0.2s', padding: '8px' }}
                                                    >
                                                        {(displayAnswer.unassigned || []).map((item, index) => (
                                                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!!displayFeedback || isReviewMode}>
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
                                                                            opacity: isReviewMode ? 0.7 : 1,
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
                                                const items = displayAnswer[group] || [];
                                                return (
                                                    <div key={group} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-input)', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                                                        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
                                                            {group}
                                                        </div>
                                                        <Droppable droppableId={group} isDropDisabled={isReviewMode}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                    style={{ flex: 1, padding: '12px', minHeight: '150px', background: snapshot.isDraggingOver ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                                >
                                                                    {items.map((item, index) => {
                                                                        const isAnsCorrect = displayFeedback && item.group === group;
                                                                        const isAnsWrong = displayFeedback && item.group !== group;
                                                                        let borderColor = 'var(--border-color)';
                                                                        let bgColor = 'var(--bg-primary)';
                                                                        if (isAnsCorrect) { borderColor = 'var(--color-success)'; bgColor = 'rgba(16, 185, 129, 0.1)'; }
                                                                        if (isAnsWrong) { borderColor = 'var(--color-error)'; bgColor = 'rgba(239, 68, 68, 0.1)'; }

                                                                        return (
                                                                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!!displayFeedback || isReviewMode}>
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
                                                                                            opacity: isReviewMode ? 0.7 : 1,
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

                            {questionRef.type === 'matching' && displayAnswer && Array.isArray(displayAnswer) && (() => {
                                const pairs = variation.pairs || [];
                                const isDragDisabled = !!displayFeedback || isReviewMode;
                                const matchId = 'grammar-match';

                                // --- Shift animation helpers (same as TakeExamPage) ---
                                const applyShiftClasses = (fromIdx, hoverIdx) => {
                                    const allRows = document.querySelectorAll(`[data-match-grammar] .exam-match-swap-row`);
                                    const chips = document.querySelectorAll(`[data-match-grammar] .exam-match-swap-right`);
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
                                        const sourceRowH = allRows[fromIdx] ? allRows[fromIdx].getBoundingClientRect().height + 12 : 60;
                                        if (fromIdx < hoverIdx && idx > fromIdx && idx <= hoverIdx) {
                                            chip.style.transform = `translateY(-${sourceRowH}px)`;
                                        } else if (fromIdx > hoverIdx && idx >= hoverIdx && idx < fromIdx) {
                                            chip.style.transform = `translateY(${sourceRowH}px)`;
                                        } else {
                                            chip.style.transform = '';
                                        }
                                    });
                                };

                                const clearShiftClasses = () => {
                                    const chips = document.querySelectorAll(`[data-match-grammar] .exam-match-swap-right`);
                                    chips.forEach(r => {
                                        r.classList.remove('drag-hover');
                                        r.style.transform = '';
                                        r.style.transition = '';
                                    });
                                };

                                const addSettleAnimation = (fromIdx, toIdx) => {
                                    const rows = document.querySelectorAll(`[data-match-grammar] .exam-match-swap-right`);
                                    const min = Math.min(fromIdx, toIdx);
                                    const max = Math.max(fromIdx, toIdx);
                                    for (let i = min; i <= max; i++) {
                                        if (rows[i]) {
                                            rows[i].classList.add('just-settled');
                                            setTimeout(() => rows[i]?.classList.remove('just-settled'), 400);
                                        }
                                    }
                                };

                                // --- Desktop HTML5 drag ---
                                const handleDragStart = (e, pIdx) => {
                                    if (isDragDisabled) { e.preventDefault(); return; }
                                    e.dataTransfer.setData('fromIdx', String(pIdx));
                                    e.dataTransfer.effectAllowed = 'move';
                                    // Hide source after browser captures drag image
                                    requestAnimationFrame(() => { e.target.style.opacity = '0'; });
                                    window._grammarDragFrom = pIdx;
                                };
                                const handleDragEnd = (e) => {
                                    e.target.style.opacity = '1';
                                    clearShiftClasses();
                                    window._grammarDragFrom = null;
                                };
                                const handleDragOver = (e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                };
                                const handleDragEnter = (e, toIdx) => {
                                    if (window._grammarDragFrom !== null && window._grammarDragFrom !== undefined) {
                                        applyShiftClasses(window._grammarDragFrom, toIdx);
                                    }
                                };
                                const handleDrop = (e, toIdx) => {
                                    e.preventDefault();
                                    const fromIdx = parseInt(e.dataTransfer.getData('fromIdx'));
                                    if (isNaN(fromIdx) || fromIdx === toIdx) return;
                                    clearShiftClasses();
                                    const newAnswer = [...displayAnswer];
                                    const [moved] = newAnswer.splice(fromIdx, 1);
                                    newAnswer.splice(toIdx, 0, moved);
                                    setCurrentAnswer(newAnswer);
                                    setTimeout(() => addSettleAnimation(fromIdx, toIdx), 50);
                                };

                                // --- Touch drag ---
                                const handleTouchStart = (e, pIdx) => {
                                    if (isDragDisabled) return;
                                    const touch = e.touches[0];
                                    const target = e.currentTarget;
                                    const rect = target.getBoundingClientRect();

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
                                    target.classList.add('dragging-source');
                                    target.style.opacity = '0';

                                    window._grammarMatchDrag = {
                                        fromIdx: pIdx,
                                        clone,
                                        sourceEl: target,
                                        answer: displayAnswer,
                                        hoverIdx: null
                                    };

                                    const onTouchMove = (ev) => {
                                        const drag = window._grammarMatchDrag;
                                        if (!drag) return;
                                        ev.preventDefault();
                                        const t = ev.touches[0];
                                        const r2 = drag.clone.getBoundingClientRect();
                                        drag.clone.style.left = `${t.clientX - r2.width / 2}px`;
                                        drag.clone.style.top = `${t.clientY - 25}px`;

                                        const rows = document.querySelectorAll(`[data-match-grammar] .exam-match-swap-row`);
                                        let newHover = null;
                                        rows.forEach((row, idx) => {
                                            const rb = row.getBoundingClientRect();
                                            if (t.clientY >= rb.top && t.clientY <= rb.bottom) {
                                                newHover = idx;
                                            }
                                        });
                                        if (newHover !== drag.hoverIdx) {
                                            drag.hoverIdx = newHover;
                                            applyShiftClasses(drag.fromIdx, newHover);
                                        }
                                    };

                                    const onTouchEnd = () => {
                                        const drag = window._grammarMatchDrag;
                                        if (!drag) return;
                                        document.removeEventListener('touchmove', onTouchMove);
                                        document.removeEventListener('touchend', onTouchEnd);
                                        drag.clone.remove();
                                        drag.sourceEl.classList.remove('dragging-source');
                                        drag.sourceEl.style.opacity = '1';
                                        clearShiftClasses();

                                        if (drag.hoverIdx !== null && drag.hoverIdx !== drag.fromIdx) {
                                            const newAnswer = [...drag.answer];
                                            const [moved] = newAnswer.splice(drag.fromIdx, 1);
                                            newAnswer.splice(drag.hoverIdx, 0, moved);
                                            setCurrentAnswer(newAnswer);
                                            setTimeout(() => addSettleAnimation(drag.fromIdx, drag.hoverIdx), 50);
                                        }
                                        window._grammarMatchDrag = null;
                                    };

                                    document.addEventListener('touchmove', onTouchMove, { passive: false });
                                    document.addEventListener('touchend', onTouchEnd);
                                };

                                return (
                                    <>
                                    <div className="exam-matching-swap" data-match-grammar>
                                        <div className="exam-match-swap-pairs">
                                            {pairs.map((pair, pIdx) => {
                                                const item = displayAnswer[pIdx];
                                                const slotValue = item?.text || '';
                                                const isAnsCorrect = displayFeedback && item?.text === pair.right;
                                                const isAnsWrong = displayFeedback && item?.text !== pair.right;

                                                let rowBorder = '1.5px solid var(--border-color)';
                                                let rowBg = 'var(--bg-primary)';
                                                if (isAnsCorrect) { rowBorder = '2px solid var(--color-success)'; rowBg = 'rgba(16, 185, 129, 0.08)'; }
                                                if (isAnsWrong) { rowBorder = '2px solid var(--color-error)'; rowBg = 'rgba(239, 68, 68, 0.08)'; }

                                                return (
                                                    <div key={pIdx} className="exam-match-swap-row"
                                                        style={{ background: rowBg, border: rowBorder }}
                                                        onDragOver={handleDragOver}
                                                        onDragEnter={e => handleDragEnter(e, pIdx)}
                                                        onDrop={e => handleDrop(e, pIdx)}>
                                                        <div className="exam-match-swap-num" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{pIdx + 1}</div>
                                                        <div className="exam-match-swap-left" style={{ color: 'var(--text-primary)' }}>
                                                            {pair.left}
                                                        </div>
                                                        <div className="exam-match-swap-divider" style={{ color: 'var(--text-muted)' }}>—</div>
                                                        <div
                                                            className="exam-match-swap-right"
                                                            style={{
                                                                background: isAnsCorrect ? 'var(--color-success)' : isAnsWrong ? 'var(--color-error)' : 'var(--color-primary-light, #6366f1)',
                                                                cursor: isDragDisabled ? 'default' : 'grab',
                                                                opacity: isDragDisabled && !displayFeedback ? 0.7 : 1
                                                            }}
                                                            draggable={!isDragDisabled}
                                                            onDragStart={e => handleDragStart(e, pIdx)}
                                                            onDragEnd={handleDragEnd}
                                                            onTouchStart={e => handleTouchStart(e, pIdx)}
                                                        >
                                                            {!isDragDisabled && <span className="exam-match-swap-grip">⠿</span>}
                                                            <span className="exam-match-swap-value">{slotValue}</span>
                                                            {isAnsCorrect && <span>✓</span>}
                                                            {isAnsWrong && <span>✗</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Feedback details */}
                                    {displayFeedback && !displayFeedback.isCorrect && (
                                        <div style={{ marginTop: '24px', width: '100%', maxWidth: '800px', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <h4 style={{ color: 'var(--color-error)', marginBottom: '12px', fontSize: '1.1rem' }}>Đáp án đúng:</h4>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {pairs.map((pair, i) => (
                                                    <li key={`ans-${i}`} style={{ color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, flex: 1 }}>{pair.left}</span>
                                                        <span style={{ color: 'var(--text-muted)', padding: '0 16px' }}>&rarr;</span>
                                                        <span style={{ color: 'var(--color-success)', fontWeight: 600, flex: 1 }}>{pair.right}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    </>
                                );
                            })()}
                        </div>



            {/* Bottom Bar using shared styles */}
            {displayFeedback ? (
                <div className={`learn-bottom-bar ${displayFeedback.isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                    <div className="learn-bottom-bar-inner">
                        <div className="learn-bottom-bar-content">
                            <div className="learn-bottom-bar-title">{displayFeedback.isCorrect ? 'Chính xác!' : 'Chưa đúng rồi'}</div>

                            {!displayFeedback.isCorrect && questionRef.type === 'multiple_choice' && (
                                <div className="learn-bottom-bar-subtitle">
                                    Đáp án: {isImageOption(variation.options[variation.correctAnswer])
                                        ? <img src={variation.options[variation.correctAnswer]} alt="Đáp án" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, verticalAlign: 'middle' }} />
                                        : <strong>{variation.options[variation.correctAnswer]}</strong>}
                                </div>
                            )}

                            {!displayFeedback.isCorrect && (questionRef.type === 'fill_in_blank' || questionRef.type === 'fill_in_blanks') && (() => {
                                const markerRegex = /\{\{(.+?)\}\}/g;
                                const cw = [];
                                let m2;
                                while ((m2 = markerRegex.exec(variation.text || '')) !== null) { cw.push(decodeHtmlEntities(m2[1])); }
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

                            {displayFeedback.aiFeedback && (
                                <div style={{ marginTop: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5, display: 'flex', gap: '8px' }}>
                                    <Sparkles size={16} color="var(--color-primary-light)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ color: 'var(--color-primary-light)' }}>Giải thích: </strong>
                                        <MarkdownText>{displayFeedback.aiFeedback}</MarkdownText>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                        {!isReviewMode && <button className="btn btn-primary" onClick={handleNext}>Tiếp tục →</button>}
                    </div>
                </div>
            ) : questionRef?.type !== 'multiple_choice' && !isReviewMode && (
                <div className="floating-bottom-btn-wrapper">
                    <button
                        className="btn btn-primary"
                        onClick={() => handleCheckResponse()}
                        disabled={
                            isChecking ||
                            (questionRef?.type === 'categorization' && (displayAnswer?.unassigned?.length > 0)) ||
                            (questionRef?.type === 'ordering' && (displayAnswer?.pool?.length > 0)) ||
                            (questionRef?.type === 'matching' && (!Array.isArray(displayAnswer) || displayAnswer.length < (variation?.pairs?.length || 0))) ||
                            (questionRef?.type === 'essay' && (!displayAnswer || (typeof displayAnswer === 'string' && !displayAnswer.trim()))) ||
                            (questionRef?.type === 'audio_recording' && !audioBlob) ||
                            (['fill_in_blank', 'fill_in_blanks'].includes(questionRef?.type) && typeof displayAnswer === 'string' && !displayAnswer?.trim()) ||
                            (['fill_in_blank', 'fill_in_blanks'].includes(questionRef?.type) && typeof displayAnswer === 'object' && displayAnswer !== null && Object.keys(displayAnswer).length < (displayQuestionData?.correctWords?.length || 1))
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
