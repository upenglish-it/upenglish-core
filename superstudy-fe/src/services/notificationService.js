import { notificationsService, usersService } from '../models';
import { api } from '../models/httpClient';

function normalizeUser(user) {
    return {
        ...user,
        id: user?.id || user?._id,
    };
}

async function getGroupUsers(groupId) {
    if (!groupId) return [];
    try {
        const result = await usersService.getGroupMembers(groupId);
        const users = Array.isArray(result) ? result : (result?.data || []);
        return users.map(normalizeUser);
    } catch (error) {
        console.error('Error loading group users:', error);
        return [];
    }
}

/**
 * Check if a user wants to receive email for a specific notification type.
 * Returns true by default (opt-out model).
 */
export async function getUserEmailPreference(userId, notificationType) {
    if (!userId || !notificationType) return true;
    try {
        const user = await usersService.findOne(userId);
        if (!user) return true;
        const prefs = user.emailPreferences;
        if (!prefs) return true;
        return prefs[notificationType] !== false;
    } catch (e) {
        console.warn('Error reading email preference:', e);
        return true;
    }
}

/**
 * Creates a new notification for a specific user.
 */
export async function createNotification(data) {
    if (!data.userId) return null;
    const result = await notificationsService.create({
        ...data,
        isRead: false,
    });
    return result?.id || result;
}

/**
 * Subscribe to notifications for a user (Real-time).
 * NOTE: This still uses Firestore onSnapshot because REST APIs don't support real-time subscriptions.
 * Consider migrating to WebSocket/SSE when the backend supports it.
 */
export function subscribeToUserNotifications(userId, callback) {
    if (!userId) {
        callback?.([]);
        return () => { };
    }

    let active = true;

    const load = async () => {
        try {
            const result = await notificationsService.findAll(userId);
            const notifications = (result?.data || result || []).map(item => ({
                ...item,
                id: item.id || item._id,
            }));
            if (active) callback(notifications);
        } catch (error) {
            console.warn('Error loading notifications:', error);
            if (active) callback([]);
        }
    };

    load();
    const intervalId = window.setInterval(load, 30000);

    return () => {
        active = false;
        window.clearInterval(intervalId);
    };
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId) {
    if (!notificationId) return;
    await notificationsService.markRead(notificationId);
}

/**
 * Mark all unread notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId) {
    if (!userId) return;
    await notificationsService.markAllRead(userId);
}

/**
 * Auto-cleanup: delete read notifications older than 7 days.
 * NOTE: Stays on Firestore — backend should handle scheduled cleanup.
 */
export async function cleanupOldReadNotifications(userId) {
    if (!userId) return 0;
    return 0;
}

/**
 * Clear ALL notifications for a user.
 */
export async function clearAllNotifications(userId) {
    if (!userId) return 0;
    const result = await notificationsService.clearAll(userId);
    return result?.data?.deletedCount ?? result?.deletedCount ?? 0;
}

/**
 * Creates a notification for ALL admin users.
 * NOTE: Batch notification creation stays on Firestore for now.
 * Backend should have a dedicated batch-create endpoint.
 */
export async function createNotificationForAdmins(data) {
    try {
        const result = await usersService.findAll({ role: 'admin' });
        const admins = (Array.isArray(result) ? result : (result?.data || []))
            .map(normalizeUser)
            .filter(user => user.id);
        await Promise.all(admins.map(admin => createNotification({ ...data, userId: admin.id })));
    } catch (error) {
        console.error("Error creating notifications for admins:", error);
    }
}

/**
 * Creates a notification for all teachers (and admins) assigned to a specific group.
 */
export async function createNotificationForGroupTeachers(groupId, data) {
    if (!groupId) return;

    try {
        const teacherIds = (await getGroupUsers(groupId))
            .filter(user => user.role === 'teacher' || user.role === 'admin')
            .map(user => user.id)
            .filter(Boolean);

        if (teacherIds.length === 0) return;

        await Promise.all(teacherIds.map(userId => createNotification({ ...data, userId })));
    } catch (error) {
        console.error("Error creating notifications for group teachers:", error);
    }
}

/**
 * Creates an in-app notification for all STUDENTS in a specific group.
 */
export async function createNotificationForGroupStudents(groupId, data, excludeUserId = null) {
    if (!groupId) return;

    try {
        const studentIds = (await getGroupUsers(groupId))
            .filter(user => user.role === 'user' && user.id !== excludeUserId)
            .map(user => user.id)
            .filter(Boolean);

        if (studentIds.length === 0) return;

        await Promise.all(studentIds.map(userId => createNotification({ ...data, userId })));
    } catch (error) {
        console.error("Error creating notifications for group students:", error);
    }
}

/**
 * Queue emails for all students in a group.
 * NOTE: mail_queue is Firestore-specific — Cloud Functions pick these up.
 */
export async function queueEmailForGroupStudents(groupId, emailData, excludeUserId = null) {
    if (!groupId) return;

    try {
        const students = (await getGroupUsers(groupId)).filter(user =>
            user.role === 'user' && user.id !== excludeUserId && user.email
        );

        if (students.length === 0) return;

        await Promise.all(students.map(student => queueEmail(student.email, emailData)));
    } catch (error) {
        console.error("Error queuing emails for group students:", error);
    }
}

/**
 * Build a beautifully branded email HTML with UP logo and warm tone.
 */
export function buildEmailHtml({
    emoji = '📬', heading, headingColor = '#4f46e5', body,
    highlight, highlightBg = '#eef2ff', highlightBorder = '#4f46e5',
    ctaText, ctaLink, ctaColor = '#4f46e5', ctaColor2 = '#3b82f6',
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

    const finalCtaUrl = ctaLink || appUrl;
    const ctaBlock = ctaText ? `
        <div style="text-align:center;margin-top:28px;">
            <a href="${finalCtaUrl}" style="display:inline-block;background:linear-gradient(135deg,${ctaColor},${ctaColor2});color:white;padding:13px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.95rem;box-shadow:0 4px 14px rgba(0,0,0,0.1);">${ctaText}</a>
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
 * NOTE: mail_queue stays on Firestore — Cloud Functions pick these up.
 */
export async function queueEmail(email, emailData) {
    if (!email || !emailData?.subject) return;
    try {
        await api.post('/mail-queue', {
            to: email,
            subject: emailData.subject,
            html: emailData.html || '',
        });
    } catch (error) {
        console.error("Error queuing email:", error);
    }
}

/**
 * Queue emails for all admin and staff users.
 */
export async function queueEmailForAdmins(emailData, notificationType = null) {
    if (!emailData?.subject) return;
    try {
        await api.post('/mail-queue/admins', {
            subject: emailData.subject,
            html: emailData.html || '',
            notificationType
        });
    } catch (error) {
        console.error("Error queuing emails for admins:", error);
    }
}

/**
 * Queue emails for all teachers in a group.
 */
export async function queueEmailForGroupTeachers(groupId, emailData, notificationType = null) {
    if (!groupId || !emailData?.subject) return;
    try {
        const teachers = (await getGroupUsers(groupId)).filter(user => {
            if ((user.role !== 'teacher' && user.role !== 'admin') || !user.email) {
                return false;
            }
            if (!notificationType) return true;
            const prefs = user.emailPreferences;
            return !prefs || prefs[notificationType] !== false;
        });

        if (teachers.length === 0) return;

        await Promise.all(teachers.map(teacher => queueEmail(teacher.email, emailData)));
    } catch (error) {
        console.error("Error queuing emails for group teachers:", error);
    }
}
