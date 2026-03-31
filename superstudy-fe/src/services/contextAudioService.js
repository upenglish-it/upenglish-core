import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export async function uploadContextAudio(file, resourceType, resourceId) {
    // Validate file size based on resource type
    // Grammar questions (single variation): ~5MB max is plenty for listening
    // Exams (multiple variations, long passages): ~20MB max
    const maxSize = resourceType === 'grammar' ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
    const maxSizeMB = resourceType === 'grammar' ? 5 : 20;

    if (file.size > maxSize) {
        throw new Error(`File quá lớn. Giới hạn tối đa cho ${resourceType === 'grammar' ? 'Câu hỏi Kỹ năng' : 'Bài tập và Kiểm tra'} là ${maxSizeMB}MB.`);
    }

    // Strict format check before uploading
    if (!file.type.includes('mp3') && !file.type.includes('mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        throw new Error('Chỉ hỗ trợ định dạng file MP3.');
    }

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);

    // Determine extension based on type mapping instead of assuming
    let ext = 'bin';
    if (file.type.includes('mp3') || file.type.includes('mpeg')) ext = 'mp3';
    else if (file.type.includes('wav')) ext = 'wav';
    else if (file.type.includes('webm')) ext = 'webm';
    else if (file.type.includes('mp4') || file.type.includes('aac') || file.type.includes('m4a')) ext = 'm4a';
    // Fallback if the original file name contains an extension
    else if (file.name && file.name.includes('.')) ext = file.name.split('.').pop();

    const storagePath = `context_audio/${resourceType}/${resourceId}/${timestamp}_${rand}.${ext}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type || 'audio/mpeg' });
    return getDownloadURL(storageRef);
}

/**
 * Delete a context audio file from Firebase Storage by its download URL.
 * @param {string} url - The download URL
 */
export async function deleteContextAudio(url) {
    if (!url || typeof url !== 'string') return;
    // Only delete if it's a Firebase Storage URL for context audio
    if (!url.includes('context_audio')) return;
    try {
        let storagePath = url;
        // If it's a full download URL, try to extract the relative path
        if (url.includes('firebasestorage.googleapis.com')) {
            const decodedUrl = decodeURIComponent(url);
            const pathStart = decodedUrl.indexOf('context_audio/');
            if (pathStart !== -1) {
                const pathEnd = decodedUrl.indexOf('?', pathStart);
                storagePath = decodedUrl.substring(pathStart, pathEnd !== -1 ? pathEnd : undefined);
            }
        }

        const audioRef = ref(storage, storagePath);
        await deleteObject(audioRef);
        console.log('[contextAudio] Deleted:', storagePath);
    } catch (e) {
        console.error('[contextAudio] Error deleting audio from Storage:', e);
    }
}
