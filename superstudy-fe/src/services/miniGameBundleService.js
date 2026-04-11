import JSZip from 'jszip';
import { buildMiniGameBundleLaunchUrl } from './miniGameRuntime';

const BASE_URL = import.meta.env.VITE_BASE_URL;

const CONTENT_TYPES = {
    css: 'text/css',
    gif: 'image/gif',
    html: 'text/html; charset=utf-8',
    ico: 'image/x-icon',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    map: 'application/json; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    png: 'image/png',
    svg: 'image/svg+xml',
    txt: 'text/plain; charset=utf-8',
    wasm: 'application/wasm',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject'
};

function getContentTypeForPath(path) {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    return CONTENT_TYPES[extension] || 'application/octet-stream';
}

function normalizeEntryPath(path) {
    return String(path || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/{2,}/g, '/');
}

async function collectZipEntries(file) {
    const zip = await JSZip.loadAsync(file);
    const entries = [];

    zip.forEach((relativePath, entry) => {
        if (entry.dir) return;

        const normalizedPath = normalizeEntryPath(relativePath);
        if (!normalizedPath || normalizedPath.startsWith('__MACOSX/')) return;
        if (normalizedPath.split('/').includes('..')) return;

        entries.push({ path: normalizedPath, entry });
    });

    if (!entries.some(item => item.path === 'index.html')) {
        throw new Error('File ZIP pháº£i chá»©a index.html á»Ÿ thÆ° má»¥c gá»‘c cá»§a dist.');
    }

    return entries;
}

async function parseUploadResponse(res) {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false || payload?.success === 'false') {
        const message = payload?.message || payload?.error || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return payload;
}

async function uploadMiniGameAsset(url, formData) {
    const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    return parseUploadResponse(res);
}

export function isMiniGameBundleFile(file) {
    return /\.zip$/i.test(file?.name || '');
}

export function isMiniGameHtmlFile(file) {
    return /\.(html?)$/i.test(file?.name || '');
}

export function isMiniGameThumbnailFile(file) {
    if (!file) return false;

    if (String(file.type || '').startsWith('image/')) {
        return true;
    }

    return /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name || '');
}

function getFileContentType(file) {
    if (file?.type) return file.type;
    return getContentTypeForPath(file?.name || '');
}

export async function uploadMiniGameHtmlFile(file, gameId, onProgress) {
    const formData = new FormData();
    formData.append('file', file, file.name || 'index.html');

    onProgress?.(10);
    const payload = await uploadMiniGameAsset(`${BASE_URL}/mini-games/${encodeURIComponent(gameId)}/assets/single`, formData);
    onProgress?.(100);

    return payload?.data || payload;
}

export async function uploadMiniGameBundleFile(file, gameId, onProgress) {
    const entries = await collectZipEntries(file);
    const bundleVersion = String(Date.now());
    let completed = 0;

    onProgress?.(0);

    for (const item of entries) {
        const data = await item.entry.async('uint8array');
        const entryFile = new File([data], item.path.split('/').pop() || 'asset', {
            type: getContentTypeForPath(item.path)
        });
        const formData = new FormData();
        formData.append('file', entryFile, entryFile.name);
        formData.append('path', item.path);
        formData.append('bundleVersion', bundleVersion);

        await uploadMiniGameAsset(`${BASE_URL}/mini-games/${encodeURIComponent(gameId)}/assets/bundle`, formData);

        completed += 1;
        onProgress?.(Math.round((completed / entries.length) * 100));
    }

    return {
        deliveryMode: 'dist_bundle',
        gameUrl: '',
        launchUrl: buildMiniGameBundleLaunchUrl(gameId, bundleVersion, 'index.html'),
        entryPath: 'index.html',
        storagePrefix: `mini-games/${gameId}/bundles/${bundleVersion}`,
        bundleVersion,
        fileName: file.name
    };
}

export async function uploadMiniGameThumbnailFile(file, gameId) {
    if (!isMiniGameThumbnailFile(file)) {
        throw new Error('Thumbnail pháº£i lÃ  file áº£nh PNG, JPG, WEBP, GIF hoáº·c SVG.');
    }

    const formData = new FormData();
    const safeName = file.name || `thumbnail.${getFileContentType(file).split('/').pop() || 'png'}`;
    formData.append('file', file, safeName);

    const payload = await uploadMiniGameAsset(`${BASE_URL}/mini-games/${encodeURIComponent(gameId)}/assets/thumbnail`, formData);
    return payload?.data?.url || payload?.url || '';
}
