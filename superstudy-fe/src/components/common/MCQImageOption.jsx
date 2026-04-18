import { useId, useState, useRef } from 'react';
import { uploadOptionImage, deleteOptionImage, generateAndUploadOptionImage } from '../../services/examService';
import { ImagePlus, X, Loader, Sparkles } from 'lucide-react';

/**
 * Check if an MCQ option string is an image URL (Firebase Storage).
 */
export function isImageOption(opt) {
    if (!opt || typeof opt !== 'string') return false;
    return opt.startsWith('https://firebasestorage.googleapis.com/') ||
        opt.startsWith('https://storage.googleapis.com/');
}

/**
 * Renders an MCQ option as either an image or text.
 * @param {{ opt: string, size?: number }} props
 */
export function OptionContent({ opt, size = 120 }) {
    if (isImageOption(opt)) {
        return (
            <img
                src={opt}
                alt="Đáp án hình"
                style={{
                    width: size,
                    height: size,
                    objectFit: 'cover',
                    borderRadius: 8,
                    display: 'block'
                }}
                draggable={false}
            />
        );
    }
    return <>{opt}</>;
}

/**
 * Image upload button for teacher editor — sits next to the text input.
 * When an image is uploaded, it replaces the text option with the image URL.
 * Deletion is deferred via onScheduleDelete instead of deleting immediately.
 * @param {{ value: string, onChange: (url: string) => void, onScheduleDelete?: (url: string) => void, onTrackUpload?: (url: string) => void, onSaveOriginalText?: (text: string) => void, restoreValue?: string, disabled?: boolean }} props
 */
export function ImageOptionUploader({ value, onChange, onScheduleDelete, onTrackUpload, onSaveOriginalText, restoreValue, disabled }) {
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);
    const inputId = useId();

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadOptionImage(file);
            // Track newly uploaded image for cleanup if modal is closed without saving
            if (onTrackUpload) onTrackUpload(url);
            // Save current text before replacing with image
            if (!isImageOption(value) && value && onSaveOriginalText) onSaveOriginalText(value);
            // If replacing an existing image, schedule old one for deletion
            if (isImageOption(value)) {
                if (onScheduleDelete) onScheduleDelete(value);
            }
            onChange(url);
        } catch (err) {
            console.error('Image upload failed:', err);
            alert('Upload hình thất bại. Vui lòng thử lại.');
        }
        setUploading(false);
        // Reset so selecting the same file triggers change
        if (fileRef.current) fileRef.current.value = '';
    };

    const isImage = isImageOption(value);

    if (isImage) {
        return (
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                    src={value}
                    alt="option"
                    style={{
                        width: 120,
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '2px solid var(--border-color, #e2e8f0)'
                    }}
                />
                {!disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            // Schedule for deletion instead of deleting immediately
                            if (onScheduleDelete) onScheduleDelete(value);
                            // Restore original text instead of clearing
                            onChange(restoreValue || '');
                        }}
                        title="Xóa hình"
                        style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#ef4444',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                        }}
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <input
                id={inputId}
                name={`mcq-image-upload-${inputId}`}
                aria-label="Tải ảnh đáp án"
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFile}
                disabled={disabled || uploading}
            />
            <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || uploading}
                title="Upload hình đáp án (480×480)"
                style={{
                    background: 'none',
                    border: '1px dashed var(--border-color, #cbd5e1)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    cursor: disabled || uploading ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                    opacity: disabled ? 0.5 : 1
                }}
            >
                {uploading ? <Loader size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={14} />}
            </button>
        </>
    );
}

/**
 * AI image generation button for MCQ options.
 * Generates an image using the option text as prompt, then replaces the text with the image URL.
 * Deletion is deferred via onScheduleDelete instead of deleting immediately.
 * @param {{ optionText: string, onChange: (url: string) => void, currentValue: string, onScheduleDelete?: (url: string) => void, onTrackUpload?: (url: string) => void, onSaveOriginalText?: (text: string) => void, disabled?: boolean }} props
 */
export function AIImageGenerateButton({ optionText, onChange, currentValue, onScheduleDelete, onTrackUpload, onSaveOriginalText, disabled }) {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!optionText || optionText.trim().length === 0) return;
        setGenerating(true);
        try {
            // Save original text before replacing with image
            if (optionText && onSaveOriginalText) onSaveOriginalText(optionText);
            // Schedule existing image for deletion instead of deleting immediately
            if (isImageOption(currentValue)) {
                if (onScheduleDelete) onScheduleDelete(currentValue);
            }
            const url = await generateAndUploadOptionImage(optionText.trim());
            // Track newly uploaded image for cleanup if modal is closed without saving
            if (onTrackUpload) onTrackUpload(url);
            onChange(url);
        } catch (err) {
            console.error('AI image generation failed:', err);
            alert('Tạo ảnh AI thất bại. Vui lòng thử lại.');
        }
        setGenerating(false);
    };

    const isEmpty = !optionText || optionText.trim().length === 0;
    const isDisabled = disabled || generating || isEmpty || isImageOption(currentValue);

    return (
        <button
            type="button"
            onClick={handleGenerate}
            disabled={isDisabled}
            title={isEmpty ? 'Nhập text đáp án trước để tạo ảnh AI' : 'Tạo ảnh AI từ nội dung đáp án'}
            style={{
                background: 'none',
                border: '1px dashed #a78bfa',
                borderRadius: 8,
                padding: '6px 8px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                color: isDisabled ? '#cbd5e1' : '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.8rem',
                flexShrink: 0,
                opacity: isDisabled ? 0.5 : 1,
                transition: 'all 0.2s'
            }}
        >
            {generating ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
        </button>
    );
}

/** Re-export deleteOptionImage for direct use when saving */
export { deleteOptionImage };
