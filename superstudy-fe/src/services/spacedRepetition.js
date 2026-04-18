/**
 * Spaced Repetition Service - SM-2 simplified
 * Migrated from Firestore to Nest-backed storage.
 */

import { api, wordProgressService, topicsService, teacherTopicsService } from '../models';

const INTERVALS = [0, 1, 3, 7, 14, 30];
const TOTAL_STEPS = 6;
const MAX_REVIEW_WORDS = 15;

function unwrapResult(result) {
    return result?.data || result || null;
}

function unwrapList(result) {
    return Array.isArray(result) ? result : (result?.data || []);
}

function toDate(value) {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value) {
    const date = value instanceof Date ? value : toDate(value);
    return date ? date.toISOString() : null;
}

function parseStepMastery(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeProgressRecord(record = {}) {
    const lastStudied = toDate(record.lastStudied || record.lastPracticedAt);
    const nextReview = toDate(record.nextReview || record.nextReviewAt);
    const stepMastery = parseStepMastery(record.stepMastery);

    return {
        ...record,
        id: record.id || record.wordId || record._id,
        wordId: record.wordId || record.id || record._id,
        stepsCompleted: record.stepsCompleted ?? ((record.level ?? 0) >= 1 ? 6 : 0),
        level: record.level ?? 0,
        totalCorrect: record.totalCorrect ?? 0,
        totalWrong: record.totalWrong ?? 0,
        totalReviews: record.totalReviews ?? 0,
        easeFactor: record.easeFactor ?? 2.5,
        interval: record.interval ?? 0,
        correctStreak: record.correctStreak ?? 0,
        stepMastery,
        lastStudied,
        nextReview,
        lastPracticedAt: lastStudied,
        nextReviewAt: nextReview,
    };
}

function buildUpsertPayload(uid, topicId, wordId, word, extra = {}) {
    const nextReview = extra.nextReview || extra.nextReviewAt || null;
    const lastStudied = extra.lastStudied || extra.lastPracticedAt || null;

    return {
        userId: uid,
        topicId,
        wordId,
        word,
        ...extra,
        topicType: extra.topicType || null,
        nextReview: toIsoString(nextReview),
        nextReviewAt: toIsoString(nextReview),
        lastStudied: toIsoString(lastStudied),
        lastPracticedAt: toIsoString(lastStudied),
        stepMastery: extra.stepMastery || null,
    };
}

async function listProgressRecords(uid, topicId) {
    const result = await wordProgressService.findAll(uid, topicId);
    return unwrapList(result).map(normalizeProgressRecord);
}

async function findProgressRecord(uid, topicId, wordId) {
    if (!uid || !topicId || !wordId) return null;

    const result = await wordProgressService.findOne(uid, topicId, wordId);
    const data = unwrapResult(result);
    return data ? normalizeProgressRecord(data) : null;
}

async function upsertProgressRecord(uid, topicId, wordId, word, extra = {}) {
    const result = await wordProgressService.upsert(buildUpsertPayload(uid, topicId, wordId, word, extra));
    const data = unwrapResult(result);
    return data ? normalizeProgressRecord(data) : null;
}

async function removeProgressRecord(uid, topicId, wordId) {
    if (!uid || !topicId || !wordId) return false;

    try {
        await wordProgressService.removeOne(uid, topicId, wordId);
        return true;
    } catch (error) {
        console.warn('removeProgressRecord error:', error);
        return false;
    }
}

async function customListExists(uid, listId) {
    try {
        const result = await api.get('/settings', { userId: uid, type: 'custom_lists' });
        const docs = unwrapList(result);
        const lists = Array.isArray(docs[0]?.lists) ? docs[0].lists : [];
        return lists.some(list => list?.id === listId);
    } catch {
        return false;
    }
}

function isSyntheticTopicId(topicId) {
    const normalized = String(topicId || '').trim();
    return normalized.startsWith('__') && normalized.endsWith('__');
}

async function topicExists(topicId) {
    if (isSyntheticTopicId(topicId)) {
        return false;
    }

    try {
        const topic = await topicsService.findOne(topicId);
        if (unwrapResult(topic)) return true;
    } catch {
        // Ignore and try teacher topics next.
    }

    try {
        const topic = await teacherTopicsService.findOne(topicId);
        return !!unwrapResult(topic);
    } catch {
        return false;
    }
}

async function verifyTopicIds(uid, topicIds) {
    const validTopicIds = new Set();
    const invalidTopicIds = new Set();

    await Promise.all(topicIds.map(async (topicId) => {
        if (!topicId || validTopicIds.has(topicId) || invalidTopicIds.has(topicId)) return;

        if (isSyntheticTopicId(topicId)) {
            invalidTopicIds.add(topicId);
            return;
        }

        let exists = false;
        if (topicId.startsWith('list_')) {
            exists = await customListExists(uid, topicId);
        } else {
            exists = await topicExists(topicId);
        }

        if (exists) validTopicIds.add(topicId);
        else invalidTopicIds.add(topicId);
    }));

    return { validTopicIds, invalidTopicIds };
}

/**
 * Get progress for a specific word.
 */
export async function getWordProgress(uid, wordId) {
    try {
        const records = await listProgressRecords(uid);
        return records.find(record => record.wordId === wordId || record.id === wordId) || null;
    } catch (err) {
        console.warn('getWordProgress error:', err);
        return null;
    }
}

/**
 * Update progress after completing a word session.
 */
export async function updateWordProgress(uid, wordId, topicId, word, passed, stepsCompleted = 6, sessionCorrect = 0, sessionWrong = 0) {
    try {
        const existing = await findProgressRecord(uid, topicId, wordId);

        const now = new Date();
        let level = existing?.level ?? 0;
        let easeFactor = existing?.easeFactor ?? 2.5;
        let correctStreak = existing?.correctStreak ?? 0;
        const totalReviews = (existing?.totalReviews ?? 0) + 1;
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

        const saved = await upsertProgressRecord(uid, topicId, wordId, word, {
            level,
            easeFactor,
            interval,
            nextReview,
            lastStudied: now,
            correctStreak,
            totalReviews,
            totalCorrect,
            totalWrong,
            stepsCompleted,
            stepMastery: existing?.stepMastery || null,
            practiceCount: totalReviews,
            masteryScore: existing?.masteryScore ?? 0,
            isMastered: level >= 1,
        });

        return saved ? { level: saved.level, interval: saved.interval, nextReview: saved.nextReview } : null;
    } catch (err) {
        console.warn('updateWordProgress error:', err);
        return null;
    }
}

/**
 * Update intermediate progress for a word.
 */
export async function updateIntermediateWordProgress(uid, wordId, topicId, word, stepsCompleted, stepMastery) {
    try {
        const existing = await findProgressRecord(uid, topicId, wordId);
        const masteryData = stepMastery || null;

        if (!existing) {
            const autoLevel = stepsCompleted >= 6 ? 1 : 0;
            const now = new Date();
            const interval = autoLevel >= 1 ? INTERVALS[autoLevel] || 0 : 0;
            const nextReview = new Date(now.getTime() + interval * 86400000);

            await upsertProgressRecord(uid, topicId, wordId, word, {
                level: autoLevel,
                easeFactor: 2.5,
                interval,
                nextReview,
                lastStudied: now,
                correctStreak: 0,
                totalReviews: 0,
                totalCorrect: 0,
                totalWrong: 0,
                stepsCompleted,
                stepMastery: masteryData,
                practiceCount: 0,
                masteryScore: 0,
                isMastered: autoLevel >= 1,
            });
            return;
        }

        const updateData = {
            stepsCompleted,
            lastStudied: new Date(),
            stepMastery: masteryData ?? existing.stepMastery ?? null,
            level: existing.level ?? 0,
            easeFactor: existing.easeFactor ?? 2.5,
            interval: existing.interval ?? 0,
            nextReview: existing.nextReview,
            correctStreak: existing.correctStreak ?? 0,
            totalReviews: existing.totalReviews ?? 0,
            totalCorrect: existing.totalCorrect ?? 0,
            totalWrong: existing.totalWrong ?? 0,
            practiceCount: existing.practiceCount ?? existing.totalReviews ?? 0,
            masteryScore: existing.masteryScore ?? 0,
            isMastered: existing.isMastered ?? ((existing.level ?? 0) >= 1),
        };

        if (stepsCompleted >= 6 && (existing.level ?? 0) < 1) {
            updateData.level = 1;
            updateData.easeFactor = Math.min((existing.easeFactor ?? 2.5) + 0.1, 3.0);
            updateData.correctStreak = (existing.correctStreak ?? 0) + 1;
            updateData.interval = INTERVALS[1] || 0;
            updateData.nextReview = new Date(Date.now() + updateData.interval * 86400000);
            updateData.isMastered = true;
        }

        await upsertProgressRecord(uid, topicId, wordId, word, updateData);
    } catch (err) {
        console.warn('updateIntermediateWordProgress error:', err);
    }
}

/**
 * Reset all progress for a specific word.
 */
export async function resetWordProgress(uid, wordId) {
    try {
        const existing = await getWordProgress(uid, wordId);
        if (!existing) return true;

        await upsertProgressRecord(uid, existing.topicId, existing.wordId, existing.word, {
            stepsCompleted: 0,
            level: 0,
            easeFactor: 2.5,
            interval: 0,
            correctStreak: 0,
            totalReviews: 0,
            totalCorrect: 0,
            totalWrong: 0,
            stepMastery: null,
            nextReview: null,
            lastStudied: new Date(),
            practiceCount: 0,
            masteryScore: 0,
            isMastered: false,
        });

        return true;
    } catch (err) {
        console.warn('resetWordProgress error:', err);
        return false;
    }
}

/**
 * Get all words due for review today.
 */
export async function getDueWords(uid) {
    try {
        const now = new Date();
        const records = await listProgressRecords(uid);
        return records.filter(record => {
            const nextReview = record.nextReview || new Date(0);
            return nextReview <= now;
        });
    } catch (err) {
        console.warn('getDueWords error:', err);
        return [];
    }
}

/**
 * Get all learned words for a specific topic.
 */
export async function getLearnedWordsForTopic(uid, topicId) {
    try {
        const records = await listProgressRecords(uid, topicId);
        const words = new Set();
        records.forEach(record => {
            if ((record.level ?? 0) >= 1 && record.word) {
                words.add(record.word);
            }
        });
        return words;
    } catch (err) {
        console.warn('getLearnedWordsForTopic error:', err);
        return new Set();
    }
}

/**
 * Get progress map for all words in a topic.
 */
export async function getWordProgressMapForTopic(uid, topicId) {
    try {
        const records = await listProgressRecords(uid, topicId);
        const map = {};

        records.forEach(record => {
            map[record.word] = {
                stepsCompleted: record.stepsCompleted ?? ((record.level ?? 0) >= 1 ? 6 : 0),
                level: record.level ?? 0,
                stepMastery: record.stepMastery,
            };
        });

        return map;
    } catch (err) {
        console.warn('getWordProgressMapForTopic error:', err);
        return {};
    }
}

/**
 * Get progress map for all words learned by a user.
 */
export async function getAllWordProgressMap(uid, startDate = '', endDate = '') {
    try {
        const records = await listProgressRecords(uid);
        const map = {};

        let start = null;
        let end = null;
        if (startDate) start = new Date(startDate).setHours(0, 0, 0, 0);
        if (endDate) end = new Date(endDate).setHours(23, 59, 59, 999);

        records.forEach(record => {
            const studiedAt = record.lastStudied?.getTime() || 0;
            if (start && studiedAt < start) return;
            if (end && studiedAt > end) return;

            map[record.word] = {
                stepsCompleted: record.stepsCompleted ?? ((record.level ?? 0) >= 1 ? 6 : 0),
                level: record.level ?? 0,
                totalCorrect: record.totalCorrect ?? 0,
                totalWrong: record.totalWrong ?? 0,
                stepMastery: record.stepMastery,
            };
        });

        return map;
    } catch (err) {
        console.warn('getAllWordProgressMap error:', err);
        return {};
    }
}

/**
 * Get total learned words count.
 */
export async function getLearnedCount(uid) {
    try {
        const records = await listProgressRecords(uid);
        return records.filter(record => (record.level ?? 0) >= 1).length;
    } catch (err) {
        return 0;
    }
}

/**
 * Get counts for the review session.
 */
export async function getReviewCounts(uid) {
    try {
        const records = await listProgressRecords(uid);
        const now = new Date();
        let incompleteCount = 0;
        let dueCount = 0;

        const topicIds = [...new Set(records.map(record => record.topicId))].filter(Boolean);
        const { invalidTopicIds } = await verifyTopicIds(uid, topicIds);

        for (const record of records) {
            if (invalidTopicIds.has(record.topicId)) {
                await removeProgressRecord(uid, record.topicId, record.wordId);
                continue;
            }

            const lastStudied = record.lastStudied || new Date(0);
            if (lastStudied.toDateString() === now.toDateString()) continue;

            const steps = record.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                incompleteCount++;
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = record.nextReview || new Date(0);
                if (nextReview <= now) dueCount++;
            }
        }

        return {
            incompleteCount,
            dueCount,
            totalCount: Math.min(incompleteCount + dueCount, MAX_REVIEW_WORDS),
        };
    } catch (err) {
        console.warn('getReviewCounts error:', err);
        return { incompleteCount: 0, dueCount: 0, totalCount: 0 };
    }
}

/**
 * Lightweight review count for a given user.
 */
export async function getReviewCountsForUser(uid) {
    try {
        const records = await listProgressRecords(uid);
        const now = new Date();
        let count = 0;

        records.forEach(record => {
            const lastStudied = record.lastStudied || new Date(0);
            if (lastStudied.toDateString() === now.toDateString()) return;

            const steps = record.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                count++;
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = record.nextReview || new Date(0);
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
 * Get all progress docs that qualify for review.
 */
export async function getReviewProgressDocs(uid) {
    try {
        const records = await listProgressRecords(uid);
        const now = new Date();
        const incomplete = [];
        const due = [];

        const topicIds = [...new Set(records.map(record => record.topicId))].filter(Boolean);
        const { invalidTopicIds } = await verifyTopicIds(uid, topicIds);

        for (const record of records) {
            if (invalidTopicIds.has(record.topicId)) {
                await removeProgressRecord(uid, record.topicId, record.wordId);
                continue;
            }

            const lastStudied = record.lastStudied || new Date(0);
            if (lastStudied.toDateString() === now.toDateString()) continue;

            const steps = record.stepsCompleted ?? 0;
            if (steps < TOTAL_STEPS && steps > 0) {
                incomplete.push(record);
            } else if (steps >= TOTAL_STEPS) {
                const nextReview = record.nextReview || new Date(0);
                if (nextReview <= now) due.push(record);
            }
        }

        incomplete.sort((a, b) => (a.stepsCompleted ?? 0) - (b.stepsCompleted ?? 0));
        due.sort((a, b) => {
            const aDate = a.nextReview || new Date(0);
            const bDate = b.nextReview || new Date(0);
            return aDate - bDate;
        });

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
 * Reset progress for all words in a specific topic.
 */
export async function resetTopicProgress(uid, topicId) {
    if (!uid || !topicId) return false;

    try {
        await wordProgressService.reset(uid, topicId);
        return true;
    } catch (err) {
        console.error('resetTopicProgress error:', err);
        return false;
    }
}
