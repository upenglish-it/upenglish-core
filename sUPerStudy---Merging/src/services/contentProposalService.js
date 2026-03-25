import { db } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, deleteField, query, where, orderBy } from 'firebase/firestore';
import { createNotificationForAdmins, createNotification } from './notificationService';

// ========== CONTENT PROPOSALS ==========
// Collection: content_proposals

/**
 * Submit a proposal to make teacher content official (preset).
 * @param {Object} data { type, level, sourceId, sourceFolderId, sourceCollection, teacherId, teacherName, teacherEmail, proposalName, proposalDescription, icon, color }
 */
export async function submitProposal(data) {
    const proposalRef = doc(collection(db, 'content_proposals'));
    await setDoc(proposalRef, {
        ...data,
        status: 'pending',
        adminNote: '',
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null
    });

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

    return proposalRef.id;
}

/**
 * Get pending proposals filtered by type (vocab / grammar / exam).
 */
export async function getPendingProposals(type = null) {
    let q;
    if (type) {
        q = query(collection(db, 'content_proposals'), where('status', '==', 'pending'), where('type', '==', type));
    } else {
        q = query(collection(db, 'content_proposals'), where('status', '==', 'pending'));
    }
    const snapshot = await getDocs(q);
    const proposals = [];
    snapshot.forEach(docSnap => proposals.push({ id: docSnap.id, ...docSnap.data() }));
    return proposals.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

/**
 * Get proposals submitted by a specific teacher.
 */
export async function getTeacherProposals(teacherId) {
    const q = query(collection(db, 'content_proposals'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    const proposals = [];
    snapshot.forEach(docSnap => proposals.push({ id: docSnap.id, ...docSnap.data() }));
    return proposals;
}

/**
 * Get the proposal status for a specific source item.
 */
export async function getProposalForSource(sourceId, type) {
    const q = query(
        collection(db, 'content_proposals'),
        where('sourceId', '==', sourceId),
        where('type', '==', type)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        // Return latest proposal (there might be rejected + re-submitted)
        const proposals = [];
        snapshot.forEach(docSnap => proposals.push({ id: docSnap.id, ...docSnap.data() }));
        proposals.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
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
    const proposalRef = doc(db, 'content_proposals', proposalId);
    const proposalSnap = await getDoc(proposalRef);
    if (!proposalSnap.exists()) throw new Error('Proposal not found');

    const proposal = proposalSnap.data();
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

        // Mark as approved
        await updateDoc(proposalRef, {
            status: 'approved',
            approveMode: mode,
            reviewedAt: serverTimestamp(),
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
    const proposalRef = doc(db, 'content_proposals', proposalId);
    const proposalSnap = await getDoc(proposalRef);
    const proposal = proposalSnap.exists() ? proposalSnap.data() : {};

    await updateDoc(proposalRef, {
        status: 'rejected',
        adminNote,
        reviewedAt: serverTimestamp(),
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

// ========== COPY HELPERS ==========

async function copyItemToPreset(proposal) {
    const { type, sourceId } = proposal;

    if (type === 'vocab') {
        await copyVocabToPreset(sourceId, proposal);
    } else if (type === 'grammar') {
        await copyGrammarToPreset(sourceId, proposal);
    } else if (type === 'exam') {
        await copyExamToPreset(sourceId, proposal);
    }
}

async function copyFolderToPreset(proposal) {
    const { type, sourceFolderId } = proposal;

    if (type === 'vocab') {
        await copyVocabFolderToPreset(sourceFolderId, proposal);
    } else if (type === 'grammar') {
        await copyGrammarFolderToPreset(sourceFolderId, proposal);
    } else if (type === 'exam') {
        await copyExamFolderToPreset(sourceFolderId, proposal);
    }
}

// --- VOCAB ---

async function copyVocabToPreset(sourceId, proposal) {
    // Read teacher topic
    const sourceRef = doc(db, 'teacher_topics', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) {
        console.error('[VOCAB COPY] Source topic NOT FOUND in teacher_topics:', sourceId);
        throw new Error('Source topic not found');
    }

    const sourceData = sourceSnap.data();
    
    // Use Firestore auto-generated ID for reliability
    const presetRef = doc(collection(db, 'topics'));
    const newId = presetRef.id;

    // Create preset topic (spread all source data, strip teacher fields AND id)
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, ...cleanData } = sourceData;
    await setDoc(presetRef, {
        ...cleanData,
        name: sourceData.name || proposal.proposalName,
        createdByRole: 'admin',
        copiedFrom: sourceId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Copy words subcollection
    const wordsSnap = await getDocs(collection(db, `teacher_topics/${sourceId}/words`));
    const batch = writeBatch(db);
    wordsSnap.forEach(wordDoc => {
        const wordData = wordDoc.data();
        const wordRef = doc(db, `topics/${newId}/words`, wordDoc.id);
        batch.set(wordRef, { ...wordData });
    });
    await batch.commit();

    return newId;
}

async function copyVocabFolderToPreset(sourceFolderId, proposal) {
    // Read source folder
    const folderRef = doc(db, 'teacher_topic_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source folder not found');

    const folderData = folderSnap.data();
    const topicIds = folderData.topicIds || [];

    // Copy each topic
    const newTopicIds = [];
    for (const topicId of topicIds) {
        try {
            const newId = await copyVocabToPreset(topicId, proposal);
            newTopicIds.push(newId);
        } catch (e) {
            console.error(`[VOCAB FOLDER COPY] Error copying topic ${topicId}:`, e);
        }
    }

    // Create preset folder
    const newFolderId = `pf-${Date.now()}`;
    const presetFolderRef = doc(db, 'topic_folders', newFolderId);
    const { teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, topicIds: _ids, ...cleanFolderData } = folderData;
    
    const folderWriteData = {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        topicIds: newTopicIds,
        copiedFrom: sourceFolderId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        updatedAt: serverTimestamp()
    };
    await setDoc(presetFolderRef, folderWriteData);

    return newFolderId;
}

// --- GRAMMAR ---

async function copyGrammarToPreset(sourceId, proposal) {
    const sourceRef = doc(db, 'grammar_exercises', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Source grammar exercise not found');

    const sourceData = sourceSnap.data();
    const newExerciseRef = doc(collection(db, 'grammar_exercises'));
    const newId = newExerciseRef.id;

    // Create new exercise as admin/preset (spread all source data, strip teacher fields)
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, ...cleanData } = sourceData;
    await setDoc(newExerciseRef, {
        ...cleanData,
        title: sourceData.title || sourceData.name || proposal.proposalName,
        name: sourceData.name || sourceData.title || proposal.proposalName,
        createdByRole: 'admin',
        copiedFrom: sourceId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Copy grammar questions
    const questionsQ = query(collection(db, 'grammar_questions'), where('exerciseId', '==', sourceId));
    const questionsSnap = await getDocs(questionsQ);
    const batch = writeBatch(db);
    questionsSnap.forEach(qDoc => {
        const qData = qDoc.data();
        const newQRef = doc(collection(db, 'grammar_questions'));
        batch.set(newQRef, {
            ...qData,
            exerciseId: newId,
            copiedFrom: qDoc.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();

    return newId;
}

async function copyGrammarFolderToPreset(sourceFolderId, proposal) {
    const folderRef = doc(db, 'teacher_grammar_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source grammar folder not found');

    const folderData = folderSnap.data();
    const exerciseIds = folderData.exerciseIds || [];

    const newExerciseIds = [];
    for (const exId of exerciseIds) {
        try {
            const newId = await copyGrammarToPreset(exId, proposal);
            newExerciseIds.push(newId);
        } catch (e) {
            console.error(`Error copying grammar exercise ${exId}:`, e);
        }
    }

    const newFolderId = `gf-${Date.now()}`;
    const presetFolderRef = doc(db, 'grammar_folders', newFolderId);
    const { teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, exerciseIds: _ids, ...cleanFolderData } = folderData;
    await setDoc(presetFolderRef, {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        exerciseIds: newExerciseIds,
        copiedFrom: sourceFolderId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        updatedAt: serverTimestamp()
    });

    return newFolderId;
}

// --- EXAM ---

async function copyExamToPreset(sourceId, proposal) {
    const sourceRef = doc(db, 'exams', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Source exam not found');

    const sourceData = sourceSnap.data();
    const newExamRef = doc(collection(db, 'exams'));
    const newId = newExamRef.id;

    // Create new exam as admin/preset
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, ...cleanData } = sourceData;
    await setDoc(newExamRef, {
        ...cleanData,
        title: sourceData.title || proposal.proposalName,
        createdByRole: 'admin',
        copiedFrom: sourceId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Copy exam questions
    const questionsQ = query(collection(db, 'exam_questions'), where('examId', '==', sourceId));
    const questionsSnap = await getDocs(questionsQ);
    const batch = writeBatch(db);
    questionsSnap.forEach(qDoc => {
        const qData = qDoc.data();
        const newQRef = doc(collection(db, 'exam_questions'));
        batch.set(newQRef, {
            ...qData,
            examId: newId,
            copiedFrom: qDoc.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();

    return newId;
}

async function copyExamFolderToPreset(sourceFolderId, proposal) {
    const folderRef = doc(db, 'teacher_exam_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source exam folder not found');

    const folderData = folderSnap.data();
    const examIds = folderData.examIds || [];

    const newExamIds = [];
    for (const exId of examIds) {
        try {
            const newId = await copyExamToPreset(exId, proposal);
            newExamIds.push(newId);
        } catch (e) {
            console.error(`Error copying exam ${exId}:`, e);
        }
    }

    const newFolderId = `ef-${Date.now()}`;
    const presetFolderRef = doc(db, 'exam_folders', newFolderId);
    const { teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, isDeleted, deletedAt, examIds: _ids, ...cleanFolderData } = folderData;
    await setDoc(presetFolderRef, {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        examIds: newExamIds,
        copiedFrom: sourceFolderId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        updatedAt: serverTimestamp()
    });

    return newFolderId;
}

// ========== OVERWRITE HELPERS ==========

async function overwriteItemToPreset(proposal) {
    const { type, sourceId } = proposal;
    if (type === 'vocab') {
        await overwriteVocabPreset(sourceId, proposal);
    } else if (type === 'grammar') {
        await overwriteGrammarPreset(sourceId, proposal);
    } else if (type === 'exam') {
        await overwriteExamPreset(sourceId, proposal);
    }
}

async function overwriteFolderToPreset(proposal) {
    const { type, sourceFolderId } = proposal;
    if (type === 'vocab') {
        await overwriteVocabFolderPreset(sourceFolderId, proposal);
    } else if (type === 'grammar') {
        await overwriteGrammarFolderPreset(sourceFolderId, proposal);
    } else if (type === 'exam') {
        await overwriteExamFolderPreset(sourceFolderId, proposal);
    }
}

// --- VOCAB OVERWRITE ---

async function overwriteVocabPreset(sourceId, proposal) {
    const existing = await findExistingOfficialCopy(sourceId, 'vocab');
    if (!existing) return copyVocabToPreset(sourceId, proposal);

    const targetId = existing.id;
    const sourceRef = doc(db, 'teacher_topics', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Source topic not found');

    const sourceData = sourceSnap.data();
    const { id: _sourceId, teacherId, createdBy, createdByRole, sharedWith, collaboratorIds, collaboratorNames, collaboratorRoles, copiedFrom, isDeleted, deletedAt, archived, ...cleanData } = sourceData;

    await updateDoc(doc(db, 'topics', targetId), {
        ...cleanData,
        name: sourceData.name || proposal.proposalName,
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        archived: deleteField(),
        updatedAt: serverTimestamp()
    });

    // Smart merge words: update existing, add new, delete removed (preserves IDs for student progress)
    const oldWordsSnap = await getDocs(collection(db, `topics/${targetId}/words`));
    const newWordsSnap = await getDocs(collection(db, `teacher_topics/${sourceId}/words`));

    const oldWordIds = new Set(oldWordsSnap.docs.map(d => d.id));
    const newWordIds = new Set(newWordsSnap.docs.map(d => d.id));
    const newWordsMap = new Map(newWordsSnap.docs.map(d => [d.id, d.data()]));

    const batch = writeBatch(db);

    // Update existing + add new words
    for (const [wordId, wordData] of newWordsMap) {
        const wordRef = doc(db, `topics/${targetId}/words`, wordId);
        batch.set(wordRef, { ...wordData }, { merge: true });
    }

    // Delete words that no longer exist in teacher's version
    for (const oldId of oldWordIds) {
        if (!newWordIds.has(oldId)) {
            batch.delete(doc(db, `topics/${targetId}/words`, oldId));
        }
    }

    await batch.commit();

    return targetId;
}

async function overwriteVocabFolderPreset(sourceFolderId, proposal) {
    const existing = await findExistingOfficialCopy(sourceFolderId, 'vocab', 'folder');
    if (!existing) return copyVocabFolderToPreset(sourceFolderId, proposal);

    const folderRef = doc(db, 'teacher_topic_folders', sourceFolderId);
    const folderSnap = await getDoc(folderRef);
    if (!folderSnap.exists()) throw new Error('Source folder not found');

    const folderData = folderSnap.data();
    const rawTopicIds = folderData.topicIds || [];

    // Filter out soft-deleted teacher topics
    const topicIds = [];
    for (const tid of rawTopicIds) {
        const tSnap = await getDoc(doc(db, 'teacher_topics', tid));
        if (tSnap.exists() && !tSnap.data().isDeleted) {
            topicIds.push(tid);
        }
    }

    // Get old official folder's current item IDs
    const oldFolderSnap = await getDoc(doc(db, 'topic_folders', existing.id));
    const oldTopicIds = oldFolderSnap.exists() ? (oldFolderSnap.data().topicIds || []) : [];

    const newTopicIds = [];
    for (const topicId of topicIds) {
        try {
            const newId = await overwriteVocabPreset(topicId, proposal);
            newTopicIds.push(newId);
        } catch (e) {
            console.error(`Error overwriting topic ${topicId}:`, e);
        }
    }

    // Archive orphaned items (in old folder but not in new results)
    const orphanedIds = oldTopicIds.filter(id => !newTopicIds.includes(id));
    for (const orphanId of orphanedIds) {
        try {
            const orphanSnap = await getDoc(doc(db, 'topics', orphanId));
            if (orphanSnap.exists()) {
                const orphanData = orphanSnap.data();
                const currentName = orphanData.name || '';
                if (!currentName.startsWith('[Archived]')) {
                    await updateDoc(doc(db, 'topics', orphanId), {
                        name: `[Archived] ${currentName}`,
                        archived: true,
                        createdByRole: 'admin',
                        isDeleted: deleteField(),
                        deletedAt: deleteField(),
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (e) {
            console.error(`Error archiving topic ${orphanId}:`, e);
        }
    }

    const { teacherId: _t, createdBy: _c, createdByRole: _r, sharedWith: _s, collaboratorIds: _ci, collaboratorNames: _cn, collaboratorRoles: _cr, isDeleted: _d, deletedAt: _da, topicIds: _ids, ...cleanFolderData } = folderData;
    const finalTopicIds = [...newTopicIds, ...orphanedIds];
    await updateDoc(doc(db, 'topic_folders', existing.id), {
        ...cleanFolderData,
        name: folderData.name || proposal.proposalName,
        topicIds: finalTopicIds,
        updatedAt: serverTimestamp()
    });

    return existing.id;
}

// --- GRAMMAR OVERWRITE ---

async function overwriteGrammarPreset(sourceId, proposal) {
    const existing = await findExistingOfficialCopy(sourceId, 'grammar');
    if (!existing) return copyGrammarToPreset(sourceId, proposal);

    const targetId = existing.id;
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
