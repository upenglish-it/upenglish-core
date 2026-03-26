import { db, storage } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, Timestamp, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { recalcExamQuestionCache, getExam, getExamQuestions, saveExam, saveExamQuestion } from './examService';
import { recalcGrammarQuestionCache, getGrammarExercise, getGrammarQuestions, saveGrammarExercise, saveGrammarQuestion } from './grammarService';
import { teacherTopicsService } from '../models';

// ==========================================
// HELPER: Copy a Firebase Storage file to a new path
// ==========================================

/**
 * Download a file from a Firebase Storage URL and re-upload with a new name.
 * Returns the new download URL, or null if the URL is invalid.
 */
async function copyStorageFile(url, targetFolder) {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('firebasestorage.googleapis.com')) return url; // external URL, keep as-is

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        // Detect extension from content type or URL
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
        console.error('[duplicateService] Error copying storage file:', url, e);
        return url; // fallback: keep original URL (shared reference) rather than failing
    }
}

/**
 * Copy ALL Firebase Storage URLs found inside an HTML string.
 * Downloads each file and re-uploads to a new path for full data independence.
 * Returns the HTML with old URLs replaced by new ones.
 */
async function copyAllStorageUrlsInHtml(html) {
    if (!html || typeof html !== 'string') return html;
    const regex = /https:\/\/firebasestorage\.googleapis\.com\/[^"'\s)<>]+/g;
    const urls = [...new Set(html.match(regex) || [])];
    if (urls.length === 0) return html;

    let newHtml = html;
    for (const oldUrl of urls) {
        // Detect target folder from the URL path
        let folder = 'duplicated_assets';
        if (oldUrl.includes('context_images')) folder = 'context_images';
        else if (oldUrl.includes('option_images')) folder = 'option_images';
        else if (oldUrl.includes('context_audio')) folder = 'context_audio/duplicated';
        else if (oldUrl.includes('vocab_images')) folder = 'vocab_images';

        const newUrl = await copyStorageFile(oldUrl, folder);
        if (newUrl && newUrl !== oldUrl) {
            newHtml = newHtml.split(oldUrl).join(newUrl);
        }
    }
    return newHtml;
}

/**
 * Copy option images/URLs in a multiple_choice question's variations.
 * Copies ANY Firebase Storage URL found in options (not just option_images paths).
 * Returns the updated variations array.
 */
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
            if (opt && typeof opt === 'string' && opt.includes('firebasestorage.googleapis.com')) {
                const folder = opt.includes('option_images') ? 'option_images' : 'duplicated_assets';
                const newUrl = await copyStorageFile(opt, folder);
                newOptions.push(newUrl || opt);
            } else {
                newOptions.push(opt);
            }
        }
        newVariations.push({ ...v, options: newOptions });
    }
    return newVariations;
}

// ==========================================
// DUPLICATE: Teacher Topic (Vocab)
// ==========================================

/**
 * Deep-clone a teacher topic (vocab) with all words and images.
 * @param {string} topicId - The source topic ID
 * @param {string} teacherId - The current user's UID (new owner)
 * @returns {Promise<string>} The new topic ID
 */
export async function duplicateTeacherTopic(topicId, teacherId) {
    if (!topicId || !teacherId) throw new Error('Missing topicId or teacherId');

    // 1. Read source topic from API
    const topicData = await teacherTopicsService.findOne(topicId);
    if (!topicData) throw new Error('Bài học không tồn tại.');

    // 2. Generate new ID
    const newTopicId = `t-${teacherId.substring(0, 5)}-${Date.now()}`;

    // 3. Prepare new topic data
    const newTopicData = {
        ...topicData,
        teacherId,
        id: newTopicId,
        name: `${topicData.name || 'Bài học'} (Bản sao)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    // Reset ownership/sharing fields
    delete newTopicData._id;
    delete newTopicData.collaboratorIds;
    delete newTopicData.collaboratorNames;
    delete newTopicData.isPublic;
    delete newTopicData.duplicatedFrom;
    
    newTopicData.duplicatedFrom = topicId;
    newTopicData.collaborators = [];

    // 4. Read and copy all words (already inside topicData.words for the API version)
    let words = newTopicData.words || [];
    let wordCount = 0;
    
    // Create new words array with copied assets
    const newWords = [];
    for (const w of words) {
        const wordData = { ...w };

        // Copy vocab image if present
        if (wordData.imageUrl && wordData.imageUrl.includes('firebasestorage.googleapis.com')) {
            wordData.imageUrl = await copyStorageFile(wordData.imageUrl, 'vocab_images');
        }

        newWords.push({
            ...wordData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        wordCount++;
    }
    
    newTopicData.words = newWords;
    newTopicData.cachedWordCount = wordCount;

    // 5. Save new topic via API
    await teacherTopicsService.create(newTopicData);

    return newTopicId;
}

// ==========================================
// DUPLICATE: Exam (Bài tập / Kiểm tra)
// ==========================================

/**
 * Deep-clone an exam with all sections, questions, and media.
 * @param {string} examId - The source exam ID
 * @param {string} teacherId - The current user's UID (new owner)
 * @returns {Promise<string>} The new exam ID
 */
export async function duplicateExam(examId, teacherId) {
    if (!examId || !teacherId) throw new Error('Missing examId or teacherId');

    // 1. Read source exam via API
    const examData = await getExam(examId);
    if (!examData) throw new Error('Đề thi không tồn tại.');

    // 2. Create section ID mapping (old → new)
    const sectionIdMap = {};
    const newSections = (examData.sections || []).map(section => {
        const newSectionId = crypto.randomUUID();
        sectionIdMap[section.id || section._id] = newSectionId;
        return { ...section, id: newSectionId };
    });

    // 3. Copy section-level context audio & context images
    for (let i = 0; i < newSections.length; i++) {
        if (newSections[i].contextAudioUrl) {
            newSections[i].contextAudioUrl = await copyStorageFile(
                newSections[i].contextAudioUrl,
                `context_audio/exam/${crypto.randomUUID()}`
            );
        }
        // Copy all Firebase Storage URLs in section HTML (images etc.)
        if (newSections[i].context) {
            newSections[i].context = await copyAllStorageUrlsInHtml(newSections[i].context);
        }
    }

    // 4. Prepare new exam data
    const newExamId = `e-${teacherId.substring(0, 5)}-${Date.now()}`;
    const newExamData = {
        ...examData,
        sections: newSections,
        createdBy: teacherId,
        createdByRole: 'teacher',
        name: `${examData.name || 'Đề thi'} (Bản sao)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    // Reset ownership/sharing
    delete newExamData.collaboratorIds;
    delete newExamData.collaboratorNames;
    delete newExamData.isPublic;
    delete newExamData.id;
    delete newExamData._id;
    newExamData.duplicatedFrom = examId;
    newExamData.collaborators = [];

    // Save new exam via API
    await saveExam({ _id: newExamId, ...newExamData });

    // 5. Read and copy all questions via API
    const questions = await getExamQuestions(examId);

    for (const qBase of questions) {
        try {
            const qData = { ...qBase };

            // Map IDs
            qData.examId = newExamId;
            if (qData.sectionId && sectionIdMap[qData.sectionId]) {
                qData.sectionId = sectionIdMap[qData.sectionId];
            }

            // Copy option images (multiple_choice)
            if (qData.type === 'multiple_choice' && qData.variations) {
                qData.variations = await copyQuestionOptionImages(qData.variations);
            }

            // Copy context audio
            if (qData.contextAudioUrl) {
                qData.contextAudioUrl = await copyStorageFile(
                    qData.contextAudioUrl,
                    `context_audio/exam/${newExamId}`
                );
            }

            // Copy all Firebase Storage URLs in question context HTML
            if (qData.context) {
                qData.context = await copyAllStorageUrlsInHtml(qData.context);
            }

            // Deep-copy all Firebase Storage URLs in variation text HTML
            if (qData.variations && Array.isArray(qData.variations)) {
                for (let vi = 0; vi < qData.variations.length; vi++) {
                    const v = qData.variations[vi];
                    if (v && v.text && typeof v.text === 'string' && v.text.includes('firebasestorage.googleapis.com')) {
                        qData.variations[vi] = { ...v, text: await copyAllStorageUrlsInHtml(v.text) };
                    }
                }
            }

            delete qData.id;
            delete qData._id;

            // Save new question via API
            await saveExamQuestion({
                ...qData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('[duplicateService] Error copying exam question:', qBase.id || qBase._id, e);
        }
    }

    // 6. Recalc cache
    await recalcExamQuestionCache(newExamId);

    return newExamId;
}

// ==========================================
// DUPLICATE: Grammar Exercise (Bài học Kỹ năng)
// ==========================================

/**
 * Deep-clone a grammar exercise with all questions and media.
 * @param {string} exerciseId - The source exercise ID
 * @param {string} teacherId - The current user's UID (new owner)
 * @returns {Promise<string>} The new exercise ID
 */
export async function duplicateGrammarExercise(exerciseId, teacherId) {
    if (!exerciseId || !teacherId) throw new Error('Missing exerciseId or teacherId');

    // 1. Read source exercise via API
    const exData = await getGrammarExercise(exerciseId);
    if (!exData) throw new Error('Bài học không tồn tại.');

    // 2. Create new exercise
    const newExId = `g-${teacherId.substring(0, 5)}-${Date.now()}`;
    const newExData = {
        ...exData,
        teacherId,
        name: `${exData.name || exData.title || 'Bài học'} (Bản sao)`,
        title: `${exData.name || exData.title || 'Bài học'} (Bản sao)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    // Reset ownership/sharing
    delete newExData.collaboratorIds;
    delete newExData.collaboratorNames;
    delete newExData.isPublic;
    delete newExData.id;
    delete newExData._id;
    newExData.duplicatedFrom = exerciseId;
    newExData.collaborators = [];

    // Save exercise via API
    await saveGrammarExercise({ _id: newExId, ...newExData });

    // 3. Read and copy all questions via API
    const questions = await getGrammarQuestions(exerciseId);

    for (const qBase of questions) {
        try {
            const qData = { ...qBase };

            // Map exercise ID
            qData.exerciseId = newExId;

            // Copy option images (multiple_choice)
            if (qData.type === 'multiple_choice' && qData.variations) {
                qData.variations = await copyQuestionOptionImages(qData.variations);
            }

            // Copy context audio
            if (qData.contextAudioUrl) {
                qData.contextAudioUrl = await copyStorageFile(
                    qData.contextAudioUrl,
                    `context_audio/grammar/${newExId}`
                );
            }

            // Copy all Firebase Storage URLs in question context HTML
            if (qData.context) {
                qData.context = await copyAllStorageUrlsInHtml(qData.context);
            }

            // Deep-copy all Firebase Storage URLs in variation text HTML
            if (qData.variations && Array.isArray(qData.variations)) {
                for (let vi = 0; vi < qData.variations.length; vi++) {
                    const v = qData.variations[vi];
                    if (v && v.text && typeof v.text === 'string' && v.text.includes('firebasestorage.googleapis.com')) {
                        qData.variations[vi] = { ...v, text: await copyAllStorageUrlsInHtml(v.text) };
                    }
                }
            }

            delete qData.id;
            delete qData._id;

            // Save new question via API
            await saveGrammarQuestion({
                ...qData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('[duplicateService] Error copying grammar question:', qBase.id || qBase._id, e);
        }
    }

    // 4. Recalc cache
    await recalcGrammarQuestionCache(newExId);

    return newExId;
}
