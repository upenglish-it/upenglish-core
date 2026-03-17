import { useState, useEffect, useRef, useCallback } from 'react';
import { getTeacherPrompts } from '../services/promptService';
import { MessageSquare, ChevronDown, Mic, PenTool } from 'lucide-react';

const SKILL_META = {
    writing: { label: 'Viết', icon: PenTool, color: '#3b82f6', bg: '#eff6ff' },
    speaking: { label: 'Nói', icon: Mic, color: '#f59e0b', bg: '#fffbeb' },
};

/**
 * A button + dropdown that lets teachers pick one of their saved prompts.
 * Uses position:fixed so the dropdown always floats above modal headers.
 */
export default function SavedPromptPicker({ uid, onSelect, disabled }) {
    const [open, setOpen] = useState(false);
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const dropdownRef = useRef(null);

    // Calculate position from button rect
    const updatePosition = useCallback(() => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const dropWidth = Math.min(360, vw - 16);
        setDropdownPos({
            top: rect.bottom + 6,
            left: vw <= 480 ? 8 : Math.max(8, rect.right - dropWidth),
            width: dropWidth,
        });
    }, []);

    // Close on outside click
    useEffect(() => {
        function handler(e) {
            if (
                btnRef.current && !btnRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handler);
            window.addEventListener('scroll', () => setOpen(false), true);
            window.addEventListener('resize', () => setOpen(false));
        }
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', () => setOpen(false), true);
            window.removeEventListener('resize', () => setOpen(false));
        };
    }, [open]);

    async function handleOpen() {
        if (disabled) return;
        if (!loaded) {
            setLoading(true);
            try {
                const data = await getTeacherPrompts(uid);
                setPrompts(data);
                setLoaded(true);
            } catch (err) {
                console.error('Failed to load saved prompts:', err);
            } finally {
                setLoading(false);
            }
        }
        updatePosition();
        setOpen(prev => !prev);
    }

    function handleSelect(prompt) {
        onSelect(prompt.content);
        setOpen(false);
    }

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '8px',
                    border: '1.5px solid #e2e8f0', background: '#f8fafc',
                    color: '#4f46e5', fontWeight: 600, fontSize: '0.78rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#eef2ff'; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
            >
                <MessageSquare size={13} /> Chọn prompt đã lưu <ChevronDown size={13} />
            </button>

            {open && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: dropdownPos.width || 360, maxHeight: '320px',
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 99999,
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    }}
                >
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                        Prompt đã lưu
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>Đang tải...</div>
                        ) : prompts.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
                                Chưa có prompt nào.
                                <br />
                                <span style={{ fontSize: '0.78rem' }}>Vào Quản lý prompt để tạo prompt mới.</span>
                            </div>
                        ) : prompts.map(p => {
                            const meta = SKILL_META[p.skill] || SKILL_META.writing;
                            const SkillIcon = meta.icon;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    style={{
                                        padding: '10px 14px', cursor: 'pointer',
                                        borderBottom: '1px solid #f8fafc', transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                                            background: meta.bg, color: meta.color,
                                        }}>
                                            <SkillIcon size={10} /> {meta.label}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.title}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {p.content}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}

