import { wordProgressService } from '../models';
import { usersService } from '../models';

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

    try {
        const data = await wordProgressService.getStreak(uid);
        const todayStr = new Date().toLocaleDateString('en-CA'); // strict YYYY-MM-DD local time

        let currentStreak = data?.currentStreak || 0;
        let lastActiveDate = data?.lastActiveDate || null;

        // If already active today, just return current streak
        if (lastActiveDate === todayStr) {
            return currentStreak || 1;
        }

        // Check if last active was exactly yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        let newStreak = 1;
        if (lastActiveDate === yesterdayStr) {
            newStreak = currentStreak + 1;
        }

        // Update via API
        await wordProgressService.upsert({
            userId: uid,
            currentStreak: newStreak,
            lastActiveDate: todayStr,
        });

        return newStreak;
    } catch (error) {
        console.error("Error updating formatting user streak:", error);
        return 0;
    }
}

/**
 * Award bonus streak days to a user (e.g. for completing teacher ratings).
 * Adds bonusDays to the current streak without resetting lastActiveDate.
 * @param {string} uid The user ID
 * @param {number} bonusDays Number of bonus days to add
 * @returns {Promise<number>} The new streak value
 */
export async function awardStreakBonus(uid, bonusDays) {
    if (!uid || !bonusDays || bonusDays <= 0) return 0;

    try {
        const data = await wordProgressService.getStreak(uid);
        let currentStreak = data?.currentStreak || 1;

        const newStreak = currentStreak + bonusDays;

        await wordProgressService.upsert({
            userId: uid,
            currentStreak: newStreak,
        });

        return newStreak;
    } catch (error) {
        console.error("Error awarding streak bonus:", error);
        return 0;
    }
}

/**
 * Fetch streak and last activity data for multiple student UIDs.
 * Returns { [uid]: { currentStreak, lastActiveDate } }
 */
export async function getStudentsStreakData(uids) {
    if (!uids || uids.length === 0) return {};
    try {
        const data = await wordProgressService.getBulkStreak(uids);
        // Normalize: ensure every uid has an entry
        const results = {};
        uids.forEach(uid => {
            results[uid] = data?.[uid] || { currentStreak: 0, lastActiveDate: null };
        });
        return results;
    } catch (error) {
        console.error("Error fetching students streak data:", error);
        return {};
    }
}

/**
 * Fetch names/emails for a list of UIDs (public info)
 * @param {string[]} uids 
 */
export async function getUsersPublicInfo(uids) {
    if (!uids || uids.length === 0) return {};
    const results = {};
    try {
        // Fetch user details via API — batch by chunks of 10
        const chunks = [];
        for (let i = 0; i < uids.length; i += 10) {
            chunks.push(uids.slice(i, i + 10));
        }

        await Promise.all(chunks.map(async (chunk) => {
            // Use findAll with filter or fetch individually
            const promises = chunk.map(uid => usersService.findOne(uid).catch(() => null));
            const users = await Promise.all(promises);
            users.forEach((userData, idx) => {
                if (userData) {
                    results[chunk[idx]] = {
                        displayName: userData.displayName || userData.email || 'Giáo viên ẩn danh',
                        email: userData.email
                    };
                }
            });
        }));

        return results;
    } catch (error) {
        console.error("Error fetching users public info:", error);
        return results;
    }
}
