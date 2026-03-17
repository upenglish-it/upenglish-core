/**
 * Migration: Backfill targetSkill using AI classification
 * 
 * Uses AI (chatCompletion) to analyze each question's purpose, type, and content
 * to accurately classify the target skill.
 */

import { db } from '../config/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { chatCompletion } from './aiService';

const VALID_SKILLS = ['listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary'];

/**
 * Use AI to classify a batch of questions
 * Processes up to 20 questions at once to minimize API calls
 */
async function classifyBatchWithAI(questions) {
    const questionsForAI = questions.map((q, i) => ({
        index: i,
        type: q.type || 'unknown',
        purpose: (q.purpose || '').substring(0, 200),
        sampleContent: (q.variations?.[0]?.text || '').substring(0, 150)
    }));

    const systemPrompt = `You are an English language education expert. Your task is to classify exam/practice questions into exactly one target skill category.

The 6 categories are:
- listening: Questions testing listening comprehension (audio-based, dictation, etc.)
- speaking: Questions testing speaking ability (recording, pronunciation, oral tasks)
- reading: Questions testing reading comprehension (passage-based, reading texts)
- writing: Questions testing writing skills (essay, paragraph writing, letter writing)
- grammar: Questions testing grammar knowledge (tenses, structures, word forms, sentence patterns)
- vocabulary: Questions testing vocabulary knowledge (word meanings, synonyms, word usage, collocations)

Rules:
- If a question focuses on grammar rules/structures (tenses, conditionals, passive voice, word forms, etc.), classify as "grammar" even if it involves reading a sentence.
- If a question requires students to write freely (essays, letters, paragraphs), classify as "writing".
- If question type is "audio_recording", classify as "speaking".
- If the purpose mentions listening/audio, classify as "listening".
- Fill-in-the-blank and multiple choice about grammar points → "grammar".
- Fill-in-the-blank and multiple choice about word meanings/usage → "vocabulary".

Return a JSON array with objects: { "index": number, "skill": string }
Only use these exact skill values: listening, speaking, reading, writing, grammar, vocabulary`;

    const userContent = `Classify these questions:\n${JSON.stringify(questionsForAI, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent,
            responseFormat: 'json'
        });

        let parsed;
        if (typeof response === 'string') {
            // Clean JSON from markdown code blocks if present
            const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } else {
            parsed = response;
        }

        // Handle both array and object responses
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.classifications || [parsed]);

        // Map back to questions
        const skillMap = {};
        results.forEach(r => {
            if (r.index !== undefined && VALID_SKILLS.includes(r.skill)) {
                skillMap[r.index] = r.skill;
            }
        });

        return questions.map((q, i) => ({
            ...q,
            assignedSkill: skillMap[i] || fallbackClassify(q),
            aiClassified: !!skillMap[i]
        }));
    } catch (error) {
        console.warn('AI classification failed, using fallback:', error.message);
        return questions.map(q => ({
            ...q,
            assignedSkill: fallbackClassify(q),
            aiClassified: false
        }));
    }
}

/**
 * Simple fallback if AI fails
 */
function fallbackClassify(question) {
    if (question.type === 'audio_recording') return 'speaking';
    if (question.type === 'essay') return 'writing';
    return 'grammar';
}

/**
 * Main migration function
 * @param {boolean} dryRun - if true, only preview without writing
 * @param {boolean} forceOverwrite - if true, re-classify even questions that already have targetSkill
 */
export async function migrateTargetSkills(dryRun = true, forceOverwrite = false) {
    const results = {
        grammarQuestions: { total: 0, missing: 0, updated: 0 },
        examQuestions: { total: 0, missing: 0, updated: 0 },
        details: []
    };

    console.log(`🔍 [Migration] Starting AI-powered targetSkill backfill (dryRun: ${dryRun}, forceOverwrite: ${forceOverwrite})...`);

    // Collect questions that need classification
    const toClassify = [];

    // --- Grammar Questions ---
    const grammarSnap = await getDocs(collection(db, 'grammar_questions'));
    results.grammarQuestions.total = grammarSnap.size;

    grammarSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.targetSkill || forceOverwrite) {
            results.grammarQuestions.missing++;
            toClassify.push({
                collection: 'grammar_questions',
                id: docSnap.id,
                type: data.type,
                purpose: data.purpose || '',
                variations: data.variations || []
            });
        }
    });

    // --- Exam Questions ---
    const examSnap = await getDocs(collection(db, 'exam_questions'));
    results.examQuestions.total = examSnap.size;

    examSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.targetSkill || forceOverwrite) {
            results.examQuestions.missing++;
            toClassify.push({
                collection: 'exam_questions',
                id: docSnap.id,
                type: data.type,
                purpose: data.purpose || '',
                variations: data.variations || []
            });
        }
    });

    if (toClassify.length === 0) {
        console.log('✅ All questions already have targetSkill. Nothing to do.');
        return results;
    }

    console.log(`📋 Found ${toClassify.length} questions to classify. Processing in batches of 20...`);

    // Process in batches of 20
    const BATCH_SIZE = 20;
    const classified = [];

    for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
        const batch = toClassify.slice(i, i + BATCH_SIZE);
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toClassify.length / BATCH_SIZE)}...`);
        
        const batchResults = await classifyBatchWithAI(batch);
        classified.push(...batchResults);

        // Small delay between API calls
        if (i + BATCH_SIZE < toClassify.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Build results details
    classified.forEach(q => {
        results.details.push({
            collection: q.collection,
            id: q.id,
            purpose: (q.purpose || '').substring(0, 60),
            type: q.type,
            assignedSkill: q.assignedSkill,
            aiClassified: q.aiClassified
        });

        if (q.collection === 'grammar_questions') {
            results.grammarQuestions.updated++;
        } else {
            results.examQuestions.updated++;
        }
    });

    // Write to Firestore if not dry run
    if (!dryRun && classified.length > 0) {
        // Firestore batch limit is 500
        for (let i = 0; i < classified.length; i += 450) {
            const batchSlice = classified.slice(i, i + 450);
            const batch = writeBatch(db);
            batchSlice.forEach(q => {
                batch.update(doc(db, q.collection, q.id), { targetSkill: q.assignedSkill });
            });
            await batch.commit();
            console.log(`  ✅ Committed batch ${Math.floor(i / 450) + 1}`);
        }
    }

    // Print summary
    console.log('\n📊 Migration Results:');
    console.log(`  Grammar: ${results.grammarQuestions.missing}/${results.grammarQuestions.total} → ${results.grammarQuestions.updated} ${dryRun ? 'sẽ cập nhật' : 'đã cập nhật'}`);
    console.log(`  Exams:   ${results.examQuestions.missing}/${results.examQuestions.total} → ${results.examQuestions.updated} ${dryRun ? 'sẽ cập nhật' : 'đã cập nhật'}`);

    if (dryRun) {
        console.log('\n⚠️  DRY RUN. Bấm "Áp dụng" để ghi vào Firestore.');
    }

    console.table(results.details.map(d => ({
        collection: d.collection,
        id: d.id.substring(0, 10),
        purpose: d.purpose,
        type: d.type,
        skill: d.assignedSkill,
        ai: d.aiClassified ? '✅' : '⚠️'
    })));

    return results;
}
