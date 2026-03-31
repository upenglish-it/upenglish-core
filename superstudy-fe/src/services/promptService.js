import { api } from '../models/httpClient';

const BASE = '/teacher-prompts';

/**
 * Get ALL prompts (admin use). Returns every prompt across all teachers.
 * @returns {Promise<Array>}
 */
export async function getAllPrompts() {
    const result = await api.get(`${BASE}/all`);
    return Array.isArray(result) ? result : (result?.data || []);
}

/**
 * Get all prompts created by a specific teacher.
 * @param {string} uid - Teacher's user ID
 * @returns {Promise<Array>} Array of prompt objects
 */
export async function getTeacherPrompts(uid) {
    const result = await api.get(BASE, { teacherId: uid });
    let prompts = Array.isArray(result) ? result : (result?.data || []);
    return prompts.map(p => ({ ...p, id: p._id || p.id }));
}

/**
 * Create a new prompt.
 * @param {{ title: string, content: string, skill: 'writing'|'speaking', createdBy: string }} data
 * @returns {Promise<string>} The new document ID
 */
export async function createPrompt(data) {
    const result = await api.post(BASE, data);
    return result?.data?._id || result?.data?.id || result?._id || result?.id || result;
}

/**
 * Update an existing prompt.
 * @param {string} id - Document ID
 * @param {{ title?: string, content?: string, skill?: string }} data
 */
export async function updatePrompt(id, data) {
    return api.patch(`${BASE}/${id}`, data);
}

/**
 * Delete a prompt.
 * @param {string} id - Document ID
 */
export async function deletePrompt(id) {
    return api.delete(`${BASE}/${id}`);
}

/**
 * Get a single prompt by its document ID.
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} The prompt object or null if not found
 */
export async function getPromptById(id) {
    if (!id) return null;
    try {
        const result = await api.get(`${BASE}/${id}`);
        const data = result?.data || result;
        if (!data) return null;
        return { ...data, id: data._id || data.id };
    } catch {
        return null;
    }
}
