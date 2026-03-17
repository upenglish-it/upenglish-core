import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherPrompts, createPrompt, updatePrompt, deletePrompt } from '../../services/promptService';
import { MessageSquare, Plus, Pencil, Trash2, X, Mic, PenTool, Search } from 'lucide-react';

const SKILL_OPTIONS = [
    { value: 'writing', label: 'Viết', icon: PenTool, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { value: 'speaking', label: 'Nói', icon: Mic, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
];

export default function TeacherPromptsPage() {
    const { user } = useAuth();
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState(null); // null = create, object = edit
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formSkill, setFormSkill] = useState('writing');
    const [saving, setSaving] = useState(false);

    // Filter & search
    const [filterSkill, setFilterSkill] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        if (user?.uid) loadPrompts();
    }, [user?.uid]);

    async function loadPrompts() {
        try {
            setLoading(true);
            const data = await getTeacherPrompts(user.uid);
            setPrompts(data);
        } catch (err) {
            console.error(err);
            setError('Lỗi tải danh sách prompt.');
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingPrompt(null);
        setFormTitle('');
        setFormContent('');
        setFormSkill('writing');
        setModalOpen(true);
    }

    function openEditModal(prompt) {
        setEditingPrompt(prompt);
        setFormTitle(prompt.title);
        setFormContent(prompt.content);
        setFormSkill(prompt.skill || 'writing');
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setEditingPrompt(null);
        setFormTitle('');
        setFormContent('');
        setFormSkill('writing');
    }

    async function handleSave() {
        if (!formTitle.trim() || !formContent.trim()) return;
        setSaving(true);
        try {
            if (editingPrompt) {
                await updatePrompt(editingPrompt.id, { title: formTitle, content: formContent, skill: formSkill });
            } else {
                await createPrompt({ title: formTitle, content: formContent, skill: formSkill, createdBy: user.uid });
            }
            closeModal();
            await loadPrompts();
        } catch (err) {
            console.error(err);
            setError('Lỗi lưu prompt.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        try {
            await deletePrompt(id);
            setDeleteTarget(null);
            await loadPrompts();
        } catch (err) {
            console.error(err);
            setError('Lỗi xóa prompt.');
        }
    }

    // Filtered prompts
    const filtered = prompts.filter(p => {
        if (filterSkill !== 'all' && p.skill !== filterSkill) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
        }
        return true;
    });

    function formatDate(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    return (
        <div className="admin-page">
            {error && (
                <div className="admin-alert error" style={{ marginBottom: '16px' }}>
                    {error}
                    <button onClick={() => setError(null)} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
            )}

            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Tìm prompt..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0',
                                borderRadius: '12px', fontSize: '0.9rem', outline: 'none', background: '#f8fafc',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = '#4f46e5'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Skill filter pills */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                            onClick={() => setFilterSkill('all')}
                            style={{
                                padding: '8px 16px', borderRadius: '20px', border: `1.5px solid ${filterSkill === 'all' ? '#4f46e5' : '#e2e8f0'}`,
                                background: filterSkill === 'all' ? '#eff6ff' : '#fff', color: filterSkill === 'all' ? '#4f46e5' : '#64748b',
                                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                            }}
                        >Tất cả</button>
                        {SKILL_OPTIONS.map(s => (
                            <button
                                key={s.value}
                                onClick={() => setFilterSkill(s.value)}
                                style={{
                                    padding: '8px 16px', borderRadius: '20px',
                                    border: `1.5px solid ${filterSkill === s.value ? s.color : '#e2e8f0'}`,
                                    background: filterSkill === s.value ? s.bg : '#fff',
                                    color: filterSkill === s.value ? s.color : '#64748b',
                                    fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                            >
                                <s.icon size={14} /> {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={openCreateModal}
                    className="admin-btn"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                        border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                        transition: 'all 0.2s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)'; }}
                >
                    <Plus size={18} /> Tạo Prompt
                </button>
            </div>

            {/* Content */}
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="admin-empty-state" style={{ padding: '48px 20px' }}>Đang tải dữ liệu...</div>
                ) : filtered.length === 0 ? (
                    <div className="admin-empty-state" style={{ padding: '48px 20px' }}>
                        <div className="admin-empty-icon"><MessageSquare size={28} /></div>
                        <h3>{prompts.length === 0 ? 'Chưa có prompt nào' : 'Không tìm thấy'}</h3>
                        <p>{prompts.length === 0 ? 'Bấm "Tạo Prompt" để thêm prompt chấm bài AI đầu tiên.' : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0' }}>
                        {filtered.map(prompt => {
                            const skillMeta = SKILL_OPTIONS.find(s => s.value === prompt.skill) || SKILL_OPTIONS[0];
                            const SkillIcon = skillMeta.icon;
                            return (
                                <div
                                    key={prompt.id}
                                    style={{
                                        padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
                                        borderRight: '1px solid #f1f5f9',
                                        transition: 'background 0.15s', cursor: 'default',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Top row: skill badge + actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                                            background: skillMeta.bg, color: skillMeta.color, border: `1px solid ${skillMeta.border}`,
                                        }}>
                                            <SkillIcon size={12} /> {skillMeta.label}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={() => openEditModal(prompt)}
                                                title="Sửa"
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#64748b', transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.color = '#4f46e5'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(prompt)}
                                                title="Xóa"
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#64748b', transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                                        {prompt.title}
                                    </h4>

                                    {/* Content preview */}
                                    <p style={{
                                        margin: '0 0 12px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6,
                                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {prompt.content}
                                    </p>

                                    {/* Date */}
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {formatDate(prompt.createdAt)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            {modalOpen && (
                <div className="teacher-modal-overlay" onClick={closeModal}>
                    <div className="teacher-modal wide" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '95%' }}>
                        <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={closeModal} style={{
                                pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)',
                                border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer',
                            }}>
                                <X size={20} />
                            </button>
                        </div>

                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <MessageSquare size={24} color="#4f46e5" /> {editingPrompt ? 'Sửa Prompt' : 'Tạo Prompt mới'}
                        </h2>

                        {/* Skill selector */}
                        <div className="teacher-form-group" style={{ marginBottom: '20px' }}>
                            <label className="teacher-form-label">Kỹ năng</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {SKILL_OPTIONS.map(s => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setFormSkill(s.value)}
                                        style={{
                                            padding: '10px 24px', borderRadius: '16px', fontWeight: 700, fontSize: '0.9rem',
                                            border: `2px solid ${formSkill === s.value ? s.color : 'transparent'}`,
                                            background: formSkill === s.value ? s.bg : '#f1f5f9',
                                            color: formSkill === s.value ? s.color : '#475569',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                        }}
                                    >
                                        <s.icon size={16} /> {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div className="teacher-form-group" style={{ marginBottom: '20px' }}>
                            <label className="teacher-form-label">Tên prompt</label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                placeholder="VD: Chấm Writing Task 2 IELTS..."
                                style={{
                                    width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0',
                                    borderRadius: '12px', fontSize: '0.95rem', outline: 'none',
                                    transition: 'border-color 0.2s', boxSizing: 'border-box',
                                }}
                                onFocus={e => e.target.style.borderColor = '#4f46e5'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>

                        {/* Content */}
                        <div className="teacher-form-group" style={{ marginBottom: '24px' }}>
                            <label className="teacher-form-label">Nội dung prompt</label>
                            <textarea
                                value={formContent}
                                onChange={e => setFormContent(e.target.value)}
                                placeholder="Nhập nội dung prompt chấm bài AI..."
                                rows={10}
                                style={{
                                    width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0',
                                    borderRadius: '12px', fontSize: '0.9rem', outline: 'none', resize: 'vertical',
                                    lineHeight: 1.7, fontFamily: 'inherit', transition: 'border-color 0.2s',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={e => e.target.style.borderColor = '#4f46e5'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: '10px 24px', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                                }}
                            >Hủy</button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formTitle.trim() || !formContent.trim()}
                                style={{
                                    padding: '10px 24px', borderRadius: '12px', border: 'none',
                                    background: (!formTitle.trim() || !formContent.trim()) ? '#cbd5e1' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                    color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'wait' : 'pointer',
                                    boxShadow: formTitle.trim() && formContent.trim() ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                                    opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
                                }}
                            >
                                {saving ? 'Đang lưu...' : (editingPrompt ? 'Cập nhật' : 'Tạo prompt')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="teacher-modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', textAlign: 'center', padding: '32px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Trash2 size={28} />
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Xóa prompt?</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: '#64748b' }}>
                            Bạn có chắc muốn xóa "<strong>{deleteTarget.title}</strong>"? Thao tác này không thể hoàn tác.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                style={{ padding: '10px 24px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                            >Hủy</button>
                            <button
                                onClick={() => handleDelete(deleteTarget.id)}
                                style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                            >Xóa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
