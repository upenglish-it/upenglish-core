import { readUserStorageDoc, writeUserStorageDoc } from './userStorageService';

const RECENT_DOC_TYPE = 'recent_lists';

function isLegacyCustomTopicEntry(entry) {
    return entry?.id === 'custom' && entry?.type === 'topic';
}

/**
 * Log a recently accessed list/topic to the user's settings.
 * @param {string} userId
 * @param {object} listInfo
 */
export async function logRecentList(userId, listInfo) {
    if (!userId || !listInfo || !listInfo.id) return;

    try {
        const doc = await readUserStorageDoc(userId, RECENT_DOC_TYPE);
        let recent = Array.isArray(doc?.lists) ? [...doc.lists] : [];

        recent = recent.filter(r => r.id !== listInfo.id && !isLegacyCustomTopicEntry(r));
        recent.unshift({
            ...listInfo,
            accessedAt: Date.now(),
        });

        if (recent.length > 8) {
            recent = recent.slice(0, 8);
        }

        await writeUserStorageDoc(userId, RECENT_DOC_TYPE, { lists: recent });
    } catch (err) {
        console.warn('Failed to log recent list', err);
    }
}

/**
 * Get recently accessed lists.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getRecentLists(userId) {
    if (!userId) return [];

    try {
        const doc = await readUserStorageDoc(userId, RECENT_DOC_TYPE);
        const lists = Array.isArray(doc?.lists) ? doc.lists : [];
        return lists
            .filter(list => !isLegacyCustomTopicEntry(list))
            .slice()
            .sort((a, b) => (b?.accessedAt || 0) - (a?.accessedAt || 0));
    } catch (err) {
        console.warn('Failed to fetch recent lists', err);
        return [];
    }
}
