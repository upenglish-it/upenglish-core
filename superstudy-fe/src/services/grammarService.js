import { grammarExercisesService, grammarQuestionsService, grammarSubmissionsService } from '../models';
import { deleteQuestionImages, deleteContextImages } from './examService';
import { deleteContextAudio } from './contextAudioService';

// --- QUESTION COUNTS ---

export async function getGrammarQuestionCounts(exerciseIds) {
    // Use the exam-questions-style count endpoint if available, or fetch per-exercise
    const counts = {};
    await Promise.all(exerciseIds.map(async (exId) => {
        try {
            const questions = await grammarQuestionsService.findAll(exId);
            const list = Array.isArray(questions) ? questions : (questions?.data || []);
            counts[exId] = list.length;
        } catch (e) {
            console.error(`Error counting questions for exercise ${exId}:`, e);
            counts[exId] = 0;
        }
    }));
    return counts;
}

export async function recalcGrammarQuestionCache(exerciseId) {
    try {
        // Backend should handle this — trigger via update
        await grammarExercisesService.update(exerciseId, { _recalcQuestionCount: true });
    } catch (e) {
        console.error(`Error recalculating grammar question cache for ${exerciseId}:`, e);
    }
}

// --- EXERCISES ---

export async function getGrammarExercises(teacherId = null) {
    const result = await grammarExercisesService.findAll();
    let exercises = Array.isArray(result) ? result : (result?.data || []);
    exercises = exercises
        .map(e => ({ ...e, id: e._id || e.id }))
        .filter(e => !e.isDeleted)
        .filter(e => teacherId ? e.teacherId === teacherId : true);
    return exercises.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function getSharedAndPublicGrammarExercises(grammarAccessIds = []) {
    const result = await grammarExercisesService.findShared(grammarAccessIds);
    let exercises = Array.isArray(result) ? result : (result?.data || []);
    exercises = exercises.map(e => ({ ...e, id: e._id || e.id }));
    return exercises.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function getGrammarExercise(id) {
    const result = await grammarExercisesService.findOne(id);
    return result ? { ...result, id: result._id || result.id } : null;
}

export async function saveGrammarExercise(exerciseData) {
    const { id, _id, ...data } = exerciseData;
    const targetId = id || _id;
    
    if (!data.targetLevel) delete data.targetLevel;
    if (!data.cefrLevel) delete data.cefrLevel;
    
    if (targetId) {
        try {
            await grammarExercisesService.update(targetId, data);
            return targetId;
        } catch (e) {
            const result = await grammarExercisesService.create({ _id: targetId, ...data });
            return result?.id || result?._id || result;
        }
    } else {
        const result = await grammarExercisesService.create(data);
        return result?.id || result?._id || result;
    }
}

export async function deleteGrammarExercise(id) {
    await grammarExercisesService.softDelete(id);
}

export async function restoreGrammarExercise(id) {
    await grammarExercisesService.restore(id);
}

export async function permanentlyDeleteGrammarExercise(id) {
    // Backend handles cascade deletion of questions, images, audio
    await grammarExercisesService.permanentDelete(id);
}

export async function getDeletedGrammarExercises() {
    try {
        const result = await grammarExercisesService.findDeleted();
        let exercises = Array.isArray(result) ? result : (result?.data || []);
        exercises = exercises.map(e => ({ ...e, id: e._id || e.id }));
        return exercises.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching deleted grammar exercises:", error);
        return [];
    }
}

// --- QUESTIONS ---

export async function getGrammarQuestions(exerciseId) {
    const result = await grammarQuestionsService.findAll(exerciseId);
    let questions = Array.isArray(result) ? result : (result?.data || []);
    questions = questions.map(q => ({ ...q, id: q._id || q.id }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getGrammarQuestionsByIds(questionIds = []) {
    if (!questionIds || questionIds.length === 0) return [];
    try {
        // Fetch individually since there's no batch-by-IDs endpoint
        const promises = questionIds.map(id => grammarQuestionsService.findOne(id).catch(() => null));
        const results = await Promise.all(promises);
        return results.filter(Boolean).map(q => {
            const data = q?.data || q;
            return { ...data, id: data._id || data.id };
        });
    } catch (err) {
        console.error("Error fetching grammar questions by IDs:", err);
        return [];
    }
}

export async function saveGrammarQuestion(questionData) {
    const { id, ...data } = questionData;
    let resultId;
    if (id) {
        await grammarQuestionsService.update(id, data);
        resultId = id;
    } else {
        const result = await grammarQuestionsService.create(data);
        resultId = result?.data?._id || result?.data?.id || result?._id || result?.id || result;
    }

    // Fire-and-forget: auto-classify errorCategory in background
    import('./aiGrammarService').then(({ classifyErrorCategory }) => {
        classifyErrorCategory({
            targetSkill: data.targetSkill,
            type: data.type,
            purpose: data.purpose,
            questionText: data.variations?.[0]?.text,
            options: data.variations?.[0]?.options
        }).then(category => {
            grammarQuestionsService.update(resultId, { errorCategory: category }).catch(() => {});
        }).catch(() => {});
    }).catch(() => {});

    // Fire-and-forget: recalc grammar question cache
    recalcGrammarQuestionCache(data.exerciseId).catch(() => {});

    return resultId;
}

export async function deleteGrammarQuestion(id) {
    // Fetch question first to get exerciseId and clean up assets
    try {
        const question = await grammarQuestionsService.findOne(id);
        if (question) {
            await deleteQuestionImages(question);
            if (question.contextAudioUrl) await deleteContextAudio(question.contextAudioUrl);
            if (question.context) await deleteContextImages(question.context);
        }
        await grammarQuestionsService.remove(id);
        if (question?.exerciseId) recalcGrammarQuestionCache(question.exerciseId).catch(() => {});
    } catch (e) {
        // If fetch fails, still try to delete
        await grammarQuestionsService.remove(id);
    }
}

// --- ASSIGNMENTS ---
// NOTE: grammar_assignments doesn't have a dedicated backend module yet.
// These use the generic assignments service (which handles isGrammar flag).

import { assignmentsService } from '../models';

export async function getGrammarAssignmentsForGroup(groupId) {
    const result = await assignmentsService.findAll({ groupId, isGrammar: true });
    let assignments = Array.isArray(result) ? result : (result?.data || []);
    return assignments.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function saveGrammarAssignment(assignmentData) {
    const { id, ...data } = assignmentData;
    if (id) {
        await assignmentsService.update(id, { ...data, isGrammar: true });
        return id;
    } else {
        const result = await assignmentsService.create({ ...data, isGrammar: true });
        return result?.id || result;
    }
}

// --- SUBMISSIONS ---

export async function getGrammarSubmission(assignmentId, studentId) {
    const result = await grammarSubmissionsService.findByAssignmentAndStudent(assignmentId, studentId);
    const data = result?.data || result;
    return data ? { ...data, id: data._id || data.id } : null;
}

export async function getGrammarSubmissionsForAssignment(assignmentId) {
    const result = await grammarSubmissionsService.findByAssignment(assignmentId);
    const list = Array.isArray(result) ? result : (result?.data || []);
    return list.map(item => ({ ...item, id: item._id || item.id }));
}

export async function saveGrammarSubmission(submissionData) {
    const { id, ...data } = submissionData;
    if (id) {
        await grammarSubmissionsService.update(id, data);
        return id;
    } else {
        const result = await grammarSubmissionsService.create(data);
        const created = result?.data || result;
        return created?._id || created?.id || created;
    }
}

// ==========================================
// TEACHER GRAMMAR FOLDERS
// ==========================================

import { teacherFoldersService } from '../models';

export async function getTeacherGrammarFolders(teacherId) {
    const result = await teacherFoldersService.getGrammarFolders(teacherId);
    let folders = Array.isArray(result) ? result : (result?.data || []);
    folders = folders.map(f => ({ ...f, id: f._id || f.id })).filter(f => !f.isDeleted);
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function updateTeacherGrammarFoldersOrder(orderedFolders) {
    const folders = orderedFolders.map((folder, index) => ({ id: folder.id, order: index }));
    await teacherFoldersService.reorderGrammarFolders(folders);
}

export async function getAllTeacherGrammarFolders() {
    const result = await teacherFoldersService.getAllGrammarFolders();
    let folders = Array.isArray(result) ? result : (result?.data || []);
    folders = folders.map(f => ({ ...f, id: f._id || f.id })).filter(f => !f.isDeleted);
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveTeacherGrammarFolder(teacherId, folderData) {
    const { id, ...data } = folderData;
    if (id) {
        // The backend uses a single save endpoint
        await teacherFoldersService.saveGrammarFolder({ id, ...data, teacherId });
        return id;
    } else {
        const result = await teacherFoldersService.saveGrammarFolder({ ...data, teacherId });
        return result?.id || result;
    }
}

export async function deleteTeacherGrammarFolder(folderId) {
    await teacherFoldersService.softDeleteGrammarFolder(folderId);
}

export async function restoreTeacherGrammarFolder(folderId) {
    await teacherFoldersService.restoreGrammarFolder(folderId);
}

export async function permanentlyDeleteTeacherGrammarFolder(folderId) {
    await teacherFoldersService.permanentDeleteGrammarFolder(folderId);
}

export async function getDeletedTeacherGrammarFolders() {
    try {
        // Fetch deleted folders for a teacher — need teacherId
        // Since this is admin use, get all deleted
        const result = await teacherFoldersService.getDeletedGrammarFolders();
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching deleted teacher grammar folders:", error);
        return [];
    }
}

/**
 * Get public and explicitly shared teacher grammar folders.
 * Used by TeacherMiniGamesPage to load grammar data sources for teachers.
 */
export async function getSharedAndPublicTeacherGrammarFolders(folderAccessIds = []) {
    try {
        const result = await teacherFoldersService.getSharedAndPublicGrammarFolders(folderAccessIds);
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders
            .map(f => ({ ...f, id: f._id || f.id, isTeacherFolder: true }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error("Error fetching shared teacher grammar folders:", error);
        return [];
    }
}
