import { db, storage } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, Timestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { recalcExamQuestionCache, getExam, getExamQuestions, saveExam, saveExamQuestion } from './examService';
import { recalcGrammarQuestionCache, getGrammarExercise, getGrammarQuestions, saveGrammarExercise, saveGrammarQuestion } from './grammarService';

// ==========================================
// HELPER: Copy a Firebase Storage file to a new path
// ==========================================

async function copyStorageFile(url, targetFolder) {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('firebasestorage.googleapis.com')) return url;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        let ext = 'webp';
        const contentType = blob.type || '';
        if (contentType.includes('mp3') || contentType.includes('mpeg')) ext = 'mp3';
        else if (contentType.includes('wav')) ext = 'wav';
        else if (contentType.includes('webm')) ext = 'webm';
        else if (contentType.includes('mp4') || contentType.includes('m4a')) ext = 'm4a';
        else if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';

        const newPath = `${targetFolder}/${timestamp}_${rand}.${ext}`;
        const storageRef = ref(storage, newPath);
        await uploadBytes(storageRef, blob, { contentType: blob.type || 'application/octet-stream' });
        return getDownloadURL(storageRef);
    } catch (e) {
        console.error('[conversionService] Error copying storage file:', url, e);
        return url;
    }
}

async function copyContextImagesInHtml(html) {
    if (!html || typeof html !== 'string') return html;
    const regex = /https:\/\/firebasestorage\.googleapis\.com[^"'\s)]*context_images[^"'\s)]*/g;
    const urls = [...new Set(html.match(regex) || [])];
    if (urls.length === 0) return html;

    let newHtml = html;
    for (const oldUrl of urls) {
        const newUrl = await copyStorageFile(oldUrl, 'context_images');
        if (newUrl && newUrl !== oldUrl) {
            newHtml = newHtml.split(oldUrl).join(newUrl);
        }
    }
    return newHtml;
}

async function copyQuestionOptionImages(variations) {
    if (!variations || !Array.isArray(variations)) return variations;
    const newVariations = [];
    for (const v of variations) {
        if (!v || !v.options) {
            newVariations.push(v);
            continue;
        }
        const newOptions = [];
        for (const opt of v.options) {
            if (opt && typeof opt === 'string' && opt.includes('option_images')) {
                const newUrl = await copyStorageFile(opt, 'option_images');
                newOptions.push(newUrl || opt);
            } else {
                newOptions.push(opt);
            }
        }
        newVariations.push({ ...v, options: newOptions });
    }
    return newVariations;
}

/**
 * Convert HTML (from Quill rich text editor) to plain text with format markers.
 * Grammar uses ReactQuill (HTML), Exam uses textarea with **bold** *italic* __underline__ markers.
 * Preserves {{word}} markers for fill-in-blank.
 */
function stripHtmlToPlainText(html) {
    if (!html || typeof html !== 'string') return html || '';
    // If there are no HTML tags, return as-is (already plain text)
    if (!/<[a-zA-Z][^>]*>/.test(html)) {
        return html.replace(/&nbsp;/g, ' ').trim();
    }
    let text = html;
    // Convert formatting tags to marker equivalents BEFORE stripping
    text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    text = text.replace(/<u>(.*?)<\/u>/gi, '__$1__');
    // Convert block-level end tags to newlines
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // Strip all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Convert HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&#x27;/g, "'");
    // Clean up excessive whitespace but preserve newlines
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n /g, '\n');
    text = text.replace(/ \n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

function cleanVariationTexts(variations, questionType) {
    if (!variations || !Array.isArray(variations)) return variations;
    // Only strip HTML for fill_in_blank types (uses plain textarea in exam editor)
    // Other types (essay, multiple_choice, etc.) use ReactQuill on both sides → keep HTML
    const needsStripping = ['fill_in_blank', 'fill_in_blanks', 'fill_in_blank_typing'].includes(questionType);
    if (!needsStripping) return variations;
    return variations.map(v => {
        if (!v) return v;
        const cleaned = { ...v };
        if (typeof cleaned.text === 'string') {
            cleaned.text = stripHtmlToPlainText(cleaned.text);
        }
        return cleaned;
    });
}

// ==========================================
// CONVERT: Grammar Exercise → Exam
// ==========================================

/**
 * Convert a grammar exercise into an exam (Bài tập or Kiểm tra).
 * Creates a NEW exam with all questions copied from the grammar exercise.
 * The original grammar exercise is NOT modified or deleted.
 *
 * @param {string} exerciseId - The source grammar exercise ID
 * @param {string} teacherId - The current user's UID (new owner)
 * @param {Object} options - Configuration options
 * @param {string} options.examType - 'test' or 'homework'
 * @param {string} options.timingMode - 'exam', 'section', or 'question'
 * @returns {Promise<string>} The new exam ID
 */
export async function convertGrammarToExam(exerciseId, teacherId, options = {}) {
    if (!exerciseId || !teacherId) throw new Error('Missing exerciseId or teacherId');

    const { examType = 'homework', timingMode = 'exam', createdByRole = 'teacher' } = options;

    // 1. Read source grammar exercise via API
    const exData = await getGrammarExercise(exerciseId);
    if (!exData) throw new Error('Bài kỹ năng không tồn tại.');

    // 2. Create a default section
    const defaultSectionId = crypto.randomUUID();
    const sections = [{ id: defaultSectionId, title: 'Phần 1' }];

    // 3. Prepare new exam data
    const newExamId = `e-${teacherId.substring(0, 5)}-${Date.now()}`;
    const newExamData = {
        name: exData.name || exData.title || 'Bài chuyển đổi',
        description: exData.description || '',
        icon: exData.icon || '📝',
        color: exData.color || '#6366f1',
        cefrLevel: exData.targetLevel || '',
        targetAge: exData.targetAge || '',
        examType,
        timingMode,
        sections,
        createdBy: teacherId,
        createdByRole,
        convertedFrom: { type: 'grammar', id: exerciseId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await saveExam({ _id: newExamId, ...newExamData });

    // 4. Read and copy all grammar questions → exam questions via API
    const questions = await getGrammarQuestions(exerciseId);

    // Sort by order to preserve sequence
    const sortedDocs = questions.sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < sortedDocs.length; i++) {
        const qData = { ...sortedDocs[i] };

        delete qData.id;
        delete qData._id;
        delete qData.exerciseId;

        // Set exam-specific fields
        qData.examId = newExamId;
        qData.sectionId = defaultSectionId;
        qData.order = i;

        // Copy option images (multiple_choice)
        if (qData.type === 'multiple_choice' && qData.variations) {
            qData.variations = await copyQuestionOptionImages(qData.variations);
        }

        // Clean HTML from fill_in_blank variation texts (grammar uses rich text, exam uses plain textarea)
        if (qData.variations) {
            qData.variations = cleanVariationTexts(qData.variations, qData.type);
        }

        // Copy context audio
        if (qData.contextAudioUrl) {
            qData.contextAudioUrl = await copyStorageFile(
                qData.contextAudioUrl,
                `context_audio/exam/${newExamId}`
            );
        }

        // Copy context images in HTML
        if (qData.context) {
            qData.context = await copyContextImagesInHtml(qData.context);
        }

        // Save new question via API
        await saveExamQuestion({
            ...qData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // 5. Recalc cache
    await recalcExamQuestionCache(newExamId);

    return newExamId;
}

// ==========================================
// CONVERT: Exam → Grammar Exercise
// ==========================================

/**
 * Convert an exam into a grammar exercise (Bài kỹ năng).
 * Creates a NEW grammar exercise with all questions merged from all sections.
 * Time limits are removed. The original exam is NOT modified or deleted.
 *
 * @param {string} examId - The source exam ID
 * @param {string} teacherId - The current user's UID (new owner)
 * @returns {Promise<string>} The new grammar exercise ID
 */
export async function convertExamToGrammar(examId, teacherId, options = {}) {
    if (!examId || !teacherId) throw new Error('Missing examId or teacherId');

    const { createdByRole = 'teacher' } = options;

    // 1. Read source exam via API
    const examData = await getExam(examId);
    if (!examData) throw new Error('Bài tập/Kiểm tra không tồn tại.');

    // 2. Create new grammar exercise
    const newExId = `g-${teacherId.substring(0, 5)}-${Date.now()}`;
    const newExData = {
        name: examData.name || 'Bài chuyển đổi',
        title: examData.name || 'Bài chuyển đổi',
        description: examData.description || '',
        icon: examData.icon || '✍️',
        color: examData.color || '#d97706',
        targetLevel: examData.cefrLevel || examData.targetLevel || '',
        targetAge: examData.targetAge || '',
        teacherId,
        createdByRole,
        convertedFrom: { type: 'exam', id: examId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await saveGrammarExercise({ _id: newExId, ...newExData });

    // 3. Read ALL exam questions from ALL sections via API
    const questions = await getExamQuestions(examId);

    // Build section order map
    const sectionOrder = {};
    (examData.sections || []).forEach((s, idx) => { sectionOrder[s.id || s._id] = idx; });

    // Sort: section order first, then question order within section
    const sortedDocs = questions.sort((a, b) => {
        const sA = sectionOrder[a.sectionId] ?? 999;
        const sB = sectionOrder[b.sectionId] ?? 999;
        if (sA !== sB) return sA - sB;
        return (a.order || 0) - (b.order || 0);
    });

    for (let i = 0; i < sortedDocs.length; i++) {
        const qData = { ...sortedDocs[i] };

        delete qData.id;
        delete qData._id;
        delete qData.examId;
        delete qData.sectionId;
        delete qData.timeLimitSeconds; // Remove time limit

        // Set grammar-specific fields
        qData.exerciseId = newExId;
        qData.order = i;

        // Copy option images (multiple_choice)
        if (qData.type === 'multiple_choice' && qData.variations) {
            qData.variations = await copyQuestionOptionImages(qData.variations);
        }

        // Clean HTML from fill_in_blank variation texts
        if (qData.variations) {
            qData.variations = cleanVariationTexts(qData.variations, qData.type);
        }

        // Copy context audio
        if (qData.contextAudioUrl) {
            qData.contextAudioUrl = await copyStorageFile(
                qData.contextAudioUrl,
                `context_audio/grammar/${newExId}`
            );
        }

        // Copy context images in HTML
        if (qData.context) {
            qData.context = await copyContextImagesInHtml(qData.context);
        }

        // Save new question
        await saveGrammarQuestion({
            ...qData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // 4. Recalc cache
    await recalcGrammarQuestionCache(newExId);

    return newExId;
}
