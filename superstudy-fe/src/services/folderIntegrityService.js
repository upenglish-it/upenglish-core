import { api } from '../models/httpClient';

export const FOLDER_COLLECTION_CONFIG = {
    topic_folders:          { itemIdsField: 'topicIds',    childCollection: 'topics',            childOwnerField: null },
    teacher_topic_folders:  { itemIdsField: 'topicIds',    childCollection: 'teacher_topics',    childOwnerField: 'teacherId' },
    grammar_folders:        { itemIdsField: 'exerciseIds', childCollection: 'grammar_exercises', childOwnerField: null },
    teacher_grammar_folders:{ itemIdsField: 'exerciseIds', childCollection: 'grammar_exercises', childOwnerField: 'teacherId' },
    exam_folders:           { itemIdsField: 'examIds',     childCollection: 'exams',             childOwnerField: null },
    teacher_exam_folders:   { itemIdsField: 'examIds',     childCollection: 'exams',             childOwnerField: 'createdBy' }
};

// Map Firestore collection names → backend route prefixes
const COLLECTION_TO_ROUTE = {
    topic_folders:           'topic-folders',
    teacher_topic_folders:   'teacher-topic-folders',
    grammar_folders:         'grammar-folders',
    teacher_grammar_folders: 'teacher-grammar-folders',
    exam_folders:            'exam-folders',
    teacher_exam_folders:    'teacher-exam-folders',
};

export function getFolderCollectionConfig(collectionName) {
    return FOLDER_COLLECTION_CONFIG[collectionName] || null;
}

export function normalizeFolderItemIds(ids = []) {
    const seen = new Set();
    return (Array.isArray(ids) ? ids : [])
        .map(id => typeof id === 'string' ? id.trim() : id)
        .filter(id => {
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
}

/**
 * Save a folder and enforce exclusive ownership of its items — i.e. remove
 * those item IDs from every other folder in the same collection.
 *
 * Mirrors the original Firebase implementation but uses the backend API.
 */
export async function saveFolderWithExclusiveItems({
    collectionName,
    folderData,
    ownerField,
    ownerValue
}) {
    if (!collectionName || !folderData) throw new Error('Missing folder save config');

    const config = getFolderCollectionConfig(collectionName);
    if (!config) throw new Error(`Unsupported folder collection: ${collectionName}`);

    const route = COLLECTION_TO_ROUTE[collectionName];
    if (!route) throw new Error(`No backend route mapped for: ${collectionName}`);

    const { itemIdsField } = config;
    const { id, ...data } = folderData;

    const hasItemIds = Object.prototype.hasOwnProperty.call(folderData, itemIdsField);
    const normalizedItemIds = hasItemIds ? normalizeFolderItemIds(folderData[itemIdsField]) : [];

    const payload = { ...data };
    if (hasItemIds) payload[itemIdsField] = normalizedItemIds;
    if (!id && ownerField && ownerValue) payload[ownerField] = ownerValue;

    let targetFolderId;
    if (id) {
        // Update existing folder
        const result = await api.patch(`/${route}/${id}`, payload);
        targetFolderId = id;
        // Enforce exclusivity via backend endpoint
        if (hasItemIds && normalizedItemIds.length > 0) {
            try {
                await api.post(`/${route}/${id}/enforce-exclusive`, { [itemIdsField]: normalizedItemIds });
            } catch (e) {
                // enforce-exclusive endpoint may not exist yet — fail silently
                console.warn('[folderIntegrityService] enforce-exclusive not available:', e.message);
            }
        }
    } else {
        // Create new folder
        const result = await api.post(`/${route}`, payload);
        const created = result?.data || result;
        targetFolderId = created?.id || created?._id;
        // Enforce exclusivity after creation
        if (hasItemIds && normalizedItemIds.length > 0 && targetFolderId) {
            try {
                await api.post(`/${route}/${targetFolderId}/enforce-exclusive`, { [itemIdsField]: normalizedItemIds });
            } catch (e) {
                console.warn('[folderIntegrityService] enforce-exclusive not available:', e.message);
            }
        }
    }

    return targetFolderId;
}
