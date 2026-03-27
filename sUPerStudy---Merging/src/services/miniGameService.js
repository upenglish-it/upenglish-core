import { api } from '../models/httpClient';

// ==========================================
// CRUD OPERATIONS
// ==========================================

export async function getAllMiniGames() {
    try {
        const result = await api.get('/mini-games');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error('Error fetching all mini games:', error);
        throw error;
    }
}

export async function getMyGames(userId) {
    if (!userId) return [];
    try {
        const result = await api.get('/mini-games/me', { userId });
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error('Error fetching my games:', error);
        throw error;
    }
}

export async function getApprovedGames() {
    try {
        const result = await api.get('/mini-games/approved/list');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error('Error fetching approved games:', error);
        throw error;
    }
}

export async function getPendingGames() {
    try {
        const result = await api.get('/mini-games/pending/list');
        return Array.isArray(result) ? result : (result?.data || []);
    } catch (error) {
        console.error('Error fetching pending games:', error);
        throw error;
    }
}

export async function getPendingGamesCount() {
    try {
        const result = await api.get('/mini-games/pending/count');
        return result?.data?.count ?? result?.count ?? 0;
    } catch {
        return 0;
    }
}

export async function getMiniGameById(gameId) {
    if (!gameId) return null;
    try {
        const result = await api.get(`/mini-games/${gameId}`);
        return result?.data || result || null;
    } catch (error) {
        console.error('Error fetching mini game:', error);
        throw error;
    }
}

export async function createMiniGame(data) {
    try {
        const result = await api.post('/mini-games', data);
        return result?.data || result;
    } catch (error) {
        console.error('Error creating mini game:', error);
        throw error;
    }
}

export async function updateMiniGame(gameId, data) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        const updateData = { ...data };
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.createdBy;
        delete updateData.status;
        delete updateData.changeLog;
        await api.patch(`/mini-games/${gameId}`, updateData);
    } catch (error) {
        console.error('Error updating mini game:', error);
        throw error;
    }
}

export async function deleteMiniGame(gameId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await api.delete(`/mini-games/${gameId}`);
    } catch (error) {
        console.error('Error deleting mini game:', error);
        throw error;
    }
}

// ==========================================
// APPROVAL WORKFLOW
// ==========================================

export async function submitForReview(gameId, userId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await api.patch(`/mini-games/${gameId}/submit`, { userId });
    } catch (error) {
        console.error('Error submitting game for review:', error);
        throw error;
    }
}

export async function approveGame(gameId, adminId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await api.patch(`/mini-games/${gameId}/approve`, { adminId });
    } catch (error) {
        console.error('Error approving game:', error);
        throw error;
    }
}

export async function rejectGame(gameId, adminId, note = '') {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await api.patch(`/mini-games/${gameId}/reject`, { adminId, note });
    } catch (error) {
        console.error('Error rejecting game:', error);
        throw error;
    }
}

export async function toggleMiniGame(gameId, isActive) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await api.patch(`/mini-games/${gameId}`, { isActive });
    } catch (error) {
        console.error('Error toggling mini game:', error);
        throw error;
    }
}
