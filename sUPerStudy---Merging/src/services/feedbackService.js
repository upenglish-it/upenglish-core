import { db } from '../config/firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { api } from '../models/httpClient';
import { queueEmail, buildEmailHtml } from './notificationService';

const FEEDBACK_COLLECTION = 'anonymous_feedback';

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

/**
 * Get all feedback sent TO ADMIN (targetType != 'direct')
 */
export async function getAdminFeedback() {
    // Get all and filter client-side: feedback without targetType or with targetType === 'admin'
    const q = query(
        collection(db, FEEDBACK_COLLECTION),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(fb => !fb.targetType || fb.targetType === 'admin');
}

/**
 * Get all DIRECT (peer-to-peer) feedback — for admin to view
 */
export async function getDirectFeedback() {
    try {
        const q = query(
            collection(db, FEEDBACK_COLLECTION),
            where('targetType', '==', 'direct'),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('Index not ready, using client-side sort:', err.message);
        const q = query(
            collection(db, FEEDBACK_COLLECTION),
            where('targetType', '==', 'direct')
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => {
            const ta = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const tb = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return tb - ta;
        });
        return results;
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

/**
 * Get count of unread direct feedback for a user
 */
export async function getMyUnreadFeedbackCount(uid) {
    if (!uid) return 0;
    const q = query(
        collection(db, FEEDBACK_COLLECTION),
        where('targetType', '==', 'direct'),
        where('targetUid', '==', uid),
        where('isRead', '==', false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

/**
 * Get all feedback (legacy — used by admin sidebar badge)
 */
export async function getAllFeedback() {
    const q = query(
        collection(db, FEEDBACK_COLLECTION),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Mark feedback as read
 */
export async function markFeedbackAsRead(feedbackId) {
    return api.patch(`/anonymous-feedback/${feedbackId}/read`);
}

/**
 * Delete feedback
 */
export async function deleteFeedback(feedbackId) {
    const ref = doc(db, FEEDBACK_COLLECTION, feedbackId);
    return deleteDoc(ref);
}

/**
 * Hide feedback for a specific user (soft delete)
 */
export async function hideFeedbackForUser(feedbackId, uid) {
    return api.patch(`/anonymous-feedback/${feedbackId}/hide`, { uid });
}

/**
 * Get count of unread feedback sent to admin
 */
export async function getUnreadFeedbackCount() {
    // Can't filter targetType != 'direct' in count query, so just count all unread
    const q = query(
        collection(db, FEEDBACK_COLLECTION),
        where('isRead', '==', false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
}
