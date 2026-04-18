import { api } from '../models/httpClient';

function unwrapList(result) {
    return Array.isArray(result) ? result : (result?.data || []);
}

function sanitizeStoredDoc(doc = {}) {
    const { id, _id, createdAt, updatedAt, ...rest } = doc || {};
    return rest;
}

export async function readUserStorageDoc(userId, type) {
    if (!userId || !type) return null;

    const result = await api.get('/settings', { userId, type });
    const docs = unwrapList(result);
    return docs[0] || null;
}

export async function writeUserStorageDoc(userId, type, data) {
    if (!userId || !type) throw new Error('Missing user storage identifiers');

    const existing = await readUserStorageDoc(userId, type);
    const payload = {
        ...(existing ? sanitizeStoredDoc(existing) : {}),
        ...(data || {}),
        userId,
        type,
    };

    const result = existing?.id
        ? await api.patch(`/settings/${existing.id}`, payload)
        : await api.post('/settings', payload);

    return result?.data || result;
}
