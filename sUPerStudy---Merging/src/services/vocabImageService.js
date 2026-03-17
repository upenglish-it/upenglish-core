import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Use aiProxy Cloud Function URL directly (not the PHP proxy which doesn't support hf_image)
const HF_PROXY_URL = 'https://aiproxy-z22gh4r42a-as.a.run.app';
const HF_API_TOKEN = import.meta.env.VITE_HF_API_TOKEN;
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const IMAGE_SIZE = 720;

/**
 * Resize an image source so the longest side is IMAGE_SIZE, preserving aspect ratio, and convert to WebP.
 * @param {Blob|File} source The image source (File from picker or Blob from AI)
 * @returns {Promise<Blob>} The resized WebP blob
 */
async function resizeToWebP(source) {
    const bitmap = await createImageBitmap(source);
    const { width, height } = bitmap;

    // Scale so the longest side = IMAGE_SIZE, preserve aspect ratio
    const scale = Math.min(IMAGE_SIZE / width, IMAGE_SIZE / height, 1); // don't upscale
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, newW, newH);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
}

// ==================== LOCAL-ONLY OPERATIONS (no Firebase) ====================

/**
 * Prepare a teacher-selected image file: resize and return a local blob + preview URL.
 * Does NOT upload to Firebase — call uploadVocabImageBlob() on form submit.
 * @param {File} file The image file from file picker
 * @returns {Promise<{blob: Blob, previewUrl: string}>}
 */
export async function prepareVocabImage(file) {
    const blob = await resizeToWebP(file);
    const previewUrl = URL.createObjectURL(blob);
    return { blob, previewUrl };
}

/**
 * Generate a vocabulary illustration using AI, return a local blob + preview URL.
 * Does NOT upload to Firebase — call uploadVocabImageBlob() on form submit.
 * @param {string} word The English word
 * @param {string} meaning The Vietnamese meaning
 * @param {string} [customPrompt] Optional custom prompt override
 * @returns {Promise<{blob: Blob, previewUrl: string}>}
 */
export async function generateVocabImageLocal(word, meaning, customPrompt) {
    const prompt = customPrompt || `A clear, simple illustration representing the concept "${word}" (${meaning}). Flat design style, educational illustration, clean white background, no text, no letters, vibrant colors, centered composition.`;

    // Always call through Cloud Function proxy (direct browser→HF calls are blocked by CORS)
    const imageBlob = await fetchHfImageFromProxy(prompt);
    const resizedBlob = await resizeToWebP(imageBlob);
    const previewUrl = URL.createObjectURL(resizedBlob);
    return { blob: resizedBlob, previewUrl };
}

// ==================== FIREBASE OPERATIONS (on form submit) ====================

/**
 * Upload a prepared blob to Firebase Storage.
 * Call this on form submit, not when the user picks/generates a file.
 * @param {Blob} blob The WebP blob to upload
 * @returns {Promise<string>} The download URL
 */
export async function uploadVocabImageBlob(blob) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const storageRef = ref(storage, `vocab_images/${timestamp}_${rand}.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    return getDownloadURL(storageRef);
}

/**
 * Delete a vocab image from Firebase Storage by its download URL.
 * Extracts the storage path from the download URL since ref(storage, fullURL) 
 * doesn't reliably work with download URLs that contain tokens.
 * @param {string} url The download URL
 */
export async function deleteVocabImage(url) {
    if (!url || typeof url !== 'string' || !url.includes('vocab_images')) return;
    try {
        // Extract path from download URL
        // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media&token=...
        const match = url.match(/\/o\/(.+?)(\?|$)/);
        if (match) {
            const storagePath = decodeURIComponent(match[1]);
            const imageRef = ref(storage, storagePath);
            await deleteObject(imageRef);
        } else {
            // Fallback: try direct ref
            const imageRef = ref(storage, url);
            await deleteObject(imageRef);
        }
    } catch (e) {
        // Silently ignore "object not found" — the image is already gone, which is fine
        if (e?.code === 'storage/object-not-found') return;
        console.error('Error deleting vocab image from Storage:', e);
    }
}

// ==================== INTERNAL ====================

/**
 * Call HF API through the aiProxy Cloud Function (avoids CORS).
 * Returns a Blob of the generated image.
 */
async function fetchHfImageFromProxy(prompt) {
    let res;
    try {
        res = await fetch(HF_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'hf_image',
                model: HF_MODEL,
                prompt,
            }),
        });
    } catch (networkErr) {
        console.error('Network error calling proxy:', networkErr);
        throw new Error('Không thể kết nối đến server tạo ảnh. Vui lòng thử lại.');
    }

    if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
            const errData = await res.json();
            errMsg = errData.error?.message || errData.error || errMsg;
        } catch {
            errMsg = await res.text().catch(() => errMsg);
        }
        throw new Error(`Lỗi tạo ảnh: ${errMsg}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!data.image) throw new Error('Server không trả về ảnh. Vui lòng thử lại.');

    // Convert base64 to Blob
    const binary = atob(data.image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: data.contentType || 'image/jpeg' });
}
