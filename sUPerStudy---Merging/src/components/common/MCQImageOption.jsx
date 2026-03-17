import { useState, useRef } from 'react';
import { uploadOptionImage, deleteOptionImage } from '../../services/examService';
import { ImagePlus, X, Loader } from 'lucide-react';

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
 * @param {{ value: string, onChange: (url: string) => void, disabled?: boolean }} props
 */
export function ImageOptionUploader({ value, onChange, disabled }) {
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadOptionImage(file);
            if (isImageOption(value)) {
                deleteOptionImage(value).catch(console.error);
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
                            deleteOptionImage(value).catch(console.error);
                            onChange('');
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
