import { gradeGrammarSubmissionWithAI, gradeFillInBlankBlanksWithAI } from './aiGrammarService';
import { getPromptById } from './promptService';
import { normalizeForComparison } from '../utils/textNormalization';
import { evaluateAudioAnswer, chatCompletion, isSilentAudio } from './aiService';
import { deleteContextAudio } from './contextAudioService';
import { examsService, examQuestionsService, examAssignmentsService, examSubmissionsService, teacherFoldersService, adminFoldersService, usersService } from '../models';
import { deletePublicAsset, uploadPublicAsset } from './uploadService';

function unwrapApiResult(response) {
    return response?.data || response || null;
}

function nowIso() {
    return new Date().toISOString();
}

async function getExamRecord(examId) {
    if (!examId) return null;
    try {
        return unwrapApiResult(await examsService.findOne(examId));
    } catch {
        return null;
    }
}

async function getSubmissionRecord(submissionId) {
    if (!submissionId) return null;
    try {
        return unwrapApiResult(await examSubmissionsService.findOne(submissionId));
    } catch {
        return null;
    }
}

async function getAssignmentRecord(assignmentId) {
    if (!assignmentId) return null;
    try {
        return unwrapApiResult(await examAssignmentsService.findOne(assignmentId));
    } catch {
        return null;
    }
}

async function getUserRecord(userId) {
    if (!userId) return null;
    try {
        return unwrapApiResult(await usersService.findOne(userId));
    } catch {
        return null;
    }
}

/**
 * Upload an audio answer blob to Firebase Storage.
 * @param {Blob} audioBlob The audio blob
 * @param {string} submissionId The exam submission ID
 * @param {string} questionId The question ID
 * @returns {Promise<string>} The download URL
 */
export async function uploadAudioAnswer(audioBlob, submissionId, questionId) {
    const ext = audioBlob.type?.includes('mp4') ? 'mp4' : audioBlob.type?.includes('aac') ? 'aac' : 'webm';
    const upload = await uploadPublicAsset(audioBlob, `audio_answers/${submissionId}`, {
        fileName: `${questionId}.${ext}`,
        contentType: audioBlob.type || 'audio/webm',
    });
    return upload?.url || '';
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
    const upload = await uploadPublicAsset(blob, 'option_images', {
        fileName: `${timestamp}_${rand}.webp`,
        contentType: 'image/webp',
    });
    return upload?.url || '';
}

/**
 * Generate an AI image for an MCQ option using FLUX.1-schnell,
 * center-crop to 480×480, upload to Firebase Storage.
 * @param {string} prompt Text description for the image (usually the option text)
 * @returns {Promise<string>} The download URL
 */
export async function generateAndUploadOptionImage(prompt) {
    const { fetchHfImageFromProxy } = await import('./vocabImageService');

    // Random seed ensures different images for the same prompt on regeneration
    const randomSeed = Math.floor(Math.random() * 99999);
    const noTextRule = 'absolutely NO text, NO words, NO letters, NO labels, NO writing of any kind';

    // If teacher wrote a detailed prompt (contains style/composition keywords), use it directly
    const styleKeywords = /\b(style|cartoon|watercolor|realistic|3d|pixel|anime|sketch|drawing|painting|illustration|minimalist|vintage|retro|pastel|neon|chibi|isometric|vector|flat design|cute|photo)\b/i;
    let fullPrompt;
    if (styleKeywords.test(prompt)) {
        fullPrompt = `${prompt}. ${noTextRule}. seed:${randomSeed}`;
    } else {
        fullPrompt = `A clear, simple illustration of: "${prompt}". Flat design style, educational illustration, clean white background, ${noTextRule}, vibrant colors, centered composition. seed:${randomSeed}`;
    }
    const imageBlob = await fetchHfImageFromProxy(fullPrompt);

    // Center-crop to 480×480 (matching uploadOptionImage)
    const SIZE = 480;
    const bitmap = await createImageBitmap(imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const upload = await uploadPublicAsset(blob, 'option_images', {
        fileName: `${timestamp}_${rand}.webp`,
        contentType: 'image/webp',
    });
    return upload?.url || '';
}

/**
 * Delete an option image from Firebase Storage by its download URL.
 * @param {string} url The download URL
 */
export async function deleteOptionImage(url) {
    if (!url || typeof url !== 'string' || !url.includes('option_images')) return;
    try {
        await deletePublicAsset(url);
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
    const upload = await uploadPublicAsset(blob, 'context_images', {
        fileName: `${timestamp}_${rand}.webp`,
        contentType: 'image/webp',
    });
    return upload?.url || '';
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
            await deletePublicAsset(url);
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
    const result = await examsService.findAll({ createdByRole });
    let exams = Array.isArray(result) ? result : (result?.data || []);
    exams = exams.filter(e => !e.isDeleted).map(e => ({ ...e, id: e._id || e.id }));
    return exams.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function getExam(id) {
    const response = await examsService.findOne(id);
    const result = response?.data || response;
    return result ? { ...result, id: result._id || result.id } : null;
}

export async function getSharedExams(examAccessIds = []) {
    try {
        const result = await examsService.findShared(examAccessIds);
        let exams = Array.isArray(result) ? result : (result?.data || []);
        exams = exams.map(e => ({ ...e, id: e._id || e.id }));
        return exams.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error("Error fetching shared exams:", error);
        return [];
    }
}

export async function saveExam(examData) {
    const { id, _id, ...data } = examData;
    const targetId = id || _id;
    if (targetId) {
        if (!data.targetLevel) delete data.targetLevel;
        if (!data.cefrLevel) delete data.cefrLevel;
        try {
            await examsService.update(targetId, data);
            return targetId;
        } catch (e) {
            const response = await examsService.create({ _id: targetId, ...data });
            const result = response?.data || response;
            return result?.id || result?._id || result;
        }
    } else {
        if (!data.targetLevel) delete data.targetLevel;
        if (!data.cefrLevel) delete data.cefrLevel;
        const response = await examsService.create(data);
        const result = response?.data || response;
        return result?.id || result?._id || result;
    }
}

export async function deleteExam(id) {
    await examsService.softDelete(id);
}

export async function restoreExam(id) {
    await examsService.restore(id);
}

export async function permanentlyDeleteExam(id) {
    // Backend handles cascade deletion of questions, assignments, submissions, and storage
    await examsService.permanentDelete(id);
}

export async function getDeletedExams() {
    try {
        const result = await examsService.findDeleted();
        let exams = Array.isArray(result) ? result : (result?.data || []);
        exams = exams.map(e => ({ ...e, id: e._id || e.id }));
        return exams.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching deleted exams:", error);
        return [];
    }
}

// ========== EXAM QUESTIONS ==========

export async function getExamQuestions(examId) {
    const result = await examQuestionsService.findAll(examId);
    let questions = Array.isArray(result) ? result : (result?.data || []);
    questions = questions.map(q => ({ ...q, id: q.id || q._id }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getExamQuestionsBySection(examId, sectionId) {
    const result = await examQuestionsService.findBySection(examId, sectionId);
    let questions = Array.isArray(result) ? result : (result?.data || []);
    questions = questions.map(q => ({ ...q, id: q.id || q._id }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getExamQuestionCounts(examIds) {
    if (!examIds || examIds.length === 0) return {};
    try {
        const result = await examQuestionsService.getCounts(examIds);
        return result?.data || result || {};
    } catch (e) {
        console.error(`Error counting questions:`, e);
        return {};
    }
}

export async function getExamQuestionTimeTotals(examIds) {
    if (!examIds || examIds.length === 0) return {};
    try {
        const result = await examQuestionsService.getTimeTotals(examIds);
        return result?.data || result || {};
    } catch (e) {
        console.error(`Error getting question time totals:`, e);
        return {};
    }
}

/**
 * Recalculate and cache question stats into the exam document.
 * Stores: cachedQuestionCount, cachedQuestionTimeTotalSeconds, cachedQuestionTimeMissingCount
 * Only counts questions that belong to valid (existing) sections — orphan questions are excluded.
 */
export async function recalcExamQuestionCache(examId) {
    try {
        // Backend handles the recalculation
        await examsService.update(examId, { _recalcQuestionCache: true });
    } catch (e) {
        console.error(`Error recalculating exam question cache for ${examId}:`, e);
    }
}

export async function saveExamQuestion(questionData) {
    const { id, ...data } = questionData;
    let resultId;
    if (id) {
        await examQuestionsService.update(id, data);
        resultId = id;
    } else {
        const result = await examQuestionsService.create(data);
        const normalized = result?.data || result;
        resultId = normalized?.id || normalized?._id || normalized;
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
            examQuestionsService.update(resultId, { errorCategory: category }).catch(() => {});
        }).catch(() => {});
    }).catch(() => {});

    // Fire-and-forget: recalc exam question cache
    recalcExamQuestionCache(data.examId).catch(() => {});

    return resultId;
}

export async function deleteExamQuestion(id) {
    try {
        const question = await examQuestionsService.findOne(id);
        if (question) await deleteQuestionImages(question);
        await examQuestionsService.remove(id);
        if (question?.examId) recalcExamQuestionCache(question.examId).catch(() => {});
    } catch (e) {
        await examQuestionsService.remove(id);
    }
}

export async function updateExamQuestionsOrder(examId, sectionId, orderedQuestions) {
    const orders = orderedQuestions.map((q, index) => ({ id: q.id, order: index }));
    await examQuestionsService.reorder(examId, sectionId, orders);
}

// ========== EXAM ASSIGNMENTS ==========

export async function createExamAssignment(assignmentData) {
    const { id, ...data } = assignmentData;
    // Generate a random seed for variation selection
    const variationSeed = Math.floor(Math.random() * 100000);

    const result = await examAssignmentsService.create({
        ...data,
        variationSeed,
    });
    const assignmentId = result?.id || result;

    // Notifications for group assignments
    // Check if scheduledStart is in the future — if so, skip student notifications
    const scheduledStartDate = data.scheduledStart
        ? (data.scheduledStart.toDate ? data.scheduledStart.toDate() : new Date(data.scheduledStart))
        : null;
    const shouldNotifyStudents = !scheduledStartDate || scheduledStartDate <= new Date();

    if (data.targetType === 'group' && data.targetId) {
        const examName = data.examName || data.examTitle || 'Không tên';
        const examType = data.examType;
        const typeLabel = examType === 'test' ? 'bài kiểm tra' : 'bài tập';
        const typeEmoji = examType === 'test' ? '📝' : '📋';
        const dueDate = data.dueDate;
        const dueDateStr = dueDate ? (dueDate.toDate ? dueDate.toDate() : new Date(dueDate)).toLocaleString('vi-VN') : '';
        const appUrl = 'https://upenglishvietnam.com/preview/superstudy';

        try {
            const { createNotificationForGroupTeachers, createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');

            // Notify group teachers (always, even for scheduled assignments)
            await createNotificationForGroupTeachers(data.targetId, {
                type: 'exam_assigned',
                title: `${typeEmoji} ${typeLabel === 'bài kiểm tra' ? 'Kiểm tra' : 'Bài tập'} mới được giao`,
                message: `${typeLabel === 'bài kiểm tra' ? 'Bài kiểm tra' : 'Bài tập'} "${examName}" đã được giao cho nhóm.`,
                link: `/teacher/groups/${data.targetId}`
            });

            // Only notify students if not scheduled for the future
            if (shouldNotifyStudents) {
                // Notify students (in-app)
                await createNotificationForGroupStudents(data.targetId, {
                    type: 'exam_assignment_new',
                    title: `${typeEmoji} ${typeLabel === 'bài kiểm tra' ? 'Kiểm tra' : 'Bài tập'} mới`,
                    message: `Bạn có ${typeLabel} mới: "${examName}".${dueDateStr ? ` Hạn: ${dueDateStr}` : ''}`,
                    link: '/dashboard?tab=exams'
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
                        ctaText: 'Vào làm bài ngay', ctaLink: `${appUrl}/dashboard?tab=exams`, ctaColor: accentColor, ctaColor2: accentColor2
                    })
                });
            }
        } catch (e) {
            console.error('Error sending exam assignment notification:', e);
        }
    }

    return assignmentId;
}

export async function getExamAssignment(id) {
    const result = await examAssignmentsService.findOne(id);
    return result || null;
}

export async function getExamAssignmentsForExam(examId) {
    if (!examId) return [];
    try {
        const result = await examAssignmentsService.findByExam(examId);
        let assignments = Array.isArray(result) ? result : (result?.data || []);
        return assignments.filter(a => !a.isDeleted);
    } catch (error) {
        console.error('Error fetching exam assignments for exam:', error);
        return [];
    }
}

export async function getExamAssignmentsForGroup(groupId) {
    const result = await examAssignmentsService.findByGroup(groupId);
    let assignments = Array.isArray(result) ? result : (result?.data || []);
    assignments = assignments.filter(a => !a.isDeleted);
    return assignments.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function getExamAssignmentsForStudent(studentId, groupIds = []) {
    try {
        const result = await examAssignmentsService.findForStudent(studentId, groupIds);
        let assignments = Array.isArray(result) ? result : (result?.data || []);
        // Filter out deleted and filter by assignedStudentIds
        let filtered = assignments.filter(a => !a.isDeleted);
        filtered = filtered.filter(a => {
            if (a.assignedStudentIds && Array.isArray(a.assignedStudentIds) && a.assignedStudentIds.length > 0) {
                return a.assignedStudentIds.includes(studentId);
            }
            return true;
        });
        return filtered.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error('Error fetching student exam assignments:', error);
        return [];
    }
}

export async function getExamAssignmentsForStudents(studentIds = []) {
    const uniqueStudentIds = [...new Set((studentIds || []).filter(Boolean))];
    if (uniqueStudentIds.length === 0) return [];

    try {
        const results = await Promise.all(
            uniqueStudentIds.map(studentId => examAssignmentsService.findAll({ studentId }))
        );
        const assignments = results.flatMap(result => Array.isArray(result) ? result : (result?.data || []));
        const deduped = new Map();

        assignments
            .filter(assignment => !assignment.isDeleted)
            .forEach(assignment => {
                const assignmentId = assignment.id || assignment._id;
                if (assignmentId) deduped.set(assignmentId, assignment);
            });

        return Array.from(deduped.values()).sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error('Error fetching exam assignments for students:', error);
        return [];
    }
}

export async function deleteExamAssignment(assignmentId) {
    await examAssignmentsService.softDelete(assignmentId);
}

export async function restoreExamAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    await examAssignmentsService.restore(assignmentId);
}

export async function permanentlyDeleteExamAssignment(assignmentId) {
    // Backend handles cascade deletion of submissions and storage cleanup
    await examAssignmentsService.permanentDelete(assignmentId);
}

export async function getDeletedExamAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const result = await examAssignmentsService.findDeletedByGroup(groupId);
        let data = Array.isArray(result) ? result : (result?.data || []);
        data.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
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
/**
 * Auto-purge soft-deleted items older than 30 days for a group.
 * Delegates exam_assignments cleanup to the backend.
 */
export async function cleanupExpiredDeletedItems(groupId) {
    try {
        // Fetch deleted exam assignments from backend
        const result = await examAssignmentsService.findDeletedByGroup(groupId);
        const deletedAssignments = Array.isArray(result) ? result : (result?.data || []);
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - THIRTY_DAYS_MS;

        const purgePromises = deletedAssignments
            .filter(a => {
                if (!a.deletedAt) return false;
                const deletedMs = typeof a.deletedAt === 'string' ? new Date(a.deletedAt).getTime() : a.deletedAt;
                return deletedMs < cutoff;
            })
            .map(a => permanentlyDeleteExamAssignment(a._id || a.id));

        if (purgePromises.length > 0) {
            await Promise.allSettled(purgePromises);
            console.log(`[Cleanup] Purged ${purgePromises.length} expired exam assignments for group ${groupId}`);
        }
    } catch (error) {
        console.error("Error during cleanup of expired deleted items:", error);
    }
}

export async function updateExamAssignmentDueDate(assignmentId, newDueDate) {
    if (!assignmentId || !newDueDate) throw new Error("Missing assignment ID or new due date");
    try {
        const dueDateStr = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toISOString();
        await examAssignmentsService.updateDueDate(assignmentId, { dueDate: dueDateStr });
    } catch (error) {
        console.error("Error updating exam assignment due date:", error);
        throw error;
    }
}

export async function updateExamAssignmentStudentDeadline(assignmentId, studentId, newDueDate) {
    if (!assignmentId || !studentId || !newDueDate) throw new Error("Missing parameters");
    try {
        const dueDateISO = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toISOString();
        await examAssignmentsService.update(assignmentId, {
            [`studentDeadlines.${studentId}`]: dueDateISO,
        });
    } catch (error) {
        console.error("Error updating exam student deadline:", error);
        throw error;
    }
}

export async function removeExamAssignmentStudentDeadline(assignmentId, studentId) {
    if (!assignmentId || !studentId) throw new Error("Missing parameters");
    try {
        // Backend uses $unset pattern — send null to signal removal
        await examAssignmentsService.update(assignmentId, {
            [`studentDeadlines.${studentId}`]: null,
        });
    } catch (error) {
        console.error("Error removing exam student deadline:", error);
        throw error;
    }
}

// ========== EXAM SUBMISSIONS ==========

export async function getExamSubmission(assignmentId, studentId) {
    const result = await examSubmissionsService.findByAssignmentAndStudent(assignmentId, studentId);
    if (!result) return null;
    // If multiple returned, pick the finished one
    if (Array.isArray(result)) {
        const finished = result.find(d => d.status === 'submitted' || d.status === 'grading' || d.status === 'graded');
        if (finished) return finished;
        const hasScore = result.find(d => d.totalScore !== undefined && d.totalScore !== null);
        if (hasScore) return hasScore;
        return result[0] || null;
    }
    return result;
}

export async function getExamSubmissionsForAssignment(assignmentId) {
    const result = await examSubmissionsService.findByAssignment(assignmentId);
    return Array.isArray(result) ? result : (result?.data || []);
}

export async function getExamSubmissionsForAssignments(assignmentIds) {
    if (!assignmentIds || assignmentIds.length === 0) return [];
    try {
        const result = await examSubmissionsService.findByAssignments(assignmentIds);
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (e) {
        console.error("Error fetching bulk exam submissions:", e);
        return [];
    }
}

export async function getExamSubmissionsForStudent(studentId) {
    const result = await examSubmissionsService.findByStudent(studentId);
    return Array.isArray(result) ? result : (result?.data || []);
}

export async function saveExamSubmission(submissionData) {
    const { id, ...data } = submissionData;
    if (id) {
        await examSubmissionsService.update(id, data);
        return id;
    } else {
        const result = await examSubmissionsService.create(data);
        return result?.id || result;
    }
}

/**
 * Delete an exam submission and its associated audio files in Storage.
 * @param {string} submissionId 
 */
export async function deleteExamSubmission(submissionId) {
    if (!submissionId) return;

    // 1. Delete via API
    await examSubmissionsService.remove(submissionId);

    // Backend handles cascade deletion of audio files in storage
}

/**
 * Generate a concise AI summary after all exam questions have been graded.
 * @param {Object} params
 * @param {Object[]} params.summaryItems - Pre-collected summary data per question
 * @param {number} params.totalScore
 * @param {number} params.maxTotalScore
 * @param {string} params.teacherTitle
 * @param {string} params.studentTitle
 * @param {string} params.cefrLevel
 * @returns {Promise<string>}
 */
async function generateExamSummary({ summaryItems, totalScore, maxTotalScore, teacherTitle = 'thầy/cô', studentTitle = 'em', cefrLevel = '' }) {
    // Build compact summary of all question results from pre-collected items
    const questionSummaries = summaryItems.map(item => {
        let line = `Câu ${item.num} (${item.typeName}${item.purpose ? ' - ' + item.purpose : ''}): ${item.isCorrect ? 'ĐÚNG' : 'SAI'} — ${item.score}/${item.maxScore}`;
        if (item.detectedErrors && item.detectedErrors.length > 0) {
            line += ` [Lỗi: ${item.detectedErrors.join(', ')}]`;
        }
        if (item.feedback) {
            line += `\n  Nhận xét: ${item.feedback}`;
        }
        if (item.followUpRequested) {
            line += `\n  ➡️ Giáo viên yêu cầu làm lại câu này`;
            if (item.followUpResult) {
                line += ` → Kết quả làm lại: ${item.followUpResult.score}/${item.followUpResult.maxScore}`;
                if (item.followUpResult.feedback) line += `\n  Nhận xét bài sửa: ${item.followUpResult.feedback}`;
            } else {
                line += ` (chưa làm lại)`;
            }
        }
        if (!item.isCorrect && item.questionText) {
            line += `\n  Đề: "${item.questionText}"`;
            if (item.studentAnswer) line += `\n  Trả lời: "${item.studentAnswer}"`;
            if (item.correctAnswer) line += `\n  Đáp án: "${item.correctAnswer}"`;
        }
        return line;
    }).join('\n');

    const scorePercent = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

    const systemPrompt = `Bạn là giáo viên tiếng Anh viết NHẬN XÉT TỔNG KẾT cho một bài kiểm tra. Gọi học viên bằng "${studentTitle}". Có thể xưng "${teacherTitle}" nhưng không bắt buộc.
${cefrLevel ? `Trình độ mục tiêu: ${cefrLevel}.` : ''}

Dựa trên kết quả dưới đây, hãy viết nhận xét tổng kết bằng TIẾNG VIỆT. TẬP TRUNG VÀO KỸ NĂNG, KHÔNG liệt kê từng câu.

Cấu trúc:
1. **Điểm mạnh**: Những kỹ năng học viên thể hiện tốt (ví dụ: phát âm rõ ràng, ngữ pháp chắc, từ vựng phong phú, triển khai ý tưởng logic...).
2. **Điểm cần cải thiện**: Những kỹ năng còn yếu, phân tích pattern lỗi nếu có (ví dụ: hay sai thì động từ, thiếu từ nối, ý tưởng chưa phát triển đủ...). CHỈ nêu kỹ năng/pattern, KHÔNG nói "ở Câu 3" hay "Câu 5".

LƯU Ý:
- Viết tự nhiên, đi thẳng vào nội dung. KHÔNG mở đầu bằng tiêu đề.
- KHÔNG đề cập số câu hỏi cụ thể (Câu 1, Câu 2...). Chỉ nói về kỹ năng.
- NGOẠI TRỪ: Nếu có câu được giáo viên yêu cầu làm lại, hãy ghi rõ số câu cần làm lại (ví dụ: "Giáo viên yêu cầu em làm lại Câu 2, Câu 4 và Câu 6 vì chưa đạt yêu cầu"). Nếu học viên chưa làm lại, nhắc nhở luôn.
- Dùng **in đậm** để nhấn mạnh. Không dùng heading (#).
- Sử dụng dấu gạch ngang (- ) để liệt kê.
- Nếu bài đạt điểm cao (≥80%), vẫn chỉ ra kỹ năng có thể nâng cấp.
- Nếu bài đạt điểm thấp (<50%), động viên nhẹ nhàng.
- CHỈ trả về text nhận xét, KHÔNG trả về JSON.`;

    const userContent = `TỔNG ĐIỂM: ${totalScore}/${maxTotalScore} (${scorePercent}%)

KẾT QUẢ TỪNG CÂU:
${questionSummaries}`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent
        });

        return typeof response === 'string' ? response.trim() : (response?.text || response?.content || '');
    } catch (err) {
        console.error('generateExamSummary error:', err);
        return '';
    }
}

/**
 * Manually (re)generate exam summary for a submission.
 * Used when teacher wants to generate/regenerate after fixing grading errors.
 * @param {string} submissionId
 * @param {Object[]} questions - All exam questions for this exam
 * @param {string} teacherTitle
 * @param {string} studentTitle
 * @returns {Promise<string>} The generated summary
 */
export async function regenerateExamSummaryForSubmission(submissionId, questions, teacherTitle = '', studentTitle = '') {
    const submissionRes = await examSubmissionsService.findOne(submissionId);
    const submission = submissionRes?.data || submissionRes;
    if (!submission) throw new Error('Submission not found');
    const results = submission.results || {};

    const TYPE_LABELS = {
        multiple_choice: 'Trắc nghiệm', matching: 'Ghép nối', categorization: 'Phân loại',
        fill_in_blank: 'Điền từ', fill_in_blanks: 'Điền từ', fill_in_blank_typing: 'Điền từ (nhập)',
        essay: 'Tự luận', audio_recording: 'Thu âm', ordering: 'Sắp xếp thứ tự'
    };

    // Build summaryItems from stored results
    const summaryItems = [];
    let counter = 0;
    for (const q of questions) {
        const r = results[q.id];
        if (!r) continue;
        counter++;
        const item = {
            num: counter,
            typeName: TYPE_LABELS[q.type] || q.type,
            purpose: q.purpose || '',
            isCorrect: r.isCorrect,
            score: r.score,
            maxScore: r.maxScore,
            detectedErrors: r.detectedErrors || [],
            feedback: r.feedback || '',
            followUpRequested: !!submission.followUpRequested?.[q.id],
            followUpResult: submission.followUpResults?.[q.id] || null
        };
        if (!r.isCorrect) {
            // For wrong answers, add question text (we don't have variation here, just use purpose)
            item.questionText = q.purpose || q.type;
        }
        summaryItems.push(item);
    }

    const totalScore = submission.totalScore || 0;
    const maxTotalScore = submission.maxTotalScore || 0;

    // Determine CEFR level from exam
    let cefrLevel = '';
    if (submission.examId) {
        try {
            const examRes = await examsService.findOne(submission.examId);
            const examData = examRes?.data || examRes;
            if (examData) cefrLevel = examData.cefrLevel || '';
        } catch (e) { /* ignore */ }
    }

    const finalTeacherTitle = teacherTitle || 'thầy/cô';
    const finalStudentTitle = studentTitle || 'em';

    const summary = await generateExamSummary({
        summaryItems,
        totalScore,
        maxTotalScore,
        teacherTitle: finalTeacherTitle,
        studentTitle: finalStudentTitle,
        cefrLevel
    });

    // Save via backend
    await examSubmissionsService.update(submissionId, { examSummary: summary });

    return summary;
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
    // Re-read the latest submission data from backend storage to avoid race conditions
    // (e.g., audioUrl saved after grading was triggered but before it actually grades that question)
    try {
        const freshData = await getSubmissionRecord(submissionId);
        if (freshData) {
            // Merge: use fresh answers from Firestore (they are the most up-to-date)
            submission = { ...submission, ...freshData, answers: freshData.answers || submission.answers };
        }
    } catch (e) {
        console.warn('Could not re-read submission from backend, using passed-in data:', e);
    }

    // Preserve existing results (e.g. teacherOverride) from previous grading
    const existingResults = submission.results || {};

    const results = {};
    let totalScore = 0;

    let finalTeacherTitle = teacherTitle;
    let finalStudentTitle = studentTitle;
    let cefrLevel = '';
    if (!finalTeacherTitle && submission.examId) {
        try {
            const examData = await getExamRecord(submission.examId);
            if (examData) {
                cefrLevel = examData.cefrLevel || '';
                if (examData.teacherTitle) {
                    finalTeacherTitle = examData.teacherTitle;
                    if (examData.studentTitle) finalStudentTitle = examData.studentTitle;
                } else if (examData.createdBy) {
                    const userData = await getUserRecord(examData.createdBy);
                    if (userData) {
                        if (userData.teacherTitle) finalTeacherTitle = userData.teacherTitle;
                        if (userData.studentTitle) finalStudentTitle = userData.studentTitle;
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

    // ── Helper: get total max score for a question (perItem × itemCount) ──
    function getQuestionMaxScore(q) {
        const perItem = q.points || 1;
        const varIdx = submission.variationMap?.[q.id] || 0;
        const v = q.variations?.[varIdx] || q.variations?.[0];
        if (!v) return perItem;
        if (q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing') {
            const count = (v.text || '').match(/\{\{.+?\}\}/g)?.length || 1;
            return perItem * count;
        }
        if (q.type === 'matching') return perItem * ((v.pairs || []).length || 1);
        if (q.type === 'categorization') return perItem * ((v.items || []).length || 1);
        if (q.type === 'ordering') return perItem; // All-or-nothing
        return perItem;
    }

    // ── maxTotalScore = sum of ALL question points (perItem × itemCount) ──
    const maxTotalScore = questions.reduce((sum, q) => sum + getQuestionMaxScore(q), 0);

    // Track index of AI-graded questions (essay/audio) to avoid repeated greetings
    let essayAudioIndex = 0;
    let usedAI = false; // Track whether AI was called during grading
    const summaryItems = []; // Collect data for exam summary
    let questionCounter = 0;

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

    // Track answer updates (e.g. AI transcript for audio recordings)
    const answerUpdates = {};

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

            const perItemPoints = question.points || 1;
            // For multi-item types, actual maxScore = perItemPoints × itemCount
            // We'll calculate this per type below; default is perItemPoints (for single-answer types)
            let maxScore = perItemPoints;

            try {
                let isCorrect = false;
                let score = 0;
                let feedback = '';
                let savedAiVerdicts = null;

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
                        correctWords.push(mm[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '));
                    }
                    maxScore = perItemPoints * correctWords.length; // Total = per-blank × blanks
                    if (correctWords.length > 0 && typeof answerData.answer === 'object' && answerData.answer !== null) {
                        let correctCount = 0;
                        correctWords.forEach((cw, idx) => {
                            const studentWord = answerData.answer[String(idx)];
                            if (typeof studentWord === 'string' && normalizeForComparison(studentWord) === normalizeForComparison(cw)) {
                                correctCount++;
                            }
                        });
                        score = correctCount * perItemPoints;
                        score = Math.round(score * 10) / 10;
                        isCorrect = correctCount === correctWords.length && correctWords.length > 0;
                        feedback = isCorrect ? 'Chính xác!' : `Bạn đã điền đúng ${correctCount}/${correctWords.length} chỗ trống.`;

                        // AI fallback: if exact match failed and teacher enabled AI grading
                        if (!isCorrect && question.useAIGrading && question.type === 'fill_in_blank_typing' && correctWords.length > 0) {
                            try {
                                usedAI = true;
                                const blanksData = correctWords.map((cw, idx) => {
                                    const sw = answerData.answer[String(idx)] || '';
                                    const exactOk = normalizeForComparison(sw) === normalizeForComparison(cw);
                                    return { idx, expected: cw, studentAnswer: sw, exactMatch: exactOk };
                                });
                                // Skip if all exact match (shouldn't happen since !isCorrect)
                                if (blanksData.every(b => b.exactMatch)) continue;

                                const sectionContext = sectionsMap[sectionId] || '';
                                const cleanText = (variation.text || '').replace(/<[^>]*>/g, ' ').replace(/\{\{.+?\}\}/g, '___');
                                const aiVerdicts = await gradeFillInBlankBlanksWithAI(cleanText, blanksData, sectionContext);

                                if (aiVerdicts && aiVerdicts.length === correctWords.length) {
                                    savedAiVerdicts = aiVerdicts;
                                    let aiCorrectCount = 0;
                                    correctWords.forEach((cw, idx) => {
                                        const sw = answerData.answer[String(idx)] || '';
                                        const exactOk = normalizeForComparison(sw) === normalizeForComparison(cw);
                                        if (exactOk || aiVerdicts[idx] === true) aiCorrectCount++;
                                    });
                                    score = aiCorrectCount * perItemPoints;
                                    score = Math.round(score * 10) / 10;
                                    isCorrect = aiCorrectCount === correctWords.length;
                                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã điền đúng ${aiCorrectCount}/${correctWords.length} chỗ trống.`;
                                }
                            } catch (aiErr) {
                                console.error(`AI fallback grading failed for question ${questionId}:`, aiErr);
                            }
                        }
                    } else {
                        isCorrect = typeof answerData.answer === 'string' &&
                            answerData.answer.trim().toLowerCase() === variation.correctAnswer?.trim().toLowerCase();
                        score = isCorrect ? maxScore : 0;
                        feedback = isCorrect ? 'Chính xác!' : `Đáp án đúng: ${variation.correctAnswer}`;
                    }
                } else if (question.type === 'matching') {
                    const pairs = variation.pairs || [];
                    const total = pairs.length;
                    maxScore = perItemPoints * total; // Total = per-pair × pairs
                    let correctCount = 0;
                    pairs.forEach((pair, i) => {
                        if (answerData.answer?.[i]?.text === pair.right) correctCount++;
                    });
                    score = correctCount * perItemPoints;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã ghép đúng ${correctCount}/${total} cặp.`;
                } else if (question.type === 'categorization') {
                    const items = variation.items || [];
                    const total = items.length;
                    maxScore = perItemPoints * total; // Total = per-item × items
                    let correctCount = 0;
                    const studentAnswers = answerData.answer || {};
                    items.forEach(item => {
                        if (studentAnswers[item.text] === item.group) correctCount++;
                    });
                    score = correctCount * perItemPoints;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? 'Chính xác!' : `Bạn đã phân loại đúng ${correctCount}/${total} mục.`;
                } else if (question.type === 'ordering') {
                    const correctItems = variation.items || [];
                    const total = correctItems.length;
                    maxScore = perItemPoints; // All-or-nothing: single score for the whole question
                    const studentOrder = Array.isArray(answerData.answer) ? answerData.answer : [];
                    isCorrect = total > 0 && correctItems.every((item, i) => studentOrder[i] === item);
                    score = isCorrect ? maxScore : 0;
                    feedback = isCorrect ? 'Chính xác!' : 'Thứ tự chưa đúng.';
                } else if (question.type === 'essay') {
                    try {
                        usedAI = true;
                        const sectionContext = sectionsMap[sectionId] || '';
                        // Resolve prompt content from linked prompt if available, combine with specialRequirement
                        let resolvedSpecialReq = question.specialRequirement || '';
                        if (question.promptId) {
                            try {
                                const linkedPrompt = await getPromptById(question.promptId);
                                if (linkedPrompt) {
                                    resolvedSpecialReq = resolvedSpecialReq
                                        ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${resolvedSpecialReq}`
                                        : linkedPrompt.content;
                                }
                            } catch (e) { console.warn('Could not resolve linked prompt:', e); }
                        }
                        const gradeResult = await gradeGrammarSubmissionWithAI(
                            variation.text || variation.content,
                            answerData.answer,
                            question.purpose,
                            question.type,
                            resolvedSpecialReq,
                            sectionContext,
                            finalTeacherTitle,
                            finalStudentTitle,
                            essayAudioIndex,
                            questions.length,
                            cefrLevel,
                            maxScore,
                            question.useDefaultGradingCriteria !== false
                        );
                        essayAudioIndex++;
                        const numericScore = parseFloat(gradeResult.score) || 0;
                        score = Math.min(Math.round(numericScore * 10) / 10, maxScore);
                        isCorrect = score >= (maxScore * 0.8);
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
                    let audioAnswer = answerData.answer || {};
                    // Resolve prompt content from linked prompt if available, combine with specialRequirement
                    let resolvedAudioSpecialReq = question.specialRequirement || '';
                    if (question.promptId) {
                        try {
                            const linkedPrompt = await getPromptById(question.promptId);
                            if (linkedPrompt) {
                                resolvedAudioSpecialReq = resolvedAudioSpecialReq
                                    ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${resolvedAudioSpecialReq}`
                                    : linkedPrompt.content;
                            }
                        } catch (e) { console.warn('Could not resolve linked prompt for audio:', e); }
                    }

                    // Poll for audioUrl if student recorded but upload hasn't completed yet
                    if (audioAnswer.hasRecording && !audioAnswer.audioUrl) {
                        for (let poll = 0; poll < 3; poll++) {
                            await new Promise(r => setTimeout(r, 3000)); // wait 3s between polls
                            try {
                                const pollData = await getSubmissionRecord(submissionId);
                                if (pollData) {
                                    const pollAnswer = pollData.answers?.[sectionId]?.[questionId]?.answer;
                                    if (pollAnswer?.audioUrl) {
                                        audioAnswer = pollAnswer;
                                        console.log(`[AudioPoll] Got audioUrl for ${questionId} after ${poll + 1} polls`);
                                        break;
                                    }
                                }
                            } catch (e) { console.warn('[AudioPoll] Poll failed:', e); }
                        }
                    }

                    if (audioAnswer.audioUrl) {
                        // Silence detection: skip AI if audio is silent (saves tokens)
                        let detectedSilent = false;
                        try {
                            const silenceCheckResp = await fetch(audioAnswer.audioUrl);
                            const silenceCheckBlob = await silenceCheckResp.blob();
                            detectedSilent = await isSilentAudio(silenceCheckBlob);
                        } catch (e) {
                            console.warn('[SilenceDetect] Pre-check failed, proceeding with AI grading:', e);
                        }

                        if (detectedSilent) {
                            // Skip AI call entirely for silent audio
                            console.log(`[SilenceDetect] Audio for question ${questionId} is silent — skipping AI, score: 0`);
                            score = 0;
                            isCorrect = false;
                            feedback = 'Không phát hiện giọng nói trong bản thu âm. Vui lòng thu âm lại câu trả lời.';
                        } else {
                        // Grade audio with retry (1 retry on failure)
                        let audioGraded = false;
                        for (let attempt = 0; attempt < 2 && !audioGraded; attempt++) {
                            try {
                                const audioResp = await fetch(audioAnswer.audioUrl);
                                const audioBlob = await audioResp.blob();
                                const sectionContext = sectionsMap[sectionId] || '';
                                const audioResult = await evaluateAudioAnswer(
                                    audioBlob,
                                    variation.text || variation.content || '',
                                    question.purpose || '',
                                    resolvedAudioSpecialReq,
                                    maxScore,
                                    sectionContext,
                                    finalTeacherTitle,
                                    finalStudentTitle,
                                    essayAudioIndex,
                                    questions.length,
                                    cefrLevel,
                                    question.useDefaultGradingCriteria !== false
                                );
                                essayAudioIndex++;
                                score = parseFloat(audioResult.score) || 0;
                                isCorrect = score >= (maxScore * 0.8);
                                feedback = audioResult.feedback || '';
                                // Save AI transcript back into answers for display
                                if (audioResult.transcript) {
                                    if (!answerUpdates[sectionId]) answerUpdates[sectionId] = {};
                                    answerUpdates[sectionId][questionId] = {
                                        ...answerData,
                                        answer: { ...audioAnswer, transcript: audioResult.transcript }
                                    };
                                }
                                audioGraded = true;
                            } catch (audioErr) {
                                console.error(`Audio grading attempt ${attempt + 1} failed for ${questionId}:`, audioErr);
                                if (attempt < 1) {
                                    await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
                                }
                            }
                        }
                        if (!audioGraded) {
                            // Both attempts failed — fallback
                            if (audioAnswer.aiScore !== undefined) {
                                score = parseFloat(audioAnswer.aiScore);
                                isCorrect = score >= (maxScore * 0.8);
                                feedback = audioAnswer.aiFeedback || '';
                            } else {
                                score = 0;
                                feedback = 'Lỗi khi chấm bài thu âm. Giáo viên sẽ chấm thủ công.';
                            }
                        }
                        } // end of !detectedSilent block
                    } else if (audioAnswer.aiScore !== undefined) {
                        const numericScore = parseFloat(audioAnswer.aiScore);
                        score = numericScore;
                        isCorrect = numericScore >= (maxScore * 0.8);
                        feedback = audioAnswer.aiFeedback || '';
                    } else {
                        score = 0;
                        feedback = audioAnswer.hasRecording
                            ? 'Bài thu âm chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công.'
                            : 'Học viên chưa thu âm câu trả lời.';
                    }
                }

                totalScore += score;
                // Preserve existing teacherOverride from previous grading (e.g. when teacher re-grades)
                const existingOverride = existingResults[questionId]?.teacherOverride || null;
                const resultEntry = { score, maxScore, isCorrect, feedback, teacherOverride: existingOverride };
                // Attach AI metadata for essay questions (used by skill analysis)
                if (typeof teacherNote === 'string' && teacherNote) resultEntry.teacherNote = teacherNote;
                if (Array.isArray(detectedErrors) && detectedErrors.length > 0) resultEntry.detectedErrors = detectedErrors;
                if (savedAiVerdicts) resultEntry.aiVerdicts = savedAiVerdicts;
                // If teacher already overrode the score, use the overridden score for totalScore calculation
                if (existingOverride && existingOverride.score !== undefined && existingOverride.score !== null) {
                    totalScore -= score; // remove the AI score we just added
                    totalScore += parseFloat(existingOverride.score) || 0;
                }
                results[questionId] = resultEntry;

                // ── Collect summary item for exam summary ──
                questionCounter++;
                const TYPE_LABELS = {
                    multiple_choice: 'Trắc nghiệm', matching: 'Ghép nối', categorization: 'Phân loại',
                    fill_in_blank: 'Điền từ', fill_in_blanks: 'Điền từ', fill_in_blank_typing: 'Điền từ (nhập)',
                    essay: 'Tự luận', audio_recording: 'Thu âm', ordering: 'Sắp xếp thứ tự'
                };
                const summaryItem = {
                    num: questionCounter,
                    typeName: TYPE_LABELS[question.type] || question.type,
                    purpose: question.purpose || '',
                    isCorrect,
                    score,
                    maxScore,
                    detectedErrors: resultEntry.detectedErrors || []
                };
                // Add context for wrong answers (truncated question text + answers)
                if (!isCorrect) {
                    const rawText = (variation.text || variation.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    summaryItem.questionText = rawText.slice(0, 150);
                    if (question.type === 'multiple_choice') {
                        summaryItem.studentAnswer = typeof answerData.answer === 'string' && answerData.answer.startsWith('http') ? '(hình ảnh)' : String(answerData.answer || '');
                        const correctOpt = variation.options?.[variation.correctAnswer];
                        summaryItem.correctAnswer = typeof correctOpt === 'string' && correctOpt.startsWith('http') ? '(đáp án hình ảnh)' : (correctOpt || '');
                    } else if (question.type === 'fill_in_blank' || question.type === 'fill_in_blanks' || question.type === 'fill_in_blank_typing') {
                        const markers = [...(variation.text || '').matchAll(/\{\{(.+?)\}\}/g)].map(m => m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '));
                        summaryItem.correctAnswer = markers.join(', ');
                        if (typeof answerData.answer === 'object' && answerData.answer !== null) {
                            summaryItem.studentAnswer = Object.values(answerData.answer).join(', ');
                        }
                    } else if (question.type === 'ordering') {
                        summaryItem.studentAnswer = (Array.isArray(answerData.answer) ? answerData.answer : []).join(' → ');
                        summaryItem.correctAnswer = (variation.items || []).join(' → ');
                    } else if (question.type === 'matching') {
                        const wrongPairs = (variation.pairs || []).filter((pair, i) => answerData.answer?.[i]?.text !== pair.right);
                        if (wrongPairs.length > 0) {
                            summaryItem.studentAnswer = wrongPairs.map(p => `"${p.left}" → sai`).join('; ');
                            summaryItem.correctAnswer = wrongPairs.map(p => `"${p.left}" ↔ "${p.right}"`).join('; ');
                        }
                    } else if (question.type === 'categorization') {
                        const wrongItems = (variation.items || []).filter(item => (answerData.answer || {})[item.text] !== item.group);
                        if (wrongItems.length > 0) {
                            summaryItem.studentAnswer = wrongItems.map(item => `"${item.text}" → "${(answerData.answer || {})[item.text] || '?'}"`).join('; ');
                            summaryItem.correctAnswer = wrongItems.map(item => `"${item.text}" → "${item.group}"`).join('; ');
                        }
                    }
                    // essay/audio: questionText is enough, AI already has detectedErrors
                }
                summaryItems.push(summaryItem);

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
            // Check if there's an existing answer with hasRecording but no audioUrl
            let unansweredFeedback = '';
            if (question.type === 'audio_recording') {
                // Check all sections for this question's answer
                for (const sec of (sections || [])) {
                    const qAnswer = submission.answers?.[sec.id]?.[question.id]?.answer;
                    if (qAnswer?.hasRecording) {
                        unansweredFeedback = 'Bài thu âm chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công.';
                        break;
                    }
                }
            }
            // Preserve existing teacherOverride for unanswered questions too
            const existingOverride = existingResults[question.id]?.teacherOverride || null;
            const unansweredScore = existingOverride?.score !== undefined ? parseFloat(existingOverride.score) || 0 : 0;
            if (existingOverride?.score !== undefined) totalScore += unansweredScore;
            results[question.id] = {
                score: 0,
                maxScore: question.points || 1,
                isCorrect: false,
                feedback: unansweredFeedback,
                teacherOverride: existingOverride
            };
        }
    }

    // Round to avoid floating point precision issues (e.g. 6.99999999999999 → 7)
    totalScore = Math.round(totalScore * 10) / 10;

    // Auto-release if no AI grading was used (all questions were self-graded)
    const isFullyAutoGraded = !usedAI;

    // Update submission with results
    // Merge AI transcript updates into submission answers
    const updatedAnswers = { ...submission.answers };
    for (const [secId, qUpdates] of Object.entries(answerUpdates)) {
        updatedAnswers[secId] = { ...updatedAnswers[secId], ...qUpdates };
    }

    // Summary is NOT auto-generated — teachers create it manually after reviewing/adjusting scores
    const examSummary = '';

    const updateData = {
        results,
        totalScore,
        maxTotalScore,
        answers: updatedAnswers,
        status: 'graded',
        gradedAt: nowIso(),
        updatedAt: nowIso(),
        examSummary
    };

    // Auto-release if all questions are auto-graded
    if (isFullyAutoGraded) {
        updateData.resultsReleased = true;
        updateData.releasedAt = nowIso();
        updateData.releasedBy = 'system';
        updateData.releasedByName = 'Hệ thống (tự động)';
    }

    await examSubmissionsService.update(submissionId, updateData);

    // Send auto-release notifications
    if (isFullyAutoGraded) {
        try {
            const subData = await getSubmissionRecord(submissionId);
            if (subData) {
                const studentId = subData.studentId;
                const assignmentId = subData.assignmentId;

                let examName = 'Bài tập và Kiểm tra';
                let targetId = null;

                if (assignmentId) {
                    const asgnData = await getAssignmentRecord(assignmentId);
                    if (asgnData) {
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
                    const studentData = await getUserRecord(studentId);
                    if (studentData?.email) {
                        const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
                        await queueEmail(studentData.email, {
                            subject: `Bài "${examName}" đã có kết quả${scoreText ? ` — ${scoreText} điểm` : ''}`,
                            html: buildEmailHtml({
                                emoji: '📊', heading: 'Kết quả đã sẵn sàng!', headingColor: '#10b981',
                                greeting: 'Chào bạn 👋',
                                body: `<p>Bài <strong>"${examName}"</strong> đã được chấm tự động.${scoreText ? ` Điểm: <strong style="color:#10b981;font-size:1.1rem;">${scoreText}</strong>.` : ''} Vào xem kết quả chi tiết ngay nhé!</p>`,
                                highlight: `<strong style="color:#1e293b;font-size:1.05rem;">${examName}</strong>${scoreText ? `<br/><span style="font-size:1.3rem;font-weight:900;color:#10b981;">${scoreText}</span> <span style="color:#64748b;font-size:0.85rem;">điểm</span>` : ''}`,
                                highlightBg: '#f0fdf4', highlightBorder: '#10b981',
                                ctaText: 'Xem kết quả ngay', ctaLink: `${appUrl}/exam-result?submissionId=${submissionId}`, ctaColor: '#10b981', ctaColor2: '#34d399'
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
 * Re-grade a SINGLE question by AI (essay or audio_recording only).
 * Updates the result for that question in Firestore without re-grading the entire exam.
 */
export async function gradeSingleQuestion(submissionId, questionId, question, sections = [], teacherTitle = '', studentTitle = '') {
    const submission = await getSubmissionRecord(submissionId);
    if (!submission) throw new Error('Submission not found');

    // Find which section this question belongs to
    let sectionId = null;
    let answerData = null;
    for (const [secId, secAnswers] of Object.entries(submission.answers || {})) {
        if (secAnswers[questionId]) {
            sectionId = secId;
            answerData = secAnswers[questionId];
            break;
        }
    }

    if (!sectionId || !answerData) {
        throw new Error('Không tìm thấy câu trả lời cho câu hỏi này.');
    }

    // Resolve teacher/student titles
    let finalTeacherTitle = teacherTitle;
    let finalStudentTitle = studentTitle;
    let cefrLevel = '';
    if (!finalTeacherTitle && submission.examId) {
        try {
            const examData = await getExamRecord(submission.examId);
            if (examData) {
                cefrLevel = examData.cefrLevel || '';
                if (examData.teacherTitle) {
                    finalTeacherTitle = examData.teacherTitle;
                    if (examData.studentTitle) finalStudentTitle = examData.studentTitle;
                }
            }
        } catch (err) { console.warn('Could not fetch teacher titles:', err); }
    }

    // Build section context map
    const sectionsMap = {};
    (sections || []).forEach(s => {
        if (s?.id) {
            let fullContext = s.context || '';
            if (s.contextScript) fullContext += `\n\n[SCRIPT / TRANSCRIPT CỦA BÀI NGHE/VIDEO]:\n${s.contextScript}`;
            sectionsMap[s.id] = fullContext;
        }
    });

    // Resolve variation
    const variationIndex = submission.variationMap?.[questionId] || 0;
    let variation = question.variations?.[variationIndex];
    if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, '').trim().length === 0))) {
        variation = question.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, '').trim().length > 0)) || question.variations?.[0];
    }
    if (!variation) throw new Error('Không tìm thấy nội dung câu hỏi.');

    const maxScore = question.points || 1;
    const sectionContext = sectionsMap[sectionId] || '';
    let score = 0;
    let isCorrect = false;
    let feedback = '';
    let teacherNote = '';
    let detectedErrors = [];
    let answerUpdates = null;

    // Resolve prompt
    let resolvedSpecialReq = question.specialRequirement || '';
    if (question.promptId) {
        try {
            const linkedPrompt = await getPromptById(question.promptId);
            if (linkedPrompt) {
                resolvedSpecialReq = resolvedSpecialReq
                    ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${resolvedSpecialReq}`
                    : linkedPrompt.content;
            }
        } catch (e) { console.warn('Could not resolve linked prompt:', e); }
    }

    if (question.type === 'essay') {
        const gradeResult = await gradeGrammarSubmissionWithAI(
            variation.text || variation.content,
            answerData.answer,
            question.purpose,
            question.type,
            resolvedSpecialReq,
            sectionContext,
            finalTeacherTitle, finalStudentTitle,
            0, [], 1, cefrLevel, maxScore,
            question.useDefaultGradingCriteria !== false
        );
        score = Math.min(Math.round((parseFloat(gradeResult.score) || 0) * 10) / 10, maxScore);
        isCorrect = score >= (maxScore * 0.8);
        feedback = gradeResult.feedback || '';
        teacherNote = gradeResult.teacherNote || '';
        detectedErrors = Array.isArray(gradeResult.detectedErrors) ? gradeResult.detectedErrors : [];
    } else if (question.type === 'audio_recording') {
        const audioAnswer = answerData.answer || {};
        if (!audioAnswer.audioUrl) throw new Error('Không có file thu âm. Học viên chưa upload audio.');

        const audioResp = await fetch(audioAnswer.audioUrl);
        const audioBlob = await audioResp.blob();

        // Silence detection: skip AI if audio is silent (saves tokens)
        const detectedSilent = await isSilentAudio(audioBlob).catch(() => false);
        if (detectedSilent) {
            score = 0;
            isCorrect = false;
            feedback = 'Không phát hiện giọng nói trong bản thu âm. Vui lòng thu âm lại câu trả lời.';
        } else {
        const audioResult = await evaluateAudioAnswer(
            audioBlob,
            variation.text || variation.content || '',
            question.purpose || '',
            resolvedSpecialReq,
            maxScore,
            sectionContext,
            finalTeacherTitle, finalStudentTitle,
            0, [], 1, cefrLevel,
            question.useDefaultGradingCriteria !== false
        );
        score = parseFloat(audioResult.score) || 0;
        isCorrect = score >= (maxScore * 0.8);
        feedback = audioResult.feedback || '';
        if (audioResult.transcript) {
            answerUpdates = {
                ...answerData,
                answer: { ...audioAnswer, transcript: audioResult.transcript }
            };
        }
        } // end of !detectedSilent block
    } else {
        throw new Error('Chỉ hỗ trợ chấm lại câu tự luận và thu âm.');
    }

    // Build the updated result entry (preserve existing teacherOverride)
    const existingResult = submission.results?.[questionId] || {};
    const resultEntry = {
        score, maxScore, isCorrect, feedback,
        teacherOverride: existingResult.teacherOverride || null
    };
    if (teacherNote) resultEntry.teacherNote = teacherNote;
    if (detectedErrors.length > 0) resultEntry.detectedErrors = detectedErrors;

    // Recalculate totalScore
    const allResults = { ...submission.results, [questionId]: resultEntry };
    let newTotalScore = 0;
    for (const [qId, r] of Object.entries(allResults)) {
        const effectiveScore = r.teacherOverride?.score !== undefined && r.teacherOverride?.score !== null
            ? parseFloat(r.teacherOverride.score) || 0
            : (r.score || 0);
        newTotalScore += effectiveScore;
    }
    newTotalScore = Math.round(newTotalScore * 10) / 10;

    // Update Firestore atomically
    const updateData = {
        [`results.${questionId}`]: resultEntry,
        totalScore: newTotalScore,
        updatedAt: nowIso()
    };
    // Save AI transcript if available
    if (answerUpdates) {
        updateData[`answers.${sectionId}.${questionId}`] = answerUpdates;
    }
    // Set status to graded if still submitted
    if (submission.status === 'submitted') {
        updateData.status = 'graded';
        updateData.gradedAt = nowIso();
    }

    await examSubmissionsService.update(submissionId, updateData);

    return resultEntry;
}


/**
 * Teacher overrides the AI score and/or feedback for a specific question in a submission.
 */
export async function overrideExamQuestionScore(submissionId, questionId, newScore, note, newFeedback, teacherUid, overriderName = 'Giáo viên') {
    const submissionRes = await examSubmissionsService.findOne(submissionId);
    const data = submissionRes?.data || submissionRes;
    if (!data) throw new Error('Submission not found');

    const results = { ...(data.results || {}) };
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
    if (newFeedback !== undefined) results[questionId].feedback = newFeedback;

    const newTotalScore = Math.round(((data.totalScore || 0) + scoreDiff) * 10) / 10;

    await examSubmissionsService.update(submissionId, {
        results,
        totalScore: newTotalScore,
        examSummary: ''
    });

    return { results, totalScore: newTotalScore };
}

/**
 * Releases results for a submission so the student can view them.
 */
export async function releaseExamSubmissionResults(submissionId, releaserUid, releaserName = 'Giáo viên') {
    // Backend handles the release update + optional notification via the /release endpoint
    await examSubmissionsService.release(submissionId, {
        releasedBy: releaserUid,
        releasedByName: releaserName,
    });
}

// ========== EXAM FOLDERS ==========

export async function getExamFolders() {
    try {
        const result = await adminFoldersService.getExamFolders();
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (e) {
        console.error("Error fetching admin exam folders:", e);
        return [];
    }
}

export async function saveExamFolder(folderData) {
    try {
        await adminFoldersService.saveExamFolder(folderData);
    } catch (error) {
        console.error("Error saving admin exam folder:", error);
    }
}

export async function updateExamFoldersOrder(orderedFolders) {
    try {
        await adminFoldersService.reorderExamFolders(orderedFolders.map((f, i) => ({ id: f.id, order: i })));
    } catch (error) {
        console.error("Error updating admin exam folders order:", error);
    }
}

export async function deleteExamFolder(folderId) {
    try {
        await adminFoldersService.deleteExamFolder(folderId);
    } catch (error) {
        console.error("Error deleting admin exam folder:", error);
    }
}

// ========== TEACHER EXAM FOLDERS ==========

export async function getTeacherExamFolders(teacherId) {
    if (!teacherId) return [];
    try {
        const result = await teacherFoldersService.getExamFolders(teacherId);
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error("Error fetching teacher exam folders:", error);
        return [];
    }
}

export async function getAllTeacherExamFolders() {
    try {
        const result = await teacherFoldersService.getAllExamFolders();
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error("Error fetching all teacher exam folders:", error);
        return [];
    }
}

export async function saveTeacherExamFolder(teacherId, folderData) {
    const dataToSave = { ...folderData, teacherId };
    try {
        const result = await teacherFoldersService.saveExamFolder(dataToSave);
        return result?.id || result?._id || result;
    } catch (error) {
        console.error("Error saving teacher exam folder:", error);
        throw error;
    }
}

export async function deleteTeacherExamFolder(folderId) {
    try {
        await teacherFoldersService.softDeleteExamFolder(folderId);
    } catch (error) {
        console.error("Error deleting teacher exam folder:", error);
        throw error;
    }
}

export async function updateTeacherExamFoldersOrder(orderedFolders) {
    try {
        await teacherFoldersService.reorderExamFolders(orderedFolders.map((f, i) => ({ id: f.id, order: i })));
    } catch (error) {
        console.error("Error updating teacher exam folders order:", error);
    }
}

export async function restoreTeacherExamFolder(folderId) {
    try {
        await teacherFoldersService.restoreExamFolder(folderId);
    } catch (error) {
        console.error("Error restoring teacher exam folder:", error);
        throw error;
    }
}

export async function permanentlyDeleteTeacherExamFolder(folderId) {
    try {
        await teacherFoldersService.permanentDeleteExamFolder(folderId);
    } catch (error) {
        console.error("Error permanently deleting teacher exam folder:", error);
        throw error;
    }
}

export async function getDeletedTeacherExamFolders(teacherId) {
    try {
        const result = await teacherFoldersService.getDeletedExamFolders(teacherId);
        const folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching deleted teacher exam folders:", error);
        return [];
    }
}

// ========== SHARING (Admin) ==========

export async function toggleExamPublic(examId, isPublic) {
    const { sharingService } = await import('../models');
    await sharingService.togglePublic({ resourceType: 'exam', resourceId: examId, isPublic });
}

export async function shareExamToTeacher(examId, teacherUid) {
    const { sharingService } = await import('../models');
    await sharingService.addTeacherShare({ resourceType: 'exam', resourceId: examId, teacherId: teacherUid });
}

export async function unshareExamFromTeacher(examId, teacherUid) {
    const { sharingService } = await import('../models');
    await sharingService.removeTeacherShare({ resourceType: 'exam', resourceId: examId, teacherId: teacherUid });
}

/**
 * Check if ≥50% of students have submitted for an exam assignment.
 * If so (and not already notified), send a one-time in-app + email notification to group teachers.
 * This is a fire-and-forget helper — errors are caught internally.
 *
 * @param {string} assignmentId
 * @param {string} groupId
 * @param {string} examName
 * @param {string} examType  'test' | 'exercise'
 */
export async function checkAndNotifyHalfSubmitted(assignmentId, groupId, examName, examType) {
    if (!assignmentId || !groupId) return;
    try {
        // 1. Get assignment to check flag
        const asgnRes = await examAssignmentsService.findOne(assignmentId);
        const aData = asgnRes?.data || asgnRes;
        if (!aData || aData.halfSubmittedNotified) return;

        // 2. Count finished submissions via backend
        const subsRes = await examSubmissionsService.findByAssignment(assignmentId);
        const subs = Array.isArray(subsRes) ? subsRes : (subsRes?.data || []);
        const submittedCount = subs.filter(s => s.status === 'submitted' || s.status === 'graded').length;

        // 3. Determine total expected students
        let totalStudents = 0;
        if (aData.assignedStudentIds?.length > 0) {
            totalStudents = aData.assignedStudentIds.length;
        } else {
            const { usersService } = await import('../models');
            const usersRes = await usersService.findAll({ groupId, role: 'user' });
            const users = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
            totalStudents = users.length;
        }

        if (totalStudents <= 0) return;

        // 4. Check threshold (≥50%)
        const threshold = Math.ceil(totalStudents * 0.5);
        if (submittedCount < threshold) return;

        // 5. Set flag via backend
        await examAssignmentsService.update(assignmentId, { halfSubmittedNotified: true });

        // 6. Send notifications (notification service is still wired)
        const typeLabel = examType === 'test' ? 'bài kiểm tra' : 'bài tập';
        const { createNotificationForGroupTeachers } = await import('./notificationService');
        await createNotificationForGroupTeachers(groupId, {
            type: 'half_submitted',
            title: '📊 50% học viên đã nộp bài',
            message: `Đã có ${submittedCount}/${totalStudents} học viên nộp ${typeLabel} "${examName}".`,
            link: `/teacher/exam-submissions/${assignmentId}`
        });

        console.log(`[HalfSubmitted] Notified teachers: ${submittedCount}/${totalStudents} for assignment ${assignmentId}`);
    } catch (error) {
        console.error('Error in checkAndNotifyHalfSubmitted:', error);
    }
}

// ========== FOLLOW-UP ANSWERS ==========

/**
 * Toggle follow-up request for a specific question.
 * Teacher requests the student to re-answer a question.
 */
export async function toggleFollowUpRequest(submissionId, questionId, teacherUid, teacherName, enable = true) {
    if (enable) {
        await examSubmissionsService.update(submissionId, {
            [`followUpRequested.${questionId}`]: {
                requestedAt: new Date().toISOString(),
                requestedBy: teacherUid,
                requestedByName: teacherName
            }
        });
    } else {
        // Send null to trigger $unset on the backend
        await examSubmissionsService.update(submissionId, {
            [`followUpRequested.${questionId}`]: null
        });
    }
}

/**
 * Save a follow-up answer from the student.
 */
export async function saveFollowUpAnswer(submissionId, sectionId, questionId, answer) {
    await examSubmissionsService.update(submissionId, {
        [`followUpAnswers.${sectionId}.${questionId}`]: {
            answer,
            submittedAt: new Date().toISOString()
        }
    });
}

/**
 * Save ALL follow-up answers at once (batch submit).
 * @param {string} submissionId
 * @param {Array<{sectionId, questionId, answer}>} answers
 */
export async function saveAllFollowUpAnswers(submissionId, answers) {
    const updates = {};
    const now = new Date().toISOString();
    for (const { sectionId, questionId, answer } of answers) {
        updates[`followUpAnswers.${sectionId}.${questionId}`] = { answer, submittedAt: now };
    }
    await examSubmissionsService.update(submissionId, updates);
}

/**
 * Hydrate a follow-up audio answer with a transcript.
 * Fetches the audio from the stored URL, transcribes it, saves the transcript back,
 * and returns the transcript string so the UI can display it immediately.
 */
export async function hydrateFollowUpAudioTranscript(submissionId, sectionId, questionId, question, sections = [], teacherTitle = 'thầy/cô', studentTitle = 'em') {
    const submission = await getSubmissionRecord(submissionId);
    if (!submission) throw new Error('Submission not found');

    // Resolve teacher/student titles from exam if not provided
    let finalTeacherTitle = teacherTitle;
    let finalStudentTitle = studentTitle;
    if ((!finalTeacherTitle || finalTeacherTitle === 'thầy/cô') && submission.examId) {
        try {
            const examData = await getExamRecord(submission.examId);
            if (examData) {
                if (examData.teacherTitle) {
                    finalTeacherTitle = examData.teacherTitle;
                    if (examData.studentTitle) finalStudentTitle = examData.studentTitle;
                } else if (examData.createdBy) {
                    const userData = await getUserRecord(examData.createdBy);
                    if (userData) {
                        if (userData.teacherTitle) finalTeacherTitle = userData.teacherTitle;
                        if (userData.studentTitle) finalStudentTitle = userData.studentTitle;
                    }
                }
            }
        } catch (err) {
            console.warn('Could not fetch teacher titles for follow-up transcript:', err);
        }
    }

    const followUpAnswerData = submission.followUpAnswers?.[sectionId]?.[questionId];
    const answer = followUpAnswerData?.answer;
    if (!followUpAnswerData || !answer?.audioUrl || answer?.transcript) {
        return answer?.transcript || '';
    }

    const varIdx = submission.variationMap?.[questionId] || 0;
    const variation = question.variations?.[varIdx] || question.variations?.[0];
    if (!variation) return '';

    let sectionContext = '';
    (sections || []).forEach(s => {
        if (s.id === sectionId) {
            sectionContext = s.context || '';
            if (s.contextScript) sectionContext += `\n\n[SCRIPT]:\n${s.contextScript}`;
        }
    });

    let gradingCriteria = question.specialRequirement || '';
    if (question.promptId) {
        try {
            const linkedPrompt = await getPromptById(question.promptId);
            if (linkedPrompt) {
                gradingCriteria = gradingCriteria
                    ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${gradingCriteria}`
                    : linkedPrompt.content;
            }
        } catch (e) {
            console.warn('Could not resolve linked prompt for follow-up transcript:', e);
        }
    }

    const maxScore = submission.results?.[questionId]?.maxScore ?? question.points ?? 1;

    // Transcribe the audio answer
    let transcript = '';
    try {
        const audioResp = await fetch(answer.audioUrl);
        const audioBlob = await audioResp.blob();
        const detectedSilent = await isSilentAudio(audioBlob).catch(() => false);
        if (!detectedSilent) {
            const audioResult = await evaluateAudioAnswer(
                audioBlob,
                variation,
                question.purpose || '',
                gradingCriteria,
                maxScore,
                sectionContext,
                finalTeacherTitle,
                finalStudentTitle,
                0,
                1,
                '',
                question.useDefaultGradingCriteria !== false
            );
            transcript = audioResult.transcript || '';
        }
    } catch (err) {
        console.warn('Could not transcribe follow-up audio:', err);
        return '';
    }

    if (!transcript) return '';

    const updates = {
        [`followUpAnswers.${sectionId}.${questionId}`]: {
            ...followUpAnswerData,
            answer: { ...answer, transcript }
        },
        updatedAt: nowIso()
    };

    if (submission.followUpResults?.[questionId]) {
        updates[`followUpResults.${questionId}.transcript`] = transcript;
    }

    await examSubmissionsService.update(submissionId, updates);
    return transcript;
}

/**

 * Grade a follow-up answer using AI.
 * References the original answer, score, and feedback for better contextual grading.
 */
export async function gradeFollowUpAnswer(submissionId, questionId, question, sections = [], teacherTitle = 'thầy/cô', studentTitle = 'em') {
    const submission = await getSubmissionRecord(submissionId);
    if (!submission) throw new Error('Submission not found');

    const originalResult = submission.results?.[questionId];
    const sectionId = question.sectionId;
    const followUpAnswerData = submission.followUpAnswers?.[sectionId]?.[questionId];
    if (!followUpAnswerData) throw new Error('No follow-up answer found');

    const varIdx = submission.variationMap?.[questionId] || 0;
    let variation = question.variations?.[varIdx] || question.variations?.[0];
    if (!variation) throw new Error('No variation found');

    // Build section context
    let sectionContext = '';
    (sections || []).forEach(s => {
        if (s.id === sectionId) {
            sectionContext = s.context || '';
            if (s.contextScript) sectionContext += `\n\n[SCRIPT]:\n${s.contextScript}`;
        }
    });

    // Use the original result's maxScore as the canonical total, so the follow-up
    // score matches the original grading scale.  Fall back to question.points for
    // question types that don't inflate (MC, ordering, essay).
    const originalMaxScore = originalResult?.maxScore ?? (question.points || 1);
    let maxScore = originalMaxScore;

    // For objective question types, auto-grade without AI
    const answer = followUpAnswerData.answer;
    let score = 0;
    let isCorrect = false;
    let feedback = '';

    if (question.type === 'multiple_choice') {
        const correctAnswerText = variation.options?.[variation.correctAnswer];
        isCorrect = answer === correctAnswerText;
        score = isCorrect ? maxScore : 0;
        feedback = isCorrect ? 'Chính xác! Bạn đã sửa đúng rồi! 🎉' : `Vẫn chưa đúng. Đáp án đúng là: ${correctAnswerText}`;
    } else if (question.type === 'fill_in_blank' || question.type === 'fill_in_blanks' || question.type === 'fill_in_blank_typing') {
        const markerRegex = /\{\{(.+?)\}\}/g;
        const correctWords = [];
        let mm;
        while ((mm = markerRegex.exec(variation.text || '')) !== null) {
            correctWords.push(mm[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '));
        }
        const numBlanks = correctWords.length || 1;
        const perBlankScore = maxScore / numBlanks;
        if (correctWords.length > 0 && typeof answer === 'object' && answer !== null) {
            let correctCount = 0;
            correctWords.forEach((cw, idx) => {
                const sw = answer[String(idx)];
                if (typeof sw === 'string' && normalizeForComparison(sw) === normalizeForComparison(cw)) correctCount++;
            });
            score = Math.round(correctCount * perBlankScore * 10) / 10;
            isCorrect = correctCount === correctWords.length;
            feedback = isCorrect ? 'Tuyệt vời! Bạn đã sửa đúng tất cả! 🎉' : `Bạn đã điền đúng ${correctCount}/${correctWords.length} chỗ trống.`;
        } else {
            isCorrect = typeof answer === 'string' && answer.trim().toLowerCase() === variation.correctAnswer?.trim().toLowerCase();
            score = isCorrect ? maxScore : 0;
            feedback = isCorrect ? 'Chính xác! 🎉' : `Đáp án đúng: ${variation.correctAnswer}`;
        }
    } else if (question.type === 'matching') {
        const pairs = variation.pairs || [];
        const numPairs = pairs.length || 1;
        const perPairScore = maxScore / numPairs;
        let correctCount = 0;
        pairs.forEach((pair, i) => { if (answer?.[i]?.text === pair.right) correctCount++; });
        score = Math.round(correctCount * perPairScore * 10) / 10;
        isCorrect = correctCount === pairs.length;
        feedback = isCorrect ? 'Tuyệt vời! Ghép đúng tất cả! 🎉' : `Bạn đã ghép đúng ${correctCount}/${pairs.length} cặp.`;
    } else if (question.type === 'categorization') {
        const items = variation.items || [];
        const numItems = items.length || 1;
        const perItemScore = maxScore / numItems;
        let correctCount = 0;
        items.forEach(item => { if (answer?.[item.text] === item.group) correctCount++; });
        score = Math.round(correctCount * perItemScore * 10) / 10;
        isCorrect = correctCount === items.length;
        feedback = isCorrect ? 'Phân loại chính xác! 🎉' : `Bạn đã phân loại đúng ${correctCount}/${items.length} mục.`;
    } else if (question.type === 'ordering') {
        const correctItems = variation.items || [];
        const isAllCorrect = Array.isArray(answer) && correctItems.every((item, i) => answer[i] === item);
        isCorrect = isAllCorrect;
        score = isCorrect ? maxScore : 0;
        feedback = isCorrect ? 'Sắp xếp chính xác! 🎉' : 'Thứ tự vẫn chưa đúng.';
    } else if (question.type === 'essay' || question.type === 'short_answer' || question.type === 'audio_recording') {
        // AI grading for subjective types — reference original mistakes
        const TYPE_LABELS = {
            essay: 'Tự luận', short_answer: 'Trả lời ngắn', audio_recording: 'Thu âm'
        };

        const originalScore = originalResult?.teacherOverride?.score ?? originalResult?.score ?? 0;
        const originalMaxScore = originalResult?.maxScore ?? maxScore;
        const originalFeedback = originalResult?.feedback || '';
        const originalAnswer = (() => {
            const origAns = submission.answers?.[sectionId]?.[questionId]?.answer;
            if (typeof origAns === 'string') return origAns;
            if (typeof origAns === 'object' && origAns?.transcript) return origAns.transcript;
            return JSON.stringify(origAns || '');
        })();

        // Resolve grading criteria from specialRequirement + linked prompt
        let gradingCriteria = question.specialRequirement || '';
        if (question.promptId) {
            try {
                const linkedPrompt = await getPromptById(question.promptId);
                if (linkedPrompt) {
                    gradingCriteria = gradingCriteria
                        ? `${linkedPrompt.content}\n\nYÊU CẦU BỔ SUNG:\n${gradingCriteria}`
                        : linkedPrompt.content;
                }
            } catch (e) { console.warn('Could not resolve linked prompt for follow-up:', e); }
        }

        const questionText = (variation.text || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
        const followUpText = typeof answer === 'string' ? answer : (answer?.transcript || JSON.stringify(answer || ''));

        const systemPrompt = `Bạn là giáo viên tiếng Anh đang chấm BÀI SỬA (lần 2) của học viên. Gọi học viên bằng "${studentTitle}".

Học viên đã làm bài lần 1 và bị sai/mất điểm. Sau khi xem nhận xét, học viên đã sửa lại câu trả lời. Nhiệm vụ của bạn:

1. Đánh giá bài sửa DỰA TRÊN CÙNG TIÊU CHÍ CHẤM BÀI GỐC (xem phần TIÊU CHÍ CHẤM ĐIỂM bên dưới)
2. So sánh bài sửa với bài gốc — học viên đã khắc phục được lỗi cũ chưa?
3. Chấm điểm bài sửa trên thang ${maxScore} điểm
4. Nhận xét cụ thể: điểm cải thiện, lỗi còn tồn tại (nếu có)
5. Động viên nếu có tiến bộ

Trả về JSON duy nhất (không markdown, không code block):
{"score": number, "feedback": "nhận xét bằng tiếng Việt", "isCorrect": boolean}`;

        // Gather teacher's correction notes (only what student actually saw)
        const teacherOverrideNote = originalResult?.teacherOverride?.note || '';
        const teacherOverrideFeedback = originalResult?.teacherOverride?.feedback || '';
        const teacherCorrections = [
            teacherOverrideNote && `GV: ${teacherOverrideNote}`,
            teacherOverrideFeedback && `Nhận xét GV: ${teacherOverrideFeedback}`
        ].filter(Boolean).join('\n');

        const userContent = `CÂU HỎI (${TYPE_LABELS[question.type] || question.type}): ${questionText}
${question.purpose ? `MỤC ĐÍCH: ${question.purpose}` : ''}
${sectionContext ? `NGỮ CẢNH: ${sectionContext.replace(/<[^>]*>/g, ' ')}` : ''}
${gradingCriteria ? `\nTIÊU CHÍ CHẤM:\n${gradingCriteria}` : ''}

LẦN 1: ${originalScore}/${originalMaxScore}
Nhận xét: "${originalFeedback}"
${teacherCorrections ? `${teacherCorrections}` : ''}

BÀI SỬA: "${followUpText}"

Điểm tối đa: ${maxScore}`;

        try {
            const response = await chatCompletion({ systemPrompt, userContent });
            const text = typeof response === 'string' ? response : (response?.text || response?.content || '');
            const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            score = Math.min(Math.max(0, parsed.score || 0), maxScore);
            score = Math.round(score * 10) / 10;
            feedback = parsed.feedback || '';
            isCorrect = parsed.isCorrect || score >= maxScore;
        } catch (err) {
            console.error('AI follow-up grading error:', err);
            feedback = 'Lỗi khi AI chấm bài sửa. Giáo viên sẽ chấm thủ công.';
            score = 0;
        }
    }

    // Save follow-up results (does NOT affect original totalScore)
    await examSubmissionsService.update(submissionId, {
        [`followUpResults.${questionId}`]: {
            score,
            maxScore,
            feedback,
            isCorrect,
            gradedAt: new Date().toISOString()
        },
        updatedAt: nowIso()
    });

    return { score, maxScore, feedback, isCorrect };
}

/**
 * Teacher overrides a follow-up question score/feedback.
 */
export async function overrideFollowUpScore(submissionId, questionId, newScore, note, newFeedback, teacherUid, overriderName = 'Giáo viên') {
    const submissionRes = await examSubmissionsService.findOne(submissionId);
    const data = submissionRes?.data || submissionRes;
    if (!data) throw new Error('Submission not found');

    const currentResult = data.followUpResults?.[questionId];
    if (!currentResult) throw new Error('Follow-up result not found');

    const updatedResult = {
        ...currentResult,
        teacherOverride: {
            score: newScore,
            note,
            overriddenBy: teacherUid,
            overriddenByName: overriderName,
            overriddenAt: new Date().toISOString()
        }
    };
    if (newFeedback !== undefined) updatedResult.feedback = newFeedback;

    await examSubmissionsService.update(submissionId, {
        [`followUpResults.${questionId}`]: updatedResult
    });

    return updatedResult;
}

/**
 * Release follow-up results so the student can see them.
 */
export async function releaseFollowUpResults(submissionId, releaserUid, releaserName = 'Giáo viên') {
    // Backend handles the release flag update via the /release-follow-up endpoint
    await examSubmissionsService.releaseFollowUp(submissionId, {
        releasedBy: releaserUid,
        releasedByName: releaserName,
    });
}
