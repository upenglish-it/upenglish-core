import { db } from '../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, orderBy, getDocs, onSnapshot, limit, Timestamp, getDoc } from 'firebase/firestore';

/**
 * Check if a user wants to receive email for a specific notification type.
 * Returns true by default (opt-out model: if field is missing, user gets all emails).
 * 
 * @param {string} userId
 * @param {string} notificationType e.g. 'deadline_expired', 'collab', 'content_proposal'
 * @returns {Promise<boolean>}
 */
export async function getUserEmailPreference(userId, notificationType) {
    if (!userId || !notificationType) return true;
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return true;
        const prefs = userSnap.data().emailPreferences;
        if (!prefs) return true; // no preferences set → send all
        return prefs[notificationType] !== false; // only skip if explicitly false
    } catch (e) {
        console.warn('Error reading email preference:', e);
        return true; // fail-open: send email if we can't read preference
    }
}

/**
 * Creates a new notification for a specific user.
 * 
 * @param {Object} data Notification data
 * @param {string} data.userId The user ID receiving this notification
 * @param {string} data.type e.g. 'exam_graded'
 * @param {string} data.title Short title
 * @param {string} data.message Detailed text
 * @param {string} data.link URL to navigate when clicked
 */
export async function createNotification(data) {
    if (!data.userId) return null;

    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
        ...data,
        isRead: false,
        createdAt: serverTimestamp()
    });
    return notifRef.id;
}

/**
 * Subscribe to notifications for a user (Real-time).
 * Retrieves the latest 50 notifications.
 *
 * @param {string} userId
 * @param {function} callback Function to call with updated notifications array
 * @returns {function} Unsubscribe function
 */
export function subscribeToUserNotifications(userId, callback) {
    if (!userId) return () => { };

    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = [];
        snapshot.forEach((docSnap) => {
            notifications.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Sort client-side (newest first) to avoid needing a composite index
        notifications.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });
        callback(notifications);
    });
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId) {
    if (!notificationId) return;
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, {
        isRead: true,
        readAt: serverTimestamp()
    });
}

/**
 * Mark all unread notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId) {
    if (!userId) return;

    // Fetch unread notifications
    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
            isRead: true,
            readAt: serverTimestamp()
        });
    });

    await batch.commit();
}

/**
 * Auto-cleanup: delete read notifications older than 7 days.
 */
export async function cleanupOldReadNotifications(userId) {
    if (!userId) return 0;

    const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', true)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    let count = 0;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt;
        if (createdAt && createdAt.toMillis && createdAt.toMillis() < sevenDaysAgo.toMillis()) {
            batch.delete(docSnap.ref);
            count++;
        }
    });

    if (count > 0) await batch.commit();
    return count;
}

/**
 * Clear ALL notifications for a user.
 */
export async function clearAllNotifications(userId) {
    if (!userId) return 0;

    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
    });

    await batch.commit();
    return snapshot.size;
}

/**
 * Creates a notification for ALL admin users.
 * @param {Object} data Common notification data (type, title, message, link, etc.)
 */
export async function createNotificationForAdmins(data) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'admin'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                ...data,
                userId: docSnap.id,
                isRead: false,
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error creating notifications for admins:", error);
    }
}

/**
 * Creates a notification for all teachers (and admins) assigned to a specific group.
 * @param {string} groupId
 * @param {Object} data Common notification data (title, message, etc.)
 */
export async function createNotificationForGroupTeachers(groupId, data) {
    if (!groupId) return;

    try {
        const usersRef = collection(db, 'users');
        // Find users who have this groupId in their groupIds array
        // Note: In an app with many teachers, this could be large, but normally it's few.
        const q = query(
            usersRef,
            where('groupIds', 'array-contains', groupId)
        );
        const snapshot = await getDocs(q);

        const teacherIds = [];
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            // Verify role if students also use `groupIds` array
            if (userData.role === 'teacher' || userData.role === 'admin') {
                teacherIds.push(docSnap.id);
            }
        });

        // Batch create notifications for these teachers
        if (teacherIds.length === 0) return;

        const batch = writeBatch(db);
        teacherIds.forEach(teacherId => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                ...data,
                userId: teacherId,
                isRead: false,
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error creating notifications for group teachers:", error);
    }
}

/**
 * Creates an in-app notification for all STUDENTS in a specific group.
 * @param {string} groupId
 * @param {Object} data Common notification data (title, message, link, etc.)
 * @param {string} [excludeUserId] Optional user ID to exclude (e.g. the teacher who created it)
 */
export async function createNotificationForGroupStudents(groupId, data, excludeUserId = null) {
    if (!groupId) return;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('groupIds', 'array-contains', groupId));
        const snapshot = await getDocs(q);

        const studentIds = [];
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            // Only students (role 'user')
            if (userData.role === 'user' && docSnap.id !== excludeUserId) {
                studentIds.push(docSnap.id);
            }
        });

        if (studentIds.length === 0) return;

        const batch = writeBatch(db);
        studentIds.forEach(studentId => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                ...data,
                userId: studentId,
                isRead: false,
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error creating notifications for group students:", error);
    }
}

/**
 * Queue emails for all students in a group.
 * Creates documents in `mail_queue` collection — Cloud Functions will pick them up and send.
 * @param {string} groupId
 * @param {Object} emailData { subject, html }
 * @param {string} [excludeUserId] Optional user ID to exclude
 */
export async function queueEmailForGroupStudents(groupId, emailData, excludeUserId = null) {
    if (!groupId) return;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('groupIds', 'array-contains', groupId));
        const snapshot = await getDocs(q);

        const students = [];
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (userData.role === 'user' && docSnap.id !== excludeUserId && userData.email) {
                students.push({ uid: docSnap.id, email: userData.email, displayName: userData.displayName });
            }
        });

        if (students.length === 0) return;

        const batch = writeBatch(db);
        students.forEach(student => {
            const mailRef = doc(collection(db, 'mail_queue'));
            batch.set(mailRef, {
                to: student.email,
                subject: emailData.subject,
                html: emailData.html,
                status: 'pending',
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Queued ${students.length} emails for group ${groupId}`);
    } catch (error) {
        console.error("Error queuing emails for group students:", error);
    }
}

/**
 * Build a beautifully branded email HTML with UP logo and warm tone.
 * @param {Object} options
 * @param {string} options.emoji - Section emoji icon
 * @param {string} options.heading - Main heading text
 * @param {string} options.headingColor - CSS color for heading (default: #4f46e5)
 * @param {string} options.body - HTML body content (paragraphs, etc.)
 * @param {string} [options.highlight] - Optional highlighted box text
 * @param {string} [options.highlightBg] - Background for highlight box (default: #eef2ff)
 * @param {string} [options.highlightBorder] - Border color for highlight box (default: #4f46e5)
 * @param {string} options.ctaText - Call-to-action button text
 * @param {string} [options.ctaColor] - Gradient start color for CTA (default: #4f46e5)
 * @param {string} [options.ctaColor2] - Gradient end color for CTA (default: #3b82f6)
 * @param {string} [options.greeting] - Optional personal greeting (e.g., "Chào Minh Anh 👋")
 */
export function buildEmailHtml({
    emoji = '📬', heading, headingColor = '#4f46e5', body,
    highlight, highlightBg = '#eef2ff', highlightBorder = '#4f46e5',
    ctaText, ctaColor = '#4f46e5', ctaColor2 = '#3b82f6',
    greeting
}) {
    const logoUrl = 'https://upenglishvietnam.com/logo.png';
    const appUrl = 'https://upenglishvietnam.com/preview/superstudy';

    const highlightBlock = highlight ? `
        <div style="background:${highlightBg};padding:16px 20px;border-radius:12px;margin:16px 0;border-left:4px solid ${highlightBorder};">
            ${highlight}
        </div>` : '';

    const greetingBlock = greeting ? `
        <p style="color:#334155;font-size:1.05rem;line-height:1.6;margin-bottom:4px;">${greeting}</p>` : '';

    const ctaBlock = ctaText ? `
        <div style="text-align:center;margin-top:28px;">
            <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,${ctaColor},${ctaColor2});color:white;padding:13px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.95rem;box-shadow:0 4px 14px rgba(0,0,0,0.1);">${ctaText}</a>
        </div>` : '';

    return `
    <div style="font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:540px;margin:0 auto;padding:0;background:#f8fafc;">
        <!-- Header with logo -->
        <div style="text-align:center;padding:28px 24px 16px;">
            <img src="${logoUrl}" alt="UP English" style="height:48px;width:auto;margin-bottom:8px;" />
            <p style="color:#94a3b8;font-size:0.75rem;margin:0;letter-spacing:0.5px;">Trung tâm Ngoại ngữ UP</p>
        </div>

        <!-- Main card -->
        <div style="background:#ffffff;margin:0 16px;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h2 style="color:${headingColor};margin:0 0 16px;font-size:1.35rem;text-align:center;">${emoji} ${heading}</h2>
            ${greetingBlock}
            <div style="color:#334155;font-size:0.95rem;line-height:1.7;">
                ${body}
            </div>
            ${highlightBlock}
            ${ctaBlock}
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding:20px 24px 28px;">
            <p style="color:#94a3b8;font-size:0.75rem;margin:0;">Bạn nhận email này vì đang là thành viên của sUPerStudy.</p>
            <p style="color:#cbd5e1;font-size:0.7rem;margin:6px 0 0;">© ${new Date().getFullYear()} Trung tâm Ngoại ngữ UP — upenglishvietnam.com</p>
        </div>
    </div>`;
}

/**
 * Queue a single email for one user.
 * @param {string} email Recipient email address
 * @param {Object} emailData { subject, html }
 */
export async function queueEmail(email, emailData) {
    if (!email || !emailData?.subject) return;
    try {
        const mailRef = doc(collection(db, 'mail_queue'));
        await setDoc(mailRef, {
            to: email,
            subject: emailData.subject,
            html: emailData.html || '',
            status: 'pending',
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error queuing email:", error);
    }
}

/**
 * Queue emails for all admin and staff users.
 * @param {Object} emailData { subject, html }
 * @param {string} [notificationType] Optional notification type key for email preference filtering
 */
export async function queueEmailForAdmins(emailData, notificationType = null) {
    if (!emailData?.subject) return;
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', 'in', ['admin', 'staff']));
        const snapshot = await getDocs(q);

        const admins = [];
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (userData.email) {
                // Check email preference if notificationType is specified
                if (notificationType) {
                    const prefs = userData.emailPreferences;
                    if (prefs && prefs[notificationType] === false) return; // user opted out
                }
                admins.push(userData.email);
            }
        });

        if (admins.length === 0) return;

        const batch = writeBatch(db);
        admins.forEach(email => {
            const mailRef = doc(collection(db, 'mail_queue'));
            batch.set(mailRef, {
                to: email,
                subject: emailData.subject,
                html: emailData.html || '',
                status: 'pending',
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error queuing emails for admins:", error);
    }
}

/**
 * Queue emails for all teachers in a group.
 * @param {string} groupId
 * @param {Object} emailData { subject, html }
 * @param {string} [notificationType] Optional notification type key for email preference filtering
 */
export async function queueEmailForGroupTeachers(groupId, emailData, notificationType = null) {
    if (!groupId || !emailData?.subject) return;
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('groupIds', 'array-contains', groupId));
        const snapshot = await getDocs(q);

        const teachers = [];
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if ((userData.role === 'teacher' || userData.role === 'admin') && userData.email) {
                // Check email preference if notificationType is specified
                if (notificationType) {
                    const prefs = userData.emailPreferences;
                    if (prefs && prefs[notificationType] === false) return; // user opted out
                }
                teachers.push(userData.email);
            }
        });

        if (teachers.length === 0) return;

        const batch = writeBatch(db);
        teachers.forEach(email => {
            const mailRef = doc(collection(db, 'mail_queue'));
            batch.set(mailRef, {
                to: email,
                subject: emailData.subject,
                html: emailData.html || '',
                status: 'pending',
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error queuing emails for group teachers:", error);
    }
}
