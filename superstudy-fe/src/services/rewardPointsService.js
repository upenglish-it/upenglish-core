import { db } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, increment } from 'firebase/firestore';

// ========== CENTRALIZED REWARD POINTS ==========
// Path: reward_points/{userId}        — single doc per student (global points)
// Path: reward_points/{userId}/history — earn/deduct/redeem entries with groupId reference

/**
 * Get a student's total reward points.
 */
export async function getStudentRewardPoints(userId) {
    const snap = await getDoc(doc(db, 'reward_points', userId));
    return snap.exists() ? (snap.data().points || 0) : 0;
}

/**
 * Add points to a student and record history.
 * groupId/groupName are stored in history for reference only.
 */
export async function addPoints(userId, amount, reason, createdBy, displayName, groupId, groupName) {
    const ref = doc(db, 'reward_points', userId);
    const snap = await getDoc(ref);
    const currentPoints = snap.exists() ? (snap.data().points || 0) : 0;

    await setDoc(ref, {
        points: currentPoints + amount,
        displayName: displayName || snap.data()?.displayName || '',
        updatedAt: serverTimestamp(),
        ...(!snap.exists() ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });

    await addDoc(collection(db, `reward_points/${userId}/history`), {
        type: 'earn',
        amount,
        reason: reason || '',
        groupId: groupId || '',
        groupName: groupName || '',
        createdAt: serverTimestamp(),
        createdBy: createdBy || ''
    });
}

/**
 * Subtract (deduct) points from a student and record history.
 */
export async function subtractPoints(userId, amount, reason, createdBy, displayName, groupId, groupName) {
    const ref = doc(db, 'reward_points', userId);
    const snap = await getDoc(ref);
    const currentPoints = snap.exists() ? (snap.data().points || 0) : 0;
    const newPoints = Math.max(0, currentPoints - amount);

    await setDoc(ref, {
        points: newPoints,
        displayName: displayName || snap.data()?.displayName || '',
        updatedAt: serverTimestamp(),
        ...(!snap.exists() ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });

    await addDoc(collection(db, `reward_points/${userId}/history`), {
        type: 'deduct',
        amount,
        reason: reason || '',
        groupId: groupId || '',
        groupName: groupName || '',
        createdAt: serverTimestamp(),
        createdBy: createdBy || ''
    });

    return newPoints;
}

/**
 * Redeem a gift — subtract points and record history.
 */
export async function redeemGift(userId, amount, giftName, createdBy, groupId, groupName) {
    const ref = doc(db, 'reward_points', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Không tìm thấy dữ liệu điểm của học viên này.');
    const currentPoints = snap.data().points || 0;
    if (currentPoints < amount) throw new Error(`Không đủ điểm! Hiện có ${currentPoints} điểm, cần ${amount} điểm.`);

    await updateDoc(ref, {
        points: increment(-amount),
        updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, `reward_points/${userId}/history`), {
        type: 'redeem',
        amount,
        giftName: giftName || '',
        groupId: groupId || '',
        groupName: groupName || '',
        createdAt: serverTimestamp(),
        createdBy: createdBy || ''
    });
}

/**
 * Get full history for a student (centralized).
 */
export async function getRewardHistory(userId) {
    const q = query(
        collection(db, `reward_points/${userId}/history`),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const history = [];
    snap.forEach(docSnap => {
        history.push({ id: docSnap.id, ...docSnap.data() });
    });
    return history;
}
