import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, arrayUnion } from 'firebase/firestore';

// ==========================================
// CRUD OPERATIONS
// ==========================================

/** Get all mini games (for Admin — all statuses) */
export async function getAllMiniGames() {
    try {
        const snapshot = await getDocs(collection(db, 'mini_games'));
        const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        return games.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
        console.error('Error fetching all mini games:', error);
        throw error;
    }
}

/** Get games created by a specific IT user */
export async function getMyGames(userId) {
    if (!userId) return [];
    try {
        const q = query(collection(db, 'mini_games'), where('createdBy', '==', userId));
        const snapshot = await getDocs(q);
        const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client-side (newest first)
        return games.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error fetching my games:', error);
        throw error;
    }
}

/** Get approved & active games (for Teacher) */
export async function getApprovedGames() {
    try {
        const q = query(
            collection(db, 'mini_games'),
            where('status', '==', 'approved'),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching approved games:', error);
        throw error;
    }
}

/** Get games pending review (for Admin) */
export async function getPendingGames() {
    try {
        const q = query(collection(db, 'mini_games'), where('status', '==', 'pending_review'));
        const snapshot = await getDocs(q);
        const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        return games.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    } catch (error) {
        console.error('Error fetching pending games:', error);
        throw error;
    }
}

/** Get pending games count (for Admin sidebar badge) */
export async function getPendingGamesCount() {
    try {
        const q = query(collection(db, 'mini_games'), where('status', '==', 'pending_review'));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch {
        // Silently return 0 — collection may not have rules yet
        return 0;
    }
}

/** Get a single game by ID */
export async function getMiniGameById(gameId) {
    if (!gameId) return null;
    try {
        const docSnap = await getDoc(doc(db, 'mini_games', gameId));
        if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
        return null;
    } catch (error) {
        console.error('Error fetching mini game:', error);
        throw error;
    }
}

/** Create a new game (IT creates as draft) */
export async function createMiniGame(data) {
    try {
        const ref = doc(collection(db, 'mini_games'));
        const gameData = {
            ...data,
            status: 'draft',
            isActive: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            changeLog: [{
                action: 'created',
                at: new Date().toISOString(),
                by: data.createdBy
            }]
        };
        await setDoc(ref, gameData);
        return { id: ref.id, ...gameData };
    } catch (error) {
        console.error('Error creating mini game:', error);
        throw error;
    }
}

/** Update game info (IT can update when draft or rejected) */
export async function updateMiniGame(gameId, data) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        const updateData = { ...data, updatedAt: serverTimestamp() };
        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.createdBy;
        delete updateData.status;
        delete updateData.changeLog;
        await updateDoc(doc(db, 'mini_games', gameId), updateData);
    } catch (error) {
        console.error('Error updating mini game:', error);
        throw error;
    }
}

/** Delete a game permanently */
export async function deleteMiniGame(gameId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await deleteDoc(doc(db, 'mini_games', gameId));
    } catch (error) {
        console.error('Error deleting mini game:', error);
        throw error;
    }
}

// ==========================================
// APPROVAL WORKFLOW
// ==========================================

/** IT submits game for admin review */
export async function submitForReview(gameId, userId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await updateDoc(doc(db, 'mini_games', gameId), {
            status: 'pending_review',
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            changeLog: arrayUnion({
                action: 'submitted',
                at: new Date().toISOString(),
                by: userId
            })
        });
    } catch (error) {
        console.error('Error submitting game for review:', error);
        throw error;
    }
}

/** Admin approves a game */
export async function approveGame(gameId, adminId) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await updateDoc(doc(db, 'mini_games', gameId), {
            status: 'approved',
            isActive: true,
            reviewedBy: adminId,
            reviewedAt: serverTimestamp(),
            reviewNote: '',
            updatedAt: serverTimestamp(),
            changeLog: arrayUnion({
                action: 'approved',
                at: new Date().toISOString(),
                by: adminId
            })
        });
    } catch (error) {
        console.error('Error approving game:', error);
        throw error;
    }
}

/** Admin rejects a game with a note */
export async function rejectGame(gameId, adminId, note = '') {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await updateDoc(doc(db, 'mini_games', gameId), {
            status: 'rejected',
            isActive: false,
            reviewedBy: adminId,
            reviewedAt: serverTimestamp(),
            reviewNote: note,
            updatedAt: serverTimestamp(),
            changeLog: arrayUnion({
                action: 'rejected',
                at: new Date().toISOString(),
                by: adminId,
                note
            })
        });
    } catch (error) {
        console.error('Error rejecting game:', error);
        throw error;
    }
}

/** Admin toggles active state of an approved game */
export async function toggleMiniGame(gameId, isActive) {
    if (!gameId) throw new Error('Missing game ID');
    try {
        await updateDoc(doc(db, 'mini_games', gameId), {
            isActive,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error toggling mini game:', error);
        throw error;
    }
}
