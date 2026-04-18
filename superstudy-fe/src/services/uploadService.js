const BASE_URL = import.meta.env.VITE_BASE_URL;

async function parseJsonResponse(response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function toUploadFile(blobOrFile, fileName, contentType) {
    if (blobOrFile instanceof File) {
        return blobOrFile;
    }

    const inferredType = contentType || blobOrFile?.type || 'application/octet-stream';
    const inferredName = fileName || `upload-${Date.now()}`;
    return new File([blobOrFile], inferredName, { type: inferredType });
}

export async function uploadPublicAsset(blobOrFile, folder, options = {}) {
    const { fileName, contentType } = options;
    const formData = new FormData();
    formData.append('file', toUploadFile(blobOrFile, fileName, contentType));
    formData.append('folder', folder);

    const response = await fetch(`${BASE_URL}/uploads/public`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw payload || new Error('Upload failed');
    }

    return payload?.data || payload;
}

export async function deletePublicAsset(url) {
    if (!url) return { deleted: false };

    const response = await fetch(`${BASE_URL}/uploads/public`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        credentials: 'include',
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw payload || new Error('Delete failed');
    }

    return payload?.data || payload;
}
