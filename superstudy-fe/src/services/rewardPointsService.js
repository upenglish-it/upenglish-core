import { api } from '../models/httpClient';

/**
 * Get a student's total reward points.
 */
export async function getStudentRewardPoints(userId) {
    if (!userId) return 0;
    try {
        const result = await api.get(`/reward-points/${userId}`);
        const data = result?.data || result;
        return data?.points || 0;
    } catch {
        return 0;
    }
}

/**
 * Add points to a student and record history.
 */
export async function addPoints(userId, amount, reason, createdBy, displayName, groupId, groupName) {
    const result = await api.post(`/reward-points/${userId}/add`, {
        amount,
        reason: reason || '',
        createdBy: createdBy || null,
        displayName: displayName || '',
        groupId: groupId || '',
        groupName: groupName || '',
    });
    return result?.data || result;
}

/**
 * Subtract (deduct) points from a student and record history.
 */
export async function subtractPoints(userId, amount, reason, createdBy, displayName, groupId, groupName) {
    const result = await api.post(`/reward-points/${userId}/subtract`, {
        amount,
        reason: reason || '',
        createdBy: createdBy || null,
        displayName: displayName || '',
        groupId: groupId || '',
        groupName: groupName || '',
    });
    const data = result?.data || result;
    return data?.points ?? 0;
}

/**
 * Redeem a gift and record history.
 */
export async function redeemGift(userId, amount, giftName, createdBy, groupId, groupName, displayName = '') {
    const result = await api.post(`/reward-points/${userId}/redeem`, {
        amount,
        giftName: giftName || '',
        createdBy: createdBy || null,
        displayName,
        groupId: groupId || '',
        groupName: groupName || '',
    });
    return result?.data || result;
}

/**
 * Get full history for a student.
 */
export async function getRewardHistory(userId) {
    if (!userId) return [];
    const result = await api.get(`/reward-points/${userId}/history`);
    return result?.data || result || [];
}
