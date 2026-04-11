import { usersService } from '../models';
import { api } from '../models/httpClient';
import { blobToDataUrl } from './feedbackImageService';
import { buildEmailHtml, createNotification, queueEmail } from './notificationService';

const MANAGEMENT_ROLES = ['admin', 'staff'];

function ensureArray(result) {
    return Array.isArray(result) ? result : (result?.data || []);
}

function normalizeUser(user) {
    if (!user) return null;
    return {
        uid: user.uid || user.id || user._id || '',
        displayName: user.displayName || user.name || user.email || 'bạn',
        email: user.email || '',
        role: user.role || 'user',
        status: user.status || '',
        isDeleted: !!user.isDeleted,
    };
}

function getCategoryMeta(category) {
    return category === 'complaint'
        ? { label: 'Khiáº¿u náº¡i', emoji: 'âš ï¸' }
        : { label: 'Äá» xuáº¥t', emoji: 'ðŸ’¡' };
}

function truncateFeedbackMessage(message, maxLength = 120) {
    const cleaned = (message || '').trim().replace(/\s+/g, ' ');
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength - 1)}â€¦`;
}

function getFeedbackSourceLabel(senderRole, targetType) {
    if (targetType === 'direct') return 'tá»« ná»™i bá»™';
    return senderRole === 'user' ? 'tá»« há»c viÃªn' : 'tá»« ná»™i bá»™';
}

function getFeedbackLinkForRole(role, targetType) {
    if (targetType === 'direct' && role === 'teacher') return '/teacher/feedback';
    return '/admin/feedback';
}

async function getManagementRecipients(senderUid) {
    const results = await Promise.all(
        MANAGEMENT_ROLES.map(role => usersService.findAll({ role }).catch(() => []))
    );

    return results
        .flatMap(result => ensureArray(result))
        .map(normalizeUser)
        .filter(user => user?.uid && user.uid !== senderUid)
        .filter(user => !user.isDeleted)
        .filter(user => !user.status || user.status === 'approved');
}

async function getDirectRecipient({ targetUid, targetName, targetEmail, targetRole }) {
    if (!targetUid) return null;

    if (targetEmail && targetRole) {
        return {
            uid: targetUid,
            displayName: targetName || targetEmail || 'bạn',
            email: targetEmail,
            role: targetRole,
        };
    }

    try {
        const response = await usersService.findOne(targetUid);
        const user = normalizeUser(response?.data || response);
        if (!user || user.isDeleted) return null;
        return {
            uid: targetUid,
            displayName: targetName || user.displayName,
            email: targetEmail || user.email,
            role: targetRole || user.role,
        };
    } catch (error) {
        console.error('Error loading direct feedback recipient:', error);
        return {
            uid: targetUid,
            displayName: targetName || targetEmail || 'bạn',
            email: targetEmail || '',
            role: targetRole || 'teacher',
        };
    }
}

async function notifyFeedbackRecipients({
    feedbackId,
    message,
    category,
    senderUid,
    senderRole,
    targetType,
    targetUid,
    targetName,
    targetEmail,
    targetRole,
    hasAttachment,
}) {
    const { label: categoryLabel, emoji: categoryEmoji } = getCategoryMeta(category);
    const sourceLabel = getFeedbackSourceLabel(senderRole, targetType);
    const preview = truncateFeedbackMessage(message);
    const attachmentText = hasAttachment ? ' â€¢ CÃ³ áº£nh Ä‘Ã­nh kÃ¨m' : '';

    if (targetType === 'direct') {
        const recipient = await getDirectRecipient({ targetUid, targetName, targetEmail, targetRole });
        if (!recipient?.uid) return;

        const link = getFeedbackLinkForRole(recipient.role, 'direct');

        try {
            await createNotification({
                userId: recipient.uid,
                type: 'feedback_direct',
                title: 'ðŸ’¬ Báº¡n nháº­n Ä‘Æ°á»£c gÃ³p Ã½ áº©n danh má»›i',
                message: `${categoryEmoji} ${categoryLabel}${attachmentText}: ${preview}`,
                link,
                showPopup: true,
                feedbackId,
            });
        } catch (error) {
            console.error('Error creating direct feedback notification:', error);
        }

        if (recipient.email) {
            try {
                await queueEmail(recipient.email, {
                    subject: `${categoryEmoji} Báº¡n nháº­n Ä‘Æ°á»£c gÃ³p Ã½ áº©n danh má»›i`,
                    html: buildEmailHtml({
                        emoji: 'ðŸ’¬',
                        heading: 'GÃ³p Ã½ áº©n danh má»›i',
                        headingColor: '#7c3aed',
                        greeting: `ChÃ o ${recipient.displayName || 'bạn'} ðŸ‘‹`,
                        body: `
                            <p>Bạn vừa nhận được một góp ý ẩn danh ${sourceLabel}.</p>
                            <p><strong>Phân loại:</strong> ${categoryEmoji} ${categoryLabel}</p>
                            ${hasAttachment ? '<p><strong>Đính kèm:</strong> Có ảnh minh họa.</p>' : ''}
                        `,
                        highlight: `<p style="margin:0;color:#334155;white-space:pre-wrap;">${(message || '').trim()}</p>`,
                        highlightBg: '#f5f3ff',
                        highlightBorder: '#7c3aed',
                        ctaText: 'Xem chi tiết',
                        ctaLink: `https://upenglishvietnam.com/preview/superstudy${link}`,
                        ctaColor: '#7c3aed',
                        ctaColor2: '#6366f1',
                    }),
                });
            } catch (error) {
                console.error('Error sending direct feedback email:', error);
            }
        }

        return;
    }

    const recipients = await getManagementRecipients(senderUid);
    if (recipients.length === 0) return;

    const title = senderRole === 'user'
        ? 'ðŸ’¬ Há»c viÃªn gá»­i gÃ³p Ã½ áº©n danh má»›i'
        : 'ðŸ’¬ CÃ³ gÃ³p Ã½ áº©n danh má»›i gá»­i tá»›i ban quáº£n lÃ½';
    const link = '/admin/feedback';

    await Promise.allSettled(recipients.map(async recipient => {
        try {
            await createNotification({
                userId: recipient.uid,
                type: 'feedback_admin',
                title,
                message: `${categoryEmoji} ${categoryLabel}${attachmentText}: ${preview}`,
                link,
                showPopup: true,
                feedbackId,
            });
        } catch (error) {
            console.error('Error creating management feedback notification:', error);
        }

        if (!recipient.email) return;

        try {
            await queueEmail(recipient.email, {
                subject: senderRole === 'user'
                    ? `${categoryEmoji} Há»c viÃªn gá»­i gÃ³p Ã½ áº©n danh má»›i`
                    : `${categoryEmoji} CÃ³ gÃ³p Ã½ áº©n danh má»›i gá»­i tá»›i ban quáº£n lÃ½`,
                html: buildEmailHtml({
                    emoji: 'ðŸ’¬',
                    heading: 'GÃ³p Ã½ áº©n danh má»›i',
                    headingColor: '#7c3aed',
                    greeting: `ChÃ o ${recipient.displayName || 'bạn'} ðŸ‘‹`,
                    body: `
                        <p>Hệ thống vừa nhận được một góp ý ẩn danh ${sourceLabel}.</p>
                        <p><strong>Phân loại:</strong> ${categoryEmoji} ${categoryLabel}</p>
                        ${hasAttachment ? '<p><strong>Đính kèm:</strong> Có ảnh minh họa.</p>' : ''}
                    `,
                    highlight: `<p style="margin:0;color:#334155;white-space:pre-wrap;">${(message || '').trim()}</p>`,
                    highlightBg: '#f5f3ff',
                    highlightBorder: '#7c3aed',
                    ctaText: 'Mở góp ý',
                    ctaLink: `https://upenglishvietnam.com/preview/superstudy${link}`,
                    ctaColor: '#7c3aed',
                    ctaColor2: '#6366f1',
                }),
            });
        } catch (error) {
            console.error('Error sending management feedback email:', error);
        }
    }));
}

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
 * @param {string} [data.targetRole] - Role of direct recipient
 * @param {Blob} [data.imageBlob] - Optional feedback attachment
 * @param {string} [data.imageName] - Original attachment filename
 */
export async function submitFeedback({ message, category, senderUid, senderName, senderEmail, senderRole, targetType, targetUid, targetName, targetEmail, targetRole, imageBlob, imageName }) {
    const feedbackData = {
        message: message.trim(),
        category: category || 'suggestion',
        senderUid,
        senderName: senderName || '',
        senderEmail: senderEmail || '',
        senderRole: senderRole || 'user',
        targetType: targetType || 'admin',
    };

    if (imageBlob) {
        feedbackData.imageUrl = await blobToDataUrl(imageBlob);
        feedbackData.imageName = imageName || 'attachment.webp';
    }

    if (targetType === 'direct' && targetUid) {
        feedbackData.targetUid = targetUid;
        feedbackData.targetName = targetName || '';
        feedbackData.targetEmail = targetEmail || '';
        feedbackData.targetRole = targetRole || '';
    }

    const result = await api.post('/anonymous-feedback', feedbackData);
    const feedbackId = result?.id || result?.data?.id || result?.data?._id || result?._id;

    await notifyFeedbackRecipients({
        feedbackId,
        message,
        category,
        senderUid,
        senderRole,
        targetType: targetType || 'admin',
        targetUid,
        targetName,
        targetEmail,
        targetRole,
        hasAttachment: !!feedbackData.imageUrl,
    });

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

export async function markFeedbackAsRead(feedbackId) {
    return api.patch(`/anonymous-feedback/${feedbackId}/read`);
}

export async function deleteFeedback(feedbackId) {
    const id = typeof feedbackId === 'string' ? feedbackId : feedbackId?.id;
    if (!id) return null;
    return api.delete(`/anonymous-feedback/${id}`);
}

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
