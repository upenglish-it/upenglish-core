import { db, storage } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, Timestamp, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { recalcExamQuestionCache } from './examService';
import { recalcGrammarQuestionCache } from './grammarService';

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
 * Copy all context_images URLs found inside an HTML string.
 * Returns the HTML with old URLs replaced by new ones.
 */
async function copyContextImagesInHtml(html) {
    if (!html || typeof html !== 'string') return html;
    const regex = /https:\/\/firebasestorage\.googleapis\.com[^"'\s)]*context_images[^"'\s)]*/g;
    const urls = [...new Set(html.match(regex) || [])];
    if (urls.length === 0) return html;

    let newHtml = html;
    for (const oldUrl of urls) {
        const newUrl = await copyStorageFile(oldUrl, 'context_images');
        if (newUrl && newUrl !== oldUrl) {
            // Replace all occurrences of the old URL
            newHtml = newHtml.split(oldUrl).join(newUrl);
        }
    }
    return newHtml;
}

/**
 * Copy option images in a multiple_choice question's variations.
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

    // 1. Read source topic
    const topicSnap = await getDoc(doc(db, 'teacher_topics', topicId));
    if (!topicSnap.exists()) throw new Error('Bài học không tồn tại.');
    const topicData = topicSnap.data();

    // 2. Generate new ID
    const newTopicId = `t-${teacherId.substring(0, 5)}-${Date.now()}`;

    // 3. Prepare new topic data
    const newTopicData = {
        ...topicData,
        teacherId,
        name: `${topicData.name || 'Bài học'} (Bản sao)`,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    // Reset ownership/sharing fields
    delete newTopicData.collaboratorIds;
    delete newTopicData.collaboratorNames;
    delete newTopicData.isPublic;
    delete newTopicData.id; // CRITICAL: remove old id so it doesn't override docSnap.id on read
    delete newTopicData.duplicatedFrom;
    newTopicData.duplicatedFrom = topicId;
    newTopicData.collaborators = [];

    // 4. Save new topic
    await setDoc(doc(db, 'teacher_topics', newTopicId), newTopicData);

    // 5. Read and copy all words
    const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
    const wordsSnap = await getDocs(query(wordsRef, orderBy('createdAt', 'asc')));
    let wordCount = 0;

    for (const wordDoc of wordsSnap.docs) {
        const wordData = { ...wordDoc.data() };

        // Copy vocab image if present
        if (wordData.imageUrl && wordData.imageUrl.includes('firebasestorage.googleapis.com')) {
            wordData.imageUrl = await copyStorageFile(wordData.imageUrl, 'vocab_images');
        }

        // Save to new topic's words subcollection (auto-ID)
        const newWordRef = doc(collection(db, `teacher_topics/${newTopicId}/words`));
        await setDoc(newWordRef, {
            ...wordData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        wordCount++;
    }

    // 6. Update cached word count
    await setDoc(doc(db, 'teacher_topics', newTopicId), { cachedWordCount: wordCount }, { merge: true });

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

    // 1. Read source exam
    const examSnap = await getDoc(doc(db, 'exams', examId));
    if (!examSnap.exists()) throw new Error('Đề thi không tồn tại.');
    const examData = examSnap.data();

    // 2. Create section ID mapping (old → new)
    const sectionIdMap = {};
    const newSections = (examData.sections || []).map(section => {
        const newSectionId = crypto.randomUUID();
        sectionIdMap[section.id] = newSectionId;
        return { ...section, id: newSectionId };
    });

    // 3. Copy section-level context audio
    for (let i = 0; i < newSections.length; i++) {
        if (newSections[i].contextAudioUrl) {
            newSections[i].contextAudioUrl = await copyStorageFile(
                newSections[i].contextAudioUrl,
                `context_audio/exam/${crypto.randomUUID()}`
            );
        }
    }

    // 4. Prepare new exam data
    const newExamRef = doc(collection(db, 'exams'));
    const newExamId = newExamRef.id;
    const newExamData = {
        ...examData,
        sections: newSections,
        createdBy: teacherId,
        createdByRole: 'teacher',
        name: `${examData.name || 'Đề thi'} (Bản sao)`,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    // Reset ownership/sharing
    delete newExamData.collaboratorIds;
    delete newExamData.collaboratorNames;
    delete newExamData.isPublic;
    delete newExamData.id; // CRITICAL: remove old id
    newExamData.duplicatedFrom = examId;
    newExamData.collaborators = [];

    await setDoc(newExamRef, newExamData);

    // 5. Read and copy all questions
    const questionsSnap = await getDocs(
        query(collection(db, 'exam_questions'), where('examId', '==', examId))
    );

    for (const qDoc of questionsSnap.docs) {
        const qData = { ...qDoc.data() };

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

        // Copy context images in HTML
        if (qData.context) {
            qData.context = await copyContextImagesInHtml(qData.context);
        }

        // Save new question (auto-ID)
        const newQRef = doc(collection(db, 'exam_questions'));
        await setDoc(newQRef, {
            ...qData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
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

    // 1. Read source exercise
    const exSnap = await getDoc(doc(db, 'grammar_exercises', exerciseId));
    if (!exSnap.exists()) throw new Error('Bài học không tồn tại.');
    const exData = exSnap.data();

    // 2. Create new exercise
    const newExRef = doc(collection(db, 'grammar_exercises'));
    const newExId = newExRef.id;
    const newExData = {
        ...exData,
        teacherId,
        name: `${exData.name || 'Bài học'} (Bản sao)`,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    // Reset ownership/sharing
    delete newExData.collaboratorIds;
    delete newExData.collaboratorNames;
    delete newExData.isPublic;
    delete newExData.id; // CRITICAL: remove old id
    newExData.duplicatedFrom = exerciseId;
    newExData.collaborators = [];

    await setDoc(newExRef, newExData);

    // 3. Read and copy all questions
    const questionsSnap = await getDocs(
        query(collection(db, 'grammar_questions'), where('exerciseId', '==', exerciseId))
    );

    for (const qDoc of questionsSnap.docs) {
        const qData = { ...qDoc.data() };

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

        // Copy context images in HTML
        if (qData.context) {
            qData.context = await copyContextImagesInHtml(qData.context);
        }

        // Save new question (auto-ID)
        const newQRef = doc(collection(db, 'grammar_questions'));
        await setDoc(newQRef, {
            ...qData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    }

    // 4. Recalc cache
    await recalcGrammarQuestionCache(newExId);

    return newExId;
}
