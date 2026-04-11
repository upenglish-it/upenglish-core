import { createNotificationForAdmins, createNotification } from './notificationService';
import {
    adminFoldersService,
    contentProposalsService,
    teacherFoldersService,
    teacherTopicsService,
    topicsService,
    grammarExercisesService,
    grammarQuestionsService,
    examsService,
    examQuestionsService,
} from '../models';

// ========== CONTENT PROPOSALS ==========
// Collection: content_proposals

/**
 * Submit a proposal to make teacher content official (preset).
 * @param {Object} data { type, level, sourceId, sourceFolderId, sourceCollection, teacherId, teacherName, teacherEmail, proposalName, proposalDescription, icon, color }
 */
export async function submitProposal(data) {
    const proposalParams = {
        ...data,
        status: 'pending',
        adminNote: '',
    };
    const proposalData = await contentProposalsService.create(proposalParams);
    const newId = proposalData._id || proposalData.id || proposalData;

    // Notify all admins about this new proposal
    const typeLabels = { vocab: 'Từ vựng', grammar: 'Kỹ năng', exam: 'Bài tập và Kiểm tra' };
    const typeLinks = { vocab: '/admin/topics', grammar: '/admin/grammar', exam: '/admin/exams' };
    const typeLabel = typeLabels[data.type] || data.type;
    try {
        await createNotificationForAdmins({
            type: 'content_proposal',
            title: `📩 Đề xuất mới: ${typeLabel}`,
            message: `GV ${data.teacherName || ''} đề xuất "${data.proposalName}" thành tài liệu chính thức.`,
            link: typeLinks[data.type] || '/admin'
        });

        // #14: Email to admins
        const { queueEmailForAdmins, buildEmailHtml } = await import('./notificationService');
        await queueEmailForAdmins({
            subject: `Đề xuất mới: ${data.proposalName}`,
            html: buildEmailHtml({
                emoji: '📩', heading: 'Đề xuất nội dung mới', headingColor: '#f59e0b',
                body: `<p>GV <strong>${data.teacherName || ''}</strong> muốn đưa tài liệu <strong>"${data.proposalName}"</strong> (${typeLabel}) thành tài liệu chính thức của trung tâm. Vui lòng xem xét và duyệt nhé!</p>`,
                ctaText: 'Xem đề xuất', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
            })
        }, 'content_proposal');
    } catch (e) {
        console.error('Error sending proposal notification:', e);
    }

    return newId;
}

/**
 * Get pending proposals filtered by type (vocab / grammar / exam).
 */
export async function getPendingProposals(type = null) {
    const params = { status: 'pending' };
    if (type) params.type = type;
    const result = await contentProposalsService.findAll(params);
    let proposals = Array.isArray(result) ? result : (result?.data || []);
    return proposals.map(p => ({ ...p, id: p._id || p.id })).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

/**
 * Get proposals submitted by a specific teacher.
 */
export async function getTeacherProposals(teacherId) {
    const result = await contentProposalsService.findAll({ teacherId });
    let proposals = Array.isArray(result) ? result : (result?.data || []);
    return proposals.map(p => ({ ...p, id: p._id || p.id }));
}

/**
 * Get the proposal status for a specific source item.
 */
export async function getProposalForSource(sourceId, type) {
    const result = await contentProposalsService.findAll({ sourceId, type });
    let proposals = Array.isArray(result) ? result : (result?.data || []);
    if (proposals.length > 0) {
        proposals = proposals.map(p => ({ ...p, id: p._id || p.id }));
        proposals.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });
        return proposals[0];
    }
    return null;
}

/**
 * Find existing official copy for a source item (to detect re-proposals).
 * Returns { id, name/title, collection } or null.
 */
export async function findExistingOfficialCopy(sourceId, type, level = 'item') {
    if (type === 'vocab') {
        if (level === 'folder') {
            const result = await adminFoldersService.getTopicFolders();
            const folders = Array.isArray(result) ? result : (result?.data || []);
            const folder = folders.find(f => (f._id || f.id) && f.copiedFrom === sourceId);
            if (!folder) return null;
            return {
                id: folder._id || folder.id,
                name: folder.name || 'KhÃ´ng rÃµ tÃªn',
                collection: 'topic_folders'
            };
        }

        const result = await topicsService.findAll();
        const topics = Array.isArray(result) ? result : (result?.data || []);
        const topic = topics.find(t => (t._id || t.id) && t.copiedFrom === sourceId);
        if (!topic) return null;
        return {
            id: topic._id || topic.id,
            name: topic.name || topic.title || 'KhÃ´ng rÃµ tÃªn',
            collection: 'topics'
        };
    }

    if (type === 'grammar') {
        if (level === 'folder') {
            const result = await adminFoldersService.getGrammarFolders();
            const folders = Array.isArray(result) ? result : (result?.data || []);
            const folder = folders.find(f => normalizeId(f) && f.copiedFrom === sourceId);
            if (!folder) return null;
            return {
                id: normalizeId(folder),
                name: folder.name || 'Khong ro ten',
                collection: 'grammar_folders'
            };
        }

        const result = await grammarExercisesService.findAll();
        const exercises = Array.isArray(result) ? result : (result?.data || []);
        const exercise = exercises.find(item => normalizeId(item) && item.copiedFrom === sourceId && item.createdByRole === 'admin');
        if (!exercise) return null;
        return {
            id: normalizeId(exercise),
            name: exercise.name || exercise.title || 'Khong ro ten',
            collection: 'grammar_exercises'
        };
    }

    if (type === 'exam') {
        if (level === 'folder') {
            const result = await adminFoldersService.getExamFolders();
            const folders = Array.isArray(result) ? result : (result?.data || []);
            const folder = folders.find(f => normalizeId(f) && f.copiedFrom === sourceId);
            if (!folder) return null;
            return {
                id: normalizeId(folder),
                name: folder.name || 'Khong ro ten',
                collection: 'exam_folders'
            };
        }

        const result = await examsService.findAll();
        const exams = Array.isArray(result) ? result : (result?.data || []);
        const exam = exams.find(item => normalizeId(item) && item.copiedFrom === sourceId && item.createdByRole === 'admin');
        if (!exam) return null;
        return {
            id: normalizeId(exam),
            name: exam.name || exam.title || 'Khong ro ten',
            collection: 'exams'
        };
    }

    return null;

    const collectionMap = {
        vocab: level === 'folder' ? 'topic_folders' : 'topics',
        grammar: level === 'folder' ? 'grammar_folders' : 'grammar_exercises',
        exam: level === 'folder' ? 'exam_folders' : 'exams'
    };
    const col = collectionMap[type];
    if (!col) return null;

    const copiedFromField = 'copiedFrom';
    const q = query(collection(db, col), where(copiedFromField, '==', sourceId));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const docSnap = snap.docs[0];
    const data = docSnap.data();
    return {
        id: docSnap.id,
        name: data.name || data.title || 'Không rõ tên',
        collection: col
    };
}

/**
 * Approve a proposal and copy content to the official preset collection.
 * @param {string} mode - 'create_new' (default) or 'overwrite'
 */
export async function approveProposal(proposalId, adminUid, mode = 'create_new') {
    const proposalData = await contentProposalsService.findOne(proposalId);
    if (!proposalData) throw new Error('Proposal not found');
    const proposal = { ...proposalData, id: proposalData._id || proposalData.id };

    if (proposal.status !== 'pending') throw new Error('Proposal already reviewed');

    try {
        if (mode === 'overwrite') {
            if (proposal.level === 'folder') {
                await overwriteFolderToPreset(proposal);
            } else {
                await overwriteItemToPreset(proposal);
            }
        } else {
            if (proposal.level === 'folder') {
                await copyFolderToPreset(proposal);
            } else {
                await copyItemToPreset(proposal);
            }
        }

        // Mark as approved via API
        await contentProposalsService.update(proposal.id, {
            status: 'approved',
            approveMode: mode,
            reviewedAt: new Date().toISOString(),
            reviewedBy: adminUid
        });

        // Notify teacher
        const typeLabels = { vocab: 'Từ vựng', grammar: 'Kỹ năng', exam: 'Bài tập và Kiểm tra' };
        const teacherLinks = { vocab: '/teacher/topics', grammar: '/teacher/grammar', exam: '/teacher/exams' };
        const modeLabel = mode === 'overwrite' ? ' (cập nhật bản cũ)' : '';
        try {
            await createNotification({
                userId: proposal.teacherId,
                type: 'proposal_approved',
                title: `✅ Đề xuất được duyệt: ${typeLabels[proposal.type] || proposal.type}`,
                message: `"${proposal.proposalName}" đã được admin duyệt thành tài liệu chính thức${modeLabel}!`,
                link: teacherLinks[proposal.type] || '/teacher'
            });

            // #9: Email to teacher (check email preference)
            const { queueEmail, buildEmailHtml, getUserEmailPreference } = await import('./notificationService');
            if (proposal.teacherEmail) {
                const wantsEmail = await getUserEmailPreference(proposal.teacherId, 'content_proposal');
                if (wantsEmail) {
                    await queueEmail(proposal.teacherEmail, {
                        subject: `Đề xuất "${proposal.proposalName}" được duyệt!`,
                        html: buildEmailHtml({
                            emoji: '✅', heading: 'Đề xuất được duyệt!', headingColor: '#10b981',
                            body: `<p>Tin vui! Tài liệu <strong>"${proposal.proposalName}"</strong> của bạn đã được duyệt thành tài liệu chính thức của Trung tâm Ngoại ngữ UP${modeLabel}. Cảm ơn bạn đã đóng góp! 🌟</p>`,
                            ctaText: 'Mở sUPerStudy', ctaColor: '#10b981', ctaColor2: '#34d399'
                        })
                    });
                }
            }
        } catch (e) {
            console.error('Error sending approval notification:', e);
        }
    } catch (error) {
        console.error('Error approving proposal:', error);
        throw error;
    }
}

/**
 * Reject a proposal with an optional note.
 */
export async function rejectProposal(proposalId, adminUid, adminNote = '') {
    const proposalData = await contentProposalsService.findOne(proposalId).catch(() => null);
    const proposal = proposalData ? { ...proposalData, id: proposalData._id || proposalData.id } : {};

    await contentProposalsService.update(proposalId, {
        status: 'rejected',
        adminNote,
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminUid
    });

    // Notify teacher about rejection
    const typeLabels = { vocab: 'Từ vựng', grammar: 'Kỹ năng', exam: 'Bài tập và Kiểm tra' };
    const teacherLinks = { vocab: '/teacher/topics', grammar: '/teacher/grammar', exam: '/teacher/exams' };
    try {
        await createNotification({
            userId: proposal.teacherId,
            type: 'proposal_rejected',
            title: `❌ Đề xuất bị từ chối: ${typeLabels[proposal.type] || proposal.type}`,
            message: `"${proposal.proposalName}" bị từ chối.${adminNote ? ' Lý do: ' + adminNote : ''}`,
            link: teacherLinks[proposal.type] || '/teacher'
        });

        // Email to teacher (check email preference)
        const { queueEmail, buildEmailHtml, getUserEmailPreference } = await import('./notificationService');
        if (proposal.teacherEmail) {
            const wantsEmail = await getUserEmailPreference(proposal.teacherId, 'content_proposal');
            if (wantsEmail) {
                await queueEmail(proposal.teacherEmail, {
                    subject: `Đề xuất "${proposal.proposalName}" bị từ chối`,
                    html: buildEmailHtml({
                        emoji: '❌', heading: 'Đề xuất bị từ chối', headingColor: '#ef4444',
                        body: `<p>Tài liệu <strong>"${proposal.proposalName}"</strong> của bạn đã bị từ chối. Bạn có thể chỉnh sửa và gửi lại nhé!</p>`,
                        highlight: adminNote ? `<strong>Lý do:</strong> ${adminNote}` : undefined,
                        highlightBg: '#fef2f2', highlightBorder: '#ef4444',
                        ctaText: 'Mở sUPerStudy', ctaColor: '#6366f1', ctaColor2: '#818cf8'
                    })
                });
            }
        }
    } catch (e) {
        console.error('Error sending rejection notification:', e);
    }
}

function normalizeId(doc) {
    return doc?._id || doc?.id || null;
}

function buildOfficialVocabTopicPayload(sourceData, proposal, overrides = {}) {
    const {
        _id,
        id,
        teacherId,
        createdBy,
        createdByRole,
        sharedWith,
        collaboratorIds,
        collaboratorNames,
        collaboratorRoles,
        duplicatedFrom,
        isDeleted,
        deletedAt,
        folderId,
        transferredFromOfficial,
        transferredAt,
        ...cleanData
    } = sourceData || {};

    return {
        ...cleanData,
        ...overrides,
        name: overrides.name || sourceData?.name || proposal?.proposalName,
        createdByRole: 'admin',
        copiedFrom: sourceData?.copiedFrom || sourceData?._id || sourceData?.id || proposal?.sourceId,
        proposedBy: proposal?.teacherId || null,
        proposedByName: proposal?.teacherName || '',
        isDeleted: false,
        deletedAt: null,
        folderId: overrides.folderId ?? null,
        sharedWithTeacherIds: overrides.sharedWithTeacherIds ?? [],
    };
}

function buildOfficialVocabFolderPayload(folderData, topicIds, proposal, overrides = {}) {
    const {
        _id,
        id,
        teacherId,
        createdBy,
        createdByRole,
        sharedWith,
        collaboratorIds,
        collaboratorNames,
        collaboratorRoles,
        copiedFrom,
        isDeleted,
        deletedAt,
        topicIds: _topicIds,
        transferredFromOfficial,
        transferredAt,
        ...cleanData
    } = folderData || {};

    return {
        ...cleanData,
        ...overrides,
        name: overrides.name || folderData?.name || proposal?.proposalName,
        topicIds,
        copiedFrom: folderData?.copiedFrom || folderData?._id || folderData?.id || proposal?.sourceFolderId,
        proposedBy: proposal?.teacherId || null,
        proposedByName: proposal?.teacherName || '',
        isDeleted: false,
        deletedAt: null,
        isPublic: overrides.isPublic ?? false,
    };
}

function buildOfficialContentPayload(sourceData, proposal, overrides = {}) {
    const {
        _id,
        id,
        teacherId,
        createdBy,
        createdByRole,
        sharedWith,
        collaboratorIds,
        collaboratorNames,
        collaboratorRoles,
        duplicatedFrom,
        isDeleted,
        deletedAt,
        archived,
        transferredFromOfficial,
        transferredAt,
        ...cleanData
    } = sourceData || {};

    return {
        ...cleanData,
        ...overrides,
        title: overrides.title || sourceData?.title || sourceData?.name || proposal?.proposalName,
        name: overrides.name || sourceData?.name || sourceData?.title || proposal?.proposalName,
        createdByRole: 'admin',
        copiedFrom: sourceData?.copiedFrom || sourceData?._id || sourceData?.id || proposal?.sourceId,
        proposedBy: proposal?.teacherId || null,
        proposedByName: proposal?.teacherName || '',
        isDeleted: false,
        deletedAt: null,
        archived: overrides.archived ?? false,
    };
}

function buildOfficialFolderPayload(folderData, itemField, itemIds, proposal, overrides = {}) {
    const {
        _id,
        id,
        teacherId,
        createdBy,
        createdByRole,
        sharedWith,
        collaboratorIds,
        collaboratorNames,
        collaboratorRoles,
        copiedFrom,
        isDeleted,
        deletedAt,
        transferredFromOfficial,
        transferredAt,
        ...cleanData
    } = folderData || {};

    return {
        ...cleanData,
        ...overrides,
        name: overrides.name || folderData?.name || proposal?.proposalName,
        [itemField]: itemIds,
        copiedFrom: folderData?.copiedFrom || folderData?._id || folderData?.id || proposal?.sourceFolderId,
        proposedBy: proposal?.teacherId || null,
        proposedByName: proposal?.teacherName || '',
        isDeleted: false,
        deletedAt: null,
        isPublic: overrides.isPublic ?? false,
    };
}

function buildQuestionPayload(question, parentField, parentId, copiedFrom) {
    const {
        _id,
        id,
        examId,
        exerciseId,
        createdAt,
        updatedAt,
        ...cleanData
    } = question || {};

    return {
        ...cleanData,
        [parentField]: parentId,
        copiedFrom,
    };
}

async function getTeacherTopicFolderById(folderId) {
    const result = await teacherFoldersService.getAllTopicFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.find(folder => normalizeId(folder) === folderId) || null;
}

async function getTeacherGrammarFolderById(folderId) {
    const result = await teacherFoldersService.getAllGrammarFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.find(folder => normalizeId(folder) === folderId) || null;
}

async function getTeacherExamFolderById(folderId) {
    const result = await teacherFoldersService.getAllExamFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.find(folder => normalizeId(folder) === folderId) || null;
}

async function getAdminGrammarFolderById(folderId) {
    const result = await adminFoldersService.getGrammarFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.find(folder => normalizeId(folder) === folderId) || null;
}

async function getAdminExamFolderById(folderId) {
    const result = await adminFoldersService.getExamFolders();
    const folders = Array.isArray(result) ? result : (result?.data || []);
    return folders.find(folder => normalizeId(folder) === folderId) || null;
}

async function copyVocabToPresetViaApi(sourceId, proposal) {
    const sourceData = await teacherTopicsService.findOne(sourceId);
    if (!sourceData) throw new Error('Source topic not found');

    const payload = buildOfficialVocabTopicPayload(sourceData, proposal);
    const created = await topicsService.create(payload);
    return normalizeId(created?.data || created) || normalizeId(created);
}

async function copyVocabFolderToPresetViaApi(sourceFolderId, proposal) {
    const folderData = await getTeacherTopicFolderById(sourceFolderId);
    if (!folderData) throw new Error('Source folder not found');

    const sourceTopicIds = Array.isArray(folderData.topicIds) ? folderData.topicIds : [];
    const newTopicIds = [];

    for (const topicId of sourceTopicIds) {
        try {
            const newId = await copyVocabToPresetViaApi(topicId, proposal);
            if (newId) newTopicIds.push(newId);
        } catch (e) {
            console.error(`[VOCAB FOLDER COPY] Error copying topic ${topicId}:`, e);
        }
    }

    const payload = buildOfficialVocabFolderPayload(folderData, newTopicIds, proposal);
    const created = await adminFoldersService.saveTopicFolder(payload);
    return normalizeId(created?.data || created) || normalizeId(created);
}

async function overwriteVocabPresetViaApi(sourceId, proposal) {
    const existing = await findExistingOfficialCopy(sourceId, 'vocab');
    if (!existing) return copyVocabToPresetViaApi(sourceId, proposal);

    const sourceData = await teacherTopicsService.findOne(sourceId);
    if (!sourceData) throw new Error('Source topic not found');

    const payload = buildOfficialVocabTopicPayload(sourceData, proposal, {
        archived: false,
    });
    await topicsService.update(existing.id, payload);
    return existing.id;
}

async function overwriteVocabFolderPresetViaApi(sourceFolderId, proposal) {
    const existing = await findExistingOfficialCopy(sourceFolderId, 'vocab', 'folder');
    if (!existing) return copyVocabFolderToPresetViaApi(sourceFolderId, proposal);

    const folderData = await getTeacherTopicFolderById(sourceFolderId);
    if (!folderData) throw new Error('Source folder not found');

    const rawTopicIds = Array.isArray(folderData.topicIds) ? folderData.topicIds : [];
    const sourceTopicIds = [];
    for (const topicId of rawTopicIds) {
        try {
            const topic = await teacherTopicsService.findOne(topicId);
            if (topic && !topic.isDeleted) sourceTopicIds.push(topicId);
        } catch (e) {
            console.error(`[VOCAB FOLDER OVERWRITE] Error loading topic ${topicId}:`, e);
        }
    }

    const oldFoldersResult = await adminFoldersService.getTopicFolders();
    const oldFolders = Array.isArray(oldFoldersResult) ? oldFoldersResult : (oldFoldersResult?.data || []);
    const oldFolder = oldFolders.find(folder => normalizeId(folder) === existing.id);
    const oldTopicIds = Array.isArray(oldFolder?.topicIds) ? oldFolder.topicIds : [];

    const newTopicIds = [];
    for (const topicId of sourceTopicIds) {
        try {
            const newId = await overwriteVocabPresetViaApi(topicId, proposal);
            if (newId) newTopicIds.push(newId);
        } catch (e) {
            console.error(`[VOCAB FOLDER OVERWRITE] Error overwriting topic ${topicId}:`, e);
        }
    }

    const orphanedIds = oldTopicIds.filter(id => !newTopicIds.includes(id));
    for (const orphanId of orphanedIds) {
        try {
            const topic = await topicsService.findOne(orphanId);
            if (topic) {
                const currentName = topic.name || '';
                await topicsService.update(orphanId, {
                    name: currentName.startsWith('[Archived]') ? currentName : `[Archived] ${currentName}`,
                    archived: true,
                    isDeleted: false,
                    deletedAt: null,
                    createdByRole: 'admin',
                });
            }
        } catch (e) {
            console.error(`[VOCAB FOLDER OVERWRITE] Error archiving topic ${orphanId}:`, e);
        }
    }

    const payload = buildOfficialVocabFolderPayload(folderData, [...newTopicIds, ...orphanedIds], proposal);
    await adminFoldersService.saveTopicFolder({ id: existing.id, ...payload });
    return existing.id;
}

// ========== COPY HELPERS ==========

async function copyItemToPreset(proposal) {
    const { type, sourceId } = proposal;

    if (type === 'vocab') {
        await copyVocabToPresetViaApi(sourceId, proposal);
    } else if (type === 'grammar') {
        await copyGrammarToPreset(sourceId, proposal);
    } else if (type === 'exam') {
        await copyExamToPreset(sourceId, proposal);
    }
}

async function copyFolderToPreset(proposal) {
    const { type, sourceFolderId } = proposal;

    if (type === 'vocab') {
        await copyVocabFolderToPresetViaApi(sourceFolderId, proposal);
    } else if (type === 'grammar') {
        await copyGrammarFolderToPreset(sourceFolderId, proposal);
    } else if (type === 'exam') {
        await copyExamFolderToPreset(sourceFolderId, proposal);
    }
}

// --- VOCAB ---

async function copyVocabToPreset(sourceId, proposal) {
    return copyVocabToPresetViaApi(sourceId, proposal);
}

async function copyVocabFolderToPreset(sourceFolderId, proposal) {
    return copyVocabFolderToPresetViaApi(sourceFolderId, proposal);
}

// --- GRAMMAR ---

async function copyGrammarToPreset(sourceId, proposal) {
    const sourceData = await grammarExercisesService.findOne(sourceId);
    if (!sourceData) throw new Error('Source grammar exercise not found');

    const payload = buildOfficialContentPayload(sourceData, proposal);
    const created = await grammarExercisesService.create(payload);
    const newId = normalizeId(created?.data || created) || normalizeId(created);

    const questionsResult = await grammarQuestionsService.findAll(sourceId);
    const questions = Array.isArray(questionsResult) ? questionsResult : (questionsResult?.data || []);
    for (const question of questions) {
        await grammarQuestionsService.create(
            buildQuestionPayload(question, 'exerciseId', newId, normalizeId(question)),
        );
    }

    return newId;
}

async function copyGrammarFolderToPreset(sourceFolderId, proposal) {
    const folderData = await getTeacherGrammarFolderById(sourceFolderId);
    if (!folderData) throw new Error('Source grammar folder not found');

    const exerciseIds = Array.isArray(folderData.exerciseIds) ? folderData.exerciseIds : [];

    const newExerciseIds = [];
    for (const exId of exerciseIds) {
        try {
            const newId = await copyGrammarToPreset(exId, proposal);
            newExerciseIds.push(newId);
        } catch (e) {
            console.error(`Error copying grammar exercise ${exId}:`, e);
        }
    }

    const payload = buildOfficialFolderPayload(folderData, 'exerciseIds', newExerciseIds, proposal);
    const created = await adminFoldersService.saveGrammarFolder(payload);
    return normalizeId(created?.data || created) || normalizeId(created);
}

// --- EXAM ---

async function copyExamToPreset(sourceId, proposal) {
    const sourceData = await examsService.findOne(sourceId);
    if (!sourceData) throw new Error('Source exam not found');

    const payload = buildOfficialContentPayload(sourceData, proposal);
    const created = await examsService.create(payload);
    const newId = normalizeId(created?.data || created) || normalizeId(created);

    const questionsResult = await examQuestionsService.findAll(sourceId);
    const questions = Array.isArray(questionsResult) ? questionsResult : (questionsResult?.data || []);
    for (const question of questions) {
        await examQuestionsService.create(
            buildQuestionPayload(question, 'examId', newId, normalizeId(question)),
        );
    }

    return newId;
}

async function copyExamFolderToPreset(sourceFolderId, proposal) {
    const folderData = await getTeacherExamFolderById(sourceFolderId);
    if (!folderData) throw new Error('Source exam folder not found');

    const examIds = Array.isArray(folderData.examIds) ? folderData.examIds : [];

    const newExamIds = [];
    for (const exId of examIds) {
        try {
            const newId = await copyExamToPreset(exId, proposal);
            newExamIds.push(newId);
        } catch (e) {
            console.error(`Error copying exam ${exId}:`, e);
        }
    }

    const payload = buildOfficialFolderPayload(folderData, 'examIds', newExamIds, proposal);
    const created = await adminFoldersService.saveExamFolder(payload);
    return normalizeId(created?.data || created) || normalizeId(created);
}

// ========== OVERWRITE HELPERS ==========

async function overwriteItemToPreset(proposal) {
    const { type, sourceId } = proposal;
    if (type === 'vocab') {
        await overwriteVocabPresetViaApi(sourceId, proposal);
    } else if (type === 'grammar') {
        await overwriteGrammarPreset(sourceId, proposal);
    } else if (type === 'exam') {
        await overwriteExamPreset(sourceId, proposal);
    }
}

async function overwriteFolderToPreset(proposal) {
    const { type, sourceFolderId } = proposal;
    if (type === 'vocab') {
        await overwriteVocabFolderPresetViaApi(sourceFolderId, proposal);
    } else if (type === 'grammar') {
        await overwriteGrammarFolderPreset(sourceFolderId, proposal);
    } else if (type === 'exam') {
        await overwriteExamFolderPreset(sourceFolderId, proposal);
    }
}

// --- VOCAB OVERWRITE ---

async function overwriteVocabPreset(sourceId, proposal) {
    return overwriteVocabPresetViaApi(sourceId, proposal);
}

async function overwriteVocabFolderPreset(sourceFolderId, proposal) {
    return overwriteVocabFolderPresetViaApi(sourceFolderId, proposal);
}

// --- GRAMMAR OVERWRITE ---

async function overwriteGrammarPreset(sourceId, proposal) {
    const existing = await findExistingOfficialCopy(sourceId, 'grammar');
    if (!existing) return copyGrammarToPreset(sourceId, proposal);

    const targetId = existing.id;
    const sourceDataViaApi = await grammarExercisesService.findOne(sourceId).catch(() => null);
    if (!sourceDataViaApi) throw new Error('Source grammar exercise not found');

    await grammarExercisesService.update(
        targetId,
        buildOfficialContentPayload(sourceDataViaApi, proposal, { archived: false }),
    );

    const oldQuestionsResult = await grammarQuestionsService.findAll(targetId);
    const oldQuestions = Array.isArray(oldQuestionsResult) ? oldQuestionsResult : (oldQuestionsResult?.data || []);
    const newQuestionsResult = await grammarQuestionsService.findAll(sourceId);
    const newQuestions = Array.isArray(newQuestionsResult) ? newQuestionsResult : (newQuestionsResult?.data || []);

    const oldBySourceViaApi = new Map();
    oldQuestions.forEach(question => {
        if (question?.copiedFrom) oldBySourceViaApi.set(question.copiedFrom, question);
    });
    const matchedOldIdsViaApi = new Set();

    for (const question of newQuestions) {
        const sourceQuestionId = normalizeId(question);
        const existingQuestion = oldBySourceViaApi.get(sourceQuestionId);
        if (existingQuestion) {
            matchedOldIdsViaApi.add(normalizeId(existingQuestion));
            await grammarQuestionsService.update(
                normalizeId(existingQuestion),
                buildQuestionPayload(question, 'exerciseId', targetId, sourceQuestionId),
            );
        } else {
            await grammarQuestionsService.create(
                buildQuestionPayload(question, 'exerciseId', targetId, sourceQuestionId),
            );
        }
    }

    for (const oldQuestion of oldQuestions) {
        const oldQuestionId = normalizeId(oldQuestion);
        if (!matchedOldIdsViaApi.has(oldQuestionId)) {
            await grammarQuestionsService.remove(oldQuestionId);
        }
    }

    return targetId;

    const sourceRef = doc(db, 'grammar_exercises', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Source grammar exercise not found');

    const sourceData = sourceSnap.data();
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, copiedFrom, isDeleted, deletedAt, archived, ...cleanData } = sourceData;

    await updateDoc(doc(db, 'grammar_exercises', targetId), {
        ...cleanData,
        title: sourceData.title || sourceData.name || proposal.proposalName,
        name: sourceData.name || sourceData.title || proposal.proposalName,
        createdByRole: 'admin',
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        archived: deleteField(),
        updatedAt: serverTimestamp()
    });

    // Smart merge questions: update existing, add new, delete removed (preserves IDs for student submissions)
    const oldQuestionsQ = query(collection(db, 'grammar_questions'), where('exerciseId', '==', targetId));
    const oldQSnap = await getDocs(oldQuestionsQ);
    const newQuestionsQ = query(collection(db, 'grammar_questions'), where('exerciseId', '==', sourceId));
    const newQSnap = await getDocs(newQuestionsQ);

    // Build maps: old questions indexed by copiedFrom, new questions by their ID
    const oldBySource = new Map();
    oldQSnap.docs.forEach(d => {
        const cf = d.data().copiedFrom;
        if (cf) oldBySource.set(cf, d);
    });
    const oldQIds = new Set(oldQSnap.docs.map(d => d.id));
    const matchedOldIds = new Set();

    const batch = writeBatch(db);

    // Update existing or add new questions
    for (const qDoc of newQSnap.docs) {
        const existingDoc = oldBySource.get(qDoc.id);
        if (existingDoc) {
            // Question already has an official copy → update it in-place
            matchedOldIds.add(existingDoc.id);
            batch.update(existingDoc.ref, {
                ...qDoc.data(),
                exerciseId: targetId,
                copiedFrom: qDoc.id,
                updatedAt: serverTimestamp()
            });
        } else {
            // New question → create with copiedFrom reference
            const newQRef = doc(collection(db, 'grammar_questions'));
            batch.set(newQRef, {
                ...qDoc.data(),
                exerciseId: targetId,
                copiedFrom: qDoc.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }

    // Delete questions no longer in teacher's version
    for (const oldDoc of oldQSnap.docs) {
        if (!matchedOldIds.has(oldDoc.id)) {
            batch.delete(oldDoc.ref);
        }
    }

    await batch.commit();

    return targetId;
}

async function overwriteGrammarFolderPreset(sourceFolderId, proposal) {
    const existing = await findExistingOfficialCopy(sourceFolderId, 'grammar', 'folder');
    if (!existing) return copyGrammarFolderToPreset(sourceFolderId, proposal);

    const folderDataViaApi = await getTeacherGrammarFolderById(sourceFolderId);
    if (!folderDataViaApi) throw new Error('Source grammar folder not found');

    const rawExerciseIdsViaApi = Array.isArray(folderDataViaApi.exerciseIds) ? folderDataViaApi.exerciseIds : [];
    const exerciseIdsViaApi = [];
    for (const eid of rawExerciseIdsViaApi) {
        const exercise = await grammarExercisesService.findOne(eid).catch(() => null);
        if (exercise && !exercise.isDeleted) {
            exerciseIdsViaApi.push(eid);
        }
    }

    const oldFolderViaApi = await getAdminGrammarFolderById(existing.id);
    const oldExerciseIdsViaApi = Array.isArray(oldFolderViaApi?.exerciseIds) ? oldFolderViaApi.exerciseIds : [];

    const newExerciseIdsViaApi = [];
    for (const exId of exerciseIdsViaApi) {
        try {
            const newId = await overwriteGrammarPreset(exId, proposal);
            newExerciseIdsViaApi.push(newId);
        } catch (e) {
            console.error(`Error overwriting grammar exercise ${exId}:`, e);
        }
    }

    const orphanedIdsViaApi = oldExerciseIdsViaApi.filter(id => !newExerciseIdsViaApi.includes(id));
    for (const orphanId of orphanedIdsViaApi) {
        try {
            const orphanData = await grammarExercisesService.findOne(orphanId).catch(() => null);
            if (orphanData) {
                const currentTitle = orphanData.name || orphanData.title || '';
                if (!currentTitle.startsWith('[Archived]')) {
                    await grammarExercisesService.update(orphanId, {
                        title: `[Archived] ${currentTitle}`,
                        name: `[Archived] ${currentTitle}`,
                        archived: true,
                        createdByRole: 'admin',
                    });
                }
            }
        } catch (e) {
            console.error(`Error archiving grammar exercise ${orphanId}:`, e);
        }
    }

    await adminFoldersService.saveGrammarFolder({
        id: existing.id,
        ...buildOfficialFolderPayload(folderDataViaApi, 'exerciseIds', [...newExerciseIdsViaApi, ...orphanedIdsViaApi], proposal),
    });

    return existing.id;

    const folderRef = doc(db, 'teacher_grammar_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source grammar folder not found');

    const folderData = folderSnap.data();
    const rawExerciseIds = folderData.exerciseIds || [];

    // Filter out soft-deleted teacher grammar exercises
    const exerciseIds = [];
    for (const eid of rawExerciseIds) {
        const eSnap = await getDoc(doc(db, 'grammar_exercises', eid));
        if (eSnap.exists() && !eSnap.data().isDeleted) {
            exerciseIds.push(eid);
        }
    }

    // Get old official folder's current item IDs
    const oldFolderSnap = await getDoc(doc(db, 'grammar_folders', existing.id));
    const oldExerciseIds = oldFolderSnap.exists() ? (oldFolderSnap.data().exerciseIds || []) : [];

    const newExerciseIds = [];
    for (const exId of exerciseIds) {
        try {
            const newId = await overwriteGrammarPreset(exId, proposal);
            newExerciseIds.push(newId);
        } catch (e) {
            console.error(`Error overwriting grammar exercise ${exId}:`, e);
        }
    }

    // Archive orphaned items
    const orphanedIds = oldExerciseIds.filter(id => !newExerciseIds.includes(id));
    for (const orphanId of orphanedIds) {
        try {
            const orphanSnap = await getDoc(doc(db, 'grammar_exercises', orphanId));
            if (orphanSnap.exists()) {
                const orphanData = orphanSnap.data();
                const currentTitle = orphanData.name || orphanData.title || '';
                if (!currentTitle.startsWith('[Archived]')) {
                    await updateDoc(doc(db, 'grammar_exercises', orphanId), {
                        title: `[Archived] ${currentTitle}`,
                        name: `[Archived] ${currentTitle}`,
                        archived: true,
                        createdByRole: 'admin',
                        isDeleted: deleteField(),
                        deletedAt: deleteField(),
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (e) {
            console.error(`Error archiving grammar exercise ${orphanId}:`, e);
        }
    }

    const { teacherId: _t, createdBy: _c, createdByRole: _r, sharedWith: _s, collaboratorIds: _ci, collaboratorNames: _cn, collaboratorRoles: _cr, isDeleted: _d, deletedAt: _da, exerciseIds: _ids, ...cleanFolderData } = folderData;
    await updateDoc(doc(db, 'grammar_folders', existing.id), {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        exerciseIds: [...newExerciseIds, ...orphanedIds],
        updatedAt: serverTimestamp()
    });

    return existing.id;
}

// --- EXAM OVERWRITE ---

async function overwriteExamPreset(sourceId, proposal) {
    const existing = await findExistingOfficialCopy(sourceId, 'exam');
    if (!existing) return copyExamToPreset(sourceId, proposal);

    const targetId = existing.id;
    const sourceDataViaApi = await examsService.findOne(sourceId).catch(() => null);
    if (!sourceDataViaApi) throw new Error('Source exam not found');

    await examsService.update(
        targetId,
        buildOfficialContentPayload(sourceDataViaApi, proposal, { archived: false }),
    );

    const oldQuestionsResult = await examQuestionsService.findAll(targetId);
    const oldQuestions = Array.isArray(oldQuestionsResult) ? oldQuestionsResult : (oldQuestionsResult?.data || []);
    const newQuestionsResult = await examQuestionsService.findAll(sourceId);
    const newQuestions = Array.isArray(newQuestionsResult) ? newQuestionsResult : (newQuestionsResult?.data || []);

    const oldBySourceViaApi = new Map();
    oldQuestions.forEach(question => {
        if (question?.copiedFrom) oldBySourceViaApi.set(question.copiedFrom, question);
    });
    const matchedOldIdsViaApi = new Set();

    for (const question of newQuestions) {
        const sourceQuestionId = normalizeId(question);
        const existingQuestion = oldBySourceViaApi.get(sourceQuestionId);
        if (existingQuestion) {
            matchedOldIdsViaApi.add(normalizeId(existingQuestion));
            await examQuestionsService.update(
                normalizeId(existingQuestion),
                buildQuestionPayload(question, 'examId', targetId, sourceQuestionId),
            );
        } else {
            await examQuestionsService.create(
                buildQuestionPayload(question, 'examId', targetId, sourceQuestionId),
            );
        }
    }

    for (const oldQuestion of oldQuestions) {
        const oldQuestionId = normalizeId(oldQuestion);
        if (!matchedOldIdsViaApi.has(oldQuestionId)) {
            await examQuestionsService.remove(oldQuestionId);
        }
    }

    return targetId;

    const sourceRef = doc(db, 'exams', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Source exam not found');

    const sourceData = sourceSnap.data();
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, copiedFrom, isDeleted, deletedAt, archived, ...cleanData } = sourceData;

    await updateDoc(doc(db, 'exams', targetId), {
        ...cleanData,
        title: sourceData.title || proposal.proposalName,
        createdByRole: 'admin',
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        archived: deleteField(),
        updatedAt: serverTimestamp()
    });

    // Smart merge questions: update existing, add new, delete removed (preserves IDs for student submissions)
    const oldQuestionsQ = query(collection(db, 'exam_questions'), where('examId', '==', targetId));
    const oldQSnap = await getDocs(oldQuestionsQ);
    const newQuestionsQ = query(collection(db, 'exam_questions'), where('examId', '==', sourceId));
    const newQSnap = await getDocs(newQuestionsQ);

    // Build maps: old questions indexed by copiedFrom
    const oldBySource = new Map();
    oldQSnap.docs.forEach(d => {
        const cf = d.data().copiedFrom;
        if (cf) oldBySource.set(cf, d);
    });
    const matchedOldIds = new Set();

    const batch = writeBatch(db);

    // Update existing or add new questions
    for (const qDoc of newQSnap.docs) {
        const existingDoc = oldBySource.get(qDoc.id);
        if (existingDoc) {
            // Question already has an official copy → update it in-place
            matchedOldIds.add(existingDoc.id);
            batch.update(existingDoc.ref, {
                ...qDoc.data(),
                examId: targetId,
                copiedFrom: qDoc.id,
                updatedAt: serverTimestamp()
            });
        } else {
            // New question → create with copiedFrom reference
            const newQRef = doc(collection(db, 'exam_questions'));
            batch.set(newQRef, {
                ...qDoc.data(),
                examId: targetId,
                copiedFrom: qDoc.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }

    // Delete questions no longer in teacher's version
    for (const oldDoc of oldQSnap.docs) {
        if (!matchedOldIds.has(oldDoc.id)) {
            batch.delete(oldDoc.ref);
        }
    }

    await batch.commit();

    return targetId;
}

async function overwriteExamFolderPreset(sourceFolderId, proposal) {
    const existing = await findExistingOfficialCopy(sourceFolderId, 'exam', 'folder');
    if (!existing) return copyExamFolderToPreset(sourceFolderId, proposal);

    const folderDataViaApi = await getTeacherExamFolderById(sourceFolderId);
    if (!folderDataViaApi) throw new Error('Source exam folder not found');

    const rawExamIdsViaApi = Array.isArray(folderDataViaApi.examIds) ? folderDataViaApi.examIds : [];
    const examIdsViaApi = [];
    for (const exId of rawExamIdsViaApi) {
        const exam = await examsService.findOne(exId).catch(() => null);
        if (exam && !exam.isDeleted) {
            examIdsViaApi.push(exId);
        }
    }

    const oldFolderViaApi = await getAdminExamFolderById(existing.id);
    const oldExamIdsViaApi = Array.isArray(oldFolderViaApi?.examIds) ? oldFolderViaApi.examIds : [];

    const newExamIdsViaApi = [];
    for (const exId of examIdsViaApi) {
        try {
            const newId = await overwriteExamPreset(exId, proposal);
            newExamIdsViaApi.push(newId);
        } catch (e) {
            console.error(`Error overwriting exam ${exId}:`, e);
        }
    }

    const orphanedIdsViaApi = oldExamIdsViaApi.filter(id => !newExamIdsViaApi.includes(id));

    for (const orphanId of orphanedIdsViaApi) {
        try {
            const orphanData = await examsService.findOne(orphanId).catch(() => null);
            if (orphanData) {
                const currentTitle = orphanData.name || orphanData.title || '';
                if (!currentTitle.startsWith('[Archived]')) {
                    await examsService.update(orphanId, {
                        title: `[Archived] ${currentTitle}`,
                        name: `[Archived] ${currentTitle}`,
                        archived: true,
                        createdByRole: 'admin',
                    });
                }
            }
        } catch (e) {
            console.error(`Error archiving exam ${orphanId}:`, e);
        }
    }

    await adminFoldersService.saveExamFolder({
        id: existing.id,
        ...buildOfficialFolderPayload(folderDataViaApi, 'examIds', [...newExamIdsViaApi, ...orphanedIdsViaApi], proposal),
    });

    return existing.id;

    const folderRef = doc(db, 'teacher_exam_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source exam folder not found');

    const folderData = folderSnap.data();
    const rawExamIds = folderData.examIds || [];

    // Filter out soft-deleted teacher exams
    const examIds = [];
    for (const exId of rawExamIds) {
        const exSnap = await getDoc(doc(db, 'exams', exId));
        if (exSnap.exists() && !exSnap.data().isDeleted) {
            examIds.push(exId);
        }
    }

    // Get old official folder's current item IDs
    const oldFolderSnap = await getDoc(doc(db, 'exam_folders', existing.id));
    const oldExamIds = oldFolderSnap.exists() ? (oldFolderSnap.data().examIds || []) : [];

    const newExamIds = [];
    for (const exId of examIds) {
        try {
            const newId = await overwriteExamPreset(exId, proposal);
            newExamIds.push(newId);
        } catch (e) {
            console.error(`Error overwriting exam ${exId}:`, e);
        }
    }

    // Archive orphaned items
    const orphanedIds = oldExamIds.filter(id => !newExamIds.includes(id));

    for (const orphanId of orphanedIds) {
        try {
            const orphanSnap = await getDoc(doc(db, 'exams', orphanId));
            if (orphanSnap.exists()) {
                const orphanData = orphanSnap.data();
                const currentTitle = orphanData.name || orphanData.title || '';
                if (!currentTitle.startsWith('[Archived]')) {
                    await updateDoc(doc(db, 'exams', orphanId), {
                        title: `[Archived] ${currentTitle}`,
                        name: `[Archived] ${currentTitle}`,
                        archived: true,
                        createdByRole: 'admin',
                        isDeleted: deleteField(),
                        deletedAt: deleteField(),
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (e) {
            console.error(`Error archiving exam ${orphanId}:`, e);
        }
    }

    const finalExamIds = [...newExamIds, ...orphanedIds];

    const { teacherId: _t, createdBy: _c, createdByRole: _r, sharedWith: _s, collaboratorIds: _ci, collaboratorNames: _cn, collaboratorRoles: _cr, isDeleted: _d, deletedAt: _da, examIds: _ids, ...cleanFolderData } = folderData;
    await updateDoc(doc(db, 'exam_folders', existing.id), {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        examIds: finalExamIds,
        updatedAt: serverTimestamp()
    });

    return existing.id;
}
