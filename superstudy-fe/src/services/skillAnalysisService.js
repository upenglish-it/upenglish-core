/**
 * Skill Analysis Service
 * Aggregates learning data from vocabulary, grammar, and exams
 * to produce a skill profile for each student.
 */

import { examQuestionsService, examSubmissionsService, grammarProgressService, grammarQuestionsService, wordProgressService } from '../models';

const STEP_NAMES = ['listening', 'pronunciation', 'meaning', 'spelling', 'collocation', 'sequence'];
const STEP_TO_SKILL = {
    0: 'listening',    // Step 0: Listening
    1: 'speaking',     // Step 1: Pronunciation → Speaking
    2: 'reading',      // Step 2: Meaning → Reading
    3: 'writing',      // Step 3: Spelling → Writing
    // Steps 4,5 (Collocation, Sequence) contribute to vocabulary overall
};

/**
 * Analyze a student's skills across vocabulary, grammar, and exams.
 * 
 * @param {string} uid - Student user ID
 * @param {Object} options
 * @param {string} [options.startDate] - ISO date string for range start
 * @param {string} [options.endDate] - ISO date string for range end
 * @param {string[]} [options.topicIds] - Vocab topic IDs to include
 * @param {string[]} [options.grammarExerciseIds] - Grammar exercise IDs to include
 * @param {string[]} [options.examAssignmentIds] - Exam assignment IDs to include
 * @returns {Promise<Object>} Skill analysis results
 */
export async function analyzeStudentSkills(uid, options = {}) {
    const { startDate, endDate, topicIds = [], grammarExerciseIds = [], examAssignmentIds = [] } = options;

    const [vocabData, grammarData, examData] = await Promise.all([
        analyzeVocabulary(uid, topicIds, startDate, endDate),
        analyzeGrammar(uid, grammarExerciseIds, startDate, endDate),
        analyzeExams(uid, examAssignmentIds, startDate, endDate)
    ]);

    // Merge scores from all sources
    const skills = {
        listening: { score: 0, sources: [], count: 0, totalScore: 0 },
        speaking: { score: 0, sources: [], count: 0, totalScore: 0 },
        reading: { score: 0, sources: [], count: 0, totalScore: 0 },
        writing: { score: 0, sources: [], count: 0, totalScore: 0 },
        grammar: { score: 0, sources: [], count: 0, totalScore: 0 },
        vocabulary: { score: 0, sources: [], count: 0, totalScore: 0 },
    };

    // ── Vocabulary contributions ──
    if (vocabData.stepScores) {
        for (const [stepIdx, score] of Object.entries(vocabData.stepScores)) {
            const skillKey = STEP_TO_SKILL[stepIdx];
            if (skillKey && score !== null) {
                skills[skillKey].sources.push({ type: 'vocab', label: STEP_NAMES[stepIdx], score });
                skills[skillKey].count++;
                skills[skillKey].totalScore += score;
            }
            // Steps 4 (collocation) and 5 (sequence) contribute to vocabulary skill
            if (!skillKey && score !== null) {
                skills.vocabulary.sources.push({ type: 'vocab', label: STEP_NAMES[stepIdx], score });
                skills.vocabulary.count++;
                skills.vocabulary.totalScore += score;
            }
        }
        // Overall vocab retention contributes to vocabulary skill
        if (vocabData.retentionRate !== null) {
            skills.vocabulary.sources.push({ type: 'vocab', label: 'retention', score: vocabData.retentionRate });
            skills.vocabulary.count++;
            skills.vocabulary.totalScore += vocabData.retentionRate;
        }
        // Overall vocab accuracy (correct vs wrong across all steps) also contributes
        if (vocabData.overallAccuracy !== null) {
            skills.vocabulary.sources.push({ type: 'vocab', label: 'accuracy', score: vocabData.overallAccuracy });
            skills.vocabulary.count++;
            skills.vocabulary.totalScore += vocabData.overallAccuracy;
        }
    }

    // ── Grammar contributions ──
    if (grammarData.bySkill) {
        for (const [skillKey, data] of Object.entries(grammarData.bySkill)) {
            if (skills[skillKey] && data.score !== null) {
                skills[skillKey].sources.push({ type: 'grammar', label: `grammar_${skillKey}`, score: data.score, detail: data });
                skills[skillKey].count++;
                skills[skillKey].totalScore += data.score;
            }
        }
        // Untagged grammar questions contribute to grammar skill
        if (grammarData.overallAccuracy !== null) {
            skills.grammar.sources.push({ type: 'grammar', label: 'overall', score: grammarData.overallAccuracy });
            skills.grammar.count++;
            skills.grammar.totalScore += grammarData.overallAccuracy;
        }
    }

    // ── Exam contributions ──
    if (examData.bySkill) {
        for (const [skillKey, data] of Object.entries(examData.bySkill)) {
            if (skills[skillKey] && data.score !== null) {
                skills[skillKey].sources.push({ type: 'exam', label: `exam_${skillKey}`, score: data.score });
                skills[skillKey].count++;
                skills[skillKey].totalScore += data.score;
            }
        }
    }


    // Merge errorCategory breakdown from grammar + exam
    const mergedCategoryStats = {};
    // From grammar (correct/total attempts)
    for (const [cat, stats] of Object.entries(grammarData.errorCategoryStats || {})) {
        if (!mergedCategoryStats[cat]) mergedCategoryStats[cat] = { correct: 0, total: 0 };
        mergedCategoryStats[cat].correct += stats.correct;
        mergedCategoryStats[cat].total += stats.total;
    }
    // From exams (earned/max scores → convert to correct/total with proportional mapping)
    for (const [cat, stats] of Object.entries(examData.errorCategoryStats || {})) {
        if (!mergedCategoryStats[cat]) mergedCategoryStats[cat] = { correct: 0, total: 0 };
        // Treat each exam question as 1 attempt, score ratio as accuracy
        mergedCategoryStats[cat].correct += stats.earned;
        mergedCategoryStats[cat].total += stats.max;
    }
    // Convert to array sorted by accuracy (worst first)
    const errorCategoryBreakdown = Object.entries(mergedCategoryStats)
        .map(([category, stats]) => ({
            category,
            totalAttempts: stats.total,
            correctCount: stats.correct,
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
        }))
        .filter(item => item.accuracy !== null)
        .sort((a, b) => a.accuracy - b.accuracy);

    // ── ErrorCategory → Skill enrichment ──
    // Map errorCategory keys to parent skill so radar chart benefits from category data
    const ERROR_CAT_TO_SKILL = {};
    ['verb_tense', 'subject_verb_agreement', 'modal_verb', 'gerund_infinitive', 'passive_voice',
     'word_form', 'article', 'pronoun', 'quantifier', 'preposition',
     'conjunction', 'relative_clause', 'conditional', 'reported_speech', 'comparison', 'grammar_sentence_structure'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'grammar'; });
    ['vocabulary_meaning', 'vocabulary_usage', 'vocabulary_collocation', 'vocabulary_spelling', 'vocabulary_idiom_phrasal'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'vocabulary'; });
    ['writing_structure', 'writing_coherence', 'writing_task_response', 'writing_punctuation'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'writing'; });
    ['pronunciation_sounds', 'pronunciation_stress_intonation', 'fluency', 'speaking_interaction'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'speaking'; });
    ['listening_detail', 'listening_main_idea', 'listening_inference', 'listening_purpose_attitude'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'listening'; });
    ['reading_detail', 'reading_main_idea', 'reading_inference', 'reading_context_vocab'
    ].forEach(k => { ERROR_CAT_TO_SKILL[k] = 'reading'; });

    // Aggregate errorCategory stats by parent skill
    const catSkillAgg = {};
    for (const [cat, stats] of Object.entries(mergedCategoryStats)) {
        const parentSkill = ERROR_CAT_TO_SKILL[cat];
        if (parentSkill && skills[parentSkill]) {
            if (!catSkillAgg[parentSkill]) catSkillAgg[parentSkill] = { correct: 0, total: 0 };
            catSkillAgg[parentSkill].correct += stats.correct;
            catSkillAgg[parentSkill].total += stats.total;
        }
    }
    // Inject as additional source
    for (const [skillKey, agg] of Object.entries(catSkillAgg)) {
        if (agg.total > 0) {
            const catScore = Math.round((agg.correct / agg.total) * 100);
            skills[skillKey].sources.push({ type: 'errorCategory', label: 'category_aggregate', score: catScore });
            skills[skillKey].count++;
            skills[skillKey].totalScore += catScore;
        }
    }

    // Calculate final averaged scores
    for (const key of Object.keys(skills)) {
        const s = skills[key];
        s.score = s.count > 0 ? Math.round(s.totalScore / s.count) : null;
        delete s.count;
        delete s.totalScore;
    }

    // Determine strengths and weaknesses
    const scored = Object.entries(skills)
        .filter(([, v]) => v.score !== null)
        .sort((a, b) => b[1].score - a[1].score);

    const strengths = scored.filter(([, v]) => v.score >= 70).slice(0, 3).map(([k]) => k);
    const weaknesses = scored.filter(([, v]) => v.score < 60).slice(-3).map(([k]) => k);

    return {
        skills,
        strengths,
        weaknesses,
        totalWordsLearned: vocabData.totalLearned,
        totalWordsStudied: vocabData.totalStudied,
        vocabRetentionRate: vocabData.retentionRate,
        totalGrammarQuestions: grammarData.totalQuestions,
        grammarAccuracyRate: grammarData.overallAccuracy,
        totalExamsTaken: examData.totalExams,
        examAverageScore: examData.averageScore,
        grammarWeakPoints: grammarData.weakPoints || [],
        errorCategoryBreakdown,
        examSummaries: examData.examSummaries || [],
    };
}

// ═══════════════════════════════════════════════
// VOCABULARY ANALYSIS
// ═══════════════════════════════════════════════

async function analyzeVocabulary(uid, topicIds, startDate, endDate) {
    const result = { stepScores: {}, retentionRate: null, overallAccuracy: null, totalLearned: 0, totalStudied: 0 };

    try {
        const rawResult = topicIds.length > 0
            ? await Promise.all(topicIds.map(topicId => wordProgressService.findAll(uid, topicId)))
            : [await wordProgressService.findAll(uid)];

        let progressDocs = rawResult
            .flatMap(resultSet => (Array.isArray(resultSet) ? resultSet : (resultSet?.data || [])))
            .map(doc => ({
                ...doc,
                id: doc.id || doc.wordId || doc._id,
                lastStudied: doc.lastStudied || doc.lastPracticedAt || null,
            }));

        // Filter by date range if specified
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate).getTime() : 0;
            const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
            progressDocs = progressDocs.filter(p => {
                const lastStudied = p.lastStudied ? new Date(p.lastStudied).getTime() : 0;
                return lastStudied >= start && lastStudied <= end;
            });
        }

        if (progressDocs.length === 0) return result;

        // Analyze stepMastery + totalCorrect/totalWrong
        const stepTotals = {}; // { stepIdx: { correct: n, wrong: n } }
        let totalLevel = 0;
        let learnedCount = 0;
        let grandTotalCorrect = 0;
        let grandTotalWrong = 0;

        for (const prog of progressDocs) {
            result.totalStudied++;
            if (prog.level >= 1) {
                learnedCount++;
            }
            totalLevel += prog.level || 0;

            // Include totalCorrect/totalWrong from the word_progress doc (review sessions)
            grandTotalCorrect += prog.totalCorrect || 0;
            grandTotalWrong += prog.totalWrong || 0;

            // Parse stepMastery (stored as JSON string)
            if (prog.stepMastery) {
                let mastery;
                try {
                    mastery = typeof prog.stepMastery === 'string' ? JSON.parse(prog.stepMastery) : prog.stepMastery;
                } catch { continue; }

                for (const [stepIdx, data] of Object.entries(mastery)) {
                    if (!stepTotals[stepIdx]) stepTotals[stepIdx] = { correct: 0, wrong: 0 };
                    stepTotals[stepIdx].correct += data.correct || 0;
                    stepTotals[stepIdx].wrong += data.wrong || 0;
                }
            }
        }

        // Calculate step scores (0-100)
        for (const [stepIdx, data] of Object.entries(stepTotals)) {
            const total = data.correct + data.wrong;
            result.stepScores[stepIdx] = total > 0 ? Math.round((data.correct / total) * 100) : null;
        }

        result.totalLearned = learnedCount;
        result.retentionRate = progressDocs.length > 0 ? Math.round((learnedCount / progressDocs.length) * 100) : null;

        // Calculate overall accuracy: stepMastery correct/wrong + review totalCorrect/totalWrong
        let allCorrect = grandTotalCorrect, allWrong = grandTotalWrong;
        for (const data of Object.values(stepTotals)) {
            allCorrect += data.correct;
            allWrong += data.wrong;
        }
        const allTotal = allCorrect + allWrong;
        result.overallAccuracy = allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : null;

    } catch (err) {
        console.error('analyzeVocabulary error:', err);
    }

    return result;
}

// ═══════════════════════════════════════════════
// GRAMMAR ANALYSIS
// ═══════════════════════════════════════════════

async function analyzeGrammar(uid, grammarExerciseIds, startDate, endDate) {
    const result = { bySkill: {}, overallAccuracy: null, totalQuestions: 0, weakPoints: [], errorCategoryStats: {} };

    try {
        const progressResponse = grammarExerciseIds.length > 0
            ? await grammarProgressService.findAll(uid, undefined, grammarExerciseIds.join(','))
            : await grammarProgressService.findAll(uid);
        let progressDocs = (Array.isArray(progressResponse) ? progressResponse : (progressResponse?.data || []))
            .map(doc => ({
                ...doc,
                id: doc.id || doc._id || doc.questionId,
                questionId: doc.questionId || doc.id || doc._id,
            }));

        // Filter by date
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate).getTime() : 0;
            const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
            progressDocs = progressDocs.filter(p => {
                const lastStudied = p.lastStudied ? new Date(p.lastStudied).getTime() : 0;
                return lastStudied >= start && lastStudied <= end;
            });
        }

        if (progressDocs.length === 0) return result;

        const questionsMap = {};
        const exerciseIds = [...new Set(progressDocs.map(p => p.exerciseId).filter(Boolean))];
        await Promise.all(exerciseIds.map(async (exerciseId) => {
            const response = await grammarQuestionsService.findAll(exerciseId);
            const questions = Array.isArray(response) ? response : (response?.data || []);
            questions.forEach(question => {
                const normalized = { ...question, id: question.id || question._id };
                questionsMap[normalized.id] = normalized;
            });
        }));

        // Aggregate by targetSkill
        let totalPasses = 0;
        let totalAttempts = 0;

        for (const prog of progressDocs) {
            result.totalQuestions++;
            const passes = prog.passCount || 0;
            const fails = prog.failCount || 0;
            const attempts = passes + fails;
            totalPasses += passes;
            totalAttempts += attempts;

            const question = questionsMap[prog.questionId];
            const skill = question?.targetSkill;

            if (skill && attempts > 0) {
                if (!result.bySkill[skill]) result.bySkill[skill] = { score: 0, total: 0, correct: 0, questions: [] };
                result.bySkill[skill].total += attempts;
                result.bySkill[skill].correct += passes;
                result.bySkill[skill].questions.push({
                    purpose: question?.purpose || '',
                    accuracy: Math.round((passes / attempts) * 100)
                });
            }

            // Track weak points
            if (attempts > 0 && fails > passes) {
                result.weakPoints.push({
                    purpose: question?.purpose || `Question ${prog.id}`,
                    targetSkill: skill || 'grammar',
                    errorCategory: question?.errorCategory || null,
                    accuracy: Math.round((passes / attempts) * 100)
                });
            }

            // Aggregate by errorCategory
            const errCat = question?.errorCategory;
            if (errCat && attempts > 0) {
                if (!result.errorCategoryStats[errCat]) result.errorCategoryStats[errCat] = { correct: 0, total: 0 };
                result.errorCategoryStats[errCat].correct += passes;
                result.errorCategoryStats[errCat].total += attempts;
            }
        }

        // Calculate per-skill scores
        for (const [skill, data] of Object.entries(result.bySkill)) {
            data.score = data.total > 0 ? Math.round((data.correct / data.total) * 100) : null;
        }

        result.overallAccuracy = totalAttempts > 0 ? Math.round((totalPasses / totalAttempts) * 100) : null;
        result.weakPoints.sort((a, b) => a.accuracy - b.accuracy);
        result.weakPoints = result.weakPoints.slice(0, 5);

    } catch (err) {
        console.error('analyzeGrammar error:', err);
    }

    return result;
}

// ═══════════════════════════════════════════════
// EXAM ANALYSIS
// ═══════════════════════════════════════════════

async function analyzeExams(uid, examAssignmentIds, startDate, endDate) {
    const result = { bySkill: {}, totalExams: 0, averageScore: null, errorCategoryStats: {}, examSummaries: [] };

    try {
        let submissions = [];

        if (examAssignmentIds.length > 0) {
            for (let i = 0; i < examAssignmentIds.length; i += 30) {
                const batch = examAssignmentIds.slice(i, i + 30);
                const response = await examSubmissionsService.findByAssignments(batch);
                const docs = Array.isArray(response) ? response : (response?.data || []);
                docs
                    .filter(sub => sub.studentId === uid && batch.includes(sub.assignmentId))
                    .forEach(sub => submissions.push({ id: sub._id || sub.id, ...sub }));
            }
        } else {
            // Get all submissions for student
            const response = await examSubmissionsService.findByStudent(uid);
            const docs = Array.isArray(response) ? response : (response?.data || []);
            docs.forEach(sub => submissions.push({ id: sub._id || sub.id, ...sub }));
        }

        // Filter by date
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate).getTime() : 0;
            const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
            submissions = submissions.filter(s => {
                const createdAt = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                return createdAt >= start && createdAt <= end;
            });
        }

        // Only consider graded/released submissions
        submissions = submissions.filter(s => s.status === 'graded' || s.status === 'released' || s.resultsReleased);

        if (submissions.length === 0) return result;

        result.totalExams = submissions.length;

        // Collect all examIds to fetch questions with targetSkill
        const examIds = [...new Set(submissions.map(s => s.examId).filter(Boolean))];
        const examQuestionsMap = {}; // questionId -> { targetSkill, purpose }

        for (const examId of examIds) {
            const response = await examQuestionsService.findAll(examId);
            const questions = Array.isArray(response) ? response : (response?.data || []);
            questions.forEach(question => {
                const questionId = question._id || question.id;
                if (questionId) examQuestionsMap[questionId] = question;
            });
        }

        // Aggregate scores by targetSkill
        let totalScore = 0;
        let totalMaxScore = 0;

        for (const sub of submissions) {
            totalScore += sub.totalScore || 0;
            totalMaxScore += sub.maxTotalScore || 0;

            // Process individual question results
            if (sub.results && typeof sub.results === 'object') {
                for (const [questionId, qResult] of Object.entries(sub.results)) {
                    const question = examQuestionsMap[questionId];
                    const skill = question?.targetSkill;
                    if (!skill) continue;

                    const score = qResult.score ?? 0;
                    const maxScore = question?.points || 10;

                    if (!result.bySkill[skill]) result.bySkill[skill] = { score: 0, totalScore: 0, maxScore: 0 };
                    result.bySkill[skill].totalScore += score;
                    result.bySkill[skill].maxScore += maxScore;

                    // Aggregate by errorCategory (from question tag)
                    const errCat = question?.errorCategory;
                    if (errCat) {
                        if (!result.errorCategoryStats[errCat]) result.errorCategoryStats[errCat] = { earned: 0, max: 0 };
                        result.errorCategoryStats[errCat].earned += score;
                        result.errorCategoryStats[errCat].max += maxScore;
                    }

                    // Aggregate by AI-detected errors (more accurate than static tags)
                    if (Array.isArray(qResult.detectedErrors)) {
                        qResult.detectedErrors.forEach(errKey => {
                            if (errKey && errKey !== errCat) { // Avoid double-counting with static tag
                                if (!result.errorCategoryStats[errKey]) result.errorCategoryStats[errKey] = { earned: 0, max: 0 };
                                result.errorCategoryStats[errKey].earned += score;
                                result.errorCategoryStats[errKey].max += maxScore;
                            }
                        });
                    }
                }
            }

            // Collect exam summary (pre-generated by AI after grading)
            if (sub.examSummary) {
                result.examSummaries.push({
                    examId: sub.examId,
                    totalScore: sub.totalScore,
                    maxTotalScore: sub.maxTotalScore,
                    summary: sub.examSummary
                });
            }
        }

        // Calculate per-skill scores (0-100)
        for (const [skill, data] of Object.entries(result.bySkill)) {
            data.score = data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : null;
        }

        result.averageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : null;

    } catch (err) {
        console.error('analyzeExams error:', err);
    }

    return result;
}
