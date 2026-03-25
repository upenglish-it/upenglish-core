import { db } from '../config/firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

/**
 * One-time migration: merge reward points from per-group subcollections
 * into centralized reward_points/{userId} top-level collection.
 *
 * For each user_groups/{groupId}/reward_points/{userId}:
 *   - Sum points → write to reward_points/{userId}
 *   - Copy history entries, adding groupId + groupName
 *
 * Safe to run multiple times (idempotent: sums from source, overwrites target).
 */
export async function migrateRewardPointsToCentral(onStatus) {
    const log = msg => { console.log(msg); onStatus?.(msg); };
    log('🔄 Starting reward points migration...');

    // 1. Get all groups
    const groupsSnap = await getDocs(collection(db, 'user_groups'));
    const groups = [];
    groupsSnap.forEach(d => groups.push({ id: d.id, ...d.data() }));
    log(`Found ${groups.length} groups`);

    // 2. Scan all per-group reward_points subcollections
    const userPointsMap = {}; // userId → { totalPoints, displayName, history: [] }

    for (const group of groups) {
        const groupName = group.name || group.id;
        let rewardSnap;
        try {
            rewardSnap = await getDocs(collection(db, `user_groups/${group.id}/reward_points`));
        } catch (e) {
            continue; // no subcollection
        }

        for (const rewardDoc of rewardSnap.docs) {
            const userId = rewardDoc.id;
            const data = rewardDoc.data();
            const pts = data.points || 0;

            if (!userPointsMap[userId]) {
                userPointsMap[userId] = { totalPoints: 0, displayName: data.displayName || '', history: [] };
            }
            userPointsMap[userId].totalPoints += pts;
            if (data.displayName) userPointsMap[userId].displayName = data.displayName;

            // Fetch history for this user in this group
            try {
                const histQ = query(
                    collection(db, `user_groups/${group.id}/reward_points/${userId}/history`),
                    orderBy('createdAt', 'desc')
                );
                const histSnap = await getDocs(histQ);
                histSnap.forEach(h => {
                    userPointsMap[userId].history.push({
                        ...h.data(),
                        groupId: group.id,
                        groupName
                    });
                });
            } catch (e) {
                // no history
            }
        }
        log(`  ✔ Scanned group: ${groupName}`);
    }

    const userIds = Object.keys(userPointsMap);
    log(`Found ${userIds.length} students with reward data`);

    // 3. Write centralized docs
    let migrated = 0;
    for (const userId of userIds) {
        const entry = userPointsMap[userId];

        // Write main doc
        const ref = doc(db, 'reward_points', userId);
        await setDoc(ref, {
            points: entry.totalPoints,
            displayName: entry.displayName,
            updatedAt: serverTimestamp(),
            migratedAt: serverTimestamp()
        }, { merge: true });

        // Write history entries
        for (const h of entry.history) {
            await addDoc(collection(db, `reward_points/${userId}/history`), {
                type: h.type || 'earn',
                amount: h.amount || 0,
                reason: h.reason || '',
                giftName: h.giftName || '',
                groupId: h.groupId || '',
                groupName: h.groupName || '',
                createdAt: h.createdAt || serverTimestamp(),
                createdBy: h.createdBy || '',
                migratedFromLegacy: true
            });
        }

        migrated++;
        if (migrated % 5 === 0) log(`  Migrated ${migrated}/${userIds.length}...`);
    }

    log(`✅ Migration complete! ${migrated} students migrated.`);
    return { migrated, userIds };
}
