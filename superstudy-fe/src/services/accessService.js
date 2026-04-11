import { api } from '../models/httpClient';

/**
 * Returns the effective merged access arrays for a user, combining
 * their personal access with access inherited from all their groups.
 *
 * @param {Object} userData - The authenticated user's Firestore/MongoDB document
 * @returns {Promise<{mergedFolderAccess, mergedTopicAccess, mergedGrammarAccess, mergedExamAccess}>}
 */
export async function getEffectiveUserAccess(userData = {}) {
    function unique(values = []) {
        return [...new Set((values || []).filter(Boolean))];
    }

    let mergedFolderAccess = unique(userData.folderAccess);
    let mergedTopicAccess = unique(userData.topicAccess);
    let mergedGrammarAccess = unique(userData.grammarAccess);
    let mergedExamAccess = unique(userData.examAccess);

    const groupIds = unique(userData.groupIds);
    if (groupIds.length === 0) {
        return { mergedFolderAccess, mergedTopicAccess, mergedGrammarAccess, mergedExamAccess };
    }

    try {
        const result = await api.get('/sharing/user-access', { userId: userData.uid || userData.id });
        const access = result?.data || result || {};

        mergedFolderAccess = unique([...mergedFolderAccess, ...(access.folderAccess || [])]);
        mergedTopicAccess = unique([...mergedTopicAccess, ...(access.topicAccess || [])]);
        mergedGrammarAccess = unique([...mergedGrammarAccess, ...(access.grammarAccess || [])]);
        mergedExamAccess = unique([...mergedExamAccess, ...(access.examAccess || [])]);
    } catch (err) {
        // Fallback: query groups individually to merge access
        console.warn('[accessService] Backend user-access endpoint failed, falling back to group-by-group merge:', err.message);
        try {
            for (let i = 0; i < groupIds.length; i += 10) {
                const chunk = groupIds.slice(i, i + 10);
                const groupsResult = await api.get('/user-groups', { ids: chunk.join(',') });
                const groups = Array.isArray(groupsResult) ? groupsResult : (groupsResult?.data || []);
                for (const group of groups) {
                    if (group?.isHidden) continue;
                    mergedFolderAccess = unique([...mergedFolderAccess, ...(group.folderAccess || [])]);
                    mergedTopicAccess = unique([...mergedTopicAccess, ...(group.topicAccess || [])]);
                    mergedGrammarAccess = unique([...mergedGrammarAccess, ...(group.grammarAccess || [])]);
                    mergedExamAccess = unique([...mergedExamAccess, ...(group.examAccess || [])]);
                }
            }
        } catch (fallbackErr) {
            console.error('[accessService] Fallback group fetch also failed:', fallbackErr.message);
        }
    }

    return { mergedFolderAccess, mergedTopicAccess, mergedGrammarAccess, mergedExamAccess };
}
