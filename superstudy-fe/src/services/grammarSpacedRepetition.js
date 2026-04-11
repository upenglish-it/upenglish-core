import {
    grammarExercisesService,
    grammarProgressService,
} from '../models';

function unwrapData(result) {
    return result?.data ?? result ?? null;
}

function unwrapList(result) {
    const data = unwrapData(result);
    return Array.isArray(data) ? data : [];
}

function normalizeProgressRecord(record) {
    if (!record) return null;
    return {
        ...record,
        id: record.id || record._id || record.questionId,
        questionId: record.questionId || record.id || record._id,
        variationsPassed: Array.isArray(record.variationsPassed) ? record.variationsPassed : [],
        variationsFailed: Array.isArray(record.variationsFailed) ? record.variationsFailed : [],
    };
}

async function verifyGrammarExerciseIds(exerciseIds) {
    const validExerciseIds = new Set();
    const invalidExerciseIds = new Set();

    await Promise.all((exerciseIds || []).map(async (exerciseId) => {
        if (!exerciseId || validExerciseIds.has(exerciseId) || invalidExerciseIds.has(exerciseId)) return;

        try {
            const exercise = unwrapData(await grammarExercisesService.findOne(exerciseId));
            if (exercise && !exercise?.isDeleted) {
                validExerciseIds.add(exerciseId);
            } else {
                invalidExerciseIds.add(exerciseId);
            }
        } catch (err) {
            invalidExerciseIds.add(exerciseId);
        }
    }));

    return { validExerciseIds, invalidExerciseIds };
}

function getProgressTimeMillis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value.toMillis) return value.toMillis();
    if (value.seconds) return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Get grammar progress for a specific question
 */
export async function getGrammarProgress(uid, questionId) {
    try {
        const result = await grammarProgressService.findOne(uid, questionId);
        return normalizeProgressRecord(unwrapData(result));
    } catch (err) {
        console.warn('getGrammarProgress error:', err);
        return null;
    }
}

/**
 * Update progress after answering a grammar question variation
 */
export async function updateGrammarProgress(uid, questionId, exerciseId, passed, variationIndex, totalVariations = 4) {
    try {
        const result = await grammarProgressService.upsert({
            userId: uid,
            questionId,
            exerciseId,
            passed,
            variationIndex,
            totalVariations,
        });
        const progress = normalizeProgressRecord(unwrapData(result));
        return progress ? {
            level: progress.level,
            interval: progress.interval,
            nextReview: progress.nextReview,
        } : null;
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
        const allDue = unwrapList(await grammarProgressService.findDue(uid)).map(normalizeProgressRecord);

        if (allDue.length === 0) return [];

        const exerciseIds = [...new Set(allDue.map(item => item.exerciseId))].filter(Boolean);
        const { invalidExerciseIds } = await verifyGrammarExerciseIds(exerciseIds);

        if (invalidExerciseIds.size === 0) return allDue;

        const validDue = [];
        const orphaned = [];

        allDue.forEach(item => {
            if (invalidExerciseIds.has(item.exerciseId)) orphaned.push(item);
            else validDue.push(item);
        });

        if (orphaned.length > 0) {
            Promise.all(orphaned.map(item => grammarProgressService.removeOne(uid, item.questionId))).catch(err => {
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
 * Grammar review count for a given user.
 */
export async function getGrammarReviewCountForUser(uid) {
    try {
        const result = await grammarProgressService.getReviewCount(uid);
        const count = unwrapData(result);
        return typeof count === 'number' ? count : Number(count) || 0;
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
        await grammarProgressService.reset(uid, exerciseId);
        return true;
    } catch (err) {
        console.error('resetGrammarExerciseProgress error:', err);
        return false;
    }
}

/**
 * Get a high-level summary of grammar progress for a specific student and list of exercise IDs.
 */
export async function getStudentGrammarProgressSummary(uid, grammarExerciseIds) {
    if (!uid || !grammarExerciseIds || grammarExerciseIds.length === 0) return {};

    try {
        const result = await grammarProgressService.getSummary(uid, grammarExerciseIds.join(','));
        return unwrapData(result) || {};
    } catch (err) {
        console.error('getStudentGrammarProgressSummary error:', err);
        return {};
    }
}

/**
 * Get detailed question-by-question progress for a specific student and grammar exercise.
 */
export async function getStudentGrammarQuestionsProgress(uid, exerciseId) {
    if (!uid || !exerciseId) return [];

    try {
        return unwrapList(await grammarProgressService.getQuestions(uid, exerciseId));
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
        const result = unwrapData(await grammarProgressService.getStats(uid, startDate, endDate));
        if (result) return result;
        return { learned: 0, totalCorrect: 0, totalWrong: 0 };
    } catch (err) {
        console.error('getUserOverallGrammarStats error:', err);
        return { learned: 0, totalCorrect: 0, totalWrong: 0 };
    }
}
