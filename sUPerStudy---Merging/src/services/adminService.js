import { db } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, arrayUnion, arrayRemove, query, where, orderBy, getCountFromServer, deleteField, getDocsFromServer } from 'firebase/firestore';
import localTopics from '../data/topics';
import localWordData from '../data/wordData';
import { deleteQuestionImages } from './examService';
import { deleteContextAudio } from './contextAudioService';

// Fetch all topics from Firestore (use server source to bypass persistent local cache)
export async function getAdminTopics() {
    const snapshot = await getDocsFromServer(collection(db, 'topics'));
    const topics = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) topics.push({ ...data, id: docSnap.id });
    });
    return topics;
}

// Fetch word counts for multiple topics
export async function getAdminTopicWordCounts(topicIds) {
    const counts = {};
    await Promise.all(topicIds.map(async (topicId) => {
        try {
            const coll = collection(db, `topics/${topicId}/words`);
            const snapshot = await getCountFromServer(coll);
            counts[topicId] = snapshot.data().count;
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
        const coll = collection(db, `${collectionName}/${topicId}/words`);
        const snapshot = await getCountFromServer(coll);
        await updateDoc(doc(db, collectionName, topicId), {
            cachedWordCount: snapshot.data().count
        });
    } catch (e) {
        console.error(`Error recalculating word count for ${collectionName}/${topicId}:`, e);
    }
}

// Check content completeness status for multiple topics
export async function getAdminTopicContentStatus(topicIds) {
    const status = {};
    function hasFullContent(w) {
        return !!(w.phonetic && w.distractors?.length && w.collocations?.length && w.exampleSentences?.length && w.sentenceSequence);
    }
    await Promise.all(topicIds.map(async (topicId) => {
        try {
            const snapshot = await getDocs(collection(db, `topics/${topicId}/words`));
            const words = [];
            snapshot.forEach(docSnap => words.push(docSnap.data()));
            const total = words.length;
            const complete = words.filter(hasFullContent).length;
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
    const topicRef = doc(db, 'topics', id);
    await setDoc(topicRef, data, { merge: true });
}

// Fetch words for a specific topic
export async function getAdminTopicWords(topicId) {
    const snapshot = await getDocs(collection(db, `topics/${topicId}/words`));
    const words = [];
    snapshot.forEach(docSnap => {
        words.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Order by original array if there's an index, else leave it. For now, just return.
    return words;
}

// Sanitize a word string for safe use as a Firestore document ID.
// Firestore interprets '/' as a path separator, so words like
// "Internal audit / External audit" would break document references.
function sanitizeDocId(word) {
    return word.replace(/\//g, '∕'); // Replace '/' with Unicode fullwidth solidus U+2215
}

// Save words to a topic
export async function saveAdminTopicWords(topicId, wordsArray) {
    const batch = writeBatch(db);
    wordsArray.forEach((wordObj, index) => {
        // Use sanitized word as ID to avoid '/' breaking Firestore paths
        const safeId = sanitizeDocId(wordObj.word);
        const wordRef = doc(db, `topics/${topicId}/words`, safeId);
        batch.set(wordRef, { ...wordObj, index });
    });
    await batch.commit();
}

// Delete a single word from a topic
export async function deleteAdminTopicWord(topicId, word) {
    if (!topicId || !word) throw new Error("Missing topicId or word");
    const safeId = sanitizeDocId(word);
    const wordRef = doc(db, `topics/${topicId}/words`, safeId);
    await deleteDoc(wordRef);
}

// Delete a topic and all its words
export async function deleteAdminTopic(topicId) {
    const wordsSnap = await getDocs(collection(db, `topics/${topicId}/words`));
    const batch = writeBatch(db);
    wordsSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
    });
    const topicRef = doc(db, 'topics', topicId);
    batch.delete(topicRef);
    await batch.commit();
}

// ========== TOPIC FOLDERS ==========

// Fetch all folders
export async function getFolders() {
    const snapshot = await getDocsFromServer(collection(db, 'topic_folders'));
    const folders = [];
    snapshot.forEach(docSnap => {
        folders.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Order by 'order' field
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Add or Edit a folder
export async function saveFolder(folderData) {
    const { id, ...data } = folderData;
    const folderRef = doc(db, 'topic_folders', id);
    await setDoc(folderRef, {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// Delete a folder
export async function deleteFolder(folderId) {
    const folderRef = doc(db, 'topic_folders', folderId);
    await deleteDoc(folderRef);
}

// Update order of topic folders after drag-and-drop
export async function updateTopicFoldersOrder(orderedFolders) {
    const batch = writeBatch(db);
    orderedFolders.forEach((folder, index) => {
        const ref = doc(db, 'topic_folders', folder.id);
        batch.update(ref, { order: index });
    });
    await batch.commit();
}

// Sync local mock data to Firestore (One-time tool for Admin)
export async function syncLocalDataToFirestore() {
    console.log("Starting sync...");
    for (const topic of localTopics) {
        // Save topic metadata
        await saveAdminTopic({
            id: topic.id,
            name: topic.name,
            description: topic.description,
            icon: topic.icon,
            color: topic.color
        });

        // Save words
        const words = localWordData[topic.id] || [];
        if (words.length > 0) {
            await saveAdminTopicWords(topic.id, words);
        }
        console.log(`Synced topic: ${topic.id} with ${words.length} words.`);
    }
    console.log("Sync complete!");
}

// ========== USER MANAGEMENT ==========

// Update user role (admin / user)
export async function updateUserRole(uid, newRole) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });
}

// Update user display name
export async function updateUserDisplayName(uid, newName) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { displayName: newName });
}

// Enable / Disable user account
export async function toggleUserDisabled(uid, disabled) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { disabled: !!disabled });
}

// Update user folder access
export async function updateUserFolderAccess(uid, folderIds) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { folderAccess: folderIds || [] });
}

// Get user folder access
export async function getUserFolderAccess(uid) {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
        return userSnap.data().folderAccess || [];
    }
    return [];
}

// ========== GROUPS ==========

// Get all user groups
export async function getGroups(includeHidden = false) {
    const groupsRef = collection(db, 'user_groups');
    const snap = await getDocs(groupsRef);
    let groups = [];
    snap.forEach(docSnap => {
        groups.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (!includeHidden) {
        groups = groups.filter(g => !g.isHidden);
    }

    return groups.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

// Save or create a group
export async function saveGroup(groupData) {
    const { id, ...data } = groupData;
    const groupRef = doc(db, 'user_groups', id);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
        await setDoc(groupRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } else {
        await setDoc(groupRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}

// Delete a group
export async function deleteGroup(groupId) {
    const groupRef = doc(db, 'user_groups', groupId);
    await deleteDoc(groupRef);
}

// Update user groups (override)
export async function updateUserGroups(uid, groupIds) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { groupIds: groupIds || [] });
}

// Add user to a specific group
export async function addUserToGroup(uid, groupId) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        groupIds: arrayUnion(groupId)
    });

    // #11: Email group teachers about new student
    try {
        const userSnap = await getDoc(userRef);
        const groupSnap = await getDoc(doc(db, 'user_groups', groupId));
        const studentName = userSnap.exists() ? (userSnap.data().displayName || userSnap.data().email || 'Học viên') : 'Học viên';
        const groupName = groupSnap.exists() ? (groupSnap.data().name || 'lớp') : 'lớp';
        const { createNotificationForGroupTeachers, queueEmailForGroupTeachers, buildEmailHtml } = await import('./notificationService');
        const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
        await createNotificationForGroupTeachers(groupId, {
            type: 'student_joined',
            title: '👤 Học viên mới',
            message: `${studentName} vừa được thêm vào lớp ${groupName}.`,
            link: `/teacher/groups/${groupId}`
        });
        await queueEmailForGroupTeachers(groupId, {
            subject: `Học viên mới: ${studentName} — lớp ${groupName}`,
            html: buildEmailHtml({
                emoji: '👤', heading: 'Học viên mới vào lớp', headingColor: '#0ea5e9',
                body: `<p>Lớp <strong>${groupName}</strong> của bạn vừa có thêm thành viên mới: <strong>${studentName}</strong>. Chào đón các bạn mới nhé! 🎉</p>`,
                ctaText: 'Xem lớp học', ctaLink: `${appUrl}/teacher/groups/${groupId}`, ctaColor: '#0ea5e9', ctaColor2: '#38bdf8'
            })
        }, 'student_joined');
    } catch (e) {
        console.error('Error sending student joined notification:', e);
    }
}

// Remove user from a specific group
export async function removeUserFromGroup(uid, groupId) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        groupIds: arrayRemove(groupId)
    });
}

// Get learning statistics for a specific user
export async function getUserLearningStats(uid, startDate = '', endDate = '') {
    const progressSnap = await getDocs(collection(db, 'users', uid, 'word_progress'));
    let totalWords = 0;
    let learnedWords = 0;
    let totalReviews = 0;
    let totalCorrect = 0;
    let totalWrong = 0;

    let start = null;
    let end = null;
    if (startDate) start = new Date(startDate).setHours(0, 0, 0, 0);
    if (endDate) end = new Date(endDate).setHours(23, 59, 59, 999);

    progressSnap.forEach(docSnap => {
        const data = docSnap.data();

        // Date filtering based on lastStudied
        if (start || end) {
            const lsDate = data.lastStudied?.toDate ? data.lastStudied.toDate().getTime() : 0;
            if (lsDate === 0) return; // if no last studied and we are filtering, skip
            if (start && lsDate < start) return;
            if (end && lsDate > end) return;
        }

        totalWords++;
        if ((data.level ?? 0) >= 1) learnedWords++;
        totalReviews += data.totalReviews ?? 0;
        let interimCorrect = 0;
        let interimWrong = 0;
        if (data.stepMastery) {
            try {
                const sm = typeof data.stepMastery === 'string' ? JSON.parse(data.stepMastery) : data.stepMastery;
                Object.values(sm).forEach(step => {
                    interimCorrect += step.correct || 0;
                    interimWrong += step.wrong || 0;
                });
            } catch (e) {
                // ignore
            }
        }

        totalCorrect += (data.totalCorrect ?? 0) + interimCorrect;
        totalWrong += (data.totalWrong ?? 0) + interimWrong;
    });

    return { totalWords, learnedWords, totalReviews, totalCorrect, totalWrong };
}

// Delete ALL learning progress for a user
export async function deleteUserProgress(uid) {
    const progressSnap = await getDocs(collection(db, 'users', uid, 'word_progress'));
    if (progressSnap.empty) return;

    const batch = writeBatch(db);
    progressSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
    });
    await batch.commit();
}

// ========== APPROVAL & WHITELIST ==========

// Approve a pending user with role and optional duration
export async function approveUser(uid, role, durationDays = null, customExpiresAt = null) {
    const now = new Date();
    let expiresAt = null;
    if (customExpiresAt) {
        expiresAt = Timestamp.fromDate(new Date(`${customExpiresAt}T23:59:59`));
    } else if (durationDays) {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + durationDays * 86400000));
    }

    await updateDoc(doc(db, 'users', uid), {
        status: 'approved',
        role,
        approvedAt: serverTimestamp(),
        expiresAt,
    });

    // #5: Welcome notification + email
    try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
            const { queueEmail, createNotification, buildEmailHtml } = await import('./notificationService');
            const userName = userSnap.data().displayName || 'bạn';

            await createNotification({
                userId: uid,
                type: 'account_approved',
                title: '🎉 Tài khoản đã được duyệt!',
                message: `Chào mừng ${userName}! Tài khoản của bạn đã được phê duyệt. Hãy bắt đầu học ngay!`,
                link: '/dashboard'
            });

            if (userSnap.data().email) {
                await queueEmail(userSnap.data().email, {
                    subject: 'Chào mừng bạn đến với sUPerStudy!',
                    html: buildEmailHtml({
                        emoji: '🎉', heading: `Chào mừng ${userName}!`, headingColor: '#4f46e5',
                        body: `<p>Tài khoản của bạn tại <strong>Trung tâm Ngoại ngữ UP</strong> đã được duyệt thành công! Bạn có thể đăng nhập và bắt đầu hành trình học tiếng Anh cùng sUPerStudy ngay bây giờ 🚀</p>`,
                        ctaText: 'Vào học ngay'
                    })
                });
            }
        }
    } catch (e) {
        console.error('Error sending welcome email:', e);
    }
}

// Reject a pending user
export async function rejectUser(uid) {
    await deleteDoc(doc(db, 'users', uid));
}

// Renew an expired user's access
export async function renewUser(uid, durationDays = null, customExpiresAt = null) {
    const now = new Date();
    let expiresAt = null;
    if (customExpiresAt) {
        expiresAt = Timestamp.fromDate(new Date(`${customExpiresAt}T23:59:59`));
    } else if (durationDays) {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + durationDays * 86400000));
    }

    await updateDoc(doc(db, 'users', uid), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        expiresAt,
    });
}

// Add email to whitelist (pre-approve)
export async function addEmailToWhitelist(email, role = 'user', durationDays = null, customExpiresAt = null, addedBy = '', { groupIds = [], folderAccess = [], topicAccess = [], grammarAccess = [], examAccess = [], displayName = '' } = {}) {
    const emailKey = email.toLowerCase().trim();
    await setDoc(doc(db, 'email_whitelist', emailKey), {
        email: emailKey,
        role,
        displayName,
        durationDays,
        customExpiresAt,
        addedBy,
        addedAt: serverTimestamp(),
        groupIds,
        folderAccess,
        topicAccess,
        grammarAccess,
        examAccess,
    });
}

// Update display name in whitelist
export async function updateWhitelistDisplayName(email, displayName) {
    const emailKey = email.toLowerCase().trim();
    await updateDoc(doc(db, 'email_whitelist', emailKey), {
        displayName: displayName.trim(),
    });
}

// Update all fields of a whitelist entry
export async function updateWhitelistEntry(email, data) {
    const emailKey = email.toLowerCase().trim();
    await updateDoc(doc(db, 'email_whitelist', emailKey), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// Remove email from whitelist
export async function removeEmailFromWhitelist(email) {
    const emailKey = email.toLowerCase().trim();
    await deleteDoc(doc(db, 'email_whitelist', emailKey));
}

// Get all whitelisted emails
export async function getWhitelistEmails() {
    const snap = await getDocs(collection(db, 'email_whitelist'));
    const list = [];
    snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
}

// ========== RESOURCE SHARING ==========

// Toggle public status of a topic or folder
export async function toggleResourcePublic(resourceType, resourceId, isPublic) {
    let collectionName = 'topics';
    if (resourceType === 'folder') collectionName = 'topic_folders';
    if (resourceType === 'teacher_topic') collectionName = 'teacher_topics';
    if (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') collectionName = 'grammar_exercises';
    if (resourceType === 'grammar_folder') collectionName = 'grammar_folders';
    if (resourceType === 'exam') collectionName = 'exams';
    if (resourceType === 'exam_folder') collectionName = 'exam_folders';
    if (resourceType === 'teacher_topic_folder') collectionName = 'teacher_topic_folders';
    if (resourceType === 'teacher_grammar_folder') collectionName = 'teacher_grammar_folders';
    if (resourceType === 'teacher_exam_folder') collectionName = 'teacher_exam_folders';

    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, { isPublic });
}

// Toggle teacherVisible status (allows teachers to see & assign without making public to students)
export async function toggleTeacherVisible(resourceType, resourceId, teacherVisible) {
    let collectionName = 'topics';
    if (resourceType === 'folder') collectionName = 'topic_folders';
    if (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') collectionName = 'grammar_exercises';
    if (resourceType === 'grammar_folder') collectionName = 'grammar_folders';
    if (resourceType === 'exam') collectionName = 'exams';
    if (resourceType === 'exam_folder') collectionName = 'exam_folders';

    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, { teacherVisible });
}

// Helper: resolve collection name from resource type (admin-only types)
function _resolveAdminCollection(resourceType) {
    if (resourceType === 'folder') return 'topic_folders';
    if (resourceType === 'topic') return 'topics';
    if (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') return 'grammar_exercises';
    if (resourceType === 'grammar_folder') return 'grammar_folders';
    if (resourceType === 'exam') return 'exams';
    if (resourceType === 'exam_folder') return 'exam_folders';
    return 'topics';
}

// Share a resource with a specific teacher by email
export async function shareResourceToTeacher(resourceType, resourceId, teacherEmail) {
    // Find the teacher by email
    const usersQuery = query(collection(db, 'users'), where('email', '==', teacherEmail.trim().toLowerCase()));
    const snap = await getDocs(usersQuery);
    if (snap.empty) throw new Error('Không tìm thấy giáo viên với email: ' + teacherEmail);
    const teacherDoc = snap.docs[0];
    const teacherData = teacherDoc.data();

    const collectionName = _resolveAdminCollection(resourceType);
    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, { sharedWithTeacherIds: arrayUnion(teacherDoc.id) });

    return { uid: teacherDoc.id, displayName: teacherData.displayName || '', email: teacherData.email };
}

// Remove a specific teacher's access to a resource
export async function unshareResourceFromTeacher(resourceType, resourceId, teacherUid) {
    const collectionName = _resolveAdminCollection(resourceType);
    const ref = doc(db, collectionName, resourceId);
    await updateDoc(ref, { sharedWithTeacherIds: arrayRemove(teacherUid) });
}

// Get list of teachers who have been individually shared a resource
export async function getResourceSharedTeachers(resourceType, resourceId) {
    const collectionName = _resolveAdminCollection(resourceType);
    const ref = doc(db, collectionName, resourceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];

    const sharedIds = snap.data().sharedWithTeacherIds || [];
    if (sharedIds.length === 0) return [];

    // Fetch teacher details
    const teachers = [];
    for (const uid of sharedIds) {
        try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                teachers.push({ uid, displayName: data.displayName || '', email: data.email || '' });
            }
        } catch (e) {
            teachers.push({ uid, displayName: '', email: '(không tìm thấy)' });
        }
    }
    return teachers;
}

// Get entities (users, groups) that have explicit access to a resource
export async function getResourceSharedEntities(resourceType, resourceId) {
    const accessField = (resourceType === 'folder' || resourceType === 'grammar_folder' || resourceType === 'exam_folder' || resourceType === 'teacher_topic_folder' || resourceType === 'teacher_grammar_folder' || resourceType === 'teacher_exam_folder') ? 'folderAccess' :
        (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') ? 'grammarAccess' :
            (resourceType === 'exam') ? 'examAccess' : 'topicAccess';

    // Find users with explicit access
    const usersQuery = query(collection(db, 'users'), where(accessField, 'array-contains', resourceId));
    const usersSnap = await getDocs(usersQuery);
    const users = [];
    usersSnap.forEach(snap => {
        users.push({ id: snap.id, ...snap.data() });
    });

    // Find groups with explicit access
    const groupsQuery = query(collection(db, 'user_groups'), where(accessField, 'array-contains', resourceId));
    const groupsSnap = await getDocs(groupsQuery);
    const groups = [];
    groupsSnap.forEach(snap => {
        groups.push({ id: snap.id, ...snap.data() });
    });

    return { users, groups };
}

// Share resource to an email
export async function shareResourceToEmail(resourceType, resourceId, email) {
    const emailKey = email.toLowerCase().trim();
    const accessField = (resourceType === 'folder' || resourceType === 'grammar_folder' || resourceType === 'exam_folder' || resourceType === 'teacher_topic_folder' || resourceType === 'teacher_grammar_folder' || resourceType === 'teacher_exam_folder') ? 'folderAccess' :
        (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') ? 'grammarAccess' :
            (resourceType === 'exam') ? 'examAccess' : 'topicAccess';

    // Find user uid by email
    const usersQuery = query(collection(db, 'users'), where('email', '==', emailKey));
    const usersSnap = await getDocs(usersQuery);

    if (!usersSnap.empty) {
        // User exists — update their access directly
        const uid = usersSnap.docs[0].id;
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
            [accessField]: arrayUnion(resourceId)
        });

        // Notify the user about the shared resource
        try {
            const { createNotification, queueEmail, buildEmailHtml } = await import('./notificationService');
            const typeLabels = { folder: 'Folder', topic: 'Bài từ vựng', teacher_topic: 'Bài từ vựng', admin_grammar: 'Bài Kỹ năng', teacher_grammar: 'Bài Kỹ năng', grammar_folder: 'Folder Kỹ năng', exam: 'Bài tập và Kiểm tra', exam_folder: 'Folder Bài tập & KT' };
            await createNotification({
                userId: uid,
                type: 'resource_shared',
                title: '📚 Tài liệu mới được chia sẻ',
                message: `Bạn vừa được chia sẻ ${typeLabels[resourceType] || 'tài liệu'} mới.`,
                link: '/dashboard'
            });

            const userData = usersSnap.docs[0].data();
            if (userData.email) {
                await queueEmail(userData.email, {
                    subject: `Tài liệu mới được chia sẻ cho bạn`,
                    html: buildEmailHtml({
                        emoji: '📚', heading: 'Tài liệu mới', headingColor: '#8b5cf6',
                        greeting: 'Chào bạn 👋',
                        body: `<p>Bạn vừa được chia sẻ <strong>${typeLabels[resourceType] || 'tài liệu'}</strong> mới trên sUPerStudy. Vào xem ngay nhé!</p>`,
                        ctaText: 'Xem tài liệu', ctaColor: '#8b5cf6', ctaColor2: '#a78bfa'
                    })
                });
            }
        } catch (e) {
            console.error('Error sending share notification:', e);
        }

        return { id: uid, ...usersSnap.docs[0].data() };
    }

    // User not found — check whitelist (pre-approved email)
    const whitelistRef = doc(db, 'email_whitelist', emailKey);
    const whitelistSnap = await getDoc(whitelistRef);
    if (whitelistSnap.exists()) {
        const wlData = whitelistSnap.data();
        const currentAccess = wlData[accessField] || [];
        if (!currentAccess.includes(resourceId)) {
            await updateDoc(whitelistRef, {
                [accessField]: arrayUnion(resourceId)
            });
        }
        return { id: emailKey, email: emailKey, displayName: emailKey, isWhitelist: true };
    }

    throw new Error('Không tìm thấy học viên hoặc email pre-approved với email này!');
}

// Unshare resource from user
export async function unshareResourceFromUser(resourceType, resourceId, uid) {
    const accessField = (resourceType === 'folder' || resourceType === 'grammar_folder' || resourceType === 'exam_folder' || resourceType === 'teacher_topic_folder' || resourceType === 'teacher_grammar_folder' || resourceType === 'teacher_exam_folder') ? 'folderAccess' :
        (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') ? 'grammarAccess' :
            (resourceType === 'exam') ? 'examAccess' : 'topicAccess';
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        [accessField]: arrayRemove(resourceId)
    });
}

export async function shareResourceToGroup(resourceType, resourceId, groupId) {
    const accessField = (resourceType === 'folder' || resourceType === 'grammar_folder' || resourceType === 'exam_folder' || resourceType === 'teacher_topic_folder' || resourceType === 'teacher_grammar_folder' || resourceType === 'teacher_exam_folder') ? 'folderAccess' :
        (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') ? 'grammarAccess' :
            (resourceType === 'exam') ? 'examAccess' : 'topicAccess';
    const groupRef = doc(db, 'user_groups', groupId);
    await updateDoc(groupRef, {
        [accessField]: arrayUnion(resourceId)
    });
}

export async function unshareResourceFromGroup(resourceType, resourceId, groupId) {
    const accessField = (resourceType === 'folder' || resourceType === 'grammar_folder' || resourceType === 'exam_folder' || resourceType === 'teacher_topic_folder' || resourceType === 'teacher_grammar_folder' || resourceType === 'teacher_exam_folder') ? 'folderAccess' :
        (resourceType === 'teacher_grammar' || resourceType === 'admin_grammar') ? 'grammarAccess' :
            (resourceType === 'exam') ? 'examAccess' : 'topicAccess';
    const groupRef = doc(db, 'user_groups', groupId);
    await updateDoc(groupRef, {
        [accessField]: arrayRemove(resourceId)
    });
}

// ========== TEACHER CONTENT MANAGEMENT (ADMIN) ==========

export async function getAdminAllTeacherTopics() {
    const q = query(collection(db, 'teacher_topics'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const topics = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) topics.push({ id: docSnap.id, ...data });
    });
    return topics;
}

export async function deleteAdminTeacherTopic(topicId) {
    if (!topicId) throw new Error("Missing topicId");
    // First delete all words in this topic
    const wordsRef = collection(db, `teacher_topics/${topicId}/words`);
    const wordsSnap = await getDocs(wordsRef);
    const deletePromises = [];
    wordsSnap.forEach(wordDoc => {
        deletePromises.push(deleteDoc(wordDoc.ref));
    });
    await Promise.all(deletePromises);

    // Then delete the topic itself
    await deleteDoc(doc(db, 'teacher_topics', topicId));
}

// ========== GRAMMAR FOLDERS ==========

// Fetch all grammar folders
export async function getGrammarFolders() {
    const snapshot = await getDocs(collection(db, 'grammar_folders'));
    const folders = [];
    snapshot.forEach(docSnap => {
        folders.push({ id: docSnap.id, ...docSnap.data() });
    });
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Add or Edit a grammar folder
export async function saveGrammarFolder(folderData) {
    const { id, ...data } = folderData;
    const folderRef = doc(db, 'grammar_folders', id);
    await setDoc(folderRef, {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// Delete a grammar folder
export async function deleteGrammarFolder(folderId) {
    const folderRef = doc(db, 'grammar_folders', folderId);
    await deleteDoc(folderRef);
}

// Update order of grammar folders after drag-and-drop
export async function updateGrammarFoldersOrder(orderedFolders) {
    const batch = writeBatch(db);
    orderedFolders.forEach((folder, index) => {
        const ref = doc(db, 'grammar_folders', folder.id);
        batch.update(ref, { order: index });
    });
    await batch.commit();
}

// ========== ADMIN GRAMMAR MANAGEMENT ==========

export async function getAdminAllGrammarExercises() {
    const snapshot = await getDocs(collection(db, 'grammar_exercises'));
    const exercises = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) exercises.push({ id: docSnap.id, ...data });
    });
    return exercises.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function deleteAdminGrammarExercise(exerciseId) {
    if (!exerciseId) throw new Error("Missing exerciseId");
    // Delete all questions for this exercise first
    const questionsRef = collection(db, 'grammar_questions');
    const q = query(questionsRef, where('exerciseId', '==', exerciseId));
    const questionsSnap = await getDocs(q);
    const batch = writeBatch(db);

    const questions = questionsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // Delete images and audio for these questions
    await Promise.allSettled([
        ...questions.map(q => deleteQuestionImages(q)),
        ...questions.filter(q => q.contextAudioUrl).map(q => deleteContextAudio(q.contextAudioUrl))
    ]);

    questions.forEach(q => batch.delete(doc(db, 'grammar_questions', q.id)));

    batch.delete(doc(db, 'grammar_exercises', exerciseId));
    await batch.commit();
}

// ========== CLOUD FUNCTIONS ==========
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/**
 * Permanently delete a user account from Firebase Auth AND Firestore doc.
 * Requires Firebase Blaze plan and deployed deleteUser Cloud Function.
 */
export async function permanentDeleteUser(uid) {
    const deleteUserFn = httpsCallable(functions, 'deleteUser');
    const result = await deleteUserFn({ uid });
    return result.data;
}

/**
 * Soft-delete a user — mark as deleted instead of permanently removing.
 * The user doc stays in Firestore, just flagged as deleted.
 */
export async function softDeleteUser(uid) {
    await updateDoc(doc(db, 'users', uid), {
        isDeleted: true,
        deletedAt: serverTimestamp()
    });
}

/**
 * Restore a soft-deleted user — remove the isDeleted flag.
 */
export async function restoreUser(uid) {
    await updateDoc(doc(db, 'users', uid), {
        isDeleted: deleteField(),
        deletedAt: deleteField()
    });
}

/**
 * Change a user's email in Firebase Auth AND Firestore.
 * Requires deployed changeUserEmail Cloud Function.
 */
export async function changeUserEmail(uid, newEmail) {
    const changeEmailFn = httpsCallable(functions, 'changeUserEmail');
    const result = await changeEmailFn({ uid, newEmail });
    return result.data;
}

// ========== AUTO-PURGE SOFT-DELETED CONTENT ==========

/**
 * Auto-purge soft-deleted teacher content older than 30 days.
 * Call on admin pages load (fire-and-forget).
 */
export async function cleanupExpiredDeletedContent() {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const collections = ['teacher_topics', 'teacher_topic_folders', 'grammar_exercises', 'teacher_grammar_folders', 'exams', 'teacher_exam_folders'];
    let totalPurged = 0;

    try {
        for (const colName of collections) {
            const q = query(collection(db, colName), where('isDeleted', '==', true));
            const snapshot = await getDocs(q);
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                if (data.deletedAt) {
                    const deletedMs = data.deletedAt.toMillis ? data.deletedAt.toMillis() : new Date(data.deletedAt).getTime();
                    if (deletedMs < cutoff) {
                        // For teacher_topics, also delete sub-collections (words)
                        if (colName === 'teacher_topics') {
                            const wordsSnap = await getDocs(collection(db, `teacher_topics/${docSnap.id}/words`));
                            const delPromises = [];
                            wordsSnap.forEach(w => delPromises.push(deleteDoc(w.ref)));
                            await Promise.all(delPromises);
                        }
                        await deleteDoc(docSnap.ref);
                        totalPurged++;
                    }
                }
            }
        }
        if (totalPurged > 0) {
            console.log(`[Cleanup] Purged ${totalPurged} expired soft-deleted content items.`);
        }
    } catch (error) {
        console.error('Error during cleanup of expired deleted content:', error);
    }
}

// ========== RESTORE TO ADMIN ==========

/**
 * Restore a soft-deleted teacher topic as an admin topic.
 * Copies the document + words subcollection to 'topics', then deletes original.
 */
export async function restoreTeacherTopicToAdmin(topicId) {
    const topicRef = doc(db, 'teacher_topics', topicId);
    const topicSnap = await getDoc(topicRef);
    if (!topicSnap.exists()) throw new Error('Topic not found');

    const data = topicSnap.data();
    const { isDeleted, deletedAt, teacherId, ...cleanData } = data;

    // Create in admin 'topics' collection
    const newTopicRef = doc(db, 'topics', topicId);
    await setDoc(newTopicRef, {
        ...cleanData,
        restoredFromTeacher: teacherId || true,
        restoredAt: serverTimestamp()
    });

    // Copy words subcollection
    const wordsSnap = await getDocs(collection(db, `teacher_topics/${topicId}/words`));
    const batch = writeBatch(db);
    wordsSnap.forEach(wordDoc => {
        batch.set(doc(db, `topics/${topicId}/words`, wordDoc.id), wordDoc.data());
    });
    // Delete original words
    wordsSnap.forEach(wordDoc => {
        batch.delete(wordDoc.ref);
    });
    await batch.commit();

    // Delete original teacher topic
    await deleteDoc(topicRef);
}

/**
 * Restore a soft-deleted grammar exercise as admin (system) grammar.
 * Removes teacherId to make it a system exercise.
 */
export async function restoreGrammarExerciseToAdmin(exerciseId) {
    await updateDoc(doc(db, 'grammar_exercises', exerciseId), {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        teacherId: deleteField(),
        restoredFromTeacher: true,
        restoredAt: serverTimestamp()
    });
}

/**
 * Restore a soft-deleted exam as an admin exam.
 * Changes createdByRole to 'admin'.
 */
export async function restoreExamToAdmin(examId) {
    await updateDoc(doc(db, 'exams', examId), {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        createdByRole: 'admin',
        restoredFromTeacher: true,
        restoredAt: serverTimestamp()
    });
}

// ========== TRANSFER OFFICIAL CONTENT TO TEACHER ==========

/**
 * Transfer ownership of official content to a teacher by email.
 * Handles cross-collection moves for folders and topics.
 */
export async function transferOfficialToTeacher(collectionName, docId, teacherEmail) {
    if (!collectionName || !docId || !teacherEmail) throw new Error('Missing parameters');

    // Find teacher by email
    const emailKey = teacherEmail.toLowerCase().trim();
    const usersQ = query(collection(db, 'users'), where('email', '==', emailKey));
    const usersSnap = await getDocs(usersQ);
    if (usersSnap.empty) throw new Error('Không tìm thấy giáo viên với email này.');

    const teacherDoc = usersSnap.docs[0];
    const teacherData = teacherDoc.data();
    if (teacherData.role !== 'teacher' && teacherData.role !== 'admin') {
        throw new Error('Email này không phải của giáo viên.');
    }
    const teacherUid = teacherDoc.id;
    const teacherName = teacherData.displayName || teacherData.email;

    // Cross-collection mapping: official → teacher
    const crossCollectionMap = {
        exam_folders: 'teacher_exam_folders',
        grammar_folders: 'teacher_grammar_folders',
        topic_folders: 'teacher_topic_folders',
        topics: 'teacher_topics'
    };

    const sourceRef = doc(db, collectionName, docId);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) throw new Error('Document not found');

    const sourceData = sourceSnap.data();
    // Strip collaboration & admin fields
    const { collaboratorIds, collaboratorNames, collaboratorRoles, createdByRole, ...cleanData } = sourceData;

    if (crossCollectionMap[collectionName]) {
        // CROSS-COLLECTION MOVE: copy to teacher collection, delete original
        const targetCollection = crossCollectionMap[collectionName];
        const newRef = doc(collection(db, targetCollection));

        const ownerField = 'teacherId';
        await setDoc(newRef, {
            ...cleanData,
            [ownerField]: teacherUid,
            createdByRole: 'teacher',
            transferredAt: serverTimestamp(),
            transferredFromOfficial: docId,
            updatedAt: serverTimestamp()
        });

        // For exam_folders: also transfer the exams inside
        if (collectionName === 'exam_folders' && cleanData.examIds?.length) {
            for (const examId of cleanData.examIds) {
                try {
                    const examRef = doc(db, 'exams', examId);
                    const examSnap = await getDoc(examRef);
                    if (examSnap.exists()) {
                        const examData = examSnap.data();
                        const examUpdate = {
                            createdBy: teacherUid,
                            createdByRole: 'teacher',
                            updatedAt: serverTimestamp()
                        };
                        if (examData.collaboratorIds) examUpdate.collaboratorIds = deleteField();
                        if (examData.collaboratorNames) examUpdate.collaboratorNames = deleteField();
                        if (examData.collaboratorRoles) examUpdate.collaboratorRoles = deleteField();
                        await updateDoc(examRef, examUpdate);
                    }
                } catch (e) { console.error(`Error transferring exam ${examId}:`, e); }
            }
        }

        // For grammar_folders: also transfer the exercises inside
        if (collectionName === 'grammar_folders' && cleanData.exerciseIds?.length) {
            for (const exId of cleanData.exerciseIds) {
                try {
                    const exRef = doc(db, 'grammar_exercises', exId);
                    const exSnap = await getDoc(exRef);
                    if (exSnap.exists()) {
                        const exUpdate = {
                            teacherId: teacherUid,
                            createdByRole: 'teacher',
                            updatedAt: serverTimestamp()
                        };
                        const exData = exSnap.data();
                        if (exData.collaboratorIds) exUpdate.collaboratorIds = deleteField();
                        if (exData.collaboratorNames) exUpdate.collaboratorNames = deleteField();
                        if (exData.collaboratorRoles) exUpdate.collaboratorRoles = deleteField();
                        await updateDoc(exRef, exUpdate);
                    }
                } catch (e) { console.error(`Error transferring exercise ${exId}:`, e); }
            }
        }

        // For topic_folders: also transfer the topics inside
        if (collectionName === 'topic_folders' && cleanData.topicIds?.length) {
            for (const topicId of cleanData.topicIds) {
                try {
                    await transferOfficialToTeacher('topics', topicId, teacherEmail);
                } catch (e) { console.error(`Error transferring topic ${topicId}:`, e); }
            }
        }

        // For topics: also copy the words subcollection
        if (collectionName === 'topics') {
            const wordsSnap = await getDocs(collection(db, `topics/${docId}/words`));
            if (!wordsSnap.empty) {
                const batch = writeBatch(db);
                wordsSnap.forEach(wordDoc => {
                    const newWordRef = doc(collection(db, `teacher_topics/${newRef.id}/words`));
                    batch.set(newWordRef, { ...wordDoc.data() });
                });
                await batch.commit();
            }
        }

        // Delete original official document
        await deleteDoc(sourceRef);

    } else {
        // SAME COLLECTION (exams, grammar_exercises): update in place
        const ownerField = collectionName === 'exams' ? 'createdBy' : 'teacherId';

        const updateData = {
            [ownerField]: teacherUid,
            createdByRole: 'teacher',
            transferredAt: serverTimestamp(),
            transferredToName: teacherName,
            updatedAt: serverTimestamp()
        };

        if (collaboratorIds) updateData.collaboratorIds = deleteField();
        if (collaboratorNames) updateData.collaboratorNames = deleteField();
        if (collaboratorRoles) updateData.collaboratorRoles = deleteField();

        await updateDoc(sourceRef, updateData);
    }

    return { teacherUid, teacherName };
}
