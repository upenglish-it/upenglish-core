import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAllWordProgressMap } from './spacedRepetition';
import wordData from '../data/wordData';

// Get groups managed by the teacher
// The teacher's user document has an array `groupIds`. 
// We will fetch the groups whose IDs are in that array.
export async function getTeacherGroups(groupIds) {
    if (!groupIds || groupIds.length === 0) return [];

    try {
        const groupsRef = collection(db, 'user_groups');
        // Firestore 'in' query supports up to 10 items.
        // Assuming teachers manage a small number of groups.
        const chunks = [];
        for (let i = 0; i < groupIds.length; i += 10) {
            chunks.push(groupIds.slice(i, i + 10));
        }

        let allGroups = [];
        for (const chunk of chunks) {
            const q = query(groupsRef, where('__name__', 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                allGroups.push({ id: docSnap.id, ...docSnap.data() });
            });
        }

        // Filter out hidden groups and sort alphabetically by name
        allGroups = allGroups.filter(g => !g.isHidden);
        allGroups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return allGroups;
    } catch (error) {
        console.error("Error fetching teacher groups:", error);
        throw error;
    }
}

// Fetch all students (role='user') in a specific group
export async function getStudentsInGroup(groupId) {
    if (!groupId) return [];
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('groupIds', 'array-contains', groupId),
            where('role', '==', 'user')
        );
        const snapshot = await getDocs(q);
        const students = [];
        snapshot.forEach(docSnap => {
            students.push({ uid: docSnap.id, ...docSnap.data() });
        });

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
        const docRef = doc(db, 'user_groups', groupId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching group by ID:", error);
        throw error;
    }
}

// ASSIGNMENTS MANAGEMENT

export async function createAssignment(assignmentData) {
    try {
        const assignmentsRef = collection(db, 'assignments');
        const newDocRef = doc(assignmentsRef); // auto-id
        const newAssignment = {
            ...assignmentData,
            createdAt: serverTimestamp()
        };
        await setDoc(newDocRef, newAssignment);

        // Auto-share the topic with the group to ensure students have access
        if (assignmentData.groupId && assignmentData.topicId) {
            const groupRef = doc(db, 'user_groups', assignmentData.groupId);
            await updateDoc(groupRef, {
                topicAccess: arrayUnion(assignmentData.topicId)
            });
        }

        // Notify students (in-app + email) — non-blocking
        // Skip notifications if scheduledStart is set and in the future
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

                // In-app notification
                await createNotificationForGroupStudents(assignmentData.groupId, {
                    type: 'assignment_new',
                    title: '📚 Bài luyện mới',
                    message: `Bạn có bài luyện mới: "${topicName}".${dueDateStr ? ` Hạn: ${dueDateStr}` : ''}`,
                    link: '/dashboard?tab=assignments'
                });

                // Email
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
            } catch (e) {
                console.error('Error sending assignment notifications:', e);
            }
        }

        return { id: newDocRef.id, ...newAssignment };
    } catch (error) {
        console.error("Error creating assignment:", error);
        throw error;
    }
}

export async function getAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const assignmentsRef = collection(db, 'assignments');
        const q = query(
            assignmentsRef,
            where('groupId', '==', groupId)
        );
        const snapshot = await getDocs(q);
        const data = [];
        snapshot.forEach(docSnap => {
            data.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Filter out soft-deleted assignments
        const activeData = data.filter(a => !a.isDeleted);

        // Sort by dueDate descending locally (or ascending, depending on preference)
        // Usually, sorting by dueDate strictly requires a composite index if doing it in query,
        // so we sort locally since assignment list per group will be small.
        activeData.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            const msA = typeof a.dueDate.toMillis === 'function' ? a.dueDate.toMillis() : new Date(a.dueDate).getTime();
            const msB = typeof b.dueDate.toMillis === 'function' ? b.dueDate.toMillis() : new Date(b.dueDate).getTime();
            return msA - msB;
        });

        return activeData;
    } catch (error) {
        console.error(`Error fetching assignments for group ${groupId}: `, error);
        throw error;
    }
}

export async function getAssignmentsForTopic(topicId) {
    if (!topicId) return [];
    try {
        const q = query(collection(db, 'assignments'), where('topicId', '==', topicId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching assignments for topic:', error);
        return [];
    }
}

export async function getAssignmentsForGroups(groupIds, userId = null) {
    if (!groupIds || groupIds.length === 0) return [];
    try {
        const assignmentsRef = collection(db, 'assignments');
        const chunks = [];
        for (let i = 0; i < groupIds.length; i += 10) {
            chunks.push(groupIds.slice(i, i + 10));
        }

        let allAssignments = [];
        for (const chunk of chunks) {
            const q = query(assignmentsRef, where('groupId', 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                allAssignments.push({ id: docSnap.id, ...docSnap.data() });
            });
        }

        // Filter out soft-deleted assignments
        allAssignments = allAssignments.filter(a => !a.isDeleted);

        // Filter individual assignments: if assignedStudentIds exists and is non-empty,
        // only include this assignment if the current user's uid is in the list
        if (userId) {
            allAssignments = allAssignments.filter(a => {
                if (a.assignedStudentIds && Array.isArray(a.assignedStudentIds) && a.assignedStudentIds.length > 0) {
                    return a.assignedStudentIds.includes(userId);
                }
                return true; // whole-class assignment
            });
        }

        allAssignments.sort((a, b) => {
            const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const msB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
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
    try {
        await updateDoc(doc(db, 'assignments', assignmentId), {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error soft-deleting assignment:", error);
        throw error;
    }
}

export async function restoreAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    try {
        await updateDoc(doc(db, 'assignments', assignmentId), {
            isDeleted: deleteField(),
            deletedAt: deleteField()
        });
    } catch (error) {
        console.error("Error restoring assignment:", error);
        throw error;
    }
}

export async function permanentlyDeleteAssignment(assignmentId) {
    if (!assignmentId) throw new Error("Missing assignment ID");
    try {
        await deleteDoc(doc(db, 'assignments', assignmentId));
    } catch (error) {
        console.error("Error permanently deleting assignment:", error);
        throw error;
    }
}

export async function getDeletedAssignmentsForGroup(groupId) {
    if (!groupId) return [];
    try {
        const assignmentsRef = collection(db, 'assignments');
        const q = query(assignmentsRef, where('groupId', '==', groupId));
        const snapshot = await getDocs(q);
        const data = [];
        snapshot.forEach(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            if (d.isDeleted) data.push(d);
        });
        data.sort((a, b) => {
            const tA = a.deletedAt?.toMillis ? a.deletedAt.toMillis() : 0;
            const tB = b.deletedAt?.toMillis ? b.deletedAt.toMillis() : 0;
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
        const assignmentRef = doc(db, 'assignments', assignmentId);
        const assignmentSnap = await getDoc(assignmentRef);
        await updateDoc(assignmentRef, {
            dueDate: newDueDate,
            updatedAt: serverTimestamp()
        });

        // Email students about extended deadline
        if (assignmentSnap.exists()) {
            const aData = assignmentSnap.data();
            const topicName = aData.topicName || 'bài luyện';
            const dueDateStr = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toLocaleString('vi-VN');
            const groupId = aData.groupId;
            if (groupId) {
                try {
                    const { createNotificationForGroupStudents, queueEmailForGroupStudents, buildEmailHtml } = await import('./notificationService');
                    await createNotificationForGroupStudents(groupId, {
                        type: 'deadline_extended',
                        title: '⏰ Gia hạn deadline',
                        message: `Bài "${topicName}" được gia hạn đến ${dueDateStr}.`,
                        link: '/dashboard?tab=assignments'
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
        const assignmentRef = doc(db, 'assignments', assignmentId);
        const assignmentSnap = await getDoc(assignmentRef);
        await updateDoc(assignmentRef, {
            [`studentDeadlines.${studentId}`]: newDueDate,
            updatedAt: serverTimestamp()
        });

        // Email individual student
        if (assignmentSnap.exists()) {
            const aData = assignmentSnap.data();
            const topicName = aData.topicName || 'bài luyện';
            const dueDateStr = (newDueDate.toDate ? newDueDate.toDate() : new Date(newDueDate)).toLocaleString('vi-VN');
            try {
                const { createNotification, queueEmail, buildEmailHtml } = await import('./notificationService');
                const studentSnap = await getDoc(doc(db, 'users', studentId));
                const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
                await createNotification({ userId: studentId, type: 'deadline_extended', title: '⏰ Gia hạn deadline', message: `Bài "${topicName}" được gia hạn cho bạn đến ${dueDateStr}.`, link: '/dashboard?tab=assignments' });
                if (studentSnap.exists() && studentSnap.data().email) {
                    await queueEmail(studentSnap.data().email, {
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
    try {
        const assignmentRef = doc(db, 'assignments', assignmentId);
        await updateDoc(assignmentRef, {
            [`studentDeadlines.${studentId}`]: deleteField(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error removing student deadline:", error);
        throw error;
    }
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
    const topics = [];
    const addedIds = new Set();

    try {
        // 1. Get all public teacher topics
        const publicQ = query(collection(db, 'teacher_topics'), where('isPublic', '==', true));
        const publicSnap = await getDocs(publicQ);
        publicSnap.forEach(docSnap => {
            topics.push({ id: docSnap.id, ...docSnap.data() });
            addedIds.add(docSnap.id);
        });

        // 2. Get explicitly shared topics
        const teacherTopicIds = topicAccessIds.filter(id => id.startsWith('t-'));
        if (teacherTopicIds.length > 0) {
            // Firestore 'in' query on documentId can have BloomFilter errors after writes
            // Fetch them individually to prevent internal cache corruption issues
            const docPromises = teacherTopicIds.map(id => getDoc(doc(db, 'teacher_topics', id)));
            const docsSnap = await Promise.all(docPromises);
            docsSnap.forEach(docSnap => {
                if (docSnap.exists() && !addedIds.has(docSnap.id)) {
                    topics.push({ id: docSnap.id, ...docSnap.data() });
                    addedIds.add(docSnap.id);
                }
            });
        }
    } catch (error) {
        console.error("Error fetching shared teacher topics:", error);
    }

    return topics;
}

export async function getTeacherTopics(teacherId) {
    if (!teacherId) return [];
    try {
        const q = query(collection(db, 'teacher_topics'), where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const topics = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isDeleted) topics.push({ id: docSnap.id, ...data });
        });
        return topics;
    } catch (error) {
        console.error("Error fetching teacher topics:", error);
        throw error;
    }
}

export async function saveTeacherTopic(teacherId, topicData) {
    if (!teacherId || !topicData) throw new Error("Missing teacherId or topic data");
    try {
        const topicRef = doc(db, 'teacher_topics', topicData.id);
        const dataToSave = {
            ...topicData,
            teacherId,
            updatedAt: serverTimestamp()
        };

        const docSnap = await getDoc(topicRef);
        if (!docSnap.exists()) {
            dataToSave.createdAt = serverTimestamp();
        }

        await setDoc(topicRef, dataToSave, { merge: true });
        return dataToSave;
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
        // Soft delete: mark as deleted instead of removing
        await updateDoc(doc(db, 'teacher_topics', topicId), {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error soft-deleting teacher topic:", error);
        throw error;
    }
}

export async function restoreTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    await updateDoc(doc(db, 'teacher_topics', topicId), {
        isDeleted: deleteField(),
        deletedAt: deleteField()
    });
}

export async function permanentlyDeleteTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    try {
        // Delete all words in this topic
        const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
        const wordsSnap = await getDocs(wordsRef);
        const deletePromises = [];
        wordsSnap.forEach(wordDoc => {
            deletePromises.push(deleteDoc(wordDoc.ref));
        });
        // Delete all assignments linked to this topic
        const assignmentsRef = collection(db, 'assignments');
        const assignmentsQ = query(assignmentsRef, where('topicId', '==', topicId));
        const asgnsSnap = await getDocs(assignmentsQ);
        asgnsSnap.forEach(asgnDoc => {
            deletePromises.push(deleteDoc(asgnDoc.ref));
        });
        await Promise.all(deletePromises);
        // Delete the topic itself
        await deleteDoc(doc(db, 'teacher_topics', topicId));
    } catch (error) {
        console.error("Error permanently deleting teacher topic:", error);
        throw error;
    }
}

export async function getDeletedTeacherTopics() {
    try {
        const q = query(collection(db, 'teacher_topics'), where('isDeleted', '==', true));
        const snapshot = await getDocs(q);
        const topics = [];
        snapshot.forEach(docSnap => topics.push({ id: docSnap.id, ...docSnap.data() }));
        return topics.sort((a, b) => {
            const tA = a.deletedAt?.toMillis ? a.deletedAt.toMillis() : 0;
            const tB = b.deletedAt?.toMillis ? b.deletedAt.toMillis() : 0;
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
        const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
        const q = query(wordsRef, orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        const words = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            words.push({ ...data, id: docSnap.id });
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
        let docRef;
        if (wordData.id) {
            docRef = doc(db, `teacher_topics/${topicId}/words`, wordData.id);
        } else {
            const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
            docRef = doc(wordsRef); // auto ID
            wordData.createdAt = serverTimestamp();
        }
        await setDoc(docRef, { ...wordData, updatedAt: serverTimestamp() }, { merge: true });
        return { id: docRef.id, ...wordData };
    } catch (error) {
        console.error("Error saving teacher topic word:", error);
        throw error;
    }
}

export async function saveMultipleTeacherTopicWords(topicId, wordsArray) {
    if (!topicId || !wordsArray || !Array.isArray(wordsArray)) throw new Error("Invalid parameters");
    try {
        const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
        const promises = wordsArray.map(async (wordData) => {
            const docRef = doc(wordsRef); // assign new ID
            const toSave = { ...wordData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
            return setDoc(docRef, toSave);
        });
        await Promise.all(promises);
    } catch (error) {
        console.error("Error saving multiple teacher topic words:", error);
        throw error;
    }
}

export async function deleteTeacherTopicWord(topicId, wordId) {
    if (!topicId || !wordId) throw new Error("Missing topicId or wordId. Received wordId: " + wordId);
    try {
        await deleteDoc(doc(db, `teacher_topics/${topicId}/words/${wordId}`));
    } catch (error) {
        console.error("Error deleting teacher topic word:", error);
        throw error;
    }
}

export async function updateTeacherTopicWordOrder(topicId, orderedWords) {
    if (!topicId || !Array.isArray(orderedWords)) throw new Error("Invalid parameters");
    try {
        const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
        const promises = orderedWords.map(async (wordData) => {
            if (!wordData.id) return;
            const docRef = doc(wordsRef, wordData.id);
            return setDoc(docRef, { index: wordData.index, updatedAt: serverTimestamp() }, { merge: true });
        });
        await Promise.all(promises);
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
    const q = query(collection(db, 'teacher_topic_folders'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    const folders = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) folders.push({ id: docSnap.id, ...data });
    });
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function updateTeacherTopicFoldersOrder(orderedFolders) {
    const batch = writeBatch(db);
    orderedFolders.forEach((folder, index) => {
        const ref = doc(db, 'teacher_topic_folders', folder.id);
        batch.update(ref, { order: index, updatedAt: serverTimestamp() });
    });
    await batch.commit();
}

export async function getAllTeacherTopicFolders() {
    const snapshot = await getDocs(collection(db, 'teacher_topic_folders'));
    const folders = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) folders.push({ id: docSnap.id, ...data });
    });
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveTeacherTopicFolder(teacherId, folderData) {
    const { id, ...data } = folderData;
    if (id) {
        const folderRef = doc(db, 'teacher_topic_folders', id);
        await updateDoc(folderRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        const folderRef = doc(collection(db, 'teacher_topic_folders'));
        await setDoc(folderRef, { ...data, teacherId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return folderRef.id;
    }
}

export async function deleteTeacherTopicFolder(folderId) {
    // Soft delete
    await updateDoc(doc(db, 'teacher_topic_folders', folderId), {
        isDeleted: true,
        deletedAt: serverTimestamp()
    });
}

export async function restoreTeacherTopicFolder(folderId) {
    await updateDoc(doc(db, 'teacher_topic_folders', folderId), {
        isDeleted: deleteField(),
        deletedAt: deleteField()
    });
}

export async function permanentlyDeleteTeacherTopicFolder(folderId) {
    await deleteDoc(doc(db, 'teacher_topic_folders', folderId));
}

export async function getDeletedTeacherTopicFolders() {
    try {
        const q = query(collection(db, 'teacher_topic_folders'), where('isDeleted', '==', true));
        const snapshot = await getDocs(q);
        const folders = [];
        snapshot.forEach(docSnap => folders.push({ id: docSnap.id, ...docSnap.data() }));
        return folders.sort((a, b) => {
            const tA = a.deletedAt?.toMillis ? a.deletedAt.toMillis() : 0;
            const tB = b.deletedAt?.toMillis ? b.deletedAt.toMillis() : 0;
            return tB - tA;
        });
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
    const ref = doc(db, collectionName, resourceId);

    // We need to remove the key from the collaboratorNames and collaboratorRoles maps
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) throw new Error('Resource not found');
    const data = docSnap.data();
    const updatedNames = { ...(data.collaboratorNames || {}) };
    delete updatedNames[collaboratorUid];
    const updatedRoles = { ...(data.collaboratorRoles || {}) };
    delete updatedRoles[collaboratorUid];

    await updateDoc(ref, {
        collaboratorIds: arrayRemove(collaboratorUid),
        collaboratorNames: updatedNames,
        collaboratorRoles: updatedRoles,
        updatedAt: serverTimestamp()
    });

    // Send notification + email
    try {
        const { createNotification, queueEmail, buildEmailHtml, getUserEmailPreference } = await import('./notificationService');
        const typeLabels = { teacher_topics: 'bài từ vựng', grammar_exercises: 'bài Kỹ năng', exams: 'bài tập và kiểm tra', teacher_topic_folders: 'folder Từ vựng', teacher_grammar_folders: 'folder Kỹ năng', teacher_exam_folders: 'folder Đề thi' };
        await createNotification({
            userId: collaboratorUid,
            type: 'collab_removed',
            title: 'Đã bị gỡ khỏi danh sách cộng tác',
            message: `Bạn đã bị gỡ khỏi danh sách cộng tác viên của ${typeLabels[collectionName] || 'bài học'} "${resourceName}".`,
            link: '/teacher'
        });

        // Email (check preference)
        const wantsEmail = await getUserEmailPreference(collaboratorUid, 'collab');
        if (wantsEmail) {
            const collabSnap = await getDoc(doc(db, 'users', collaboratorUid));
            if (collabSnap.exists() && collabSnap.data().email) {
                await queueEmail(collabSnap.data().email, {
                    subject: `Thông báo cộng tác: ${resourceName}`,
                    html: buildEmailHtml({
                        emoji: '📌', heading: 'Thông báo cộng tác', headingColor: '#64748b',
                        body: `<p>Bạn đã được gỡ khỏi danh sách cộng tác viên của ${typeLabels[collectionName] || 'bài học'} <strong>"${resourceName}"</strong>. Nếu bạn có thắc mắc, hãy liên hệ người quản lý nhé.</p>`
                    })
                });
            }
        }
    } catch (e) {
        console.error('Error sending collab removed notification:', e);
    }
}

/**
 * Update a collaborator's role (viewer or editor).
 */
export async function updateCollaboratorRole(collectionName, resourceId, collaboratorUid, newRole) {
    if (!collectionName || !resourceId || !collaboratorUid) throw new Error('Missing parameters');
    if (!['viewer', 'editor'].includes(newRole)) throw new Error('Invalid role');
    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, {
        [`collaboratorRoles.${collaboratorUid}`]: newRole,
        updatedAt: serverTimestamp()
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
    const ref = doc(db, collectionName, resourceId);

    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) throw new Error('Resource not found');
    const data = docSnap.data();

    // Build updated collaborator list: remove new owner from collaborators, add old owner
    const currentCollaboratorIds = data.collaboratorIds || [];
    const updatedCollaboratorIds = currentCollaboratorIds.filter(id => id !== newOwnerUid);
    if (!updatedCollaboratorIds.includes(oldOwnerUid)) {
        updatedCollaboratorIds.push(oldOwnerUid);
    }

    const updatedNames = { ...(data.collaboratorNames || {}) };
    delete updatedNames[newOwnerUid];
    updatedNames[oldOwnerUid] = oldOwnerName || 'Giáo viên';

    const updatedRoles = { ...(data.collaboratorRoles || {}) };
    delete updatedRoles[newOwnerUid];
    updatedRoles[oldOwnerUid] = 'editor'; // Old owner becomes editor collaborator

    // Determine the owner field name
    const ownerField = collectionName === 'exams' ? 'createdBy' : 'teacherId';

    await updateDoc(ref, {
        [ownerField]: newOwnerUid,
        collaboratorIds: updatedCollaboratorIds,
        collaboratorNames: updatedNames,
        collaboratorRoles: updatedRoles,
        updatedAt: serverTimestamp()
    });

    // Also transfer related folders if applicable
    // For teacher_topics: update teacher_topic_folders
    // For grammar_exercises: update teacher_grammar_folders
    // For exams: update teacher_exam_folders
    // (Folders remain with old owner — the topics just move to new owner view)

    // Send notifications
    try {
        const { createNotification } = await import('./notificationService');
        const typeLabels = { teacher_topics: 'bài từ vựng', grammar_exercises: 'bài Kỹ năng', exams: 'bài tập và kiểm tra', teacher_topic_folders: 'folder Từ vựng', teacher_grammar_folders: 'folder Kỹ năng', teacher_exam_folders: 'folder Đề thi' };
        const label = typeLabels[collectionName] || 'bài học';

        await createNotification({
            userId: newOwnerUid,
            type: 'ownership_received',
            title: '🎉 Bạn đã được chuyển nhượng quyền sở hữu',
            message: `Bạn đã nhận quyền sở hữu ${label} "${resourceName}" từ ${oldOwnerName}.`,
            link: '/teacher'
        });

        await createNotification({
            userId: oldOwnerUid,
            type: 'ownership_transferred',
            title: 'Đã chuyển nhượng quyền sở hữu',
            message: `Bạn đã chuyển nhượng quyền sở hữu ${label} "${resourceName}" cho ${newOwnerName}. Bạn vẫn là cộng tác viên.`,
            link: '/teacher'
        });
    } catch (e) {
        console.error('Error sending ownership transfer notifications:', e);
    }
}

/**
 * Get resources where a user is a collaborator.
 * @param {string} collectionName - 'teacher_topics', 'grammar_exercises', or 'exams'
 * @param {string} teacherUid
 */
export async function getCollaboratedResources(collectionName, teacherUid) {
    if (!collectionName || !teacherUid) return [];
    try {
        const q = query(
            collection(db, collectionName),
            where('collaboratorIds', 'array-contains', teacherUid)
        );
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(docSnap => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
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
    const emailKey = email.toLowerCase().trim();
    const q = query(collection(db, 'users'), where('email', '==', emailKey));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    if (data.role !== 'teacher' && data.role !== 'admin') return null;
    return { uid: docSnap.id, displayName: data.displayName || data.email, email: data.email };
}
