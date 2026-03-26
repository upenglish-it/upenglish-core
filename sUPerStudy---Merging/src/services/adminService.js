import { topicsService, adminFoldersService, usersService, userGroupsService, emailWhitelistService, sharingService, grammarExercisesService } from '../models';
import localTopics from '../data/topics';
import localWordData from '../data/wordData';
import { deleteQuestionImages } from './examService';
import { deleteContextAudio } from './contextAudioService';

// ========== TOPIC MANAGEMENT ==========

// Fetch all topics from backend
export async function getAdminTopics() {
    const result = await topicsService.findAll();
    // Backend already excludes deleted topics by default
    return Array.isArray(result) ? result : (result?.data || []);
}

// Fetch word counts for multiple topics
export async function getAdminTopicWordCounts(topicIds) {
    const counts = {};
    await Promise.all(topicIds.map(async (topicId) => {
        try {
            const topic = await topicsService.findOne(topicId);
            counts[topicId] = topic?.cachedWordCount || 0;
        } catch (e) {
            console.error(`Error counting words for ${topicId}:`, e);
            counts[topicId] = 0;
        }
    }));
    return counts;
}

/**
 * Recalculate and cache word count into the topic document.
 * @param {string} topicId
 * @param {string} collectionName - 'topics' or 'teacher_topics'
 */
export async function recalcTopicWordCount(topicId, collectionName = 'topics') {
    try {
        // This is now handled by the backend — just trigger an update
        if (collectionName === 'topics') {
            await topicsService.update(topicId, { _recalcWordCount: true });
        }
        // For teacher_topics, the backend handles it via the teacher-topics endpoint
    } catch (e) {
        console.error(`Error recalculating word count for ${collectionName}/${topicId}:`, e);
    }
}

// Check content completeness status for multiple topics
export async function getAdminTopicContentStatus(topicIds) {
    // This requires word-level data inspection — keep as a backend call or client-side logic
    // For now, fetch topic data and check cached fields
    const status = {};
    await Promise.all(topicIds.map(async (topicId) => {
        try {
            const topic = await topicsService.findOne(topicId);
            const total = topic?.cachedWordCount || 0;
            const complete = topic?.cachedCompleteWordCount || 0;
            status[topicId] = { total, complete, isComplete: total > 0 && complete === total };
        } catch (e) {
            console.error(`Error checking content for ${topicId}:`, e);
            status[topicId] = { total: 0, complete: 0, isComplete: false };
        }
    }));
    return status;
}

// Add or Edit a topic
export async function saveAdminTopic(topicData) {
    const { id, ...data } = topicData;
    if (id) {
        // Try update first, create if doesn't exist
        try {
            await topicsService.update(id, data);
        } catch (e) {
            await topicsService.create({ id, ...data });
        }
    } else {
        await topicsService.create(data);
    }
}

// Fetch words for a specific topic
export async function getAdminTopicWords(topicId) {
    // Words are fetched as part of topic detail from backend
    const topic = await topicsService.findOne(topicId);
    return topic?.words || [];
}

// Save words to a topic
export async function saveAdminTopicWords(topicId, wordsArray) {
    await topicsService.update(topicId, { words: wordsArray });
}

// Delete a single word from a topic
export async function deleteAdminTopicWord(topicId, word) {
    if (!topicId || !word) throw new Error("Missing topicId or word");
    await topicsService.update(topicId, { _deleteWord: word });
}

// Delete a topic and all its words
export async function deleteAdminTopic(topicId) {
    await topicsService.permanentDelete(topicId);
}

// ========== TOPIC FOLDERS ==========

// Fetch all folders
export async function getFolders() {
    const result = await adminFoldersService.getTopicFolders();
    let folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Add or Edit a folder
export async function saveFolder(folderData) {
    await adminFoldersService.saveTopicFolder(folderData);
}

// Delete a folder
export async function deleteFolder(folderId) {
    await adminFoldersService.deleteTopicFolder(folderId);
}

// Update order of topic folders after drag-and-drop
export async function updateTopicFoldersOrder(orderedFolders) {
    const folders = orderedFolders.map((folder, index) => ({ id: folder.id, order: index }));
    await adminFoldersService.reorderTopicFolders(folders);
}

// Sync local mock data (one-time admin tool — still uses local data)
export async function syncLocalDataToFirestore() {
    console.log("Starting sync...");
    for (const topic of localTopics) {
        await saveAdminTopic({
            id: topic.id,
            name: topic.name,
            description: topic.description,
            icon: topic.icon,
            color: topic.color
        });

        const words = localWordData[topic.id] || [];
        if (words.length > 0) {
            await saveAdminTopicWords(topic.id, words);
        }
        console.log(`Synced topic: ${topic.id} with ${words.length} words.`);
    }
    console.log("Sync complete!");
}

// ========== USER MANAGEMENT ==========

export async function updateUserRole(uid, newRole) {
    await usersService.update(uid, { role: newRole });
}

export async function updateUserDisplayName(uid, newName) {
    await usersService.update(uid, { displayName: newName });
}

export async function toggleUserDisabled(uid, disabled) {
    await usersService.update(uid, { disabled: !!disabled });
}

export async function updateUserFolderAccess(uid, folderIds) {
    await usersService.update(uid, { folderAccess: folderIds || [] });
}

export async function getUserFolderAccess(uid) {
    const user = await usersService.findOne(uid);
    return user?.folderAccess || [];
}

// ========== GROUPS ==========

export async function getGroups(includeHidden = false) {
    const result = await userGroupsService.findAll(includeHidden);
    let groups = Array.isArray(result) ? result : (result?.data || []);
    if (!includeHidden) {
        groups = groups.filter(g => !g.isHidden);
    }
    return groups.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tA - tB;
    });
}

export async function saveGroup(groupData) {
    const { id, ...data } = groupData;
    if (id) {
        try {
            // Try update first
            await userGroupsService.update(id, data);
        } catch (e) {
            // If it doesn't exist, create
            await userGroupsService.create({ id, ...data });
        }
    } else {
        await userGroupsService.create(data);
    }
}

export async function deleteGroup(groupId) {
    await userGroupsService.remove(groupId);
}

export async function updateUserGroups(uid, groupIds) {
    await usersService.update(uid, { groupIds: groupIds || [] });
}

export async function addUserToGroup(uid, groupId) {
    await usersService.addToGroup(uid, groupId);
    // The backend handles notifications for student_joined
}

export async function removeUserFromGroup(uid, groupId) {
    await usersService.removeFromGroup(uid, groupId);
}

export async function getUserLearningStats(uid, startDate = '', endDate = '') {
    const result = await usersService.getLearningStats(uid, { startDate, endDate });
    return result || { totalWords: 0, learnedWords: 0, totalReviews: 0, totalCorrect: 0, totalWrong: 0 };
}

export async function deleteUserProgress(uid) {
    // This should be a backend endpoint — for now, trigger via user update
    await usersService.update(uid, { _deleteProgress: true });
}

// ========== APPROVAL & WHITELIST ==========

export async function approveUser(uid, role, durationDays = null, customExpiresAt = null) {
    await usersService.approve(uid, { role, durationDays, customExpiresAt });
    // Backend handles welcome notification + email
}

export async function rejectUser(uid) {
    await usersService.remove(uid);
}

export async function renewUser(uid, durationDays = null, customExpiresAt = null) {
    await usersService.renew(uid, { durationDays, customExpiresAt });
}

export async function addEmailToWhitelist(email, role = 'user', durationDays = null, customExpiresAt = null, addedBy = '', { groupIds = [], folderAccess = [], topicAccess = [], grammarAccess = [], examAccess = [], displayName = '' } = {}) {
    await emailWhitelistService.create({
        email: email.toLowerCase().trim(),
        role,
        displayName,
        durationDays,
        customExpiresAt,
        addedBy,
        groupIds,
        folderAccess,
        topicAccess,
        grammarAccess,
        examAccess,
    });
}

export async function updateWhitelistDisplayName(email, displayName) {
    const emailKey = email.toLowerCase().trim();
    // Find the entry first, then update
    const entry = await emailWhitelistService.checkEmail(emailKey);
    if (entry?.id) {
        await emailWhitelistService.update(entry.id, { displayName: displayName.trim() });
    }
}

export async function updateWhitelistEntry(email, data) {
    const emailKey = email.toLowerCase().trim();
    const entry = await emailWhitelistService.checkEmail(emailKey);
    if (entry?.id) {
        await emailWhitelistService.update(entry.id, data);
    }
}

export async function removeEmailFromWhitelist(email) {
    const emailKey = email.toLowerCase().trim();
    const entry = await emailWhitelistService.checkEmail(emailKey);
    if (entry?.id) {
        await emailWhitelistService.remove(entry.id);
    }
}

export async function getWhitelistEmails() {
    const result = await emailWhitelistService.findAll();
    return Array.isArray(result) ? result : (result?.data || []);
}

// ========== RESOURCE SHARING ==========

function mapResourceType(resourceType) {
    if (resourceType === 'admin_topic' || resourceType === 'teacher_topic') return 'topic';
    if (resourceType === 'admin_grammar' || resourceType === 'teacher_grammar') return 'grammar';
    if (resourceType === 'teacher_topic_folder' || resourceType === 'admin_folder' || resourceType === 'teacher_grammar_folder') {
        throw new Error('Chức năng chia sẻ toàn bộ thư mục đang được cập nhật. Vui lòng chia sẻ từng bài học bên trong.');
    }
    return resourceType;
}

export async function toggleResourcePublic(resourceType, resourceId, isPublic) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.togglePublic({ resourceType: mappedType, resourceId, isPublic });
}

export async function toggleTeacherVisible(resourceType, resourceId, teacherVisible) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.toggleTeacherVisible({ resourceType: mappedType, resourceId, teacherVisible });
}

export async function shareResourceToTeacher(resourceType, resourceId, teacherEmail) {
    const mappedType = mapResourceType(resourceType);
    const result = await sharingService.addTeacherShare({ resourceType: mappedType, resourceId, teacherEmail });
    return result;
}

export async function unshareResourceFromTeacher(resourceType, resourceId, teacherUid) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.removeTeacherShare({ resourceType: mappedType, resourceId, teacherId: teacherUid });
}

export async function getResourceSharedTeachers(resourceType, resourceId) {
    // This data is typically included in the resource document — handled by the backend
    // Fetch via the sharing service if available
    try {
        const result = await sharingService.findUser('', 'teacher');
        return Array.isArray(result) ? result : [];
    } catch (e) {
        return [];
    }
}

export async function getResourceSharedEntities(resourceType, resourceId) {
    try {
        if (resourceType === 'teacher_topic_folder' || resourceType === 'admin_folder') return { users: [], groups: [] };
        const mappedType = mapResourceType(resourceType);
        const result = await sharingService.getResourceAccess(mappedType, resourceId);
        
        const users = Array.isArray(result?.users) ? result.users.map(u => ({ ...u, id: u._id || u.id })) : [];
        const groups = Array.isArray(result?.groups) ? result.groups.map(g => ({ ...g, id: g._id || g.id })) : [];
        return { users, groups };
    } catch (e) {
        return { users: [], groups: [] };
    }
}

export async function shareResourceToEmail(resourceType, resourceId, email) {
    const mappedType = mapResourceType(resourceType);
    const result = await sharingService.addUserAccess({ email, resourceType: mappedType, resourceId });
    return result;
}

export async function unshareResourceFromUser(resourceType, resourceId, userId) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.removeUserAccess({ userId, resourceType: mappedType, resourceId });
}

export async function shareResourceToGroup(resourceType, resourceId, groupId) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.addGroupAccess({ groupId, resourceType: mappedType, resourceId });
}

export async function unshareResourceFromGroup(resourceType, resourceId, groupId) {
    const mappedType = mapResourceType(resourceType);
    await sharingService.removeGroupAccess({ groupId, resourceType: mappedType, resourceId });
}

// ========== TEACHER CONTENT MANAGEMENT (ADMIN) ==========

export async function getAdminAllTeacherTopics() {
    const { teacherTopicsService } = await import('../models');
    const result = await teacherTopicsService.findAll('');
    let topics = Array.isArray(result) ? result : (result?.data || []);
    topics = topics.map(t => ({ ...t, id: t._id || t.id }));
    return topics.filter(t => !t.isDeleted);
}

export async function deleteAdminTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    const { teacherTopicsService } = await import('../models');
    await teacherTopicsService.permanentDelete(topicId);
}

// ========== GRAMMAR FOLDERS ==========

export async function getGrammarFolders() {
    const result = await adminFoldersService.getGrammarFolders();
    let folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveGrammarFolder(folderData) {
    await adminFoldersService.saveGrammarFolder(folderData);
}

export async function deleteGrammarFolder(folderId) {
    await adminFoldersService.deleteGrammarFolder(folderId);
}

export async function updateGrammarFoldersOrder(orderedFolders) {
    const folders = orderedFolders.map((folder, index) => ({ id: folder.id, order: index }));
    await adminFoldersService.reorderGrammarFolders(folders);
}

// ========== ADMIN GRAMMAR MANAGEMENT ==========

export async function getAdminAllGrammarExercises() {
    const result = await grammarExercisesService.findAll();
    let exercises = Array.isArray(result) ? result : (result?.data || []);
    exercises = exercises.filter(e => !e.isDeleted);
    return exercises.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

export async function deleteAdminGrammarExercise(exerciseId) {
    if (!exerciseId) throw new Error("Missing exerciseId");
    await grammarExercisesService.permanentDelete(exerciseId);
    // Backend handles cascade deletion of questions, images, and audio
}

// ========== CLOUD FUNCTIONS ==========
// These still use Firebase Functions (no backend equivalent yet)
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export async function permanentDeleteUser(uid) {
    const deleteUserFn = httpsCallable(functions, 'deleteUser');
    const result = await deleteUserFn({ uid });
    return result.data;
}

export async function softDeleteUser(uid) {
    await usersService.update(uid, { isDeleted: true });
}

export async function restoreUser(uid) {
    await usersService.update(uid, { isDeleted: false });
}

export async function changeUserEmail(uid, newEmail) {
    const changeEmailFn = httpsCallable(functions, 'changeUserEmail');
    const result = await changeEmailFn({ uid, newEmail });
    return result.data;
}

// ========== AUTO-PURGE SOFT-DELETED CONTENT ==========

/**
 * Auto-purge soft-deleted teacher content older than 30 days.
 * This is now handled by the backend via scheduled tasks.
 * Kept as a no-op placeholder for backward compatibility.
 */
export async function cleanupExpiredDeletedContent() {
    // Backend handles scheduled cleanup — no-op on frontend
    console.log('[Cleanup] Delegated to backend scheduled tasks.');
}

// ========== RESTORE TO ADMIN ==========

export async function restoreTeacherTopicToAdmin(topicId) {
    // Complex cross-collection operation — backend should handle this
    // For now, use the teacher topics service to restore + update
    const { teacherTopicsService } = await import('../models');
    await teacherTopicsService.restore(topicId);
    // Additional logic (moving to admin collection) should be a backend endpoint
}

export async function restoreGrammarExerciseToAdmin(exerciseId) {
    await grammarExercisesService.restore(exerciseId);
    // Additional admin restore logic should be a dedicated backend endpoint
}

export async function restoreExamToAdmin(examId) {
    const { examsService } = await import('../models');
    await examsService.restore(examId);
    await examsService.update(examId, { createdByRole: 'admin' });
}

// ========== EXAM FOLDERS ==========

export async function getExamFolders() {
    const result = await adminFoldersService.getExamFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveExamFolder(folderData) {
    await adminFoldersService.saveExamFolder(folderData);
}

export async function deleteExamFolder(folderId) {
    await adminFoldersService.deleteExamFolder(folderId);
}

export async function updateExamFoldersOrder(orderedFolders) {
    const folders = orderedFolders.map((folder, index) => ({ id: folder.id, order: index }));
    await adminFoldersService.reorderExamFolders(folders);
}

// ========== TRANSFER OFFICIAL CONTENT TO TEACHER ==========
// NOTE: This is a complex cross-collection operation that should ideally be a
// dedicated backend endpoint. For now it remains partially client-driven.

export async function transferOfficialToTeacher(collectionName, docId, teacherEmail) {
    if (!collectionName || !docId || !teacherEmail) throw new Error('Missing parameters');

    // Find teacher by email via the sharing service
    const teacherResult = await sharingService.findUser(teacherEmail, 'teacher');
    if (!teacherResult) throw new Error('Không tìm thấy giáo viên với email này.');

    const teacherUid = teacherResult.uid || teacherResult.id;
    const teacherName = teacherResult.displayName || teacherResult.email;

    if (!teacherUid) throw new Error('Không tìm thấy giáo viên với email này.');

    // Use sharing service's transfer ownership
    await sharingService.transferOwnership({
        resourceType: collectionName,
        resourceId: docId,
        oldOwnerId: '', // admin
        newOwnerEmail: teacherEmail,
        newOwnerId: teacherUid,
        newOwnerName: teacherName,
    });

    return { teacherUid, teacherName };
}
