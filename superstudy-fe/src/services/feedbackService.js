import { api } from '../models/httpClient';
import { queueEmail, buildEmailHtml } from './notificationService';

/**
 * Submit anonymous feedback
 * @param {Object} data
 * @param {string} data.message
 * @param {string} data.category - 'suggestion' | 'complaint'
 * @param {string} data.senderUid
 * @param {string} data.senderName
 * @param {string} data.senderEmail
 * @param {string} data.senderRole
 * @param {string} [data.targetType] - 'admin' | 'direct'
 * @param {string} [data.targetUid] - UID of direct recipient
 * @param {string} [data.targetName] - Name of direct recipient
 * @param {string} [data.targetEmail] - Email of direct recipient
 */
export async function submitFeedback({ message, category, senderUid, senderName, senderEmail, senderRole, targetType, targetUid, targetName, targetEmail }) {
    const feedbackData = {
        message: message.trim(),
        category: category || 'suggestion',
        senderUid,
        senderName: senderName || '',
        senderEmail: senderEmail || '',
        senderRole: senderRole || 'user',
        targetType: targetType || 'admin',
    };

    // Add direct target fields if sending to a specific person
    if (targetType === 'direct' && targetUid) {
        feedbackData.targetUid = targetUid;
        feedbackData.targetName = targetName || '';
        feedbackData.targetEmail = targetEmail || '';
    }

    const result = await api.post('/anonymous-feedback', feedbackData);

    // Send email notification for direct feedback
    if (targetType === 'direct' && targetEmail) {
        const categoryLabel = category === 'complaint' ? 'Khiếu nại' : 'Đề xuất';
        const categoryEmoji = category === 'complaint' ? '⚠️' : '💡';
        try {
            await queueEmail(targetEmail, {
                subject: `${categoryEmoji} Bạn nhận được góp ý ẩn danh mới`,
                html: buildEmailHtml({
                    emoji: '💬',
                    heading: 'Góp ý ẩn danh mới',
                    headingColor: '#7c3aed',
                    greeting: `Chào ${targetName || 'bạn'} 👋`,
                    body: `
                        <p>Bạn vừa nhận được một góp ý ẩn danh từ nội bộ.</p>
                        <p><strong>Phân loại:</strong> ${categoryEmoji} ${categoryLabel}</p>
                    `,
                    highlight: `<p style="margin:0;color:#334155;white-space:pre-wrap;">${message.trim()}</p>`,
                    highlightBg: '#f5f3ff',
                    highlightBorder: '#7c3aed',
                    ctaText: 'Xem chi tiết',
                    ctaLink: 'https://upenglishvietnam.com/preview/superstudy/teacher/feedback',
                    ctaColor: '#7c3aed',
                    ctaColor2: '#6366f1',
                }),
            });
        } catch (err) {
            console.error('Error sending feedback email:', err);
        }
    }

    return result;
}

export async function getAdminFeedback() {
    try {
        const result = await api.get('/anonymous-feedback/admin');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (err) {
        console.error('Error fetching admin feedback:', err);
        return [];
    }
}

export async function getDirectFeedback() {
    try {
        const result = await api.get('/anonymous-feedback/direct');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (err) {
        console.error('Error fetching direct feedback:', err);
        return [];
    }
}

/**
 * Get feedback received by a specific user (direct only)
 */
export async function getMyReceivedFeedback(uid) {
    if (!uid) return [];
    try {
        const result = await api.get('/anonymous-feedback/me', { uid });
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (err) {
        console.error('Error fetching received feedback:', err);
        return [];
    }
}

export async function getMyUnreadFeedbackCount(uid) {
    if (!uid) return 0;
    try {
        const result = await api.get('/anonymous-feedback/me/unread-count', { uid });
        return typeof result === 'number' ? result : (result?.count || 0);
    } catch (err) {
        console.error('Error fetching my unread feedback count:', err);
        return 0;
    }
}

export async function getAllFeedback() {
    try {
        const result = await api.get('/anonymous-feedback/all');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (err) {
        console.error('Error fetching all feedback:', err);
        return [];
    }
}

/**
 * Mark feedback as read
 */
export async function markFeedbackAsRead(feedbackId) {
    return api.patch(`/anonymous-feedback/${feedbackId}/read`);
}

export async function deleteFeedback(feedbackId) {
    return api.delete(`/anonymous-feedback/${feedbackId}`);
}

/**
 * Hide feedback for a specific user (soft delete)
 */
export async function hideFeedbackForUser(feedbackId, uid) {
    return api.patch(`/anonymous-feedback/${feedbackId}/hide`, { uid });
}

export async function getUnreadFeedbackCount() {
    try {
        const result = await api.get('/anonymous-feedback/admin/unread-count');
        return typeof result === 'number' ? result : (result?.count || 0);
    } catch (err) {
        console.error('Error fetching admin unread feedback count:', err);
        return 0;
    }
}
