import { useState } from 'react';
import { User } from 'lucide-react';

export default function Avatar({ src, alt, size = 40, className = '' }) {
    const [error, setError] = useState(false);

    const containerStyle = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--color-bg-secondary, #f1f5f9)',
        border: '1px solid var(--border-color, #e2e8f0)',
    };

    if (!src || error) {
        return (
            <div className={`avatar-fallback ${className}`} style={containerStyle}>
                <User size={size * 0.6} color="var(--text-muted, #94a3b8)" />
            </div>
        );
    }

    return (
        <div className={`avatar-container ${className}`} style={containerStyle}>
            <img
                src={src}
                alt={alt || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setError(true)}
            />
        </div>
    );
}
