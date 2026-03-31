import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Log a recently accessed list/topic to the user's settings.
 * @param {string} userId - The user's ID
 * @param {object} listInfo - Formatted list info: { id, name, type, icon, wordCount, isGeneratedByAI }
 */
export async function logRecentList(userId, listInfo) {
    if (!userId || !listInfo || !listInfo.id) return;
    try {
        const docRef = doc(db, `users/${userId}/settings`, 'recent_lists');
        const snap = await getDoc(docRef);
        let recent = [];
        if (snap.exists()) {
            recent = snap.data().lists || [];
        }

        // Remove if already exists to push to front
        recent = recent.filter(r => r.id !== listInfo.id);

        // Add to front
        recent.unshift({
            ...listInfo,
            accessedAt: Date.now()
        });

        // Keep top 8
        if (recent.length > 8) recent = recent.slice(0, 8);

        await setDoc(docRef, { lists: recent }, { merge: true });
    } catch (err) {
        console.warn('Failed to log recent list', err);
    }
}

/**
 * Get recently accessed lists.
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>}
 */
export async function getRecentLists(userId) {
    if (!userId) return [];
    try {
        const docRef = doc(db, `users/${userId}/settings`, 'recent_lists');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().lists || [];
        }
        return [];
    } catch (err) {
        console.warn('Failed to fetch recent lists', err);
        return [];
    }
}
