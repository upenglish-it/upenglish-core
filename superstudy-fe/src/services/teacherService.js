import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAllWordProgressMap } from './spacedRepetition';
import wordData from '../data/wordData';
import { userGroupsService, usersService, assignmentsService, teacherTopicsService, teacherFoldersService, sharingService } from '../models';

// Get groups managed by the teacher
// The teacher's user document has an array `groupIds`. 
// We will fetch the groups whose IDs are in that array.
export async function getTeacherGroups(groupIds) {
    if (!groupIds || groupIds.length === 0) return [];
    try {
        const result = await userGroupsService.findByIds(groupIds);
        let groups = Array.isArray(result) ? result : (result?.data || []);
        groups = groups.filter(g => !g.isHidden);
        groups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return groups;
    } catch (error) {
        console.error("Error fetching teacher groups:", error);
        throw error;
    }
}

// Fetch all students (role='user') in a specific group
export async function getStudentsInGroup(groupId) {
    if (!groupId) return [];
    try {
        const result = await usersService.findByGroup(groupId, 'user');
        let students = Array.isArray(result) ? result : (result?.data || []);
        students.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
        return students;
    } catch (error) {
        console.error(`Error fetching students for group ${groupId}: `, error);
        throw error;
    }
}

export async function getGroupById(groupId) {
    if (!groupId) return null;
    try {
        const result = await userGroupsService.findOne(groupId);
        return result || null;
    } catch (error) {
        console.error("Error fetching group by ID:", error);
        throw error;
    }
}

// ASSIGNMENTS MANAGEMENT

export async function createAssignment(assignmentData) {
    try {
        const result = await assignmentsService.create(assignmentData);
        const newId = result?.id || result;

        // Notify students (in-app + email) — non-blocking
        const scheduledStartDate = assignmentData.scheduledStart
            ? (assignmentData.scheduledStart.toDate ? assignmentData.scheduledStart.toDate() : new Date(assignmentData.scheduledStart))
            : null;
        const shouldNotifyNow = !scheduledStartDate || scheduledStartDate <= new Date();

        if (assignmentData.groupId && shouldNotifyNow) {
            const topicName = assignmentData.topicName || 'bài luyện mới';
            const dueDate = assignmentData.dueDate;
            const dueDateStr = dueDate ? (dueDate.toDate ? dueDate.toDate() : new Date(dueDate)).toLocaleString('vi-VN') : '';
            const appUrl = 'https://upenglishvietnam.com/preview/superstudy';

            try {
                const { createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');
                await createNotificationForGroupStudents(assignmentData.groupId, {
                    type: 'assignment_new', title: '📚 Bài luyện mới',
                    message: `Bạn có bài luyện mới: "${topicName}".${dueDateStr ? ` Hạn: ${dueDateStr}` : ''}`,
                    link: '/dashboard?tab=assignments'
                });
                await queueEmailForGroupStudents(assignmentData.groupId, {
                    subject: `Bài luyện mới: ${topicName}`,
                    html: buildEmailHtml({
                        emoji: '📚', heading: 'Bài luyện mới', headingColor: '#4f46e5',
                        greeting: 'Chào bạn 👋',
                        body: `<p>Thầy/cô vừa giao cho bạn bài luyện mới. Cố gắng hoàn thành đúng hạn nhé! 💪</p>`,
                        highlight: `<strong style="font-size:1.05rem;">${topicName}</strong>${dueDateStr ? `<br><span style="color:#ef4444;font-size:0.9rem;">⏰ Hạn: ${dueDateStr}</span>` : ''}`,
                        highlightBg: '#f8fafc', highlightBorder: '#4f46e5',
                        ctaText: 'Vào làm bài ngay', ctaLink: `${appUrl}/dashboard?tab=assignments`
                    })
                });
            } catch (e) { console.error('Error sending assignment notifications:', e); }
        }

        return { id: newId, ...assignmentData };
    } catch (error) {
        console.error("Error creating assignment:", error);
        throw error;
    }
}

export async function getAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const result = await assignmentsService.findAll({ groupId });
        let assignments = Array.isArray(result) ? result : (result?.data || []);
        assignments = assignments.filter(a => !a.isDeleted);
        assignments.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            const msA = new Date(a.dueDate).getTime();
            const msB = new Date(b.dueDate).getTime();
            return msA - msB;
        });
        return assignments;
    } catch (error) {
        console.error(`Error fetching assignments for group ${groupId}: `, error);
        throw error;
    }
}

export async function getAssignmentsForTopic(topicId) {
    if (!topicId) return [];
    try {
        const result = await assignmentsService.findAll({ topicId });
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error('Error fetching assignments for topic:', error);
        return [];
    }
}

export async function getAssignmentsForGroups(groupIds, userId = null) {
    if (!groupIds || groupIds.length === 0) return [];
    try {
        const result = await assignmentsService.findByGroups(groupIds);
        let allAssignments = Array.isArray(result) ? result : (result?.data || []);
        allAssignments = allAssignments.filter(a => !a.isDeleted);
        if (userId) {
            allAssignments = allAssignments.filter(a => {
                if (a.assignedStudentIds && Array.isArray(a.assignedStudentIds) && a.assignedStudentIds.length > 0) {
                    return a.assignedStudentIds.includes(userId);
                }
                return true;
            });
        }
        allAssignments.sort((a, b) => {
            const msA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const msB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return msB - msA;
        });
        return allAssignments;
    } catch (error) {
        console.error("Error fetching assignments for groups:", error);
        throw error;
    }
}

export async function deleteAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    await assignmentsService.softDelete(assignmentId);
}

export async function restoreAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    await assignmentsService.restore(assignmentId);
}

export async function permanentlyDeleteAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    await assignmentsService.permanentDelete(assignmentId);
}

export async function getDeletedAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const result = await assignmentsService.findDeleted({ groupId });
        let data = Array.isArray(result) ? result : (result?.data || []);
        data.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
        return data;
    } catch (error) {
        console.error("Error fetching deleted assignments:", error);
        return [];
    }
}

export async function updateAssignmentDueDate(assignmentId, newDueDate) {
    if (!assignmentId || !newDueDate) throw new Error("Missing assignment ID or new due date");
    try {
        const assignment = await assignmentsService.findOne(assignmentId);
        await assignmentsService.update(assignmentId, { dueDate: newDueDate });

        // Email students about extended deadline
        if (assignment) {
            const topicName = assignment.topicName || 'bài luyện';
            const dueDateStr = new Date(newDueDate).toLocaleString('vi-VN');
            const groupId = assignment.groupId;
            if (groupId) {
                try {
                    const { createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');
                    await createNotificationForGroupStudents(groupId, {
                        type: 'deadline_extended', title: '⏰ Gia hạn deadline',
                        message: `Bài "${topicName}" được gia hạn đến ${dueDateStr}.`, link: '/dashboard?tab=assignments'
                    });
                    const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
                    await queueEmailForGroupStudents(groupId, {
                        subject: `Gia hạn: ${topicName}`,
                        html: buildEmailHtml({
                            emoji: '⏰', heading: 'Gia hạn deadline', headingColor: '#f59e0b',
                            greeting: 'Chào bạn 👋',
                            body: `<p>Bài luyện <strong>"${topicName}"</strong> đã được thầy/cô gia hạn thêm thời gian. Tranh thủ làm bài nhé!</p>`,
                            highlight: `<strong>📅 Hạn mới: ${dueDateStr}</strong>`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Vào làm bài', ctaLink: `${appUrl}/dashboard?tab=assignments`, ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    });
                } catch (e) { console.error('Error sending deadline extension notification:', e); }
            }
        }
    } catch (error) {
        console.error("Error updating assignment due date:", error);
        throw error;
    }
}

export async function updateAssignmentStudentDeadline(assignmentId, studentId, newDueDate) {
    if (!assignmentId || !studentId || !newDueDate) throw new Error("Missing parameters");
    try {
        const assignment = await assignmentsService.findOne(assignmentId);
        await assignmentsService.update(assignmentId, {
            [`studentDeadlines.${studentId}`]: newDueDate,
        });

        if (assignment) {
            const topicName = assignment.topicName || 'bài luyện';
            const dueDateStr = new Date(newDueDate).toLocaleString('vi-VN');
            try {
                const { createNotification, queueEmail, buildEmailHtml } = await import('./notificationService');
                const student = await usersService.findOne(studentId);
                const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
                await createNotification({ userId: studentId, type: 'deadline_extended', title: '⏰ Gia hạn deadline', message: `Bài "${topicName}" được gia hạn cho bạn đến ${dueDateStr}.`, link: '/dashboard?tab=assignments' });
                if (student?.email) {
                    await queueEmail(student.email, {
                        subject: `Gia hạn: ${topicName}`,
                        html: buildEmailHtml({
                            emoji: '⏰', heading: 'Gia hạn deadline', headingColor: '#f59e0b',
                            greeting: 'Chào bạn 👋',
                            body: `<p>Bài luyện <strong>"${topicName}"</strong> đã được thầy/cô gia hạn riêng cho bạn. Cố gắng hoàn thành nhé!</p>`,
                            highlight: `<strong>📅 Hạn mới: ${dueDateStr}</strong>`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Vào làm bài', ctaLink: `${appUrl}/dashboard?tab=assignments`, ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    });
                }
            } catch (e) { console.error('Error sending individual deadline notification:', e); }
        }
    } catch (error) {
        console.error("Error updating student deadline:", error);
        throw error;
    }
}

export async function removeAssignmentStudentDeadline(assignmentId, studentId) {
    if (!assignmentId || !studentId) throw new Error("Missing parameters");
    await assignmentsService.update(assignmentId, {
        [`studentDeadlines.${studentId}`]: null,
    });
}

// ==========================================
// DETAILED STUDENT PROGRESS TRACKING
// ==========================================

const processWordProgress = (word, progressMap, statsCount) => {
    statsCount.total++;
    const prog = progressMap[word];

    if (prog) {
        if (prog.level >= 1) statsCount.learned++;
        else statsCount.learning++;

        // Accumulate steps for granular progress %
        statsCount.completedSteps = (statsCount.completedSteps || 0) + Math.min(prog.stepsCompleted ?? 0, 6);

        let interimCorrect = 0;
        let interimWrong = 0;
        if (prog.stepMastery) {
            try {
                const sm = typeof prog.stepMastery === 'string' ? JSON.parse(prog.stepMastery) : prog.stepMastery;
                Object.values(sm).forEach(step => {
                    interimCorrect += step.correct || 0;
                    interimWrong += step.wrong || 0;
                });
            } catch (e) {
                // ignore
            }
        }

        statsCount.totalCorrect += (prog.totalCorrect ?? 0) + interimCorrect;
        statsCount.totalWrong += (prog.totalWrong ?? 0) + interimWrong;
    } else {
        statsCount.notStarted++;
    }
};

/**
 * Get a high-level summary of progress for multiple topics for a specific student.
 */
export async function getStudentTopicProgressSummary(uid, topicIds, startDate = '', endDate = '') {
    if (!uid || !topicIds || topicIds.length === 0) return {};

    try {
        const progressMap = await getAllWordProgressMap(uid, startDate, endDate);
        const result = {};

        await Promise.all(topicIds.map(async (topicId) => {
            const statsCount = {
                total: 0, learned: 0, learning: 0, notStarted: 0, totalCorrect: 0, totalWrong: 0
            };

            if (wordData[topicId]) {
                const wordsList = wordData[topicId];
                wordsList.forEach(wordObj => {
                    processWordProgress(wordObj.word, progressMap, statsCount);
                });
            } else {
                let colPath = `topics/${topicId}/words`;
                if (topicId.startsWith('t-')) {
                    colPath = `teacher_topics/${topicId}/words`;
                }
                const wordsSnap = await getDocs(collection(db, colPath));
                wordsSnap.forEach(docSnap => {
                    const wordObj = docSnap.data();
                    processWordProgress(wordObj.word, progressMap, statsCount);
                });
            }

            result[topicId] = statsCount;
        }));

        return result;
    } catch (error) {
        console.error("Error getting student topic progress summary:", error);
        throw error;
    }
}

/**
 * Get detailed word-by-word progress for a specific student and topic.
 */
export async function getStudentTopicWordsProgress(uid, topicId) {
    if (!uid || !topicId) return [];

    try {
        const progressMap = await getAllWordProgressMap(uid);
        const words = [];

        if (wordData[topicId]) {
            const wordsList = wordData[topicId];
            wordsList.forEach(wordObj => {
                const word = wordObj.word;
                const prog = progressMap[word];
                words.push({
                    ...wordObj,
                    progress: prog || null
                });
            });
        } else {
            let colPath = `topics/${topicId}/words`;
            if (topicId.startsWith('t-')) {
                colPath = `teacher_topics/${topicId}/words`;
            }
            const wordsSnap = await getDocs(collection(db, colPath));

            wordsSnap.forEach(docSnap => {
                const wordObj = docSnap.data();
                const word = wordObj.word;
                const prog = progressMap[word];

                words.push({
                    ...wordObj,
                    progress: prog || null
                });
            });
        }

        words.sort((a, b) => {
            const levelA = a.progress ? a.progress.level : -1;
            const levelB = b.progress ? b.progress.level : -1;
            return levelA - levelB;
        });

        return words;
    } catch (error) {
        console.error("Error getting detailed topic words progress:", error);
        throw error;
    }
}

// ==========================================
// TEACHER TOPICS (LEARNING SETS)
// ==========================================

import { documentId } from 'firebase/firestore';

export async function getSharedAndPublicTeacherTopics(topicAccessIds = []) {
    try {
        const result = await teacherTopicsService.getSharedAndPublic(topicAccessIds);
        let topics = Array.isArray(result) ? result : (result?.data || []);
        return topics.map(t => ({ ...t, id: t._id || t.id }));
    } catch (error) {
        console.error("Error fetching shared teacher topics:", error);
        return [];
    }
}

export async function getTeacherTopics(teacherId) {
    if (!teacherId) return [];
    try {
        const result = await teacherTopicsService.findAll(teacherId);
        let topics = Array.isArray(result) ? result : (result?.data || []);
        return topics.map(t => ({ ...t, id: t._id || t.id }));
    } catch (error) {
        console.error("Error fetching teacher topics:", error);
        throw error;
    }
}

export async function saveTeacherTopic(teacherId, topicData) {
    if (!teacherId || !topicData) throw new Error("Missing teacherId or topic data");
    try {
        const { id, _id, ...data } = topicData;
        const targetId = id || _id;
        
        if (targetId) {
            try {
                // Attempt to update first (optimistic for existing docs)
                const updated = await teacherTopicsService.update(targetId, data);
                return updated;
            } catch (e) {
                // If not found, it's a new document with an explicitly provided ID
                const created = await teacherTopicsService.create({ _id: targetId, ...data, teacherId });
                return created;
            }
        } else {
            const created = await teacherTopicsService.create({ ...data, teacherId });
            return created;
        }
    } catch (error) {
        console.error("Error saving teacher topic:", error);
        throw error;
    }
}

export async function updateGrammarQuestionsOrder(exerciseId, orderedQuestions) {
    if (!exerciseId || !Array.isArray(orderedQuestions)) throw new Error("Invalid parameters");
    try {
        const questionsRef = collection(db, `grammar_questions`);
        const promises = orderedQuestions.map(async (qData) => {
            if (!qData.id) return;
            const docRef = doc(questionsRef, qData.id);
            return setDoc(docRef, { order: qData.order, updatedAt: serverTimestamp() }, { merge: true });
        });
        await Promise.all(promises);
    } catch (error) {
        console.error("Error updating grammar questions order:", error);
        throw error;
    }
}

export async function deleteTeacherTopic(teacherId, topicId) {
    if (!teacherId || !topicId) throw new Error("Missing teacherId or topicId");
    try {
        await teacherTopicsService.softDelete(topicId);
    } catch (error) {
        console.error("Error soft-deleting teacher topic:", error);
        throw error;
    }
}

export async function restoreTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    await teacherTopicsService.restore(topicId);
}

export async function permanentlyDeleteTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    try {
        await teacherTopicsService.permanentDelete(topicId);
    } catch (error) {
        console.error("Error permanently deleting teacher topic:", error);
        throw error;
    }
}

export async function getDeletedTeacherTopics() {
    try {
        const result = await teacherTopicsService.findDeleted();
        let topics = Array.isArray(result) ? result : (result?.data || []);
        topics = topics.map(t => ({ ...t, id: t._id || t.id }));
        return topics.sort((a, b) => {
            const tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return tB - tA;
        });
    } catch (error) {
        console.error("Error fetching deleted teacher topics:", error);
        return [];
    }
}

export async function getTeacherTopicWords(topicId) {
    if (!topicId) return [];
    try {
        const topic = await teacherTopicsService.findOne(topicId);
        if (!topic) return [];
        let words = topic.words || [];
        words = words.map(w => ({ ...w, id: w._id || w.id }));
        words.sort((a, b) => {
            if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tA - tB;
        });
        return words;
    } catch (error) {
        console.error("Error fetching teacher topic words:", error);
        throw error;
    }
}

export async function saveTeacherTopicWord(topicId, wordData) {
    if (!topicId || !wordData || !wordData.word) throw new Error("Missing data to save word");
    console.log("saveTeacherTopicWord called with id:", wordData.id, "word:", wordData.word);
    try {
        const topic = await teacherTopicsService.findOne(topicId);
        if (!topic) throw new Error("Topic not found");
        let words = topic.words || [];
        words = words.map(w => ({ ...w, id: w._id || w.id }));
        
        let savedWord;
        if (wordData.id) {
            words = words.map(w => w.id === wordData.id ? { ...w, ...wordData, updatedAt: new Date().toISOString() } : w);
            savedWord = words.find(w => w.id === wordData.id);
        } else {
            savedWord = { 
                ...wordData, 
                id: crypto.randomUUID(), 
                createdAt: new Date().toISOString(), 
                updatedAt: new Date().toISOString() 
            };
            words.push(savedWord);
        }
        await teacherTopicsService.update(topicId, { words, cachedWordCount: words.length });
        return savedWord;
    } catch (error) {
        console.error("Error saving teacher topic word:", error);
        throw error;
    }
}

export async function saveMultipleTeacherTopicWords(topicId, wordsArray) {
    if (!topicId || !wordsArray || !Array.isArray(wordsArray)) throw new Error("Invalid parameters");
    try {
        const topic = await teacherTopicsService.findOne(topicId);
        if (!topic) throw new Error("Topic not found");
        let currentWords = topic.words || [];
        currentWords = currentWords.map(w => ({ ...w, id: w._id || w.id }));
        
        const newWords = wordsArray.map(wordData => ({
            ...wordData,
            id: wordData.id || crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));

        currentWords = [...currentWords, ...newWords];
        await teacherTopicsService.update(topicId, { words: currentWords, cachedWordCount: currentWords.length });
    } catch (error) {
        console.error("Error saving multiple teacher topic words:", error);
        throw error;
    }
}

export async function deleteTeacherTopicWord(topicId, wordId) {
    if (!topicId || !wordId) throw new Error("Missing topicId or wordId. Received wordId: " + wordId);
    try {
        const topic = await teacherTopicsService.findOne(topicId);
        if (!topic) return;
        let words = topic.words || [];
        words = words.map(w => ({ ...w, id: w._id || w.id }));
        words = words.filter(w => w.id !== wordId);
        await teacherTopicsService.update(topicId, { words, cachedWordCount: words.length });
    } catch (error) {
        console.error("Error deleting teacher topic word:", error);
        throw error;
    }
}

export async function updateTeacherTopicWordOrder(topicId, orderedWords) {
    if (!topicId || !Array.isArray(orderedWords)) throw new Error("Invalid parameters");
    try {
        const topic = await teacherTopicsService.findOne(topicId);
        if (!topic) return;
        let currentWords = topic.words || [];
        currentWords = currentWords.map(w => ({ ...w, id: w._id || w.id }));
        
        orderedWords.forEach(updatedWord => {
            if (!updatedWord.id) return;
            const index = currentWords.findIndex(w => w.id === updatedWord.id);
            if (index !== -1) {
                currentWords[index].index = updatedWord.index;
                currentWords[index].updatedAt = new Date().toISOString();
            }
        });
        
        await teacherTopicsService.update(topicId, { words: currentWords });
    } catch (error) {
        console.error("Error updating word order:", error);
        throw error;
    }
}

// ==========================================
// TEACHER TOPIC FOLDERS
// ==========================================

export async function getTeacherTopicFolders(teacherId) {
    if (!teacherId) return [];
    try {
        const result = await teacherFoldersService.getTopicFolders(teacherId);
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error("Error fetching teacher topic folders:", error);
        return [];
    }
}

export async function updateTeacherTopicFoldersOrder(orderedFolders) {
    try {
        await teacherFoldersService.reorderTopicFolders(orderedFolders.map((f, i) => ({ id: f.id, order: i })));
    } catch (error) {
        console.error("Error updating teacher topic folders order:", error);
    }
}

export async function getAllTeacherTopicFolders() {
    try {
        const result = await teacherFoldersService.getAllTopicFolders();
        let folders = Array.isArray(result) ? result : (result?.data || []);
        return folders.map(f => ({ ...f, id: f._id || f.id })).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error("Error fetching all teacher topic folders:", error);
        return [];
    }
}

export async function saveTeacherTopicFolder(teacherId, folderData) {
    const dataToSave = { ...folderData, teacherId };
    try {
        const result = await teacherFoldersService.saveTopicFolder(dataToSave);
        return result?.id || result;
    } catch (error) {
        console.error("Error saving teacher topic folder:", error);
        throw error;
    }
}

export async function deleteTeacherTopicFolder(folderId) {
    try {
        await teacherFoldersService.softDeleteTopicFolder(folderId);
    } catch (error) {
        console.error("Error deleting teacher topic folder:", error);
        throw error;
    }
}

export async function restoreTeacherTopicFolder(folderId) {
    try {
        await teacherFoldersService.restoreTopicFolder(folderId);
    } catch (error) {
        console.error("Error restoring teacher topic folder:", error);
        throw error;
    }
}

export async function permanentlyDeleteTeacherTopicFolder(folderId) {
    try {
        await teacherFoldersService.permanentDeleteTopicFolder(folderId);
    } catch (error) {
        console.error("Error permanently deleting teacher topic folder:", error);
        throw error;
    }
}

export async function getDeletedTeacherTopicFolders(teacherId) {
    try {
        const result = await teacherFoldersService.getDeletedTopicFolders(teacherId);
        const folders = Array.isArray(result) ? result : (result?.data || []);
        return folders;
    } catch (error) {
        console.error("Error fetching deleted teacher topic folders:", error);
        return [];
    }
}

// ==========================================
// TEACHER COLLABORATION
// ==========================================


/**
 * Add a collaborator to a resource (teacher_topics, grammar_exercises, exams).
 * Sends a notification to the collaborator.
 */
export async function addCollaborator(collectionName, resourceId, collaboratorUid, collaboratorName, resourceName = '', role = 'editor') {
    if (!collectionName || !resourceId || !collaboratorUid) throw new Error('Missing parameters');
    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, {
        collaboratorIds: arrayUnion(collaboratorUid),
        [`collaboratorNames.${collaboratorUid}`]: collaboratorName || 'Giáo viên',
        [`collaboratorRoles.${collaboratorUid}`]: role,
        updatedAt: serverTimestamp()
    });

    // Send notification + email
    try {
        const { createNotification, queueEmail, buildEmailHtml, getUserEmailPreference } = await import('./notificationService');
        const typeLabels = { teacher_topics: 'bài từ vựng', grammar_exercises: 'bài Kỹ năng', exams: 'bài tập và kiểm tra', teacher_topic_folders: 'folder Từ vựng', teacher_grammar_folders: 'folder Kỹ năng', teacher_exam_folders: 'folder Đề thi' };
        const roleLabel = role === 'viewer' ? 'xem & sử dụng' : 'cộng tác chỉnh sửa';
        await createNotification({
            userId: collaboratorUid,
            type: 'collab_invite',
            title: '🤝 Bạn được mời hợp tác',
            message: `Bạn được mời ${roleLabel} ${typeLabels[collectionName] || 'bài học'} "${resourceName}".`,
            link: '/teacher'
        });

        // Email to collaborator (check preference)
        const wantsEmail = await getUserEmailPreference(collaboratorUid, 'collab');
        if (wantsEmail) {
            const collabSnap = await getDoc(doc(db, 'users', collaboratorUid));
            if (collabSnap.exists() && collabSnap.data().email) {
                await queueEmail(collabSnap.data().email, {
                    subject: `Bạn được mời ${roleLabel}: ${resourceName}`,
                    html: buildEmailHtml({
                        emoji: '🤝', heading: 'Lời mời cộng tác', headingColor: '#6366f1',
                        body: `<p>Bạn vừa được mời <strong>${roleLabel}</strong> ${typeLabels[collectionName] || 'bài học'} trên sUPerStudy. Cùng nhau tạo nội dung hay cho học viên nhé! 🚀</p>`,
                        highlight: `<strong>${resourceName}</strong>`,
                        highlightBg: '#eef2ff', highlightBorder: '#6366f1',
                        ctaText: 'Mở sUPerStudy', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/teacher', ctaColor: '#6366f1', ctaColor2: '#818cf8'
                    })
                });
            }
        }
    } catch (e) {
        console.error('Error sending collab invite notification:', e);
    }
}

/**
 * Remove a collaborator from a resource.
 * Sends a notification to the removed collaborator.
 */
export async function removeCollaborator(collectionName, resourceId, collaboratorUid, resourceName = '') {
    if (!collectionName || !resourceId || !collaboratorUid) throw new Error('Missing parameters');
    await sharingService.removeCollaborator({
        resourceType: collectionName,
        resourceId,
        collaboratorId: collaboratorUid
    });
}

/**
 * Update a collaborator's role (viewer or editor).
 */
export async function updateCollaboratorRole(collectionName, resourceId, collaboratorUid, newRole) {
    if (!collectionName || !resourceId || !collaboratorUid) throw new Error('Missing parameters');
    if (!['viewer', 'editor'].includes(newRole)) throw new Error('Invalid role');
    await sharingService.updateCollaboratorRole({
        resourceType: collectionName,
        resourceId,
        collaboratorId: collaboratorUid,
        role: newRole
    });
}

/**
 * Transfer ownership of a resource to a new owner.
 * The old owner becomes a collaborator.
 * @param {string} collectionName - 'teacher_topics', 'grammar_exercises', or 'exams'
 * @param {string} resourceId
 * @param {string} oldOwnerUid
 * @param {string} oldOwnerName
 * @param {string} newOwnerUid
 * @param {string} newOwnerName
 * @param {string} resourceName - for notification text
 */
export async function transferOwnership(collectionName, resourceId, oldOwnerUid, oldOwnerName, newOwnerUid, newOwnerName, resourceName = '') {
    if (!collectionName || !resourceId || !oldOwnerUid || !newOwnerUid) throw new Error('Missing parameters');
    await sharingService.transferOwnership({
        resourceType: collectionName,
        resourceId,
        oldOwnerId: oldOwnerUid,
        oldOwnerName,
        newOwnerId: newOwnerUid,
        newOwnerName,
        resourceName
    });
}

/**
 * Get resources where a user is a collaborator.
 * @param {string} collectionName - 'teacher_topics', 'grammar_exercises', or 'exams'
 * @param {string} teacherUid
 */
export async function getCollaboratedResources(collectionName, teacherUid) {
    if (!collectionName || !teacherUid) return [];
    try {
        const result = await sharingService.getCollaboratedResources(collectionName, teacherUid);
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error(`Error fetching collaborated ${collectionName}:`, error);
        return [];
    }
}

/**
 * Find a teacher user by email. Returns { uid, displayName, email } or null.
 */
export async function findTeacherByEmail(email) {
    if (!email) return null;
    try {
        const result = await sharingService.findUser(email, 'teacher');
        // Backend returns `{ uid, email, displayName, role }` directly
        return result?.uid ? result : null;
    } catch (e) {
        console.error('Error finding teacher by email:', e);
        return null;
    }
}
