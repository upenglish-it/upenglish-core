/**
 * Audio Offline Cache Service
 * 
 * Uses IndexedDB to cache audio recording blobs locally before uploading to Firebase Storage.
 * This ensures audio data is not lost if the network fails during upload.
 * 
 * Flow:
 * 1. Student records audio → blob saved to IndexedDB immediately
 * 2. Upload attempt to Firebase Storage
 * 3. On success → remove from IndexedDB
 * 4. On failure → blob stays in IndexedDB for retry
 * 5. On page reload → retryPendingUploads() picks up any failed uploads
 */

const DB_NAME = 'audio_offline_cache';
const STORE_NAME = 'pending_audios';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                store.createIndex('submissionId', 'submissionId', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Save an audio blob to IndexedDB cache.
 * @param {string} submissionId
 * @param {string} questionId
 * @param {Blob} blob - The recorded audio blob
 * @param {string} mimeType - e.g. 'audio/webm'
 */
export async function saveAudioToCache(submissionId, questionId, blob, mimeType) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
            const request = store.put({
                key: `${submissionId}_${questionId}`,
                submissionId,
                questionId,
                blob,
                mimeType,
                createdAt: new Date().toISOString()
            });
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    } catch (e) {
        console.warn('[AudioOffline] Failed to cache audio blob:', e);
    }
}

/**
 * Remove an audio blob from IndexedDB cache (after successful upload).
 * @param {string} submissionId
 * @param {string} questionId
 */
export async function removeAudioFromCache(submissionId, questionId) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
            const request = store.delete(`${submissionId}_${questionId}`);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    } catch (e) {
        console.warn('[AudioOffline] Failed to remove cached audio:', e);
    }
}

/**
 * Get all pending (not yet uploaded) audio blobs for a submission.
 * @param {string} submissionId
 * @returns {Promise<Array<{questionId: string, blob: Blob, mimeType: string}>>}
 */
export async function getPendingAudios(submissionId) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('submissionId');
        const results = await new Promise((resolve, reject) => {
            const request = index.getAll(submissionId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return results;
    } catch (e) {
        console.warn('[AudioOffline] Failed to get pending audios:', e);
        return [];
    }
}

/**
 * Retry uploading all pending audio blobs for a submission.
 * Calls onSuccess after each successful upload so the caller can update answers.
 * @param {string} submissionId
 * @param {Function} uploadFn - uploadAudioAnswer(blob, submissionId, questionId) => audioUrl
 * @param {Function} [onSuccess] - callback(questionId, audioUrl) called after each successful upload
 * @returns {Promise<number>} Number of successfully retried uploads
 */
export async function retryPendingUploads(submissionId, uploadFn, onSuccess) {
    const pending = await getPendingAudios(submissionId);
    if (pending.length === 0) return 0;

    console.log(`[AudioOffline] Found ${pending.length} pending audio upload(s) for submission ${submissionId}`);
    let successCount = 0;

    for (const item of pending) {
        try {
            const audioUrl = await uploadFn(item.blob, submissionId, item.questionId);
            if (audioUrl) {
                await removeAudioFromCache(submissionId, item.questionId);
                if (onSuccess) {
                    try { await onSuccess(item.questionId, audioUrl); } catch (_) {}
                }
                successCount++;
                console.log(`[AudioOffline] Successfully retried upload for question ${item.questionId}`);
            }
        } catch (e) {
            console.warn(`[AudioOffline] Retry failed for question ${item.questionId}:`, e);
        }
    }

    return successCount;
}

/**
 * Clear all cached audio blobs for a submission (after successful submission).
 * @param {string} submissionId
 */
export async function clearAllForSubmission(submissionId) {
    try {
        const pending = await getPendingAudios(submissionId);
        if (pending.length === 0) return;
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const item of pending) {
            store.delete(item.key);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        console.log(`[AudioOffline] Cleared ${pending.length} cached audio(s) for submission ${submissionId}`);
    } catch (e) {
        console.warn('[AudioOffline] Failed to clear cached audios:', e);
    }
}
