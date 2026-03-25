/**
 * Spaced Repetition Service — SM-2 simplified
 * Manages word progress in Firestore
 */

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, getCountFromServer, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import wordData from '../data/wordData';

const INTERVALS = [0, 1, 3, 7, 14, 30]; // days per level

/**
 * Get progress for a specific word
 */
export async function getWordProgress(uid, wordId) {
    try {
        const ref = doc(db, 'users', uid, 'word_progress', wordId);
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.warn('getWordProgress error:', err);
        return null;
    }
}

/**
 * Update progress after completing a word session
 * @param {boolean} passed — true if all 6 steps correct
 * @param {number} stepsCompleted — how many steps mastered (0-6)
 * @param {number} sessionCorrect — actual correct answer count from this session
 * @param {number} sessionWrong — actual wrong answer count from this session
 */
export async function updateWordProgress(uid, wordId, topicId, word, passed, stepsCompleted = 6, sessionCorrect = 0, sessionWrong = 0) {
    try {
        const ref = doc(db, 'users', uid, 'word_progress', wordId);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;

        const now = new Date();
        let level = existing?.level ?? 0;
        let easeFactor = existing?.easeFactor ?? 2.5;
        let correctStreak = existing?.correctStreak ?? 0;
        const totalReviews = (existing?.totalReviews ?? 0) + 1;
        // Add actual session counts instead of just +1
        const totalCorrect = (existing?.totalCorrect ?? 0) + sessionCorrect;
        const totalWrong = (existing?.totalWrong ?? 0) + sessionWrong;

        if (passed) {
            level = Math.min(level + 1, 5);
            easeFactor = Math.min(easeFactor + 0.1, 3.0);
            correctStreak += 1;
        } else {
            level = Math.max(level - 1, 0);
            easeFactor = Math.max(easeFactor - 0.2, 1.3);
            correctStreak = 0;
        }

        const interval = INTERVALS[level] || 0;
        const nextReview = new Date(now.getTime() + interval * 86400000);

        await setDoc(ref, {
            word,
            topicId,
            level,
            easeFactor,
            interval,
            nextReview: Timestamp.fromDate(nextReview),
            lastStudied: Timestamp.fromDate(now),
            correctStreak,
            totalReviews,
            totalCorrect,
            totalWrong,
            stepsCompleted,
        });

        return { level, interval, nextReview };
    } catch (err) {
        console.warn('updateWordProgress error:', err);
        return null;
    }
}

/**
 * Update intermediate progress for a word (e.g. tracking partial steps completed)
 * @param {number} stepsCompleted - How many steps out of 6 are currently completed
 * @param {Object} [stepMastery] - Optional per-step mastery data { [stepIdx]: { correct, wrong } }
 */
export async function updateIntermediateWordProgress(uid, wordId, topicId, word, stepsCompleted, stepMastery) {
    try {
        const ref = doc(db, 'users', uid, 'word_progress', wordId);
        const snap = await getDoc(ref);

        const masteryData = stepMastery ? JSON.stringify(stepMastery) : null;

        if (!snap.exists()) {
            // Auto-bump level to 1 if all 6 steps are already completed
            const autoLevel = stepsCompleted >= 6 ? 1 : 0;
            const now = new Date();
            const interval = autoLevel >= 1 ? INTERVALS[autoLevel] || 0 : 0;
            const nextReview = new Date(now.getTime() + interval * 86400000);
            const data = {
                word,
                topicId,
                level: autoLevel,
                easeFactor: 2.5,
                interval,
                nextReview: Timestamp.fromDate(nextReview),
                lastStudied: Timestamp.fromDate(now),
                correctStreak: 0,
                totalReviews: 0,
                stepsCompleted,
            };
            if (masteryData) data.stepMastery = masteryData;
            await setDoc(ref, data);
        } else {
            const existing = snap.data();
            const updateData = {
                stepsCompleted,
                lastStudied: Timestamp.fromDate(new Date()),
            };
            if (masteryData) updateData.stepMastery = masteryData;

            // Auto-bump level to 1 if all 6 steps completed but level is still 0
            // This prevents the edge case where finalizeBatch is never called
            if (stepsCompleted >= 6 && (existing.level ?? 0) < 1) {
                updateData.level = 1;
                updateData.easeFactor = Math.min((existing.easeFactor ?? 2.5) + 0.1, 3.0);
                updateData.correctStreak = (existing.correctStreak ?? 0) + 1;
                const interval = INTERVALS[1] || 0;
                updateData.interval = interval;
                updateData.nextReview = Timestamp.fromDate(new Date(Date.now() + interval * 86400000));
            }

            await updateDoc(ref, updateData);
        }
    } catch (err) {
        console.warn('updateIntermediateWordProgress error:', err);
    }
}

/**
 * Reset all progress for a specific word, returning it to a complete unlearned state
 */
export async function resetWordProgress(uid, wordId) {
    try {
        const ref = doc(db, 'users', uid, 'word_progress', wordId);
        // Using deleteDoc requires importing 'deleteDoc' from firestore
        // To avoid messing with imports if deleteDoc isn't there, we'll set it to 0
        await setDoc(ref, {
            stepsCompleted: 0,
            level: 0,
            easeFactor: 2.5,
            interval: 0,
            correctStreak: 0,
            totalReviews: 0,
            stepMastery: null
        }, { merge: true });
        return true;
    } catch (err) {
        console.warn('resetWordProgress error:', err);
        return false;
    }
}

/**
 * Get all words due for review today
 */
export async function getDueWords(uid) {
    try {
        const now = Timestamp.fromDate(new Date());
        const q = query(
            collection(db, 'users', uid, 'word_progress'),
            where('nextReview', '<=', now)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('getDueWords error:', err);
        return [];
    }
}

/**
 * Get all learned words for a specific topic
 * @returns {Set<string>} set of word strings
 */
export async function getLearnedWordsForTopic(uid, topicId) {
    try {
        const q = query(
            collection(db, 'users', uid, 'word_progress'),
            where('topicId', '==', topicId),
            where('level', '>=', 1)
        );
        const snap = await getDocs(q);
        const words = new Set();
        snap.docs.forEach((d) => words.add(d.data().word));
        return words;
    } catch (err) {
        console.warn('getLearnedWordsForTopic error:', err);
        return new Set();
    }
}

/**
 * Get progress map for all words in a topic (including stepsCompleted)
 * @returns {Object} { [word]: { stepsCompleted: number, level: number } }
 */
export async function getWordProgressMapForTopic(uid, topicId) {
    try {
        const q = query(
            collection(db, 'users', uid, 'word_progress'),
            where('topicId', '==', topicId)
        );
        const snap = await getDocs(q);
        const map = {};
        snap.docs.forEach((d) => {
            const data = d.data();
            let stepMastery = null;
            if (data.stepMastery) {
                try { stepMastery = JSON.parse(data.stepMastery); } catch (e) { /* ignore */ }
            }
            map[data.word] = {
                stepsCompleted: data.stepsCompleted ?? (data.level >= 1 ? 6 : 0),
                level: data.level ?? 0,
                stepMastery,
            };
        });
        return map;
    } catch (err) {
        console.warn('getWordProgressMapForTopic error:', err);
        return {};
    }
}

/**
 * Get progress map for all words learned by a user
 * @returns {Object} { [word]: { stepsCompleted: number, level: number } }
 */
export async function getAllWordProgressMap(uid, startDate = '', endDate = '') {
    try {
        const q = query(
            collection(db, 'users', uid, 'word_progress')
        );
        const snap = await getDocs(q);
        const map = {};

        let start = null;
        let end = null;
        if (startDate) start = new Date(startDate).setHours(0, 0, 0, 0);
        if (endDate) end = new Date(endDate).setHours(23, 59, 59, 999);

        snap.docs.forEach((d) => {
            const data = d.data();

            if (start || end) {
                const lsDate = data.lastStudied?.toDate ? data.lastStudied.toDate().getTime() : 0;
                if (lsDate === 0) return;
                if (start && lsDate < start) return;
                if (end && lsDate > end) return;
            }

            let stepMastery = null;
            if (data.stepMastery) {
                try { stepMastery = JSON.parse(data.stepMastery); } catch (e) { /* ignore */ }
            }
            map[data.word] = {
                stepsCompleted: data.stepsCompleted ?? (data.level >= 1 ? 6 : 0),
                level: data.level ?? 0,
                totalCorrect: data.totalCorrect ?? 0,
                totalWrong: data.totalWrong ?? 0,
                stepMastery,
            };
        });
        return map;
    } catch (err) {
        console.warn('getAllWordProgressMap error:', err);
        return {};
    }
}

/**
 * Get total learned words count — uses server-side aggregation (0 document reads)
 */
export async function getLearnedCount(uid) {
    try {
        const q = query(
            collection(db, 'users', uid, 'word_progress'),
            where('level', '>=', 1)
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    } catch (err) {
        return 0;
    }
}

/**
 * Shared helper: verify which topicIds still exist in Firestore.
 * Returns { validTopicIds: Set, invalidTopicIds: Set }.
 * Deduplicates logic used by getReviewCounts and getReviewProgressDocs.
 */
async function verifyTopicIds(uid, topicIds) {
    const validTopicIds = new Set();
    const invalidTopicIds = new Set();

    await Promise.all(topicIds.map(async (topicId) => {
        if (validTopicIds.has(topicId) || invalidTopicIds.has(topicId)) return;

        let exists = false;
        try {
            if (topicId.startsWith('t-')) {
                const snap = await getDoc(doc(db, 'teacher_topics', topicId));
                exists = snap.exists();
            } else if (topicId.startsWith('list_')) {
                const snap = await getDoc(doc(db, `users/${uid}/custom_lists`, topicId));
                exists = snap.exists();
            } else {
                const snap = await getDoc(doc(db, 'topics', topicId));
                exists = snap.exists();
            }
        } catch (e) {
            // Ignore
        }

        if (exists) validTopicIds.add(topicId);
        else invalidTopicIds.add(topicId);
    }));

    return { validTopicIds, invalidTopicIds };
}

const TOTAL_STEPS = 6;
const MAX_REVIEW_WORDS = 15;

/**
 * Get counts for the review session (lightweight — no word data lookup)
 * @returns {{ incompleteCount: number, dueCount: number, totalCount: number }}
 */
export async function getReviewCounts(uid) {
    try {
        const snap = await getDocs(collection(db, 'users', uid, 'word_progress'));
        const now = new Date();
        let incompleteCount = 0;
        let dueCount = 0;

        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const topicIds = [...new Set(allDocs.map(d => d.topicId))].filter(Boolean);

        const { validTopicIds, invalidTopicIds } = await verifyTopicIds(uid, topicIds);

        const orphanedRefs = [];

        allDocs.forEach(data => {
            if (invalidTopicIds.has(data.topicId)) {
                orphanedRefs.push(doc(db, 'users', uid, 'word_progress', data.id));
                return;
            }

            const lastStudied = data.lastStudied?.toDate?.() || new Date(0);

            // Skip words studied today
            if (lastStudied.toDateString() === now.toDateString()) {
                return;
            }

            const steps = data.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                incompleteCount++;
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = data.nextReview?.toDate?.() ?? new Date(0);
                if (nextReview <= now) dueCount++;
            }
        });

        // Cleanup orphaned progress records asynchronously
        if (orphanedRefs.length > 0) {
            Promise.all(orphanedRefs.map(ref => deleteDoc(ref))).catch(err => {
                console.warn('Failed to cleanup orphaned word progress:', err);
            });
        }

        return {
            incompleteCount,
            dueCount,
            totalCount: Math.min(incompleteCount + dueCount, MAX_REVIEW_WORDS)
        };
    } catch (err) {
        console.warn('getReviewCounts error:', err);
        return { incompleteCount: 0, dueCount: 0, totalCount: 0 };
    }
}

/**
 * Lightweight review count for a given user — skips topic verification.
 * Designed for bulk calls (e.g. teacher viewing all students).
 * @returns {{ vocabReviewCount: number }}
 */
export async function getReviewCountsForUser(uid) {
    try {
        const snap = await getDocs(collection(db, 'users', uid, 'word_progress'));
        const now = new Date();
        let count = 0;

        snap.docs.forEach(d => {
            const data = d.data();
            const lastStudied = data.lastStudied?.toDate?.() || new Date(0);
            if (lastStudied.toDateString() === now.toDateString()) return;

            const steps = data.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                count++;
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = data.nextReview?.toDate?.() ?? new Date(0);
                if (nextReview <= now) count++;
            }
        });

        return { vocabReviewCount: Math.min(count, MAX_REVIEW_WORDS) };
    } catch (err) {
        console.warn('getReviewCountsForUser error:', err);
        return { vocabReviewCount: 0 };
    }
}

/**
 * Get all progress docs that qualify for review
 * @returns {{ incomplete: Array, due: Array }}
 */
export async function getReviewProgressDocs(uid) {
    try {
        const snap = await getDocs(collection(db, 'users', uid, 'word_progress'));
        const now = new Date();
        const incomplete = [];
        const due = [];

        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const topicIds = [...new Set(allDocs.map(d => d.topicId))].filter(Boolean);

        const { validTopicIds, invalidTopicIds } = await verifyTopicIds(uid, topicIds);

        const orphanedRefs = [];

        allDocs.forEach(data => {
            if (invalidTopicIds.has(data.topicId)) {
                orphanedRefs.push(doc(db, 'users', uid, 'word_progress', data.id));
                return;
            }

            const lastStudied = data.lastStudied?.toDate?.() || new Date(0);

            // Skip words studied today
            if (lastStudied.toDateString() === now.toDateString()) {
                return;
            }

            const steps = data.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                incomplete.push(data);
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = data.nextReview?.toDate?.() ?? new Date(0);
                if (nextReview <= now) due.push(data);
            }
        });

        // Cleanup orphaned progress records asynchronously
        if (orphanedRefs.length > 0) {
            Promise.all(orphanedRefs.map(ref => deleteDoc(ref))).catch(err => {
                console.warn('Failed to cleanup orphaned word progress:', err);
            });
        }

        // Sort: incomplete by fewest steps first, due by oldest nextReview first
        incomplete.sort((a, b) => (a.stepsCompleted ?? 0) - (b.stepsCompleted ?? 0));
        due.sort((a, b) => {
            const aDate = a.nextReview?.toDate?.() ?? new Date(0);
            const bDate = b.nextReview?.toDate?.() ?? new Date(0);
            return aDate - bDate;
        });

        // Combine: incomplete first, then due, capped at MAX_REVIEW_WORDS
        const combined = [...incomplete, ...due].slice(0, MAX_REVIEW_WORDS);

        return {
            progressDocs: combined,
            incompleteCount: incomplete.length,
            dueCount: due.length,
        };
    } catch (err) {
        console.warn('getReviewProgressDocs error:', err);
        return { progressDocs: [], incompleteCount: 0, dueCount: 0 };
    }
}

/**
 * Reset progress for all words in a specific topic
 * @param {string} uid user id
 * @param {string} topicId topic id to reset
 * @returns {boolean} true if successful
 */
export async function resetTopicProgress(uid, topicId) {
    if (!uid || !topicId) return false;
    try {
        const q = query(
            collection(db, 'users', uid, 'word_progress'),
            where('topicId', '==', topicId)
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
        console.error('resetTopicProgress error:', err);
        return false;
    }
}
