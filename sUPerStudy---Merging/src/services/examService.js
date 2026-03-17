import { db, storage } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, query, where, orderBy, documentId, getCountFromServer, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { gradeGrammarSubmissionWithAI } from './aiGrammarService';
import { evaluateAudioAnswer } from './aiService';
import { deleteContextAudio } from './contextAudioService';

/**
 * Upload an audio answer blob to Firebase Storage.
 * @param {Blob} audioBlob The audio blob
 * @param {string} submissionId The exam submission ID
 * @param {string} questionId The question ID
 * @returns {Promise<string>} The download URL
 */
export async function uploadAudioAnswer(audioBlob, submissionId, questionId) {
    const ext = audioBlob.type?.includes('mp4') ? 'mp4' : audioBlob.type?.includes('aac') ? 'aac' : 'webm';
    const storageRef = ref(storage, `audio_answers/${submissionId}/${questionId}.${ext}`);
    await uploadBytes(storageRef, audioBlob, { contentType: audioBlob.type || 'audio/webm' });
    return getDownloadURL(storageRef);
}

/**
 * Upload an image file for MCQ option, resizing to 480x480 (center crop).
 * @param {File} file The image file
 * @returns {Promise<string>} The download URL
 */
export async function uploadOptionImage(file) {
    const SIZE = 480;
    const bitmap = await createImageBitmap(file);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Center-crop: take the largest centered square from the source
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const storageRef = ref(storage, `option_images/${timestamp}_${rand}.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    return getDownloadURL(storageRef);
}

/**
 * Delete an option image from Firebase Storage by its download URL.
 * @param {string} url The download URL
 */
export async function deleteOptionImage(url) {
    if (!url || typeof url !== 'string' || !url.includes('option_images')) return;
    try {
        const imageRef = ref(storage, url);
        await deleteObject(imageRef);
    } catch (e) {
        console.error('Error deleting option image from Storage:', e);
    }
}

/**
 * Upload a context image (from Quill editor) to Firebase Storage, converting to WebP and resizing.
 * @param {File} file The image file
 * @param {number} [maxWidth=800] Maximum width to resize to
 * @returns {Promise<string>} The download URL
 */
export async function uploadContextImage(file, maxWidth = 800) {
    const bitmap = await createImageBitmap(file);

    let width = bitmap.width;
    let height = bitmap.height;
    if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const storageRef = ref(storage, `context_images/${timestamp}_${rand}.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    return getDownloadURL(storageRef);
}

/**
 * Delete all context images (from Quill editor HTML) stored in Firebase Storage.
 * Extracts URLs matching `context_images/` from the HTML content.
 * @param {string} html The HTML content that may contain context image URLs
 */
export async function deleteContextImages(html) {
    if (!html || typeof html !== 'string') return;
    // Match all Firebase Storage URLs that reference context_images
    const regex = /https:\/\/firebasestorage\.googleapis\.com[^"'\s)]*context_images[^"'\s)]*/g;
    const urls = html.match(regex) || [];
    const uniqueUrls = [...new Set(urls)];
    await Promise.allSettled(uniqueUrls.map(async url => {
        try {
            const imageRef = ref(storage, url);
            await deleteObject(imageRef);
        } catch (e) {
            console.error('Error deleting context image:', e);
        }
    }));
}

/**
 * Helper to delete all images in a multiple_choice question's variations.
 * @param {Object} question The question object
 */
export async function deleteQuestionImages(question) {
    if (question.type !== 'multiple_choice') return;
    const promises = [];
    (question.variations || []).forEach(v => {
        if (!v || !v.options) return;
        v.options.forEach(opt => {
            if (opt && typeof opt === 'string' && opt.includes('option_images')) {
                promises.push(deleteOptionImage(opt));
            }
        });
    });
    // Use allSettled so one failure doesn't crash the deletion of the rest.
    await Promise.allSettled(promises);
}

// Collection names: exams, exam_questions, exam_assignments, exam_submissions

// ========== EXAMS ==========

export async function getExams(createdByRole = null) {
    let q;
    if (createdByRole) {
        q = query(collection(db, 'exams'), where('createdByRole', '==', createdByRole));
    } else {
        q = query(collection(db, 'exams'));
    }
    const snapshot = await getDocs(q);
    const exams = [];
    snapshot.forEach(docSnap => exams.push({ id: docSnap.id, ...docSnap.data() }));
    return exams.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function getExam(id) {
    const docSnap = await getDoc(doc(db, 'exams', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function getSharedExams(examAccessIds = []) {
    const exams = [];
    const addedIds = new Set();

    try {
        // 1. Get all public exams (visible to teachers, not students)
        const publicQ = query(collection(db, 'exams'), where('isPublic', '==', true));
        const publicSnap = await getDocs(publicQ);
        publicSnap.forEach(docSnap => {
            exams.push({ id: docSnap.id, ...docSnap.data() });
            addedIds.add(docSnap.id);
        });

        // 2. Get explicitly shared exams
        if (examAccessIds.length > 0) {
            for (let i = 0; i < examAccessIds.length; i += 10) {
                const batchIds = examAccessIds.slice(i, i + 10);
                const sharedQ = query(collection(db, 'exams'), where(documentId(), 'in', batchIds));
                const sharedSnap = await getDocs(sharedQ);
                sharedSnap.forEach(docSnap => {
                    if (!addedIds.has(docSnap.id)) {
                        exams.push({ id: docSnap.id, ...docSnap.data() });
                        addedIds.add(docSnap.id);
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error fetching shared exams:", error);
    }

    return exams.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function saveExam(examData) {
    const { id, ...data } = examData;
    let examRef;
    if (id) {
        examRef = doc(db, 'exams', id);
        await updateDoc(examRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        examRef = doc(collection(db, 'exams'));
        await setDoc(examRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return examRef.id;
    }
}

export async function deleteExam(id) {
    // Delete questions first
    const questions = await getExamQuestions(id);
    const batch = writeBatch(db);

    // Delete option images for these questions
    await Promise.allSettled(questions.map(q => deleteQuestionImages(q)));

    questions.forEach(q => batch.delete(doc(db, 'exam_questions', q.id)));

    // Delete related assignments
    const assignmentsQ = query(collection(db, 'exam_assignments'), where('examId', '==', id));
    const asgnsSnap = await getDocs(assignmentsQ);
    asgnsSnap.forEach(asgnDoc => {
        batch.delete(asgnDoc.ref);
    });

    // Delete related submissions and their storage
    const submissionsQ = query(collection(db, 'exam_submissions'), where('examId', '==', id));
    const subsSnap = await getDocs(submissionsQ);

    // We handle storage deletion separately for each submission
    for (const subDoc of subsSnap.docs) {
        batch.delete(subDoc.ref);
        // Background cleanup for each submission's audio folder
        const folderRef = ref(storage, `audio_answers/${subDoc.id}`);
        listAll(folderRef).then(listRes => {
            listRes.items.forEach(fileRef => deleteObject(fileRef).catch(() => { }));
        }).catch(() => { });
    }

    // Delete context audio for all sections
    const examDoc = await getDoc(doc(db, 'exams', id));
    if (examDoc.exists()) {
        const examData = examDoc.data();
        const audioCleanup = (examData.sections || []).filter(s => s.contextAudioUrl).map(s => deleteContextAudio(s.contextAudioUrl));
        await Promise.allSettled(audioCleanup);
    }

    batch.delete(doc(db, 'exams', id));
    await batch.commit();
}

// ========== EXAM QUESTIONS ==========

export async function getExamQuestions(examId) {
    const q = query(collection(db, 'exam_questions'), where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const questions = [];
    snapshot.forEach(docSnap => questions.push({ id: docSnap.id, ...docSnap.data() }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getExamQuestionsBySection(examId, sectionId) {
    const q = query(
        collection(db, 'exam_questions'),
        where('examId', '==', examId),
        where('sectionId', '==', sectionId)
    );
    const snapshot = await getDocs(q);
    const questions = [];
    snapshot.forEach(docSnap => questions.push({ id: docSnap.id, ...docSnap.data() }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getExamQuestionCounts(examIds) {
    const counts = {};
    await Promise.all(examIds.map(async (examId) => {
        try {
            const q = query(collection(db, 'exam_questions'), where('examId', '==', examId));
            const snapshot = await getCountFromServer(q);
            counts[examId] = snapshot.data().count;
        } catch (e) {
            console.error(`Error counting questions for exam ${examId}:`, e);
            counts[examId] = 0;
        }
    }));
    return counts;
}

export async function getExamQuestionTimeTotals(examIds) {
    const totals = {};
    await Promise.all(examIds.map(async (examId) => {
        try {
            const q = query(collection(db, 'exam_questions'), where('examId', '==', examId));
            const snapshot = await getDocs(q);
            let totalSeconds = 0;
            let missingCount = 0;
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.timeLimitSeconds && data.timeLimitSeconds >= 5) {
                    totalSeconds += data.timeLimitSeconds;
                } else {
                    missingCount++;
                }
            });
            totals[examId] = { totalSeconds, missingCount, questionCount: snapshot.size };
        } catch (e) {
            console.error(`Error getting question time totals for exam ${examId}:`, e);
            totals[examId] = { totalSeconds: 0, missingCount: 0, questionCount: 0 };
        }
    }));
    return totals;
}

/**
 * Recalculate and cache question stats into the exam document.
 * Stores: cachedQuestionCount, cachedQuestionTimeTotalSeconds, cachedQuestionTimeMissingCount
 * Only counts questions that belong to valid (existing) sections — orphan questions are excluded.
 */
export async function recalcExamQuestionCache(examId) {
    try {
        // Fetch exam to get valid section IDs
        const examSnap = await getDoc(doc(db, 'exams', examId));
        const examData = examSnap.exists() ? examSnap.data() : {};
        const validSectionIds = new Set((examData.sections || []).map(s => s.id));

        const q = query(collection(db, 'exam_questions'), where('examId', '==', examId));
        const snapshot = await getDocs(q);
        let totalSeconds = 0;
        let missingCount = 0;
        let validCount = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Skip orphan questions that don't belong to any active section
            if (data.sectionId && !validSectionIds.has(data.sectionId)) return;
            if (!data.sectionId && validSectionIds.size > 0) return;
            validCount++;
            if (data.timeLimitSeconds && data.timeLimitSeconds >= 5) {
                totalSeconds += data.timeLimitSeconds;
            } else {
                missingCount++;
            }
        });
        await updateDoc(doc(db, 'exams', examId), {
            cachedQuestionCount: validCount,
            cachedQuestionTimeTotalSeconds: totalSeconds,
            cachedQuestionTimeMissingCount: missingCount
        });
    } catch (e) {
        console.error(`Error recalculating exam question cache for ${examId}:`, e);
    }
}

export async function saveExamQuestion(questionData) {
    const { id, ...data } = questionData;
    let questionRef;
    if (id) {
        questionRef = doc(db, 'exam_questions', id);
        await updateDoc(questionRef, { ...data, updatedAt: serverTimestamp() });
    } else {
        // Find current max order for this section
        const questionsSnapshot = await getDocs(query(
            collection(db, 'exam_questions'),
            where('examId', '==', data.examId),
            where('sectionId', '==', data.sectionId)
        ));
        const numQuestions = questionsSnapshot.size;

        questionRef = doc(collection(db, 'exam_questions'));
        await setDoc(questionRef, { ...data, order: numQuestions, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }

    // Fire-and-forget: auto-classify errorCategory in background
    import('./aiGrammarService').then(({ classifyErrorCategory }) => {
        classifyErrorCategory({
            targetSkill: data.targetSkill,
            type: data.type,
            purpose: data.purpose,
            questionText: data.variations?.[0]?.text || data.text,
            options: data.variations?.[0]?.options || data.options
        }).then(category => {
            updateDoc(questionRef, { errorCategory: category }).catch(() => {});
        }).catch(() => {});
    }).catch(() => {});

    // Fire-and-forget: recalc exam question cache
    recalcExamQuestionCache(data.examId).catch(() => {});

    return id || questionRef.id;
}

export async function deleteExamQuestion(id) {
    const docRef = doc(db, 'exam_questions', id);
    const snap = await getDoc(docRef);
    let examId = null;
    if (snap.exists()) {
        examId = snap.data().examId;
        await deleteQuestionImages(snap.data());
    }
    await deleteDoc(docRef);

    // Fire-and-forget: recalc exam question cache
    if (examId) recalcExamQuestionCache(examId).catch(() => {});
}

export async function updateExamQuestionsOrder(examId, sectionId, orderedQuestions) {
    const batch = writeBatch(db);
    orderedQuestions.forEach((q, index) => {
        const ref = doc(db, 'exam_questions', q.id);
        batch.update(ref, { order: index });
    });
    await batch.commit();
}

// ========== EXAM ASSIGNMENTS ==========

export async function createExamAssignment(assignmentData) {
    const { id, ...data } = assignmentData;
    const assignmentRef = doc(collection(db, 'exam_assignments'));
    // Generate a random seed for variation selection
    const variationSeed = Math.floor(Math.random() * 100000);
    await setDoc(assignmentRef, {
        ...data,
        variationSeed,
        createdAt: serverTimestamp()
    });

    // Notifications for group assignments
    if (data.targetType === 'group' && data.targetId) {
        const examName = data.examName || data.examTitle || 'Không tên';
        const examType = data.examType;
        const typeLabel = examType === 'test' ? 'bài kiểm tra' : 'bài tập';
        const typeEmoji = examType === 'test' ? '📝' : '📋';
        const dueDate = data.dueDate;
        const dueDateStr = dueDate ? (dueDate.toDate ? dueDate.toDate() : new Date(dueDate)).toLocaleString('vi-VN') : '';
        const appUrl = 'https://upenglishvietnam.com';

        try {
            const { createNotificationForGroupTeachers, createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');

            // Notify group teachers (existing)
            await createNotificationForGroupTeachers(data.targetId, {
                type: 'exam_assigned',
                title: `${typeEmoji} ${typeLabel === 'bài kiểm tra' ? 'Kiểm tra' : 'Bài tập'} mới được giao`,
                message: `${typeLabel === 'bài kiểm tra' ? 'Bài kiểm tra' : 'Bài tập'} "${examName}" đã được giao cho nhóm.`,
                link: `/teacher/groups/${data.targetId}`
            });

            // Notify students (in-app)
            await createNotificationForGroupStudents(data.targetId, {
                type: 'exam_assignment_new',
                title: `${typeEmoji} ${typeLabel === 'bài kiểm tra' ? 'Kiểm tra' : 'Bài tập'} mới`,
                message: `Bạn có ${typeLabel} mới: "${examName}".${dueDateStr ? ` Hạn: ${dueDateStr}` : ''}`,
                link: '/'
            });

            // Email to students
            const accentColor = examType === 'test' ? '#ef4444' : '#8b5cf6';
            const accentColor2 = examType === 'test' ? '#f87171' : '#a78bfa';
            await queueEmailForGroupStudents(data.targetId, {
                subject: `${typeLabel === 'bài kiểm tra' ? 'Kiểm tra' : 'Bài tập'} mới: ${examName}`,
                html: buildEmailHtml({
                    emoji: typeEmoji, heading: `${typeLabel === 'bài kiểm tra' ? 'Bài kiểm tra' : 'Bài tập'} mới`, headingColor: accentColor,
                    greeting: 'Chào bạn 👋',
                    body: `<p>Thầy/cô vừa giao cho bạn ${typeLabel} mới. Cố gắng hoàn thành đúng hạn nhé!</p>`,
                    highlight: `<strong style="font-size:1.05rem;">${examName}</strong>${dueDateStr ? `<br><span style="color:#ef4444;font-size:0.9rem;">⏰ Hạn: ${dueDateStr}</span>` : ''}`,
                    highlightBg: '#f8fafc', highlightBorder: accentColor,
                    ctaText: 'Vào làm bài ngay', ctaColor: accentColor, ctaColor2: accentColor2
                })
            });
        } catch (e) {
            console.error('Error sending exam assignment notification:', e);
        }
    }

    return assignmentRef.id;
}

export async function getExamAssignment(id) {
    const docSnap = await getDoc(doc(db, 'exam_assignments', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function getExamAssignmentsForExam(examId) {
    if (!examId) return [];
    try {
        const q = query(collection(db, 'exam_assignments'), where('examId', '==', examId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching exam assignments for exam:', error);
        return [];
    }
}

export async function getExamAssignmentsForGroup(groupId) {
    const q = query(collection(db, 'exam_assignments'), where('targetType', '==', 'group'), where('targetId', '==', groupId));
    const snapshot = await getDocs(q);
    const assignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !a.isDeleted);
    return assignments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function getExamAssignmentsForStudent(studentId, groupIds = []) {
    const assignments = [];
    const addedIds = new Set();

    // 1. Individual assignments
    try {
        const indQ = query(collection(db, 'exam_assignments'), where('targetType', '==', 'individual'), where('targetId', '==', studentId));
        const indSnap = await getDocs(indQ);
        indSnap.forEach(d => {
            assignments.push({ id: d.id, ...d.data() });
            addedIds.add(d.id);
        });
    } catch (e) {
        console.error("Error fetching individual exam assignments:", e);
    }

    // 2. Group assignments
    if (groupIds.length > 0) {
        for (let i = 0; i < groupIds.length; i += 10) {
            const batchGroupIds = groupIds.slice(i, i + 10);
            try {
                const grpQ = query(collection(db, 'exam_assignments'), where('targetType', '==', 'group'), where('targetId', 'in', batchGroupIds));
                const grpSnap = await getDocs(grpQ);
                grpSnap.forEach(d => {
                    if (!addedIds.has(d.id)) {
                        assignments.push({ id: d.id, ...d.data() });
                        addedIds.add(d.id);
                    }
                });
            } catch (e) {
                console.error("Error fetching group exam assignments:", e);
            }
        }
    }

    return assignments.filter(a => !a.isDeleted).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function deleteExamAssignment(assignmentId) {
    // Soft delete: mark as deleted instead of removing
    try {
        await updateDoc(doc(db, 'exam_assignments', assignmentId), {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error soft-deleting exam assignment:", error);
        throw error;
    }
}

export async function restoreExamAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    try {
        await updateDoc(doc(db, 'exam_assignments', assignmentId), {
            isDeleted: deleteField(),
            deletedAt: deleteField()
        });
    } catch (error) {
        console.error("Error restoring exam assignment:", error);
        throw error;
    }
}

export async function permanentlyDeleteExamAssignment(assignmentId) {
    // Actually delete submissions and the assignment document
    const subsQ = query(collection(db, 'exam_submissions'), where('assignmentId', '==', assignmentId));
    const subsSnap = await getDocs(subsQ);
    const batch = writeBatch(db);

    for (const subDoc of subsSnap.docs) {
        batch.delete(subDoc.ref);
        const folderRef = ref(storage, `audio_answers/${subDoc.id}`);
        listAll(folderRef).then(listRes => {
            listRes.items.forEach(fileRef => deleteObject(fileRef).catch(() => { }));
        }).catch(() => { });
    }

    batch.delete(doc(db, 'exam_assignments', assignmentId));
    await batch.commit();
}

export async function getDeletedExamAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const q = query(collection(db, 'exam_assignments'), where('targetType', '==', 'group'), where('targetId', '==', groupId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => a.isDeleted);
        data.sort((a, b) => {
            const tA = a.deletedAt?.toMillis ? a.deletedAt.toMillis() : 0;
            const tB = b.deletedAt?.toMillis ? b.deletedAt.toMillis() : 0;
            return tB - tA;
        });
        return data;
    } catch (error) {
        console.error("Error fetching deleted exam assignments:", error);
        return [];
    }
}

/**
 * Auto-purge soft-deleted items older than 30 days for a group.
 * Call on page load.
 */
export async function cleanupExpiredDeletedItems(groupId) {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    try {
        // Clean up regular assignments
        const assignmentsRef = collection(db, 'assignments');
        const aq = query(assignmentsRef, where('groupId', '==', groupId));
        const aSnap = await getDocs(aq);
        const deletePromises = [];
        aSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.isDeleted && data.deletedAt) {
                const deletedMs = data.deletedAt.toMillis ? data.deletedAt.toMillis() : new Date(data.deletedAt).getTime();
                if (deletedMs < cutoff) {
                    deletePromises.push(deleteDoc(docSnap.ref));
                }
            }
        });

        // Clean up exam assignments
        const eq = query(collection(db, 'exam_assignments'), where('targetType', '==', 'group'), where('targetId', '==', groupId));
        const eSnap = await getDocs(eq);
        for (const docSnap of eSnap.docs) {
            const data = docSnap.data();
            if (data.isDeleted && data.deletedAt) {
                const deletedMs = data.deletedAt.toMillis ? data.deletedAt.toMillis() : new Date(data.deletedAt).getTime();
                if (deletedMs < cutoff) {
                    // Permanently delete with submissions
                    deletePromises.push(permanentlyDeleteExamAssignment(docSnap.id));
                }
            }
        }

        if (deletePromises.length > 0) {
            await Promise.allSettled(deletePromises);
            console.log(`[Cleanup] Purged ${deletePromises.length} expired soft-deleted items for group ${groupId}`);
        }
    } catch (error) {
        console.error("Error during cleanup of expired deleted items:", error);
    }
}

export async function updateExamAssignmentDueDate(assignmentId, newDueDate) {
    if (!assignmentId || !newDueDate) throw new Error("Missing assignment ID or new due date");
    try {
        const assignmentRef = doc(db, 'exam_assignments', assignmentId);
        const assignmentSnap = await getDoc(assignmentRef);
        await updateDoc(assignmentRef, {
            dueDate: newDueDate,
            updatedAt: serverTimestamp()
        });

        if (assignmentSnap.exists()) {
            const aData = assignmentSnap.data();
            const examName = aData.examName || aData.examTitle || 'bài';
            const dueDateStr = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toLocaleString('vi-VN');
            const targetId = aData.targetType === 'group' ? aData.targetId : null;
            if (targetId) {
                try {
                    const { createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');
                    await createNotificationForGroupStudents(targetId, { type: 'deadline_extended', title: '⏰ Gia hạn deadline', message: `Bài "${examName}" được gia hạn đến ${dueDateStr}.`, link: '/' });
                    await queueEmailForGroupStudents(targetId, {
                        subject: `Gia hạn: ${examName}`,
                        html: buildEmailHtml({
                            emoji: '⏰', heading: 'Gia hạn deadline', headingColor: '#f59e0b',
                            greeting: 'Chào bạn 👋',
                            body: `<p>Bài <strong>"${examName}"</strong> đã được thầy/cô gia hạn thêm thời gian làm bài. Tranh thủ hoàn thành nhé!</p>`,
                            highlight: `<strong>📅 Hạn mới: ${dueDateStr}</strong>`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Vào làm bài', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    });
                } catch (e) { console.error('Error sending exam deadline extension notification:', e); }
            }
        }
    } catch (error) {
        console.error("Error updating exam assignment due date:", error);
        throw error;
    }
}

export async function updateExamAssignmentStudentDeadline(assignmentId, studentId, newDueDate) {
    if (!assignmentId || !studentId || !newDueDate) throw new Error("Missing parameters");
    try {
        const assignmentRef = doc(db, 'exam_assignments', assignmentId);
        const assignmentSnap = await getDoc(assignmentRef);
        await updateDoc(assignmentRef, {
            [`studentDeadlines.${studentId}`]: newDueDate,
            updatedAt: serverTimestamp()
        });

        if (assignmentSnap.exists()) {
            const aData = assignmentSnap.data();
            const examName = aData.examName || aData.examTitle || 'bài';
            const dueDateStr = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toLocaleString('vi-VN');
            try {
                const { createNotification, queueEmail, buildEmailHtml } = await import('./notificationService');
                const studentSnap = await getDoc(doc(db, 'users', studentId));
                await createNotification({ userId: studentId, type: 'deadline_extended', title: '⏰ Gia hạn deadline', message: `Bài "${examName}" được gia hạn cho bạn đến ${dueDateStr}.`, link: '/' });
                if (studentSnap.exists() && studentSnap.data().email) {
                    await queueEmail(studentSnap.data().email, {
                        subject: `Gia hạn: ${examName}`,
                        html: buildEmailHtml({
                            emoji: '⏰', heading: 'Gia hạn deadline', headingColor: '#f59e0b',
                            greeting: 'Chào bạn 👋',
                            body: `<p>Bài <strong>"${examName}"</strong> đã được thầy/cô gia hạn riêng cho bạn, thêm thời gian làm bài. Cố gắng hoàn thành nhé!</p>`,
                            highlight: `<strong>📅 Hạn mới: ${dueDateStr}</strong>`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Vào làm bài', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    });
                }
            } catch (e) { console.error('Error sending exam individual deadline notification:', e); }
        }
    } catch (error) {
        console.error("Error updating exam student deadline:", error);
        throw error;
    }
}

export async function removeExamAssignmentStudentDeadline(assignmentId, studentId) {
    if (!assignmentId || !studentId) throw new Error("Missing parameters");
    try {
        const assignmentRef = doc(db, 'exam_assignments', assignmentId);
        await updateDoc(assignmentRef, {
            [`studentDeadlines.${studentId}`]: deleteField(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error removing exam student deadline:", error);
        throw error;
    }
}

// ========== EXAM SUBMISSIONS ==========

export async function getExamSubmission(assignmentId, studentId) {
    const q = query(
        collection(db, 'exam_submissions'),
        where('assignmentId', '==', assignmentId),
        where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const finished = docs.find(d => d.status === 'submitted' || d.status === 'grading' || d.status === 'graded');
        if (finished) return finished;
        // If none is finished, see if any has totalScore (just in case)
        const hasScore = docs.find(d => d.totalScore !== undefined && d.totalScore !== null);
        if (hasScore) return hasScore;
        return docs[0];
    }
    return null;
}

export async function getExamSubmissionsForAssignment(assignmentId) {
    const q = query(collection(db, 'exam_submissions'), where('assignmentId', '==', assignmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getExamSubmissionsForAssignments(assignmentIds) {
    if (!assignmentIds || assignmentIds.length === 0) return [];

    const submissions = [];
    const addedIds = new Set();

    // Firestore 'in' query supports up to 10 elements
    for (let i = 0; i < assignmentIds.length; i += 10) {
        const batchIds = assignmentIds.slice(i, i + 10);
        try {
            const q = query(collection(db, 'exam_submissions'), where('assignmentId', 'in', batchIds));
            const snapshot = await getDocs(q);
            snapshot.forEach(d => {
                if (!addedIds.has(d.id)) {
                    submissions.push({ id: d.id, ...d.data() });
                    addedIds.add(d.id);
                }
            });
        } catch (e) {
            console.error("Error fetching bulk exam submissions:", e);
        }
    }

    return submissions;
}

export async function getExamSubmissionsForStudent(studentId) {
    const q = query(collection(db, 'exam_submissions'), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveExamSubmission(submissionData) {
    const { id, ...data } = submissionData;
    let submissionRef;
    if (id) {
        submissionRef = doc(db, 'exam_submissions', id);
        await updateDoc(submissionRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        submissionRef = doc(collection(db, 'exam_submissions'));
        await setDoc(submissionRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return submissionRef.id;
    }
}

/**
 * Delete an exam submission and its associated audio files in Storage.
 * @param {string} submissionId 
 */
export async function deleteExamSubmission(submissionId) {
    if (!submissionId) return;

    // 1. Delete Firestore document
    await deleteDoc(doc(db, 'exam_submissions', submissionId));

    // 2. Clean up audio files in Storage
    try {
        const folderRef = ref(storage, `audio_answers/${submissionId}`);
        const listRes = await listAll(folderRef);
        const deletePromises = listRes.items.map(fileRef => deleteObject(fileRef));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error cleaning up audio files:', error);
    }
}

// ========== AI GRADING ==========

/**
 * Grade an entire exam submission using AI.
 * Processes all answers, grades each one, then saves results.
 * @param {string} submissionId The submission document ID
 * @param {Object} submission The submission data
 * @param {Object[]} questions All exam questions
 * @returns {Promise<Object>} The grading results
 */
export async function gradeExamSubmission(submissionId, submission, questions, sections = [], teacherTitle = '', studentTitle = '') {
    const results = {};
    let totalScore = 0;

    let finalTeacherTitle = teacherTitle;
    let finalStudentTitle = studentTitle;
    let cefrLevel = '';
    if (!finalTeacherTitle && submission.examId) {
        try {
            const examRef = doc(db, 'exams', submission.examId);
            const examSnap = await getDoc(examRef);
            if (examSnap.exists()) {
                const examData = examSnap.data();
                cefrLevel = examData.cefrLevel || '';
                if (examData.teacherTitle) {
                    finalTeacherTitle = examData.teacherTitle;
                    if (examData.studentTitle) finalStudentTitle = examData.studentTitle;
                } else if (examData.createdBy) {
                    const userRef = doc(db, 'users', examData.createdBy);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        if (userSnap.data().teacherTitle) finalTeacherTitle = userSnap.data().teacherTitle;
                        if (userSnap.data().studentTitle) finalStudentTitle = userSnap.data().studentTitle;
                    }
                }
            }
        } catch (err) {
            console.warn('Could not fetch teacher honorifics for AI grading:', err);
        }
    }

    const questionsMap = {};
    questions.forEach(q => { questionsMap[q.id] = q; });

    // Build a map from sectionId -> context HTML + script for comprehension-based grading
    const sectionsMap = {};
    const validSectionIds = new Set();
    (sections || []).forEach(s => {
        if (s?.id) {
            validSectionIds.add(s.id);
            let fullContext = s.context || '';
            if (s.contextScript) {
                fullContext += `\n\n[SCRIPT / TRANSCRIPT CỦA BÀI NGHE/VIDEO]:\n${s.contextScript}`;
            }
            sectionsMap[s.id] = fullContext;
        }
    });

    // Filter out orphan questions (not belonging to any active section)
    if (validSectionIds.size > 0) {
        questions = questions.filter(q => q.sectionId && validSectionIds.has(q.sectionId));
    }

    // ── maxTotalScore = sum of ALL question points (regardless of whether answered) ──
    const maxTotalScore = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    // Track index of AI-graded questions (essay/audio) to avoid repeated greetings
    let essayAudioIndex = 0;
    let usedAI = false; // Track whether AI was called during grading

    // Track all graded results to provide context for AI grading
    const previousResults = [];
    let questionCounter = 0;
    const TYPE_LABELS = {
        multiple_choice: 'Trắc nghiệm', matching: 'Ghép nối', categorization: 'Phân loại',
        fill_in_blank: 'Điền từ', fill_in_blanks: 'Điền từ', fill_in_blank_typing: 'Điền từ (nhập)',
        essay: 'Tự luận', audio_recording: 'Thu âm', ordering: 'Sắp xếp thứ tự'
    };

    // ── Build ordered list of (sectionId, questionId) pairs based on section & question order ──
    const sectionOrder = (sections || []).map(s => s.id);
    const orderedGradingPairs = [];
    for (const sectionId of sectionOrder) {
        const sectionAnswers = (submission.answers || {})[sectionId];
        if (!sectionAnswers) continue;
        // Get questions in this section, sorted by their order
        const sectionQuestionIds = Object.keys(sectionAnswers);
        const sortedQuestionIds = sectionQuestionIds
            .filter(qid => questionsMap[qid])
            .sort((a, b) => (questionsMap[a].order || 0) - (questionsMap[b].order || 0));
        for (const questionId of sortedQuestionIds) {
            orderedGradingPairs.push({ sectionId, questionId, answerData: sectionAnswers[questionId] });
        }
    }

    // ── Grade each answered question in correct order ──
    for (const { sectionId, questionId, answerData } of orderedGradingPairs) {
            const question = questionsMap[questionId];
            if (!question) continue;

            const variationIndex = submission.variationMap?.[questionId] || 0;
            let variation = question.variations?.[variationIndex];
            // Fallback: if selected variation is empty, find first valid one
            if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, '').trim().length === 0))) {
                variation = question.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, '').trim().length > 0)) || question.variations?.[0];
            }
            if (!variation) continue;

            const maxScore = question.points || 1;

            try {
                let isCorrect = false;
                let score = 0;
                let feedback = '';

                if (question.type === 'multiple_choice') {
                    const correctAnswerText = variation.options[variation.correctAnswer];
                    isCorrect = answerData.answer === correctAnswerText;
                    score = isCorrect ? maxScore : 0;
                    const isImg = typeof correctAnswerText === 'string' && (correctAnswerText.startsWith('https://firebasestorage.googleapis.com/') || correctAnswerText.startsWith('https://storage.googleapis.com/'));
                    feedback = isCorrect ? 'Chính xác!' : `Đáp án đúng: ${isImg ? 'Đáp án ' + String.fromCharCode(65 + variation.correctAnswer) : correctAnswerText}`;
                } else if (question.type === 'fill_in_blank' || question.type === 'fill_in_blanks' || question.type === 'fill_in_blank_typing') {
                    const markerRegex = /\{\{(.+?)\}\}/g;
                    const correctWords = [];
                    let mm;
                    while ((mm = markerRegex.exec(variation.text || '')) !== null) {
                        correctWords.push(mm[1]);
                    }
                    if (correctWords.length > 0 && typeof answerData.answer === 'object' && answerData.answer !== null) {
                        let correctCount = 0;
                        correctWords.forEach((cw, idx) => {
                            const studentWord = answerData.answer[String(idx)];
                            if (typeof studentWord === 'string' && studentWord.trim().toLowerCase() === cw.trim().toLowerCase()) {
                                correctCount++;
                            }
                        });
                        score = correctWords.length > 0 ? (correctCount / correctWords.length) * maxScore : 0;
                        score = Math.round(score * 10) / 10;
                        isCorrect = correctCount === correctWords.length && correctWords.length > 0;
                        feedback = isCorrect ? 'Chính xác!' : `Bạn đã điền đúng ${correctCount}/${correctWords.length} chỗ trống.`;
                    } else {
                        isCorrect = typeof answerData.answer === 'string' &&
                            answerData.answer.trim().toLowerCase() === variation.correctAnswer?.trim().toLowerCase();
                        score = isCorrect ? maxScore : 0;
                        feedback = isCorrect ? 'Chính xác!' : `Đáp án đúng: ${variation.correctAnswer}`;
                    }
                } else if (question.type === 'matching') {
                    const pairs = variation.pairs || [];
                    const total = pairs.length;
                    let correctCount = 0;
                    pairs.forEach((pair, i) => {
                        if (answerData.answer?.[i]?.text === pair.right) correctCount++;
                    });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã ghép đúng ${correctCount}/${total} cặp.`;
                } else if (question.type === 'categorization') {
                    const items = variation.items || [];
                    const total = items.length;
                    let correctCount = 0;
                    const studentAnswers = answerData.answer || {};
                    items.forEach(item => {
                        if (studentAnswers[item.text] === item.group) correctCount++;
                    });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã phân loại đúng ${correctCount}/${total} mục.`;
                } else if (question.type === 'ordering') {
                    const correctItems = variation.items || [];
                    const total = correctItems.length;
                    let correctCount = 0;
                    const studentOrder = Array.isArray(answerData.answer) ? answerData.answer : [];
                    correctItems.forEach((item, i) => {
                        if (studentOrder[i] === item) correctCount++;
                    });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã xếp đúng vị trí ${correctCount}/${total} mục.`;
                } else if (question.type === 'essay') {
                    try {
                        usedAI = true;
                        const sectionContext = sectionsMap[sectionId] || '';
                        const gradeResult = await gradeGrammarSubmissionWithAI(
                            variation.text || variation.content,
                            answerData.answer,
                            question.purpose,
                            question.type,
                            question.specialRequirement || '',
                            sectionContext,
                            finalTeacherTitle,
                            finalStudentTitle,
                            essayAudioIndex,
                            previousResults,
                            questions.length,
                            cefrLevel
                        );
                        essayAudioIndex++;
                        const numericScore = parseInt(gradeResult.score, 10);
                        score = Math.round((numericScore / 10) * maxScore * 10) / 10;
                        isCorrect = numericScore >= 8;
                        feedback = gradeResult.feedback || '';
                        // Store extra AI data for skill analysis
                        var teacherNote = gradeResult.teacherNote || '';
                        var detectedErrors = Array.isArray(gradeResult.detectedErrors) ? gradeResult.detectedErrors : [];
                    } catch (aiErr) {
                        console.error(`AI grading failed for question ${questionId}:`, aiErr);
                        score = 0;
                        feedback = 'Lỗi khi chấm bài bằng AI. Giáo viên sẽ chấm thủ công.';
                    }
                } else if (question.type === 'audio_recording') {
                    usedAI = true;
                    const audioAnswer = answerData.answer || {};
                    if (audioAnswer.audioUrl) {
                        // Re-grade audio with full context (previousResults)
                        try {
                            const audioResp = await fetch(audioAnswer.audioUrl);
                            const audioBlob = await audioResp.blob();
                            const sectionContext = sectionsMap[sectionId] || '';
                            const audioResult = await evaluateAudioAnswer(
                                audioBlob,
                                variation.text || variation.content || '',
                                question.purpose || '',
                                question.specialRequirement || '',
                                maxScore,
                                sectionContext,
                                finalTeacherTitle,
                                finalStudentTitle,
                                essayAudioIndex,
                                previousResults,
                                questions.length,
                                cefrLevel
                            );
                            essayAudioIndex++;
                            score = parseFloat(audioResult.score) || 0;
                            isCorrect = score >= (maxScore * 0.8);
                            feedback = audioResult.feedback || '';
                        } catch (audioErr) {
                            console.error(`Audio re-grading failed for ${questionId}, using existing score:`, audioErr);
                            // Fallback to existing score
                            if (audioAnswer.aiScore !== undefined) {
                                score = parseFloat(audioAnswer.aiScore);
                                isCorrect = score >= (maxScore * 0.8);
                                feedback = audioAnswer.aiFeedback || '';
                            } else {
                                score = 0;
                                feedback = 'Lỗi khi chấm bài thu âm. Giáo viên sẽ chấm thủ công.';
                            }
                        }
                    } else if (audioAnswer.aiScore !== undefined) {
                        const numericScore = parseFloat(audioAnswer.aiScore);
                        score = numericScore;
                        isCorrect = numericScore >= (maxScore * 0.8);
                        feedback = audioAnswer.aiFeedback || '';
                    } else {
                        score = 0;
                        feedback = audioAnswer.transcript
                            ? 'Bài thu âm chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công.'
                            : 'Học viên chưa thu âm câu trả lời.';
                    }
                }

                totalScore += score;
                questionCounter++;
                const resultEntry = { score, maxScore, isCorrect, feedback, teacherOverride: null };
                // Attach AI metadata for essay questions (used by skill analysis)
                if (typeof teacherNote === 'string' && teacherNote) resultEntry.teacherNote = teacherNote;
                if (Array.isArray(detectedErrors) && detectedErrors.length > 0) resultEntry.detectedErrors = detectedErrors;
                results[questionId] = resultEntry;

                // Track result for AI context in subsequent questions
                // Build detailed info for AI to detect error patterns
                let prevQuestionText = '';
                let prevStudentAnswer = '';
                let prevCorrectAnswer = '';

                if (question.type === 'multiple_choice') {
                    prevQuestionText = (variation.text || variation.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
                    prevStudentAnswer = answerData.answer || '(không trả lời)';
                    const correctIdx = variation.correctAnswer;
                    prevCorrectAnswer = variation.options?.[correctIdx] || '';
                    // Truncate image URLs
                    if (typeof prevStudentAnswer === 'string' && prevStudentAnswer.startsWith('http')) prevStudentAnswer = `(Đáp án hình ảnh)`;
                    if (typeof prevCorrectAnswer === 'string' && prevCorrectAnswer.startsWith('http')) prevCorrectAnswer = `(Đáp án hình ảnh)`;
                } else if (question.type === 'fill_in_blank' || question.type === 'fill_in_blanks' || question.type === 'fill_in_blank_typing') {
                    prevQuestionText = (variation.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
                    const markerRegex2 = /\{\{(.+?)\}\}/g;
                    const cw2 = [];
                    let m2;
                    while ((m2 = markerRegex2.exec(variation.text || '')) !== null) cw2.push(m2[1]);
                    prevCorrectAnswer = cw2.join(', ');
                    if (typeof answerData.answer === 'object' && answerData.answer !== null) {
                        prevStudentAnswer = Object.entries(answerData.answer).map(([k, v]) => `[${parseInt(k) + 1}]: "${v}"`).join(', ');
                    } else {
                        prevStudentAnswer = answerData.answer || '(không trả lời)';
                    }
                } else if (question.type === 'matching') {
                    prevQuestionText = 'Ghép nối các cặp';
                    const wrongPairs = (variation.pairs || []).filter((pair, i) => answerData.answer?.[i]?.text !== pair.right);
                    prevStudentAnswer = wrongPairs.length > 0 ? wrongPairs.map(p => `"${p.left}" → học viên ghép sai`).join('; ') : 'Tất cả đúng';
                    prevCorrectAnswer = (variation.pairs || []).map(p => `"${p.left}" ↔ "${p.right}"`).join('; ');
                } else if (question.type === 'categorization') {
                    prevQuestionText = 'Phân loại các mục';
                    const wrongItems = (variation.items || []).filter(item => (answerData.answer || {})[item.text] !== item.group);
                    prevStudentAnswer = wrongItems.length > 0 ? wrongItems.map(item => `"${item.text}" → xếp vào "${(answerData.answer || {})[item.text] || '?'}" (đúng: "${item.group}")`).join('; ') : 'Tất cả đúng';
                    prevCorrectAnswer = (variation.items || []).map(item => `"${item.text}" → "${item.group}"`).join('; ');
                } else if (question.type === 'ordering') {
                    prevQuestionText = 'Sắp xếp thứ tự';
                    prevStudentAnswer = (Array.isArray(answerData.answer) ? answerData.answer : []).join(' → ');
                    prevCorrectAnswer = (variation.items || []).join(' → ');
                } else if (question.type === 'essay') {
                    prevQuestionText = (variation.text || variation.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
                    // Không gửi studentAnswer vì AI đã phân tích lỗi trong feedback rồi
                } else if (question.type === 'audio_recording') {
                    prevQuestionText = (variation.text || variation.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
                    // Không gửi transcript vì AI đã phân tích lỗi trong feedback rồi
                }

                previousResults.push({
                    questionNumber: questionCounter,
                    typeName: TYPE_LABELS[question.type] || question.type,
                    purpose: question.purpose || '',
                    isCorrect,
                    score,
                    maxScore,
                    feedback: feedback || '',
                    questionText: prevQuestionText,
                    studentAnswer: prevStudentAnswer,
                    correctAnswer: prevCorrectAnswer
                });
            } catch (err) {
                console.error(`Error grading question ${questionId}:`, err);
                results[questionId] = {
                    score: 0,
                    maxScore,
                    isCorrect: false,
                    feedback: 'Lỗi khi chấm câu hỏi này.',
                    teacherOverride: null
                };
            }
    }

    // ── Mark all unanswered questions as score = 0 ──
    for (const question of questions) {
        if (!results[question.id]) {
            results[question.id] = {
                score: 0,
                maxScore: question.points || 1,
                isCorrect: false,
                feedback: '',
                teacherOverride: null
            };
        }
    }

    // Round to avoid floating point precision issues (e.g. 6.99999999999999 → 7)
    totalScore = Math.round(totalScore * 10) / 10;

    // Auto-release if no AI grading was used (all questions were self-graded)
    const isFullyAutoGraded = !usedAI;

    // Update submission with results
    const updateData = {
        results,
        totalScore,
        maxTotalScore,
        status: 'graded',
        gradedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Auto-release if all questions are auto-graded
    if (isFullyAutoGraded) {
        updateData.resultsReleased = true;
        updateData.releasedAt = serverTimestamp();
        updateData.releasedBy = 'system';
        updateData.releasedByName = 'Hệ thống (tự động)';
    }

    await updateDoc(doc(db, 'exam_submissions', submissionId), updateData);

    // Send auto-release notifications
    if (isFullyAutoGraded) {
        try {
            const subSnap = await getDoc(doc(db, 'exam_submissions', submissionId));
            if (subSnap.exists()) {
                const subData = subSnap.data();
                const studentId = subData.studentId;
                const assignmentId = subData.assignmentId;

                let examName = 'Bài tập và Kiểm tra';
                let targetId = null;

                if (assignmentId) {
                    const asgnSnap = await getDoc(doc(db, 'exam_assignments', assignmentId));
                    if (asgnSnap.exists()) {
                        const asgnData = asgnSnap.data();
                        examName = asgnData.examName || asgnData.examTitle || examName;
                        if (asgnData.targetType === 'group') {
                            targetId = asgnData.targetId;
                        }
                    }
                }

                const { createNotification, queueEmail, buildEmailHtml } = await import('./notificationService');

                const scoreText = subData.totalScore != null && subData.maxTotalScore ? `${Math.round(subData.totalScore * 10) / 10}/${subData.maxTotalScore}` : '';

                // Notify student (in-app)
                await createNotification({
                    userId: studentId,
                    type: 'exam_graded',
                    title: '📊 Kết quả bài làm!',
                    message: `Bài "${examName}" đã được chấm tự động.${scoreText ? ` Điểm: ${scoreText}.` : ''}`,
                    link: `/exam-result?submissionId=${submissionId}`
                });

                // Email to student
                try {
                    const studentSnap = await getDoc(doc(db, 'users', studentId));
                    if (studentSnap.exists() && studentSnap.data().email) {
                        await queueEmail(studentSnap.data().email, {
                            subject: `Bài "${examName}" đã có kết quả${scoreText ? ` — ${scoreText} điểm` : ''}`,
                            html: buildEmailHtml({
                                emoji: '📊', heading: 'Kết quả đã sẵn sàng!', headingColor: '#10b981',
                                greeting: 'Chào bạn 👋',
                                body: `<p>Bài <strong>"${examName}"</strong> đã được chấm tự động.${scoreText ? ` Điểm: <strong style="color:#10b981;font-size:1.1rem;">${scoreText}</strong>.` : ''} Vào xem kết quả chi tiết ngay nhé!</p>`,
                                highlight: `<strong style="color:#1e293b;font-size:1.05rem;">${examName}</strong>${scoreText ? `<br/><span style="font-size:1.3rem;font-weight:900;color:#10b981;">${scoreText}</span> <span style="color:#64748b;font-size:0.85rem;">điểm</span>` : ''}`,
                                highlightBg: '#f0fdf4', highlightBorder: '#10b981',
                                ctaText: 'Xem kết quả ngay', ctaColor: '#10b981', ctaColor2: '#34d399'
                            })
                        });
                    }
                } catch (emailErr) {
                    console.error('Error sending auto-release email:', emailErr);
                }
            }
        } catch (notifErr) {
            console.error('Error sending auto-release notifications:', notifErr);
        }
    }

    return { results, totalScore, maxTotalScore };
}

/**
 * Teacher overrides the AI score and/or feedback for a specific question in a submission.
 */
export async function overrideExamQuestionScore(submissionId, questionId, newScore, note, newFeedback, teacherUid, overriderName = 'Giáo viên') {
    const submissionRef = doc(db, 'exam_submissions', submissionId);
    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) throw new Error('Submission not found');

    const data = submissionSnap.data();
    const results = data.results || {};
    const currentResult = results[questionId];
    if (!currentResult) throw new Error('Question result not found');

    const oldScore = currentResult.teacherOverride?.score ?? currentResult.score;
    const scoreDiff = newScore - oldScore;

    results[questionId] = {
        ...currentResult,
        teacherOverride: {
            score: newScore,
            note,
            overriddenBy: teacherUid,
            overriddenByName: overriderName,
            overriddenAt: new Date().toISOString()
        }
    };

    // Allow overriding the AI's general feedback as well
    if (newFeedback !== undefined) {
        results[questionId].feedback = newFeedback;
    }

    const newTotalScore = Math.round(((data.totalScore || 0) + scoreDiff) * 10) / 10;

    await updateDoc(submissionRef, {
        results,
        totalScore: newTotalScore,
        updatedAt: serverTimestamp()
    });

    return { results, totalScore: newTotalScore };
}

/**
 * Releases results for a submission so the student can view them.
 */
export async function releaseExamSubmissionResults(submissionId, releaserUid, releaserName = 'Giáo viên') {
    const submissionRef = doc(db, 'exam_submissions', submissionId);
    await updateDoc(submissionRef, {
        resultsReleased: true,
        releasedAt: serverTimestamp(),
        releasedBy: releaserUid,
        releasedByName: releaserName,
        updatedAt: serverTimestamp()
    });

    try {
        const subSnap = await getDoc(submissionRef);
        if (subSnap.exists()) {
            const subData = subSnap.data();
            const assignmentId = subData.assignmentId;
            const studentId = subData.studentId;

            let examName = 'Bài tập và Kiểm tra';
            let targetId = null;

            if (assignmentId) {
                const asgnSnap = await getDoc(doc(db, 'exam_assignments', assignmentId));
                if (asgnSnap.exists()) {
                    const asgnData = asgnSnap.data();
                    examName = asgnData.examTitle || examName;
                    if (asgnData.targetType === 'group') {
                        targetId = asgnData.targetId;
                    }
                }
            }

            const { createNotification, createNotificationForGroupTeachers } = await import('./notificationService');

            const notifScoreText = subData.totalScore != null && subData.maxTotalScore ? ` Điểm: ${Math.round(subData.totalScore * 10) / 10}/${subData.maxTotalScore}.` : '';

            // Notify Student (in-app)
            await createNotification({
                userId: studentId,
                type: 'exam_graded',
                title: '📊 Bài đã có kết quả!',
                message: `Bài "${examName}" của bạn đã được ${releaserName} chấm điểm.${notifScoreText}`,
                link: `/exam-result?submissionId=${submissionId}`
            });

            // Email to student
            try {
                const studentSnap = await getDoc(doc(db, 'users', studentId));
                if (studentSnap.exists() && studentSnap.data().email) {
                    const { queueEmail, buildEmailHtml } = await import('./notificationService');
                    const scoreText = subData.totalScore != null && subData.maxTotalScore ? `${Math.round(subData.totalScore * 10) / 10}/${subData.maxTotalScore}` : '';
                    await queueEmail(studentSnap.data().email, {
                        subject: `Bài "${examName}" đã có kết quả${scoreText ? ` — ${scoreText} điểm` : ''}`,
                        html: buildEmailHtml({
                            emoji: '📊', heading: 'Kết quả đã sẵn sàng!', headingColor: '#10b981',
                            greeting: `Chào bạn 👋`,
                            body: `<p>Tin vui nè! Thầy/cô <strong>${releaserName}</strong> đã chấm xong bài của bạn rồi.${scoreText ? ` Điểm: <strong style="color:#10b981;font-size:1.1rem;">${scoreText}</strong>.` : ''} Vào xem kết quả chi tiết ngay nhé!</p>`,
                            highlight: `<strong style="color:#1e293b;font-size:1.05rem;">${examName}</strong>${scoreText ? `<br/><span style="font-size:1.3rem;font-weight:900;color:#10b981;">${scoreText}</span> <span style="color:#64748b;font-size:0.85rem;">điểm</span>` : ''}`,
                            highlightBg: '#f0fdf4', highlightBorder: '#10b981',
                            ctaText: 'Xem kết quả ngay', ctaColor: '#10b981', ctaColor2: '#34d399'
                        })
                    });
                }
            } catch (emailErr) {
                console.error('Error sending result email:', emailErr);
            }

            // Notify Teachers if it's a group assignment
            if (targetId) {
                // Let's get the student's name if possible
                const studentSnap2 = await getDoc(doc(db, 'users', studentId));
                let studentName = 'Học viên';
                if (studentSnap2.exists()) {
                    const studentData = studentSnap2.data();
                    studentName = studentData.displayName || studentData.email || 'Học viên';
                }

                await createNotificationForGroupTeachers(targetId, {
                    type: 'exam_graded_by_other',
                    title: 'Có bài vừa được chấm',
                    message: `${releaserName} vừa chấm bài "${examName}" cho ${studentName}.`,
                    link: `/teacher/exam-submissions/${assignmentId}/${studentId}`
                });

                // Email to group teachers
                try {
                    const { queueEmailForGroupTeachers, buildEmailHtml } = await import('./notificationService');
                    await queueEmailForGroupTeachers(targetId, {
                        subject: `Bài "${examName}" đã được chấm`,
                        html: buildEmailHtml({
                            emoji: '📝', heading: 'Có bài vừa được chấm', headingColor: '#3b82f6',
                            body: `<p><strong>${releaserName}</strong> vừa chấm xong bài <strong>"${examName}"</strong> cho học viên <strong>${studentName}</strong>. Bạn có thể vào xem chi tiết kết quả.</p>`,
                            ctaText: 'Xem chi tiết', ctaColor: '#3b82f6', ctaColor2: '#60a5fa'
                        })
                    }, 'exam_graded_by_other');
                } catch (emailErr) {
                    console.error('Error sending graded email to teachers:', emailErr);
                }
            }
        }
    } catch (err) {
        console.error("Failed to send release notifications:", err);
    }
}

// ========== EXAM FOLDERS ==========

export async function getExamFolders() {
    const snapshot = await getDocs(collection(db, 'exam_folders'));
    const folders = [];
    snapshot.forEach(docSnap => {
        folders.push({ id: docSnap.id, ...docSnap.data() });
    });
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveExamFolder(folderData) {
    const { id, ...data } = folderData;
    const folderRef = doc(db, 'exam_folders', id);
    await setDoc(folderRef, {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function updateExamFoldersOrder(orderedFolders) {
    const batch = writeBatch(db);
    orderedFolders.forEach((folder, index) => {
        const ref = doc(db, 'exam_folders', folder.id);
        batch.update(ref, { order: index });
    });
    await batch.commit();
}

export async function deleteExamFolder(folderId) {
    const folderRef = doc(db, 'exam_folders', folderId);
    await deleteDoc(folderRef);
}

// ========== TEACHER EXAM FOLDERS ==========

export async function getTeacherExamFolders(teacherId) {
    const q = query(collection(db, 'teacher_exam_folders'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    const folders = [];
    snapshot.forEach(docSnap => folders.push({ id: docSnap.id, ...docSnap.data() }));
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getAllTeacherExamFolders() {
    const snapshot = await getDocs(collection(db, 'teacher_exam_folders'));
    const folders = [];
    snapshot.forEach(docSnap => folders.push({ id: docSnap.id, ...docSnap.data() }));
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveTeacherExamFolder(teacherId, folderData) {
    const { id, ...data } = folderData;
    if (id) {
        const folderRef = doc(db, 'teacher_exam_folders', id);
        await updateDoc(folderRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        const folderRef = doc(collection(db, 'teacher_exam_folders'));
        await setDoc(folderRef, { ...data, teacherId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return folderRef.id;
    }
}

export async function deleteTeacherExamFolder(folderId) {
    await deleteDoc(doc(db, 'teacher_exam_folders', folderId));
}

// ========== SHARING (Admin) ==========

export async function toggleExamPublic(examId, isPublic) {
    await updateDoc(doc(db, 'exams', examId), { isPublic, updatedAt: serverTimestamp() });
}

export async function shareExamToTeacher(examId, teacherUid) {
    const examRef = doc(db, 'exams', examId);
    const examSnap = await getDoc(examRef);
    if (!examSnap.exists()) throw new Error('Exam not found');

    const sharedWith = examSnap.data().sharedWith || [];
    if (!sharedWith.includes(teacherUid)) {
        sharedWith.push(teacherUid);
        await updateDoc(examRef, { sharedWith, updatedAt: serverTimestamp() });
    }
}

export async function unshareExamFromTeacher(examId, teacherUid) {
    const examRef = doc(db, 'exams', examId);
    const examSnap = await getDoc(examRef);
    if (!examSnap.exists()) throw new Error('Exam not found');

    const sharedWith = (examSnap.data().sharedWith || []).filter(uid => uid !== teacherUid);
    await updateDoc(examRef, { sharedWith, updatedAt: serverTimestamp() });
}
