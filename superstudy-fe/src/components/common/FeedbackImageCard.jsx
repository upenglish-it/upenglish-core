import { ExternalLink, Image as ImageIcon } from 'lucide-react';

export default function FeedbackImageCard({ imageUrl, imageName }) {
    if (!imageUrl) return null;

    return (
        <div style={{
            marginTop: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#ffffff',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 12px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <ImageIcon size={15} color="#7c3aed" />
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {imageName || 'Ảnh đính kèm'}
                    </span>
                </div>
                <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#4f46e5',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        flexShrink: 0,
                    }}
                >
                    <ExternalLink size={14} />
                    Mở ảnh
                </a>
            </div>

            <a href={imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block', background: '#f8fafc' }}>
                <img
                    src={imageUrl}
                    alt={imageName || 'Ảnh đính kèm'}
                    style={{
                        display: 'block',
                        width: '100%',
                        maxHeight: '360px',
                        objectFit: 'contain',
                        background: '#ffffff',
                    }}
                />
            </a>
        </div>
    );
}
