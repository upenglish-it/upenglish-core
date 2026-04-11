import { resetTopicProgress } from './spacedRepetition';
import { readUserStorageDoc, writeUserStorageDoc } from './userStorageService';

const SAVED_WORDS_DOC_TYPE = 'saved_words';
const CUSTOM_LISTS_DOC_TYPE = 'custom_lists';

function normalizeSavedWord(word = {}) {
    const vietnameseMeaning = word?.vietnameseMeaning || word?.meaning || '';

    return {
        ...word,
        meaning: word?.meaning || vietnameseMeaning,
        vietnameseMeaning,
        savedAt: word?.savedAt || new Date().toISOString(),
    };
}

function normalizeCustomList(list = {}) {
    const words = Array.isArray(list?.words) ? list.words : [];

    return {
        ...list,
        id: list?.id,
        name: list?.name || `Danh sách ngày ${new Date().toLocaleDateString('vi-VN')}`,
        words,
        wordCount: list?.wordCount ?? words.length,
        isGeneratedByAI: !!list?.isGeneratedByAI,
        createdAt: list?.createdAt || new Date().toISOString(),
    };
}

async function readSavedWordsDoc(userId) {
    return readUserStorageDoc(userId, SAVED_WORDS_DOC_TYPE);
}

async function writeSavedWordsDoc(userId, words) {
    return writeUserStorageDoc(userId, SAVED_WORDS_DOC_TYPE, { words });
}

async function readCustomListsDoc(userId) {
    return readUserStorageDoc(userId, CUSTOM_LISTS_DOC_TYPE);
}

async function writeCustomListsDoc(userId, lists) {
    return writeUserStorageDoc(userId, CUSTOM_LISTS_DOC_TYPE, { lists });
}

/**
 * Toggle saving/unsaving a specific word for a user.
 * @param {string} userId
 * @param {object} wordData
 * @returns {Promise<boolean>}
 */
export async function toggleSavedWord(userId, wordData) {
    if (!userId || !wordData || !wordData.word) throw new Error('Invalid data');

    const doc = await readSavedWordsDoc(userId);
    const words = Array.isArray(doc?.words) ? [...doc.words] : [];
    const wordKey = wordData.word.toLowerCase();
    const existingIndex = words.findIndex(item => item?.word?.toLowerCase() === wordKey);

    if (existingIndex !== -1) {
        words.splice(existingIndex, 1);
        await writeSavedWordsDoc(userId, words);
        return false;
    }

    words.unshift(normalizeSavedWord(wordData));
    await writeSavedWordsDoc(userId, words);
    return true;
}

/**
 * Check if a word is saved by the user.
 * @param {string} userId
 * @param {string} word
 * @returns {Promise<boolean>}
 */
export async function checkWordSaved(userId, word) {
    if (!userId || !word) return false;

    const words = await getSavedWords(userId);
    const wordKey = word.toLowerCase();
    return words.some(item => item?.word?.toLowerCase() === wordKey);
}

/**
 * Get all saved words for a user, ordered by most recently saved.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getSavedWords(userId) {
    if (!userId) return [];

    const doc = await readSavedWordsDoc(userId);
    const words = Array.isArray(doc?.words) ? doc.words : [];
    return words
        .map(normalizeSavedWord)
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

/**
 * Save a custom AI-generated list.
 * @param {string} userId
 * @param {string} listName
 * @param {Array} wordsData
 * @returns {Promise<string>}
 */
export async function saveCustomList(userId, listName, wordsData, isAI = false) {
    if (!userId || !wordsData || !wordsData.length) throw new Error('Invalid data');

    const listId = `list_${Date.now()}`;
    const doc = await readCustomListsDoc(userId);
    const lists = Array.isArray(doc?.lists) ? [...doc.lists] : [];

    lists.unshift(normalizeCustomList({
        id: listId,
        name: listName,
        words: wordsData,
        wordCount: wordsData.length,
        isGeneratedByAI: isAI,
        createdAt: new Date().toISOString(),
    }));

    await writeCustomListsDoc(userId, lists);
    return listId;
}

/**
 * Get all custom lists for a user, ordered by creation date.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getCustomLists(userId) {
    if (!userId) return [];

    const doc = await readCustomListsDoc(userId);
    const lists = Array.isArray(doc?.lists) ? doc.lists : [];
    return lists
        .map(normalizeCustomList)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getCustomListById(userId, listId) {
    if (!userId || !listId) return null;

    const lists = await getCustomLists(userId);
    return lists.find(list => list.id === listId) || null;
}

/**
 * Update the words array of an existing custom list.
 * @param {string} userId
 * @param {string} listId
 * @param {Array} newWords
 */
export async function updateCustomListWords(userId, listId, newWords) {
    if (!userId || !listId || !newWords) throw new Error('Invalid data');

    const doc = await readCustomListsDoc(userId);
    const lists = Array.isArray(doc?.lists) ? [...doc.lists] : [];
    const index = lists.findIndex(list => list?.id === listId);

    if (index === -1) throw new Error('List not found');

    lists[index] = normalizeCustomList({
        ...lists[index],
        words: newWords,
        wordCount: newWords.length,
    });

    await writeCustomListsDoc(userId, lists);
}

/**
 * Delete a custom list.
 * @param {string} userId
 * @param {string} listId
 */
export async function deleteCustomList(userId, listId) {
    if (!userId || !listId) throw new Error('Invalid data');

    const doc = await readCustomListsDoc(userId);
    const lists = Array.isArray(doc?.lists) ? doc.lists : [];
    const filteredLists = lists.filter(list => list?.id !== listId);

    await writeCustomListsDoc(userId, filteredLists);
    await resetTopicProgress(userId, listId);
}
