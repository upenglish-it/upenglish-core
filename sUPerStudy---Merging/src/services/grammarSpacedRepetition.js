import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp, writeBatch, documentId, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const INTERVALS = [0, 1, 3, 7, 14, 30]; // days per level

/**
 * Get grammar progress for a specific question
 */
export async function getGrammarProgress(uid, questionId) {
    try {
        const ref = doc(db, 'users', uid, 'grammar_progress', questionId);
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.warn('getGrammarProgress error:', err);
        return null;
    }
}

/**
 * Update progress after answering a grammar question variation
 * @param {boolean} passed — true if the variation was answered correctly
 * @param {number} variationIndex — 0, 1, or 2 (which variation was answered)
 */
export async function updateGrammarProgress(uid, questionId, exerciseId, passed, variationIndex, totalVariations = 4) {
    try {
        const ref = doc(db, 'users', uid, 'grammar_progress', questionId);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;

        const now = new Date();
        let level = existing?.level ?? 0;
        let failCount = existing?.failCount ?? 0;
        let passCount = existing?.passCount ?? 0;
        let variationsPassed = existing?.variationsPassed ?? [];
        let variationsFailed = existing?.variationsFailed ?? [];

        if (passed) {
            if (!variationsPassed.includes(variationIndex)) {
                variationsPassed.push(variationIndex);
            }
            passCount += 1;
            // Only level up once all variations have been passed (completing the full question for this session)
            // Use a session key (date string) to prevent multiple level-ups in same day
            const todayKey = now.toISOString().slice(0, 10);
            const lastLeveledDay = existing?.lastLeveledDay ?? '';
            const allVariationsPassed = variationsPassed.length >= totalVariations;
            if (allVariationsPassed && lastLeveledDay !== todayKey) {
                level = Math.min(level + 1, 5);
                // persist the day we leveled up
                await setDoc(ref, { lastLeveledDay: todayKey, totalVariations }, { merge: true });
            }
        } else {
            if (!variationsFailed.includes(variationIndex)) {
                variationsFailed.push(variationIndex);
            }
            failCount += 1;
            level = Math.max(level - 1, 0); // Drop level if failed
        }

        // If a student fails all 3 variations, we might just keep reviewing variation 0 or mark it as critical
        // For now, we cycle through the available variations they haven't passed when reviewing.

        const interval = INTERVALS[level] || 0;
        const nextReview = new Date(now.getTime() + interval * 86400000);

        await setDoc(ref, {
            exerciseId,
            level,
            interval,
            nextReview: Timestamp.fromDate(nextReview),
            lastStudied: Timestamp.fromDate(now),
            failCount,
            passCount,
            variationsPassed,
            variationsFailed,
            lastVariationAttempted: variationIndex
        }, { merge: true });

        return { level, interval, nextReview };
    } catch (err) {
        console.warn('updateGrammarProgress error:', err);
        return null;
    }
}

/**
 * Get all grammar questions due for review today
 */
export async function getDueGrammarReviewIds(uid) {
    try {
        const now = Timestamp.fromDate(new Date());
        const q = query(
            collection(db, 'users', uid, 'grammar_progress'),
            where('nextReview', '<=', now)
        );
        const snap = await getDocs(q);
        const allDue = snap.docs.map((d) => ({ questionId: d.id, ...d.data() }));

        if (allDue.length === 0) return [];

        // Verify that the questions still exist
        const questionIds = allDue.map(q => q.questionId);
        const validQuestionIds = new Set();
        const batches = [];

        // Firestore 'in' query supports up to 10 elements
        for (let i = 0; i < questionIds.length; i += 10) {
            batches.push(questionIds.slice(i, i + 10));
        }

        await Promise.all(batches.map(async (batchIds) => {
            const verifyQ = query(collection(db, 'grammar_questions'), where(documentId(), 'in', batchIds));
            const verifySnap = await getDocs(verifyQ);
            verifySnap.forEach(d => validQuestionIds.add(d.id));
        }));

        const validDue = [];
        const orphanedRefs = [];

        allDue.forEach(item => {
            if (validQuestionIds.has(item.questionId)) {
                validDue.push(item);
            } else {
                orphanedRefs.push(doc(db, 'users', uid, 'grammar_progress', item.questionId));
            }
        });

        // Cleanup orphaned progress records asynchronously
        if (orphanedRefs.length > 0) {
            Promise.all(orphanedRefs.map(ref => deleteDoc(ref))).catch(err => {
                console.warn('Failed to cleanup orphaned grammar progress:', err);
            });
        }

        return validDue;
    } catch (err) {
        console.warn('getDueGrammarReviewIds error:', err);
        return [];
    }
}

/**
 * Lightweight grammar review count for a given user — skips question verification.
 * Designed for bulk calls (e.g. teacher viewing all students).
 * @returns {number} count of grammar questions due for review
 */
export async function getGrammarReviewCountForUser(uid) {
    try {
        const now = Timestamp.fromDate(new Date());
        const q = query(
            collection(db, 'users', uid, 'grammar_progress'),
            where('nextReview', '<=', now)
        );
        const snap = await getDocs(q);
        return snap.size;
    } catch (err) {
        console.warn('getGrammarReviewCountForUser error:', err);
        return 0;
    }
}

/**
 * Reset all grammar progress for a specific exercise
 */
export async function resetGrammarExerciseProgress(uid, exerciseId) {
    if (!uid || !exerciseId) return false;
    try {
        const q = query(
            collection(db, 'users', uid, 'grammar_progress'),
            where('exerciseId', '==', exerciseId)
        );
        const snap = await getDocs(q);

        if (snap.empty) return true;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            batch.delete(d.ref);
        });

        await batch.commit();
        return true;
    } catch (err) {
        console.error('resetGrammarExerciseProgress error:', err);
        return false;
    }
}

/**
 * Get a high-level summary of grammar progress for a specific student and list of exercise IDs.
 * Used for Assignment progress bars in the Dashboard.
 */
export async function getStudentGrammarProgressSummary(uid, grammarExerciseIds) {
    if (!uid || !grammarExerciseIds || grammarExerciseIds.length === 0) return {};

    try {
        const result = {};
        for (const exId of grammarExerciseIds) {
            // First, get total questions for this exercise
            const questionsQuery = query(collection(db, 'grammar_questions'), where('exerciseId', '==', exId));
            const questionsSnap = await getDocs(questionsQuery);
            const total = questionsSnap.size;

            // Second, get progress for these questions
            const progQuery = query(collection(db, 'users', uid, 'grammar_progress'), where('exerciseId', '==', exId));
            const progSnap = await getDocs(progQuery);

            let learned = 0;
            let learning = 0;
            let notStarted = total - progSnap.size;
            let completedSteps = 0;
            let totalCorrect = 0;
            let totalWrong = 0;

            progSnap.forEach(docSnap => {
                const data = docSnap.data();
                const variationsPassed = data.variationsPassed || [];

                // A question is "learned" when the student has passed at least 1 variation
                // Variations are just alternatives for retry, not all required
                if (variationsPassed.length >= 1) {
                    learned++;
                    completedSteps += 6;
                } else {
                    learning++;
                    completedSteps += 3; // Has progress record but hasn't passed any variation yet
                }
                totalCorrect += Number(data.passCount) || 0;
                totalWrong += Number(data.failCount) || 0;
            });

            result[exId] = {
                total,
                learned,
                learning,
                notStarted,
                completedSteps,
                totalCorrect,
                totalWrong
            };
        }
        return result;
    } catch (err) {
        console.error('getStudentGrammarProgressSummary error:', err);
        return {};
    }
}

/**
 * Get detailed question-by-question progress for a specific student and grammar exercise.
 * Used by teacher dashboard to show expanded detail views.
 */
export async function getStudentGrammarQuestionsProgress(uid, exerciseId) {
    if (!uid || !exerciseId) return [];

    try {
        // Get all questions for this exercise
        const questionsQuery = query(collection(db, 'grammar_questions'), where('exerciseId', '==', exerciseId));
        const questionsSnap = await getDocs(questionsQuery);

        // Get progress for this exercise
        const progQuery = query(collection(db, 'users', uid, 'grammar_progress'), where('exerciseId', '==', exerciseId));
        const progSnap = await getDocs(progQuery);

        const progressMap = {};
        progSnap.forEach(docSnap => {
            progressMap[docSnap.id] = docSnap.data();
        });

        const questions = [];
        questionsSnap.forEach(docSnap => {
            const qData = docSnap.data();
            questions.push({
                id: docSnap.id,
                ...qData,
                progress: progressMap[docSnap.id] || null
            });
        });

        // Sort by order, then by progress level (not started first)
        questions.sort((a, b) => {
            const orderA = a.order ?? 999;
            const orderB = b.order ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            const levelA = a.progress ? a.progress.level : -1;
            const levelB = b.progress ? b.progress.level : -1;
            return levelA - levelB;
        });

        return questions;
    } catch (err) {
        console.error('getStudentGrammarQuestionsProgress error:', err);
        return [];
    }
}

/**
 * Get overall grammar statistics for a user for a given date range.
 */
export async function getUserOverallGrammarStats(uid, startDate = '', endDate = '') {
    if (!uid) return { learned: 0, totalCorrect: 0, totalWrong: 0 };
    try {
        const progQuery = collection(db, 'users', uid, 'grammar_progress');
        const progSnap = await getDocs(progQuery);

        let learned = 0;
        let totalCorrect = 0;
        let totalWrong = 0;

        let start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        let end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

        progSnap.forEach(docSnap => {
            const data = docSnap.data();
            // Date filtering
            if (start || end) {
                const lsDate = data.lastStudied?.toDate ? data.lastStudied.toDate().getTime() : 0;
                if (lsDate === 0) return;
                if (start && lsDate < start) return;
                if (end && lsDate > end) return;
            }

            const variationsPassed = data.variationsPassed || [];
            if (variationsPassed.length >= 1) {
                learned++;
            }
            totalCorrect += Number(data.passCount) || 0;
            totalWrong += Number(data.failCount) || 0;
        });

        return { learned, totalCorrect, totalWrong };
    } catch (err) {
        console.error('getUserOverallGrammarStats error:', err);
        return { learned: 0, totalCorrect: 0, totalWrong: 0 };
    }
}
