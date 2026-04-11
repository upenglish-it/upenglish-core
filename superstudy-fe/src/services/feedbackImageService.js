const MAX_IMAGE_DIMENSION = 800;
const OUTPUT_QUALITY = 0.85;

async function resizeFeedbackImage(source, maxDimension = MAX_IMAGE_DIMENSION) {
    const bitmap = await createImageBitmap(source);

    try {
        const { width, height } = bitmap;
        const scale = Math.min(maxDimension / width, maxDimension / height, 1);
        const resizedWidth = Math.max(1, Math.round(width * scale));
        const resizedHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = resizedWidth;
        canvas.height = resizedHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ xá»­ lÃ½ áº£nh.');
        }

        ctx.drawImage(bitmap, 0, 0, resizedWidth, resizedHeight);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', OUTPUT_QUALITY));
        if (!blob) {
            throw new Error('KhÃ´ng thá»ƒ nÃ©n áº£nh. Vui lÃ²ng thá»­ láº¡i vá»›i áº£nh khÃ¡c.');
        }

        return blob;
    } finally {
        if (typeof bitmap.close === 'function') {
            bitmap.close();
        }
    }
}

export async function prepareFeedbackImage(file) {
    if (!file || !file.type?.startsWith('image/')) {
        throw new Error('Vui lÃ²ng chá»n file áº£nh há»£p lá»‡.');
    }

    const blob = await resizeFeedbackImage(file);
    return {
        blob,
        previewUrl: URL.createObjectURL(blob),
    };
}

export async function blobToDataUrl(blob) {
    if (!blob) return '';
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('KhÃ´ng thá»ƒ Ä‘á»c áº£nh Ä‘Ã­nh kÃ¨m.'));
        reader.readAsDataURL(blob);
    });
}

export async function uploadFeedbackImageBlob(blob) {
    if (!blob) return null;
    return {
        imageUrl: await blobToDataUrl(blob),
        imagePath: '',
    };
}

export async function deleteFeedbackImage() {
    return;
}
