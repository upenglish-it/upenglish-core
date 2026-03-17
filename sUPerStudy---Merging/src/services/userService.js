import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Gets the current streak for a user, updating it if they logged in today.
 * Streak rules:
 * - If last active date is today: streak remains the same.
 * - If last active date was yesterday: streak increments by 1.
 * - If last active date was older than yesterday (or doesn't exist): streak resets to 1.
 * 
 * @param {string} uid The user ID
 * @returns {Promise<number>} The current (updated) streak
 */
export async function getAndUpdateUserStreak(uid) {
    if (!uid) return 0;

    const statsRef = doc(db, `users/${uid}/stats`, 'overview');

    try {
        const snap = await getDoc(statsRef);
        const todayStr = new Date().toLocaleDateString('en-CA'); // strict YYYY-MM-DD local time

        let currentStreak = 1;
        let lastActiveDate = null;

        if (snap.exists()) {
            const data = snap.data();
            currentStreak = data.currentStreak || 0;
            lastActiveDate = data.lastActiveDate;
        }

        // If already active today, just return current streak
        if (lastActiveDate === todayStr) {
            return currentStreak || 1; // Default to 1 if it was 0 for some reason but active today
        }

        // Check if last active was exactly yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        let newStreak = 1;
        if (lastActiveDate === yesterdayStr) {
            newStreak = currentStreak + 1;
        }

        // Update Firestore
        await setDoc(statsRef, {
            currentStreak: newStreak,
            lastActiveDate: todayStr,
            lastUpdatedAt: serverTimestamp()
        }, { merge: true });

        return newStreak;
    } catch (error) {
        console.error("Error updating formatting user streak:", error);
        // Fallback to minimal functionality rather than crashing
        return 0;
    }
}
/**
 * Fetch names/emails for a list of UIDs (public info)
 * @param {string[]} uids 
 */
/**
 * Fetch streak and last activity data for multiple student UIDs.
 * Returns { [uid]: { currentStreak, lastActiveDate } }
 */
export async function getStudentsStreakData(uids) {
    if (!uids || uids.length === 0) return {};
    const results = {};
    try {
        await Promise.all(uids.map(async (uid) => {
            const statsRef = doc(db, `users/${uid}/stats`, 'overview');
            const snap = await getDoc(statsRef);
            if (snap.exists()) {
                const data = snap.data();
                results[uid] = {
                    currentStreak: data.currentStreak || 0,
                    lastActiveDate: data.lastActiveDate || null
                };
            } else {
                results[uid] = { currentStreak: 0, lastActiveDate: null };
            }
        }));
    } catch (error) {
        console.error("Error fetching students streak data:", error);
    }
    return results;
}

export async function getUsersPublicInfo(uids) {
    if (!uids || uids.length === 0) return {};
    const results = {};
    try {
        const chunks = [];
        for (let i = 0; i < uids.length; i += 10) {
            chunks.push(uids.slice(i, i + 10));
        }

        await Promise.all(chunks.map(async (chunk) => {
            const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                const data = docSnap.data();
                results[docSnap.id] = {
                    displayName: data.displayName || data.email || 'Giáo viên ẩn danh',
                    email: data.email
                };
            });
        }));
        return results;
    } catch (error) {
        console.error("Error fetching users public info:", error);
        return results;
    }
}
