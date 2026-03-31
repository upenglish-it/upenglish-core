/**
 * Migration: Backfill errorCategory using AI classification
 * 
 * Uses AI to analyze each question's purpose, type, and content
 * to classify the error category from the new 38-key system.
 */

import { db } from '../config/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { chatCompletion } from './aiService';

const VALID_ERROR_CATEGORIES = [
    'verb_tense', 'article', 'preposition', 'word_form', 'subject_verb_agreement',
    'pronoun', 'conjunction', 'comparison', 'passive_voice', 'conditional',
    'modal_verb', 'relative_clause', 'reported_speech', 'gerund_infinitive', 'quantifier',
    'grammar_sentence_structure',
    'vocabulary_meaning', 'vocabulary_usage', 'vocabulary_collocation', 'vocabulary_spelling', 'vocabulary_idiom_phrasal',
    'writing_structure', 'writing_coherence', 'writing_task_response', 'writing_punctuation',
    'pronunciation_sounds', 'pronunciation_stress_intonation', 'fluency', 'speaking_interaction',
    'listening_detail', 'listening_main_idea', 'listening_inference', 'listening_purpose_attitude',
    'reading_detail', 'reading_main_idea', 'reading_inference', 'reading_context_vocab',
];

/**
 * Use AI to classify a batch of questions into error categories
 */
async function classifyBatchWithAI(questions) {
    const questionsForAI = questions.map((q, i) => ({
        index: i,
        type: q.type || 'unknown',
        purpose: (q.purpose || '').substring(0, 200),
        currentErrorCategory: q.errorCategory || '',
        sampleContent: (q.variations?.[0]?.text || q.questionText || '').substring(0, 150)
    }));

    const systemPrompt = `You are an English language education expert. Classify each question into EXACTLY ONE error category.

VALID CATEGORIES (use ONLY these exact keys):
Grammar - Verbs: verb_tense, subject_verb_agreement, modal_verb, gerund_infinitive, passive_voice
Grammar - Parts of Speech: word_form, article, pronoun, quantifier, preposition
Grammar - Structures: conjunction, relative_clause, conditional, reported_speech, comparison, grammar_sentence_structure
Vocabulary: vocabulary_meaning, vocabulary_usage, vocabulary_collocation, vocabulary_spelling, vocabulary_idiom_phrasal
Writing: writing_structure, writing_coherence, writing_task_response, writing_punctuation
Speaking: pronunciation_sounds, pronunciation_stress_intonation, fluency, speaking_interaction
Listening: listening_detail, listening_main_idea, listening_inference, listening_purpose_attitude
Reading: reading_detail, reading_main_idea, reading_inference, reading_context_vocab

RULES:
- If currentErrorCategory is "other" or empty, classify based on purpose and content
- If currentErrorCategory is already a valid specific key (not "other"), keep it unless clearly wrong
- Choose the MOST SPECIFIC matching category
- NEVER use "other"
- For audio_recording type → speaking category
- For essay type → usually writing category unless purpose indicates grammar/vocabulary

Return JSON array: [{ "index": number, "category": "key" }]`;

    const userContent = `Classify:\n${JSON.stringify(questionsForAI, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent,
            responseFormat: 'json'
        });

        const text = typeof response === 'string' ? response : response.text || JSON.stringify(response);
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        let parsed = JSON.parse(cleaned);
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.classifications || [parsed]);

        const catMap = {};
        results.forEach(r => {
            if (r.index !== undefined && VALID_ERROR_CATEGORIES.includes(r.category)) {
                catMap[r.index] = r.category;
            }
        });

        return questions.map((q, i) => ({
            ...q,
            assignedCategory: catMap[i] || fallbackClassify(q),
            aiClassified: !!catMap[i]
        }));
    } catch (error) {
        console.warn('AI classification failed, using fallback:', error.message);
        return questions.map(q => ({
            ...q,
            assignedCategory: fallbackClassify(q),
            aiClassified: false
        }));
    }
}

function fallbackClassify(question) {
    if (question.type === 'audio_recording') return 'pronunciation_sounds';
    if (question.type === 'essay') return 'writing_structure';
    // Keep existing if valid
    if (question.errorCategory && VALID_ERROR_CATEGORIES.includes(question.errorCategory)) return question.errorCategory;
    return 'grammar_sentence_structure';
}

/**
 * Main migration function
 * @param {Function} onProgress - callback(msg) for progress updates
 * @param {boolean} dryRun - if true, only preview
 * @param {boolean} forceOverwrite - if true, re-classify all (not just "other"/empty)
 */
export async function migrateErrorCategories(onProgress = () => {}, dryRun = true, forceOverwrite = false) {
    const results = {
        grammarQuestions: { total: 0, needsUpdate: 0, updated: 0 },
        examQuestions: { total: 0, needsUpdate: 0, updated: 0 },
        details: []
    };

    onProgress('🔍 Đang quét câu hỏi...');

    const toClassify = [];

    // --- Grammar Questions ---
    const grammarSnap = await getDocs(collection(db, 'grammar_questions'));
    results.grammarQuestions.total = grammarSnap.size;

    grammarSnap.forEach(docSnap => {
        const data = docSnap.data();
        const needsUpdate = forceOverwrite || !data.errorCategory || data.errorCategory === 'other' || !VALID_ERROR_CATEGORIES.includes(data.errorCategory);
        if (needsUpdate) {
            results.grammarQuestions.needsUpdate++;
            toClassify.push({
                coll: 'grammar_questions', id: docSnap.id,
                type: data.type, purpose: data.purpose || '',
                errorCategory: data.errorCategory || '',
                variations: data.variations || [], questionText: data.questionText || ''
            });
        }
    });

    // --- Exam Questions ---
    const examSnap = await getDocs(collection(db, 'exam_questions'));
    results.examQuestions.total = examSnap.size;

    examSnap.forEach(docSnap => {
        const data = docSnap.data();
        const needsUpdate = forceOverwrite || !data.errorCategory || data.errorCategory === 'other' || !VALID_ERROR_CATEGORIES.includes(data.errorCategory);
        if (needsUpdate) {
            results.examQuestions.needsUpdate++;
            toClassify.push({
                coll: 'exam_questions', id: docSnap.id,
                type: data.type, purpose: data.purpose || '',
                errorCategory: data.errorCategory || '',
                variations: data.variations || [], questionText: data.questionText || ''
            });
        }
    });

    if (toClassify.length === 0) {
        onProgress('✅ Tất cả câu hỏi đã có errorCategory hợp lệ!');
        return results;
    }

    onProgress(`📋 Tìm thấy ${toClassify.length} câu cần phân loại. Đang xử lý...`);

    // Process in batches of 20
    const BATCH_SIZE = 20;
    const classified = [];

    for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
        const batch = toClassify.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(toClassify.length / BATCH_SIZE);
        onProgress(`🤖 AI đang phân loại batch ${batchNum}/${totalBatches}...`);

        const batchResults = await classifyBatchWithAI(batch);
        classified.push(...batchResults);

        if (i + BATCH_SIZE < toClassify.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Build details
    classified.forEach(q => {
        results.details.push({
            coll: q.coll, id: q.id,
            purpose: (q.purpose || '').substring(0, 60),
            oldCategory: q.errorCategory || '(trống)',
            newCategory: q.assignedCategory,
            aiClassified: q.aiClassified
        });
        if (q.coll === 'grammar_questions') results.grammarQuestions.updated++;
        else results.examQuestions.updated++;
    });

    // Write if not dry run
    if (!dryRun && classified.length > 0) {
        onProgress('💾 Đang ghi vào database...');
        for (let i = 0; i < classified.length; i += 450) {
            const batchSlice = classified.slice(i, i + 450);
            const batch = writeBatch(db);
            batchSlice.forEach(q => {
                batch.update(doc(db, q.coll, q.id), { errorCategory: q.assignedCategory });
            });
            await batch.commit();
        }
        onProgress(`✅ Đã cập nhật ${classified.length} câu hỏi!`);
    } else {
        onProgress(`📊 Xem trước: ${classified.length} câu sẽ được cập nhật. Bấm "Áp dụng" để ghi.`);
    }

    return results;
}

/**
 * Apply cached migration results directly to Firestore (no AI re-classification)
 * @param {Array} details - the details array from a previous dry run
 * @param {Function} onProgress - callback(msg) for progress updates
 */
export async function applyMigrationResults(details, onProgress = () => {}) {
    if (!details || details.length === 0) {
        onProgress('⚠️ Không có dữ liệu để ghi.');
        return;
    }

    onProgress(`💾 Đang ghi ${details.length} câu vào database...`);

    for (let i = 0; i < details.length; i += 450) {
        const batchSlice = details.slice(i, i + 450);
        const batch = writeBatch(db);
        batchSlice.forEach(d => {
            batch.update(doc(db, d.coll, d.id), { errorCategory: d.newCategory });
        });
        await batch.commit();
        onProgress(`💾 Đã ghi batch ${Math.floor(i / 450) + 1}/${Math.ceil(details.length / 450)}...`);
    }

    onProgress(`✅ Đã cập nhật ${details.length} câu hỏi thành công!`);
}
