import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getReviewProgressDocs, updateWordProgress } from '../services/spacedRepetition';
import { getAdminTopicWords } from '../services/adminService';
import { getTeacherTopicWords } from '../services/teacherService';
import { checkWordSaved, toggleSavedWord, getCustomListById } from '../services/savedService';
import wordData from '../data/wordData';
import { Heart } from 'lucide-react';
import './LearnPage.css';
import './ReviewPage.css';
import { useAntiCopy } from '../hooks/useAntiCopy';


import StepListening from '../components/learn/StepListening';
import StepPronunciation from '../components/learn/StepPronunciation';
import StepMeaning from '../components/learn/StepMeaning';
import StepSpelling from '../components/learn/StepSpelling';
import StepCollocation from '../components/learn/StepCollocation';
import StepSequence from '../components/learn/StepSequence';
import LearningComplete from '../components/learn/LearningComplete';

const STEPS = [
    { key: 'listening', Component: StepListening },
    { key: 'pronunciation', Component: StepPronunciation },
    { key: 'meaning', Component: StepMeaning },
    { key: 'spelling', Component: StepSpelling },
    { key: 'collocation', Component: StepCollocation },
    { key: 'sequence', Component: StepSequence },
];

const REQUIRED_CORRECT_DEFAULT = 1;
const REQUIRED_CORRECT_WITH_ERRORS = 2;

function buildReviewQueue(wordsArr) {
    const queue = [];
    const pool = wordsArr.map(w => ({
        ...w,
        steps: [...w.remainingSteps]
    })).filter(w => w.steps.length > 0);

    let lastPickedWord = null;

    while (pool.length > 0) {
        let eligible = pool.filter(p => p.wordObj.word !== lastPickedWord);
        if (eligible.length === 0) eligible = pool;

        // Give priority to words with fewer remaining steps to finish them off faster
        eligible.sort((a, b) => a.steps.length - b.steps.length);

        // Randomly pick from the top 3 (or fewer) shortest
        const topN = Math.min(3, eligible.length);
        const pickIdx = Math.floor(Math.random() * topN);
        const picked = eligible[pickIdx];

        const stepIdx = picked.steps.shift();

        queue.push({
            wordObj: picked.wordObj,
            progressDoc: picked.progressDoc,
            stepIdx: stepIdx,
            type: picked.type
        });

        lastPickedWord = picked.wordObj.word;

        if (picked.steps.length === 0) {
            const origIdx = pool.findIndex(p => p === picked);
            pool.splice(origIdx, 1);
        }
    }
    return queue;
}

export default function ReviewPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    useAntiCopy();

    const [loading, setLoading] = useState(true);
    const [queue, setQueue] = useState([]);
    const [cursor, setCursor] = useState(0);
    const [completed, setCompleted] = useState(false);

    // masteryMap: { [wordKey]: { [stepIdx]: { correct: N, wrong: N } } }
    const [masteryMap, setMasteryMap] = useState({});

    // Results to show in end screen: { word, totalCorrect, totalWrong, allCorrect, level }
    const [finalResults, setFinalResults] = useState([]);

    const [stepKey, setStepKey] = useState(0);

    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: Small, 1: Medium, 2: Large


    useEffect(() => {
        if (!user?.uid) return;

        async function loadReviewSession() {
            setLoading(true);
            try {
                const { progressDocs } = await getReviewProgressDocs(user.uid);

                if (progressDocs.length === 0) {
                    setQueue([]);
                    setLoading(false);
                    return;
                }

                // Identify topics not in local wordData (Admin newly created or Teacher topics)
                const topicIdsToFetch = new Set();
                progressDocs.forEach(d => {
                    if (d.topicId && !d.topicId.startsWith('list_') && !wordData[d.topicId]) {
                        topicIdsToFetch.add(d.topicId);
                    }
                });

                // Fetch those topics from Firestore
                const fetchedTopicWords = {};
                for (const tId of topicIdsToFetch) {
                    try {
                        let words = [];
                        if (tId.startsWith('t-')) {
                            words = await getTeacherTopicWords(tId);
                        } else {
                            words = await getAdminTopicWords(tId);
                        }
                        fetchedTopicWords[tId] = words;
                    } catch (e) {
                        console.warn(`Could not fetch words for topic ${tId}`, e);
                    }
                }

                const wordsArr = [];
                let dueStepCounter = 0; // Ensures diverse question types instead of random overlaps

                for (const docProg of progressDocs) {
                    let wObj = null;
                    if (docProg.topicId && docProg.topicId.startsWith('list_')) {
                        try {
                            const customList = await getCustomListById(user?.uid, docProg.topicId);
                            const words = customList?.words || [];
                            wObj = words.find(w => w.word === docProg.word);
                        } catch (e) {
                            console.warn('Could not fetch custom list word:', e);
                        }
                    } else if (wordData[docProg.topicId]) {
                        // Built-in topic word
                        wObj = wordData[docProg.topicId].find(w => w.word === docProg.word);
                    } else if (fetchedTopicWords[docProg.topicId]) {
                        // Firestore topic word
                        wObj = fetchedTopicWords[docProg.topicId].find(w => w.word === docProg.word);
                    }

                    if (wObj) {
                        const stepsCompleted = docProg.stepsCompleted ?? 0;
                        let type = 'due';
                        let remainingSteps = [];

                        if (stepsCompleted < STEPS.length) {
                            type = 'incomplete';
                            for (let i = stepsCompleted; i < STEPS.length; i++) {
                                remainingSteps.push(i);
                            }
                        } else {
                            type = 'due';
                            // Sequentially loop through steps to guarantee all question types reflect
                            const assignedStep = dueStepCounter % STEPS.length;
                            dueStepCounter++;
                            remainingSteps.push(assignedStep);
                        }

                        wordsArr.push({
                            wordObj: wObj,
                            progressDoc: docProg,
                            type,
                            remainingSteps
                        });
                    } else {
                        console.warn(`Skipping orphaned review progress for: ${docProg.word}`);
                    }
                }

                const initialQueue = buildReviewQueue(wordsArr);
                setQueue(initialQueue);

            } catch (err) {
                console.error("Lỗi khi load phiên ôn tập:", err);
            } finally {
                setLoading(false);
            }
        }

        loadReviewSession();
    }, [user?.uid]);

    const currentEntry = queue[cursor];
    const currentWord = currentEntry?.wordObj;
    const currentStepDef = currentEntry ? STEPS[currentEntry.stepIdx] : null;

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

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p className="mt-md text-muted">Đang tìm từ cần ôn...</p>
            </div>
        );
    }

    if (queue.length === 0 && !completed) {
        return (
            <div className="loading-screen">
                <h2 className="mb-4">🎉 Tuyệt vời!</h2>
                <p className="text-muted mb-6">Bạn không có từ nào cần ôn tập hôm nay.</p>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Quay lại trang chủ</button>
            </div>
        );
    }

    const progressPct = ((cursor) / queue.length) * 100;

    async function finalizeReviewSession(mMap) {
        const results = [];

        // Group queue by word
        const wordsInSession = {};
        queue.forEach(q => {
            if (!wordsInSession[q.wordObj.word]) {
                wordsInSession[q.wordObj.word] = {
                    progressDoc: q.progressDoc,
                    wordObj: q.wordObj,
                    type: q.type,
                    stepsDone: []
                };
            }
            wordsInSession[q.wordObj.word].stepsDone.push(q.stepIdx);
        });

        for (const [wordKey, info] of Object.entries(wordsInSession)) {
            const wordMap = mMap[wordKey] || {};
            let totalCorrect = 0;
            let totalWrong = 0;
            let allStepsPassed = true;

            for (const s of info.stepsDone) {
                const stepData = wordMap[s] || {};
                const required = (stepData.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;
                if ((stepData.correct || 0) < required) {
                    allStepsPassed = false;
                }
                totalCorrect += (stepData.correct || 0);
                totalWrong += (stepData.wrong || 0);
            }

            if (user?.uid) {
                try {
                    let resultLevel = 0;
                    if (info.type === 'incomplete') {
                        const baseSteps = Math.min(info.progressDoc.stepsCompleted || 0, STEPS.length);
                        let finalStepsCompleted = baseSteps;
                        for (let s = baseSteps; s < STEPS.length; s++) {
                            const stepData = wordMap[s] || {};
                            const required = (stepData.wrong || 0) > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;
                            if ((stepData.correct || 0) >= required) finalStepsCompleted++;
                        }

                        // Only promote to level 1 if fully completed 6 steps
                        if (finalStepsCompleted >= STEPS.length) {
                            const res = await updateWordProgress(user.uid, info.progressDoc.id, info.progressDoc.topicId, wordKey, true, finalStepsCompleted);
                            resultLevel = res?.level || 1;
                        } else {
                            // Just update intermediate steps
                            await updateWordProgress(user.uid, info.progressDoc.id, info.progressDoc.topicId, wordKey, false, finalStepsCompleted);
                            resultLevel = 0;
                        }

                    } else if (info.type === 'due') {
                        const res = await updateWordProgress(user.uid, info.progressDoc.id, info.progressDoc.topicId, wordKey, allStepsPassed, 6);
                        resultLevel = res?.level || 0;
                    }

                    results.push({
                        word: wordKey,
                        totalCorrect,
                        totalWrong,
                        totalAttempts: totalCorrect + totalWrong,
                        allCorrect: totalWrong === 0,
                        newLevel: resultLevel,
                        topicId: info.progressDoc.topicId
                    });

                } catch (e) {
                    console.warn(`Failed to save review progress for ${wordKey}:`, e);
                }
            }
        }

        setFinalResults(results);
        setCompleted(true);
    }

    function handleStepComplete(success) {
        if (!currentWord) return;

        const currentWdMap = masteryMap[currentWord.word] || {};
        const stepStats = currentWdMap[currentEntry.stepIdx] || { correct: 0, wrong: 0 };
        const newCorrect = stepStats.correct + (success ? 1 : 0);
        const newWrong = stepStats.wrong + (!success ? 1 : 0);

        const newMap = {
            ...masteryMap,
            [currentWord.word]: {
                ...currentWdMap,
                [currentEntry.stepIdx]: { correct: newCorrect, wrong: newWrong }
            }
        };

        setMasteryMap(newMap);

        const requiredCorrect = newWrong > 0 ? REQUIRED_CORRECT_WITH_ERRORS : REQUIRED_CORRECT_DEFAULT;

        if (newCorrect >= requiredCorrect) {
            if (cursor + 1 < queue.length) {
                setCursor(cursor + 1);
                setStepKey(prev => prev + 1);
            } else {
                finalizeReviewSession(newMap);
            }
        } else {
            // Need to repeat - push a copy to end of queue
            setQueue(prev => [...prev, currentEntry]);
            setCursor(cursor + 1);
            setStepKey(prev => prev + 1);
        }
    }

    if (completed) {
        return <LearningComplete type="review" results={finalResults} onGoHome={() => navigate('/')} />;
    }

    const { Component } = currentStepDef;

    return (
        <div className="learn-page">
            {/* Top progress */}
            <div className="learn-topbar">
                <button className="btn btn-ghost learn-topbar-back" onClick={() => navigate('/')}>
                    ✕
                </button>
                <div className="learn-progress-wrapper">
                    <div className="learn-topbar-title">Ôn tập tổng hợp</div>
                    <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>
                <div className="learn-topbar-actions">
                    <span className="learn-topbar-count">
                        {cursor}/{queue.length}
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
                        className={`btn btn-ghost learn-topbar-bookmark ${isSaved ? 'is-saved' : ''} ${isSaving ? 'is-saving' : ''}`}
                        onClick={handleToggleSave}
                        disabled={isSaving}
                        title={isSaved ? "Bỏ lưu từ" : "Lưu từ vựng"}
                    >
                        <Heart size={20} fill={isSaved ? "currentColor" : "none"} className={isSaved ? "text-error" : ""} />
                    </button>
                </div>
            </div>

            <main className="learn-main">
                <div className="learn-content" data-font-size={fontSizeLevel}>
                    <div className="learn-step-container">
                        <Component
                            key={`${currentWord.word}-${currentEntry.stepIdx}-${stepKey}`}
                            wordData={currentWord}
                            onComplete={handleStepComplete}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
