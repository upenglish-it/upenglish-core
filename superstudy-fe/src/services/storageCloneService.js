import { uploadPublicAsset } from './uploadService';

const STORAGE_URL_REGEX = /https:\/\/firebasestorage\.googleapis\.com\/[^"'\s)<>]+/g;

const CONTENT_TYPE_BY_EXT = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

function extractExtensionFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        const decoded = decodeURIComponent(url.split('?')[0] || '');
        const match = decoded.match(/\.([a-zA-Z0-9]+)$/);
        return match?.[1]?.toLowerCase() || '';
    } catch {
        return '';
    }
}

function inferFileInfo(response, blob, url) {
    const headerType = (response?.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const blobType = (blob?.type || '').split(';')[0].trim().toLowerCase();
    const sourceType = headerType || blobType;

    let ext = '';
    if (sourceType.includes('mpeg') || sourceType.includes('mp3')) ext = 'mp3';
    else if (sourceType.includes('wav')) ext = 'wav';
    else if (sourceType.includes('webm')) ext = 'webm';
    else if (sourceType.includes('mp4')) ext = 'mp4';
    else if (sourceType.includes('m4a')) ext = 'm4a';
    else if (sourceType.includes('aac')) ext = 'aac';
    else if (sourceType.includes('png')) ext = 'png';
    else if (sourceType.includes('jpeg') || sourceType.includes('jpg')) ext = 'jpg';
    else if (sourceType.includes('webp')) ext = 'webp';

    ext = ext || extractExtensionFromUrl(url) || 'bin';
    const contentType = sourceType || CONTENT_TYPE_BY_EXT[ext] || 'application/octet-stream';

    return { ext, contentType };
}

function inferTargetFolderFromUrl(url) {
    if (url.includes('context_images')) return 'context_images';
    if (url.includes('option_images')) return 'option_images';
    if (url.includes('context_audio')) return 'context_audio/duplicated';
    if (url.includes('vocab_images')) return 'vocab_images';
    return 'duplicated_assets';
}

export async function copyStorageFile(url, targetFolder) {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('firebasestorage.googleapis.com')) return url;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        const { ext, contentType } = inferFileInfo(response, blob, url);

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const upload = await uploadPublicAsset(blob, targetFolder, {
            fileName: `${timestamp}_${rand}.${ext}`,
            contentType,
        });
        return upload?.url || url;
    } catch (e) {
        console.error('[storageCloneService] Error copying storage file:', url, e);
        return url;
    }
}

export async function copyAllStorageUrlsInHtml(html) {
    if (!html || typeof html !== 'string') return html;
    const urls = [...new Set(html.match(STORAGE_URL_REGEX) || [])];
    if (urls.length === 0) return html;

    let newHtml = html;
    for (const oldUrl of urls) {
        const newUrl = await copyStorageFile(oldUrl, inferTargetFolderFromUrl(oldUrl));
        if (newUrl && newUrl !== oldUrl) {
            newHtml = newHtml.split(oldUrl).join(newUrl);
        }
    }
    return newHtml;
}

export async function copyQuestionOptionImages(variations) {
    if (!variations || !Array.isArray(variations)) return variations;
    const newVariations = [];

    for (const variation of variations) {
        if (!variation || !Array.isArray(variation.options)) {
            newVariations.push(variation);
            continue;
        }

        const newOptions = [];
        for (const option of variation.options) {
            if (typeof option === 'string' && option.includes('firebasestorage.googleapis.com')) {
                const folder = option.includes('option_images') ? 'option_images' : 'duplicated_assets';
                newOptions.push(await copyStorageFile(option, folder));
            } else {
                newOptions.push(option);
            }
        }

        newVariations.push({ ...variation, options: newOptions });
    }

    return newVariations;
}

export async function cloneQuestionStorageAssets(questionData, { contextAudioFolder = '' } = {}) {
    if (!questionData || typeof questionData !== 'object') return questionData;

    const clonedQuestion = { ...questionData };

    if (clonedQuestion.type === 'multiple_choice' && clonedQuestion.variations) {
        clonedQuestion.variations = await copyQuestionOptionImages(clonedQuestion.variations);
    }

    if (clonedQuestion.contextAudioUrl && contextAudioFolder) {
        clonedQuestion.contextAudioUrl = await copyStorageFile(
            clonedQuestion.contextAudioUrl,
            contextAudioFolder
        );
    }

    if (clonedQuestion.context) {
        clonedQuestion.context = await copyAllStorageUrlsInHtml(clonedQuestion.context);
    }

    if (Array.isArray(clonedQuestion.variations)) {
        for (let index = 0; index < clonedQuestion.variations.length; index++) {
            const variation = clonedQuestion.variations[index];
            if (variation?.text && typeof variation.text === 'string' && variation.text.includes('firebasestorage.googleapis.com')) {
                clonedQuestion.variations[index] = {
                    ...variation,
                    text: await copyAllStorageUrlsInHtml(variation.text)
                };
            }
        }
    }

    return clonedQuestion;
}
