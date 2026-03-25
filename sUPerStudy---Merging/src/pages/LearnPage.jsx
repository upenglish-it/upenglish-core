import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateWordProgress, updateIntermediateWordProgress } from '../services/spacedRepetition';
import { checkWordSaved, toggleSavedWord } from '../services/savedService';
import { logRecentList } from '../services/recentService';
import { Heart } from 'lucide-react';
import StepListening from '../components/learn/StepListening';
import StepPronunciation from '../components/learn/StepPronunciation';
import StepMeaning from '../components/learn/StepMeaning';
import StepSpelling from '../components/learn/StepSpelling';
import StepCollocation from '../components/learn/StepCollocation';
import StepSequence from '../components/learn/StepSequence';
import LearningComplete from '../components/learn/LearningComplete';
import LessonWelcomeScreen from '../components/learn/LessonWelcomeScreen';
import { useAntiCopy } from '../hooks/useAntiCopy';
import './LearnPage.css';

const STEPS = [
    { key: 'listening', Component: StepListening },
    { key: 'pronunciation', Component: StepPronunciation },
    { key: 'meaning', Component: StepMeaning },
    { key: 'spelling', Component: StepSpelling },
    { key: 'collocation', Component: StepCollocation },
    { key: 'sequence', Component: StepSequence },
];

const BATCH_SIZE = 3;
const REQUIRED_CORRECT_DEFAULT = 1; // 1 correct to master if no mistakes
const REQUIRED_CORRECT_WITH_ERRORS = 2; // 2 correct if the step had wrong answers

/**
 * Build the initial queue for a batch of words.
 * Interleaves words so they don't all appear sequentially.
 * Starts from each word's already completed steps.
 */
function buildInitialQueue(batchWords) {
    const queue = [];
    const batchLength = batchWords.length;

    // Initialize nextStep with the number of steps each word has already completed
    const nextStep = batchWords.map(w => Math.min(w.stepsCompleted || 0, STEPS.length));

    // Calculate total remaining steps for this bundle
    const totalRemaining = nextStep.reduce((acc, curr) => acc + (STEPS.length - curr), 0);

    let lastPicked = -1;

    while (queue.length < totalRemaining) {
        const eligible = [];
        for (let w = 0; w < batchLength; w++) {
            if (nextStep[w] < STEPS.length) eligible.push(w);
        }
        if (!eligible.length) break;

        let pick;
        const last2Same = queue.length >= 2 &&
            queue[queue.length - 1].wordIdx === queue[queue.length - 2].wordIdx;

        if (last2Same || Math.random() < 0.65) {
            const others = eligible.filter(w => w !== lastPicked);
            if (others.length) {
                others.sort((a, b) => nextStep[a] - nextStep[b]);
                pick = others[0];
            } else {
                pick = eligible[0];
            }
        } else {
            if (eligible.includes(lastPicked)) {
                pick = lastPicked;
            } else {
                pick = eligible[0];
            }
        }

        queue.push({ wordIdx: pick, stepIdx: nextStep[pick] });
        nextStep[pick]++;
        lastPicked = pick;
    }

    return queue;
}

export default function LearnPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    useAntiCopy();

    const { words = [], topicId = '', topicName = '', listType = 'topic', icon = '📚', color = 'var(--color-primary)', isTeacherTopic = false } = location.state || {};
    const totalWords = words.length;

    useEffect(() => {
        if (user?.uid && topicId && topicName) {
            const cleanName = topicName.replace(/^Cụm từ chủ đề:\s*/, '');
            logRecentList(user.uid, {
                id: topicId,
                name: cleanName,
                type: listType,
                icon: icon,
                color: color,
                wordCount: totalWords,
                isTeacherTopic: isTeacherTopic
            });
        }
    }, [user?.uid, topicId, topicName, listType, icon, color, totalWords]);

    // activeWords can be reset to stepsCompleted=0 when user clicks "Học lại từ đầu"
    const [activeWords, setActiveWords] = useState(words);

    const batches = useMemo(() => {
        const b = [];
        for (let i = 0; i < activeWords.length; i += BATCH_SIZE) b.push(activeWords.slice(i, i + BATCH_SIZE));
        return b;
    }, [activeWords]);

    const [batchIndex, setBatchIndex] = useState(() => {
        // Find the first batch that has at least one word with remaining steps
        for (let b = 0; b < Math.ceil(words.length / BATCH_SIZE); b++) {
            const batch = words.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
            if (buildInitialQueue(batch).length > 0) return b;
        }
        return 0;
    });
    const [completed, setCompleted] = useState(false);

    // Dynamic queue - start from the first non-empty batch
    const [queue, setQueue] = useState(() => {
        for (let b = 0; b < batches.length; b++) {
            const q = buildInitialQueue(batches[b]);
            if (q.length > 0) return q;
        }
        return []; // all batches are done
    });
    const [cursor, setCursor] = useState(0);
    const [showWelcome, setShowWelcome] = useState(!location.state?.skipWelcome);

    // History timeline for review mode
    const [historyTimeline, setHistoryTimeline] = useState([]);
    const [reviewCursor, setReviewCursor] = useState(-1);

    /**
     * masteryMap: { [wordKey]: { [stepIdx]: { correct: N, wrong: N } } }
     * Tracks how many correct/wrong answers per word-step pair.
     * Initialize from persisted stepMastery if available.
     */
    const [masteryMap, setMasteryMap] = useState(() => {
        const initial = {};
        words.forEach(w => {
            if (w.stepMastery && typeof w.stepMastery === 'object') {
                initial[w.word] = {};
                Object.keys(w.stepMastery).forEach(stepIdx => {
                    const sd = w.stepMastery[stepIdx];
                    initial[w.word][stepIdx] = {
                        correct: sd.correct ?? 0,
                        wrong: sd.wrong ?? 0
                    };
                });
            }
        });
        return initial;
    });

    // Accumulated results across all batches (for the final summary)
    const [allResults, setAllResults] = useState([]);

    // Force re-render key for step component when same item re-appears
    const [stepKey, setStepKey] = useState(0);

    // Batch indicator scroll refs
    const batchIndicatorRef = useRef(null);
    const activeWordRef = useRef(null);

    // Bookmark state
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: Small, 1: Medium, 2: Large


    // Derive from state (needed before useEffect)
    const currentBatch = batches[batchIndex] || [];
    const isReviewMode = reviewCursor !== -1;
    const activeHistoryItem = isReviewMode ? historyTimeline[reviewCursor] : null;

    const currentEntry = isReviewMode ? activeHistoryItem.entry : queue[cursor];
    const currentWord = isReviewMode ? activeHistoryItem.word : (currentEntry ? currentBatch[currentEntry.wordIdx] : null);
    const currentStepDef = currentEntry ? STEPS[currentEntry.stepIdx] : null;

    // Check if the current word is saved when it changes
    useEffect(() => {
        let isMounted = true;
        if (user?.uid && currentWord?.word) {
            checkWordSaved(user.uid, currentWord.word)
                .then(saved => {
                    if (isMounted) setIsSaved(saved);
                })
                .catch(err => console.error('Failed to check saved status', err));
        }
        return () => { isMounted = false; };
    }, [user?.uid, currentWord?.word]);

    const handleToggleSave = async () => {
        if (!user?.uid || !currentWord || isSaving) return;
        setIsSaving(true);
        try {
            const newStatus = await toggleSavedWord(user.uid, currentWord);
            setIsSaved(newStatus);
        } catch (err) {
            console.error('Failed to toggle saved word', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-scroll active word into view whenever the active word changes
    useEffect(() => {
        // Always scroll page to top when question changes
        window.scrollTo({ top: 0, behavior: 'instant' });

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
    }, [cursor, batchIndex, currentWord?.word, reviewCursor, showWelcome]);

    if (!totalWords) {
        return (
            <div className="loading-screen">
                <h2 className="mb-4">Không có từ vựng nào để học!</h2>
                <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Quay lại</button>
            </div>
        );
    }


    // Count how many step-pairs are fully mastered across all words so far
    function countAllMastered() {
        let mastered = 0;
        for (const w of words) {
            const wordMap = masteryMap[w.word] || {};
            // Start with base steps already completed
            const baseSteps = Math.min(w.stepsCompleted || 0, STEPS.length);
            mastered += baseSteps;

            // Add any newly mastered steps beyond the base (consecutive only)
            for (let s = baseSteps; s < STEPS.length; s++) {
                if ((wordMap[s]?.correct || 0) >= ((wordMap[s]?.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT)) mastered++;
                else break;
            }
        }
        return mastered;
    }

    // Total possible mastery slots in the ENTIRE session (all batches)
    const totalMasterySlots = totalWords * STEPS.length;
    const overallMastered = countAllMastered();
    const progressPct = (overallMastered / totalMasterySlots) * 100;

    // Per-word mastered step count (for the batch indicator badges)
    function getWordMasteredCount(wordKey) {
        const wordObj = words.find(w => w.word === wordKey);
        const baseSteps = Math.min(wordObj?.stepsCompleted || 0, STEPS.length);

        const wordMap = masteryMap[wordKey] || {};
        let count = baseSteps;
        for (let s = baseSteps; s < STEPS.length; s++) {
            if ((wordMap[s]?.correct || 0) >= ((wordMap[s]?.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT)) count++;
            else break;
        }
        return count;
    }

    // Build the result entries for the finalized batch
    function buildBatchResults(mMap) {
        return currentBatch.map(w => {
            const wordMap = mMap[w.word] || {};
            let totalCorrect = 0;
            let totalWrong = 0;
            for (let s = 0; s < STEPS.length; s++) {
                totalCorrect += (wordMap[s]?.correct || 0);
                totalWrong += (wordMap[s]?.wrong || 0);
            }
            return {
                word: w.word,
                totalCorrect,
                totalWrong,
                totalAttempts: totalCorrect + totalWrong,
                allCorrect: totalWrong === 0,
            };
        });
    }

    async function finalizeBatch(mMap) {
        const batchResults = buildBatchResults(mMap);

        // Save to Firestore
        for (const w of currentBatch) {
            if (user?.uid) {
                try {
                    // Count how many steps are mastered for this word
                    const wordMap = mMap[w.word] || {};
                    const baseSteps = Math.min(w.stepsCompleted || 0, STEPS.length);
                    let stepsCompleted = baseSteps;
                    let sessionCorrect = 0;
                    let sessionWrong = 0;
                    let doneCountingSteps = false;
                    for (let s = baseSteps; s < STEPS.length; s++) {
                        const stepData = wordMap[s] || {};
                        const required = (stepData.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;
                        if (!doneCountingSteps && (stepData.correct || 0) >= required) stepsCompleted++;
                        else doneCountingSteps = true;
                        sessionCorrect += (stepData.correct || 0);
                        sessionWrong += (stepData.wrong || 0);
                    }
                    await updateWordProgress(user.uid, `${topicId}_${w.word}`, topicId, w.word, true, stepsCompleted, sessionCorrect, sessionWrong);
                } catch (e) {
                    console.warn('Failed to save progress:', e);
                }
            }
        }

        const updatedAll = [...allResults, ...batchResults];

        if (batchIndex < batches.length - 1) {
            // Find the next batch with remaining steps to learn
            let nextBatchIdx = batchIndex + 1;
            let nextQueue = [];
            while (nextBatchIdx < batches.length) {
                nextQueue = buildInitialQueue(batches[nextBatchIdx]);
                if (nextQueue.length > 0) break;
                nextBatchIdx++;
            }

            if (nextQueue.length > 0) {
                setAllResults(updatedAll);
                setBatchIndex(nextBatchIdx);
                setQueue(nextQueue);
                setCursor(0);
            } else {
                // All remaining batches are fully learned too
                setAllResults(updatedAll);
                setCompleted(true);
            }
        } else {
            setAllResults(updatedAll);
            setCompleted(true);
        }
    }

    async function handleStepComplete(isCorrect, answerData = null) {
        if (isReviewMode) return;

        // Save to history timeline
        setHistoryTimeline(prev => [...prev, {
            entry: currentEntry,
            word: currentWord,
            stepIdx: currentEntry.stepIdx,
            isCorrect,
            answerData
        }]);

        const wordKey = currentWord.word;
        const stepIdx = currentEntry.stepIdx;

        // Update mastery map
        const updatedMap = { ...masteryMap };
        if (!updatedMap[wordKey]) updatedMap[wordKey] = {};
        if (!updatedMap[wordKey][stepIdx]) updatedMap[wordKey][stepIdx] = { correct: 0, wrong: 0 };

        if (isCorrect) {
            updatedMap[wordKey][stepIdx].correct += 1;
        } else {
            updatedMap[wordKey][stepIdx].wrong += 1;
        }

        setMasteryMap(updatedMap);

        const requiredForThis = updatedMap[wordKey][stepIdx].wrong > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;
        const isMastered = updatedMap[wordKey][stepIdx].correct >= requiredForThis;

        // Always save stepMastery on every answer (so red dots persist)
        if (user?.uid) {
            const baseSteps = Math.min(currentWord.stepsCompleted || 0, STEPS.length);
            let stepsCompleted = baseSteps;
            for (let s = baseSteps; s < STEPS.length; s++) {
                const stepData = updatedMap[wordKey][s] || {};
                const required = (stepData.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;
                if ((stepData.correct || 0) >= required) stepsCompleted++;
                else break;
            }
            updateIntermediateWordProgress(user.uid, `${topicId}_${wordKey}`, topicId, wordKey, stepsCompleted, updatedMap[wordKey]).catch(console.warn);
        }

        if (!isCorrect || !isMastered) {
            // Re-queue: insert the same item 3–6 positions later
            const newQueue = [...queue];
            const reinsertOffset = Math.floor(Math.random() * 4) + 3; // 3-6
            const insertPos = Math.min(cursor + reinsertOffset, newQueue.length);
            newQueue.splice(insertPos, 0, { wordIdx: currentEntry.wordIdx, stepIdx });
            setQueue(newQueue);
        }

        // Move cursor forward
        const nextCursor = cursor + 1;

        if (nextCursor >= queue.length + ((!isCorrect || !isMastered) ? 1 : 0)) {
            // This shouldn't happen normally since we re-queue on fail,
            // but just in case: check if all steps are mastered
            const allMastered = currentBatch.every(w => {
                const wm = updatedMap[w.word] || {};
                const baseSteps = Math.min(w.stepsCompleted || 0, STEPS.length);
                return Array.from({ length: STEPS.length }, (_, s) => {
                    if (s < baseSteps) return true; // Already mastered
                    return (wm[s]?.correct || 0) >= ((wm[s]?.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT);
                }).every(Boolean);
            });

            if (allMastered) {
                await finalizeBatch(updatedMap);
            } else {
                setCursor(nextCursor);
                setStepKey(k => k + 1);
            }
        } else {
            setCursor(nextCursor);
            setStepKey(k => k + 1);
        }
    }

    // === COMPLETED SCREEN ===
    if (completed) {
        return (
            <div className="learn-page">
                <LearningComplete
                    results={allResults}
                    topicName={topicName}
                    onGoHome={() => navigate('/')}
                    onRestart={() => {
                        const resetWords = words.map(w => ({ ...w, stepsCompleted: 0 }));
                        const resetBatches = [];
                        for (let i = 0; i < resetWords.length; i += BATCH_SIZE)
                            resetBatches.push(resetWords.slice(i, i + BATCH_SIZE));
                        setActiveWords(resetWords);
                        setBatchIndex(0);
                        setQueue(buildInitialQueue(resetBatches[0]));
                        setCursor(0);
                        setMasteryMap({});
                        setAllResults([]);
                        setCompleted(false);
                        setShowWelcome(false);
                        setStepKey(0);
                        setHistoryTimeline([]);
                        setReviewCursor(-1);
                    }}
                />
            </div>
        );
    }

    // Handle case when initial queue is empty (all words already fully learned)
    if (!completed && (!currentWord || !currentStepDef)) {
        // Auto-fix: patch any words that have stepsCompleted=6 but level=0 (stuck data)
        // Uses updateIntermediateWordProgress which safely only bumps level 0→1
        // and won't affect words already at level >= 1
        if (user?.uid && topicId) {
            const fixStuckWords = async () => {
                for (const w of words) {
                    if ((w.stepsCompleted ?? 0) >= 6) {
                        try {
                            await updateIntermediateWordProgress(user.uid, `${topicId}_${w.word}`, topicId, w.word, 6);
                        } catch (e) {
                            console.warn('Auto-fix word level failed:', e);
                        }
                    }
                }
            };
            fixStuckWords();
        }

        // If queue is empty from the start, treat as if the session is done to show results
        // Re-learn: reset stepsCompleted so user can start over with all steps
        const wordsForRelearn = words.map(w => ({ ...w, stepsCompleted: 0 }));
        const batchesForRelearn = [];
        for (let i = 0; i < wordsForRelearn.length; i += BATCH_SIZE) {
            batchesForRelearn.push(wordsForRelearn.slice(i, i + BATCH_SIZE));
        }
        return (
            <div className="learn-page">
                <div className="learn-complete" style={{ justifyContent: 'center', gap: 'var(--space-xl)' }}>
                    <div className="learn-complete-icon">🎉</div>
                    <h2 className="learn-complete-title">Bạn đã thuần thục!</h2>
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                        Tất cả từ trong danh sách này đã được học xong cả 6 bước.<br />
                        <span style={{ fontSize: '0.85rem', opacity: 0.8, color: 'var(--color-primary)' }}>(Việc ôn tập lại sẽ không ảnh hưởng hoặc làm giảm tiến độ đã đạt được của bạn)</span>
                    </p>
                    <div className="learn-complete-actions">
                        <button className="btn btn-primary" onClick={() => {
                            // Reset all words to stepsCompleted=0 so ALL batches get a full queue
                            const resetWords = words.map(w => ({ ...w, stepsCompleted: 0 }));
                            const resetBatches = [];
                            for (let i = 0; i < resetWords.length; i += BATCH_SIZE)
                                resetBatches.push(resetWords.slice(i, i + BATCH_SIZE));
                            setActiveWords(resetWords);
                            setBatchIndex(0);
                            setQueue(buildInitialQueue(resetBatches[0]));
                            setCursor(0);
                            setMasteryMap({});
                            setAllResults([]);
                            setCompleted(false);
                            setShowWelcome(false);
                            setStepKey(0);
                        }}>
                            🔄 Ôn lại từ đầu
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Quay lại</button>
                    </div>
                </div>
            </div>
        );
    }

    const StepComponent = currentStepDef.Component;
    const activeStepIdx = currentEntry.stepIdx;

    // How far the current word-step is toward mastery
    const currentStepMastery = masteryMap[currentWord.word]?.[activeStepIdx]?.correct || 0;

    // === WELCOME SCREEN ===
    if (showWelcome) {
        return (
            <div className="learn-page">
                <LessonWelcomeScreen
                    topicName={topicName}
                    description={location.state?.topicDescription}
                    itemCount={totalWords}
                    itemType="từ vựng"
                    icon={icon}
                    color={color}
                    onStart={() => setShowWelcome(false)}
                    onBack={() => navigate(-1)}
                />
            </div>
        );
    }

    return (
        <div className="learn-page">
            {/* Top progress */}
            <div className="learn-topbar">
                <button className="btn btn-ghost learn-topbar-back" onClick={() => navigate(-1)} title="Thoát">
                    ✕
                </button>
                
                <div className="learn-progress-wrapper">
                    <div className="learn-topbar-title" title={topicName}>
                        {topicName}
                    </div>
                    <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>
                <div className="learn-topbar-actions">
                    <span className="learn-topbar-count" style={{ marginRight: '4px' }}>
                        {overallMastered}/{totalMasterySlots}
                    </span>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setFontSizeLevel(prev => (prev + 1) % 3)}
                        style={{ padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        title="Thay đổi kích thước chữ"
                    >
                        <span style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                            A{fontSizeLevel === 0 ? '-' : fontSizeLevel === 2 ? '+' : ''}
                        </span>
                    </button>

                    <button
                        className={`btn btn-ghost learn-topbar-bookmark ${isSaved ? 'is-saved' : ''} ${isSaving ? 'is-saving' : ''}`}
                        onClick={handleToggleSave}
                        disabled={isSaving}
                        title={isSaved ? "Bỏ lưu từ" : "Lưu từ vựng"}
                    >
                        <Heart size={20} fill={isSaved ? "currentColor" : "none"} className={isSaved ? "text-error" : ""} />
                    </button>
                </div>
            </div>

            {/* All words indicator */}
            <div className="learn-batch-indicator" ref={batchIndicatorRef}>
                {words.map((w, i) => {
                    const done = getWordMasteredCount(w.word);
                    const referenceWord = isReviewMode ? activeHistoryItem.word : currentWord;
                    const isActive = referenceWord && w.word === referenceWord.word;

                    return (
                        <div
                            key={w.word}
                            className="learn-batch-word-wrapper"
                            ref={isActive ? activeWordRef : null}
                        >
                            <div
                                className={`learn-batch-word ${isActive ? 'learn-batch-word--active' : ''} ${done >= STEPS.length ? 'learn-batch-word--done' : ''} ${historyTimeline.some(item => item.word.word === w.word) ? 'learn-batch-word--clickable' : ''}`}
                                onClick={() => {
                                    const hasHistory = historyTimeline.some(item => item.word.word === w.word);
                                    if (hasHistory) {
                                        // Find the last history entry for this word
                                        for (let j = historyTimeline.length - 1; j >= 0; j--) {
                                            if (historyTimeline[j].word.word === w.word) {
                                                setReviewCursor(j);
                                                return;
                                            }
                                        }
                                    }
                                }}
                            >
                                <span>{i + 1}</span>
                                {done >= STEPS.length && <span className="learn-batch-check">✓</span>}
                            </div>

                            {/* Always show dots for all STEPS */}
                            <div className="learn-mastery-dots" style={{ opacity: isActive ? 1 : 0.6 }}>
                                {STEPS.map((_, stepIdx) => {
                                    const baseSteps = Math.min(w.stepsCompleted || 0, STEPS.length);
                                    const isPreMastered = stepIdx < baseSteps;

                                    const stepData = masteryMap[w.word]?.[stepIdx] || {};
                                    const isStepMastered = isPreMastered || (stepData.correct || 0) >= ((stepData.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT);
                                    const hasError = !isStepMastered && (stepData.wrong || 0) > 0;

                                    let dotClass = 'learn-mastery-dot';
                                    if (isStepMastered) dotClass += ' learn-mastery-dot--filled';
                                    else if (hasError) dotClass += ' learn-mastery-dot--error';

                                    const handleDotClick = () => {
                                        for (let j = historyTimeline.length - 1; j >= 0; j--) {
                                            if (historyTimeline[j].word.word === w.word && historyTimeline[j].stepIdx === stepIdx) {
                                                setReviewCursor(j);
                                                return;
                                            }
                                        }
                                    };

                                    const hasHistory = historyTimeline.some(item => item.word.word === w.word && item.stepIdx === stepIdx);

                                    return (
                                        <div
                                            key={stepIdx}
                                            className={dotClass}
                                            onClick={handleDotClick}
                                            style={{ cursor: hasHistory ? 'pointer' : 'default' }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="learn-content animate-fade-in" key={isReviewMode ? `review-${reviewCursor}` : `${batchIndex}-${cursor}-${stepKey}`} data-font-size={fontSizeLevel}>
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
                <StepComponent
                    wordData={currentWord}
                    onComplete={handleStepComplete}
                    reviewData={isReviewMode ? { ...activeHistoryItem.answerData, isCorrect: activeHistoryItem.isCorrect } : null}
                />
            </div>
        </div>
    );
}
