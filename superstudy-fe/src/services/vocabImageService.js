import { api } from "../models/httpClient";

// Use aiProxy Cloud Function URL directly (not the PHP proxy which doesn't support hf_image)
const HF_PROXY_URL = "https://aiproxy-z22gh4r42a-as.a.run.app";
const HF_API_TOKEN = import.meta.env.VITE_HF_API_TOKEN;
const HF_MODEL = "black-forest-labs/FLUX.1-schnell";
const IMAGE_SIZE = 720;
const BASE_URL = import.meta.env.VITE_BASE_URL;

async function parseUploadResponse(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false || payload?.success === "false") {
    const message =
      payload?.message ||
      payload?.errorDetails?.message ||
      payload?.error ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return payload;
}

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

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, newW, newH);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
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
  const prompt =
    customPrompt ||
    `A clear, simple illustration representing the concept "${word}" (${meaning}). Flat design style, educational illustration, clean white background, no text, no letters, vibrant colors, centered composition.`;

  // Always call through Cloud Function proxy (direct browser→HF calls are blocked by CORS)
  const imageBlob = await fetchHfImageFromProxy(prompt);
  const resizedBlob = await resizeToWebP(imageBlob);
  const previewUrl = URL.createObjectURL(resizedBlob);
  return { blob: resizedBlob, previewUrl };
}

// ==================== BACKEND OPERATIONS (on form submit) ====================

/**
 * Upload a prepared blob through the Nest backend.
 * Call this on form submit, not when the user picks/generates a file.
 * @param {Blob} blob The WebP blob to upload
 * @returns {Promise<string>} The public URL
 */
export async function uploadVocabImageBlob(blob) {
  const formData = new FormData();
  formData.append("file", blob, `vocab-${Date.now()}.webp`);

  const res = await fetch(`${BASE_URL}/topics/vocab-images/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const payload = await parseUploadResponse(res);
  return payload?.url || payload?.data?.url || "";
}

/**
 * Delete a vocab image via the Nest backend by its public URL.
 * @param {string} url The download URL
 */
export async function deleteVocabImage(url) {
  if (!url || typeof url !== "string" || !url.includes("vocab_images")) return;
  try {
    await api.delete("/topics/vocab-images", { url });
  } catch (e) {
    console.error("Error deleting vocab image from Storage:", e);
  }
}

// ==================== INTERNAL ====================

/**
 * Call HF API through the aiProxy Cloud Function (avoids CORS).
 * Returns a Blob of the generated image.
 */
export async function fetchHfImageFromProxy(prompt) {
  let res;
  try {
    res = await fetch(HF_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "hf_image",
        model: HF_MODEL,
        prompt,
      }),
    });
  } catch (networkErr) {
    console.error("Network error calling proxy:", networkErr);
    throw new Error("Không thể kết nối đến server tạo ảnh. Vui lòng thử lại.");
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
  if (data.error)
    throw new Error(data.error.message || JSON.stringify(data.error));
  if (!data.image)
    throw new Error("Server không trả về ảnh. Vui lòng thử lại.");

  // Convert base64 to Blob
  const binary = atob(data.image);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: data.contentType || "image/jpeg" });
}

// ==================== IMAGE LIFECYCLE ====================

/**
 * Delete a vocab image from Firebase Storage only if no word document still references it.
 * Adapted for NestJS backend: uses the backend API to check word references.
 * Falls back to skipping deletion (safe mode) if check fails.
 * @param {string} url The download URL of the vocab image
 * @returns {Promise<boolean>} true if deleted, false if still referenced or skipped
 */
export async function deleteVocabImageIfUnused(url) {
  if (!url || typeof url !== "string" || !url.includes("vocab_images"))
    return false;
  try {
    // Check via backend API if any word still references this image URL
    let stillReferenced = false;
    try {
      const res = await api.get("/topics/check-vocab-image-used", { url });
      stillReferenced = res.data?.used === true;
    } catch (checkErr) {
      // If the backend does not support this check yet, skip deletion (safe default)
      console.warn(
        "[vocabImageService] Could not verify image usage, skipping deletion:",
        checkErr,
      );
      return false;
    }
    if (stillReferenced) return false;
    await deleteVocabImage(url);
    return true;
  } catch (e) {
    console.error("Error deleting unused vocab image from Storage:", e);
    return false;
  }
}
