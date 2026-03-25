import { db } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';
import { resetTopicProgress } from './spacedRepetition';

/**
 * Toggle saving/unsaving a specific word for a user.
 * @param {string} userId - The user's ID
 * @param {object} wordData - The full word data object to save
 * @returns {Promise<boolean>} - True if saved, false if unsaved
 */
export async function toggleSavedWord(userId, wordData) {
    if (!userId || !wordData || !wordData.word) throw new Error('Invalid data');

    const wordKey = wordData.word.toLowerCase();
    const docRef = doc(db, `users/${userId}/saved_words`, wordKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        // Unsave
        await deleteDoc(docRef);
        return false;
    } else {
        // Save
        await setDoc(docRef, {
            ...wordData,
            savedAt: serverTimestamp(),
        });
        return true;
    }
}

/**
 * Check if a word is saved by the user.
 * @param {string} userId - The user's ID
 * @param {string} word - The word text
 * @returns {Promise<boolean>}
 */
export async function checkWordSaved(userId, word) {
    if (!userId || !word) return false;
    const wordKey = word.toLowerCase();
    const docRef = doc(db, `users/${userId}/saved_words`, wordKey);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
}

/**
 * Get all saved words for a user, ordered by most recently saved.
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>}
 */
export async function getSavedWords(userId) {
    if (!userId) return [];
    const q = query(
        collection(db, `users/${userId}/saved_words`),
        orderBy('savedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Save a custom AI-generated list.
 * @param {string} userId - The user's ID
 * @param {string} listName - The name of the list
 * @param {Array} wordsData - The array of word data objects
 * @returns {Promise<string>} - The ID of the newly created list
 */
export async function saveCustomList(userId, listName, wordsData, isAI = false) {
    if (!userId || !wordsData || !wordsData.length) throw new Error('Invalid data');

    // Generate a unique ID for the list (e.g., timestamp based)
    const listId = `list_${Date.now()}`;
    const docRef = doc(db, `users/${userId}/custom_lists`, listId);

    await setDoc(docRef, {
        id: listId,
        name: listName || `Danh sách ngày ${new Date().toLocaleDateString('vi-VN')}`,
        words: wordsData,
        createdAt: serverTimestamp(),
        wordCount: wordsData.length,
        isGeneratedByAI: isAI
    });

    return listId;
}

/**
 * Get all custom lists for a user, ordered by creation date.
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>}
 */
export async function getCustomLists(userId) {
    if (!userId) return [];
    const q = query(
        collection(db, `users/${userId}/custom_lists`),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Update the words array of an existing custom list.
 * @param {string} userId - The user's ID
 * @param {string} listId - The ID of the list to update
 * @param {Array} newWords - The updated array of word data objects
 */
export async function updateCustomListWords(userId, listId, newWords) {
    if (!userId || !listId || !newWords) throw new Error('Invalid data');
    const docRef = doc(db, `users/${userId}/custom_lists`, listId);
    await updateDoc(docRef, {
        words: newWords,
        wordCount: newWords.length,
    });
}

/**
 * Delete a custom list.
 * @param {string} userId - The user's ID
 * @param {string} listId - The ID of the list to delete
 */
export async function deleteCustomList(userId, listId) {
    if (!userId || !listId) throw new Error('Invalid data');
    const docRef = doc(db, `users/${userId}/custom_lists`, listId);
    await deleteDoc(docRef);
    // Cleanup any progress associated with this list so it doesn't appear in review
    await resetTopicProgress(userId, listId);
}
