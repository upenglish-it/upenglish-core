import React, { useState, useRef } from 'react';
import { Upload, Trash2, Music, Loader } from 'lucide-react';
import { uploadContextAudio, deleteContextAudio } from '../../services/contextAudioService';

/**
 * Audio uploader + player for context sections.
 * Handles upload, compression, playback, and deletion.
 * 
 * @param {string} audioUrl - Current audio URL (or empty)
 * @param {function} onAudioChange - Callback when audio URL changes (url or null)
 * @param {boolean} disabled - Whether the component is read-only
 * @param {string} resourceType - 'grammar' or 'exam'
 * @param {string} resourceId - The exercise/exam/section ID
 */
export default function AudioContextUploader({ audioUrl, onAudioChange, disabled = false, resourceType = 'grammar', resourceId = '' }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    async function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        const allowedTypes = ['audio/mpeg', 'audio/mp3'];
        if (!allowedTypes.some(t => file.type.includes(t.split('/')[1])) && !file.name.toLowerCase().endsWith('.mp3')) {
            setError('Định dạng không hỗ trợ. Bắt buộc phải là file MP3.');
            return;
        }

        // Validate size
        const maxMb = resourceType === 'grammar' ? 5 : 20;
        if (file.size > maxMb * 1024 * 1024) {
            setError(`File quá lớn. Giới hạn upload tối đa là ${maxMb}MB.`);
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Delete old audio if replacing
            if (audioUrl) {
                await deleteContextAudio(audioUrl);
            }

            const url = await uploadContextAudio(file, resourceType, resourceId);
            onAudioChange(url);
        } catch (err) {
            setError('Upload thất bại: ' + (err.message || 'Lỗi không xác định'));
            console.error('[AudioContextUploader] Upload error:', err);
        }

        setUploading(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleDelete() {
        if (!audioUrl) return;
        try {
            await deleteContextAudio(audioUrl);
        } catch (e) {
            console.error('[AudioContextUploader] Delete error:', e);
        }
        onAudioChange(null);
    }

    if (disabled && !audioUrl) return null;

    return (
        <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            background: audioUrl ? '#f0fdf4' : '#f8fafc',
            borderRadius: '12px',
            border: `1px ${audioUrl ? 'solid #bbf7d0' : 'dashed #cbd5e1'}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: audioUrl ? '10px' : '0' }}>
                <Music size={16} style={{ color: audioUrl ? '#16a34a' : '#94a3b8' }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: audioUrl ? '#15803d' : '#64748b' }}>
                    {audioUrl ? 'Audio ngữ cảnh' : 'Thêm audio ngữ cảnh'}
                </span>

                {!disabled && !audioUrl && (
                    <>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            style={{
                                marginLeft: 'auto',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: '#6366f1', color: '#fff',
                                border: 'none', borderRadius: '8px',
                                padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600,
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                opacity: uploading ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                            {uploading ? 'Đang tải lên...' : 'Tải file lên'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,audio/mpeg,audio/mp3"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </>
                )}

                {!disabled && audioUrl && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: '#f1f5f9', color: '#475569',
                                border: '1px solid #e2e8f0', borderRadius: '6px',
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                                cursor: uploading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {uploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
                            {uploading ? 'Đang tải...' : 'Thay file'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: '#fef2f2', color: '#ef4444',
                                border: '1px solid #fecaca', borderRadius: '6px',
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            <Trash2 size={12} /> Xoá
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,audio/mpeg,audio/mp3"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>
                )}
            </div>

            {audioUrl && (
                <audio
                    controls
                    src={audioUrl}
                    style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: '8px',
                    }}
                    controlsList="nodownload"
                    preload="metadata"
                >
                    Trình duyệt của bạn không hỗ trợ phát audio.
                </audio>
            )}

            {error && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}
