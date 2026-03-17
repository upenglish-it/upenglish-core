import { db } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
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
 * Approve a proposal and copy content to the official preset collection.
 */
export async function approveProposal(proposalId, adminUid) {
    const proposalRef = doc(db, 'content_proposals', proposalId);
    const proposalSnap = await getDoc(proposalRef);
    if (!proposalSnap.exists()) throw new Error('Proposal not found');

    const proposal = proposalSnap.data();
    if (proposal.status !== 'pending') throw new Error('Proposal already reviewed');

    try {
        if (proposal.level === 'folder') {
            await copyFolderToPreset(proposal);
        } else {
            await copyItemToPreset(proposal);
        }

        // Mark as approved
        await updateDoc(proposalRef, {
            status: 'approved',
            reviewedAt: serverTimestamp(),
            reviewedBy: adminUid
        });

        // Notify teacher
        const typeLabels = { vocab: 'Từ vựng', grammar: 'Kỹ năng', exam: 'Bài tập và Kiểm tra' };
        const teacherLinks = { vocab: '/teacher/topics', grammar: '/teacher/grammar', exam: '/teacher/exams' };
        try {
            await createNotification({
                userId: proposal.teacherId,
                type: 'proposal_approved',
                title: `✅ Đề xuất được duyệt: ${typeLabels[proposal.type] || proposal.type}`,
                message: `"${proposal.proposalName}" đã được admin duyệt thành tài liệu chính thức!`,
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
                            body: `<p>Tin vui! Tài liệu <strong>"${proposal.proposalName}"</strong> của bạn đã được duyệt thành tài liệu chính thức của Trung tâm Ngoại ngữ UP. Cảm ơn bạn đã đóng góp! 🌟</p>`,
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
    if (!sourceSnap.exists()) throw new Error('Source topic not found');

    const sourceData = sourceSnap.data();
    const newId = `preset-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Create preset topic
    const presetRef = doc(db, 'topics', newId);
    await setDoc(presetRef, {
        name: sourceData.name || proposal.proposalName,
        description: sourceData.description || proposal.proposalDescription || '',
        icon: sourceData.icon || proposal.icon || '📘',
        color: sourceData.color || proposal.color || '#10b981',
        copiedFrom: sourceId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        createdAt: serverTimestamp()
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
            console.error(`Error copying topic ${topicId}:`, e);
        }
    }

    // Create preset folder
    const newFolderId = `pf-${Date.now()}`;
    const presetFolderRef = doc(db, 'topic_folders', newFolderId);
    await setDoc(presetFolderRef, {
        name: folderData.name || proposal.proposalName,
        description: folderData.description || '',
        icon: folderData.icon || '📁',
        color: folderData.color || '#3b82f6',
        topicIds: newTopicIds,
        copiedFrom: sourceFolderId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        updatedAt: serverTimestamp()
    });

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

    // Create new exercise as admin/preset
    await setDoc(newExerciseRef, {
        title: sourceData.title || proposal.proposalName,
        description: sourceData.description || proposal.proposalDescription || '',
        icon: sourceData.icon || proposal.icon || '📝',
        color: sourceData.color || proposal.color || '#8b5cf6',
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
    await setDoc(presetFolderRef, {
        name: folderData.name || proposal.proposalName,
        description: folderData.description || '',
        icon: folderData.icon || '📁',
        color: folderData.color || '#8b5cf6',
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
    const { teacherId, createdBy, sharedWith, ...cleanData } = sourceData;
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
    await setDoc(presetFolderRef, {
        name: folderData.name || proposal.proposalName,
        description: folderData.description || '',
        icon: folderData.icon || '📁',
        color: folderData.color || '#3b82f6',
        examIds: newExamIds,
        copiedFrom: sourceFolderId,
        proposedBy: proposal.teacherId,
        proposedByName: proposal.teacherName,
        updatedAt: serverTimestamp()
    });

    return newFolderId;
}
