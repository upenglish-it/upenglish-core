import { useState, useEffect } from 'react';
import { getAllPrompts, deletePrompt } from '../../services/promptService';
import { Search, ChevronDown, ChevronRight, PenTool, Mic, Trash2, FolderOpen, MessageSquare, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { usersService } from '../../models';
import { getResolvedUserEmail, getResolvedUserLabel } from '../../utils/userIdentity';

const SKILL_META = {
    writing: { label: 'Viết', icon: PenTool, color: '#3b82f6', bg: '#eff6ff' },
    speaking: { label: 'Nói', icon: Mic, color: '#f59e0b', bg: '#fffbeb' },
};

function formatPromptDate(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN');
}

export default function AdminPromptsPage() {
    const [prompts, setPrompts] = useState([]);
    const [teachers, setTeachers] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedTeachers, setExpandedTeachers] = useState({});
    const [expandedPrompts, setExpandedPrompts] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const allPrompts = (await getAllPrompts()).map((prompt) => ({
                ...prompt,
                id: prompt.id || prompt._id,
            }));
            setPrompts(allPrompts);

            const uids = [...new Set(allPrompts.map(p => p.createdBy).filter(Boolean))];
            if (uids.length > 0) {
                const teacherMap = {};
                await Promise.all(uids.map(async (uid) => {
                    try {
                        const result = await usersService.findOne(uid);
                        const data = result?.data || result;
                        teacherMap[uid] = {
                            displayName: getResolvedUserLabel(data, '', uid),
                            email: getResolvedUserEmail(data),
                            photoURL: data?.photoURL || data?.profilePhoto || '',
                        };
                    } catch {
                        teacherMap[uid] = { displayName: getResolvedUserLabel({}, '', uid), email: '', photoURL: '' };
                    }
                }));
                setTeachers(teacherMap);

                const firstUid = uids[0];
                if (firstUid) setExpandedTeachers({ [firstUid]: true });
            }
        } catch (err) {
            console.error('Failed to load prompts:', err);
        } finally {
            setLoading(false);
        }
    }

    function toggleTeacher(uid) {
        setExpandedTeachers(prev => ({ ...prev, [uid]: !prev[uid] }));
    }

    async function handleDelete(promptId) {
        try {
            await deletePrompt(promptId);
            setPrompts(prev => prev.filter(p => p.id !== promptId));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Delete failed:', err);
        }
    }

    function togglePrompt(promptId) {
        setExpandedPrompts(prev => ({ ...prev, [promptId]: !prev[promptId] }));
    }

    const grouped = {};
    prompts.forEach(p => {
        const uid = p.createdBy || 'unknown';
        if (!grouped[uid]) grouped[uid] = [];
        grouped[uid].push(p);
    });

    const filteredGrouped = {};
    Object.entries(grouped).forEach(([uid, list]) => {
        const teacherName = (teachers[uid]?.displayName || '').toLowerCase();
        const filtered = list.filter(p => {
            const q = search.toLowerCase();
            return !q
                || p.title?.toLowerCase().includes(q)
                || p.content?.toLowerCase().includes(q)
                || teacherName.includes(q);
        });
        if (filtered.length > 0) filteredGrouped[uid] = filtered;
    });

    const sortedTeacherUids = Object.keys(filteredGrouped).sort((a, b) => {
        const nameA = teachers[a]?.displayName || '';
        const nameB = teachers[b]?.displayName || '';
        return nameA.localeCompare(nameB, 'vi');
    });

    const totalPrompts = prompts.length;
    const totalTeachers = Object.keys(grouped).length;

    return (
        <div className="admin-page-container">
            <div className="admin-page-header" style={{ textAlign: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <MessageSquare size={28} color="#4f46e5" /> Quản lý Prompt AI
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                    Tất cả prompt chấm bài AI của giáo viên
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '2px', fontWeight: 600 }}>
                    {totalTeachers} giáo viên • {totalPrompts} prompt
                </p>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto 24px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    id="admin-prompts-search"
                    name="adminPromptsSearch"
                    type="text"
                    placeholder="Tìm theo tên giáo viên, tiêu đề hoặc nội dung prompt..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 14px 12px 42px',
                        border: '1.5px solid #e2e8f0', borderRadius: '14px',
                        fontSize: '0.9rem', outline: 'none', background: '#f8fafc',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#4f46e5'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    Đang tải prompt...
                </div>
            ) : sortedTeacherUids.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <MessageSquare size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                        {search ? 'Không tìm thấy prompt nào.' : 'Chưa có prompt nào.'}
                    </p>
                </div>
            ) : (
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sortedTeacherUids.map(uid => {
                        const teacher = teachers[uid] || { displayName: 'Unknown', email: 'Unknown user' };
                        const teacherPrompts = filteredGrouped[uid];
                        const isExpanded = search ? true : expandedTeachers[uid];
                        const writingCount = teacherPrompts.filter(p => p.skill === 'writing').length;
                        const speakingCount = teacherPrompts.filter(p => p.skill === 'speaking').length;

                        return (
                            <div key={uid} style={{
                                border: '1.5px solid #e2e8f0', borderRadius: '16px',
                                background: '#fff', overflow: 'hidden', transition: 'box-shadow 0.2s',
                                boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                            }}>
                                <div
                                    onClick={() => toggleTeacher(uid)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '14px 18px', cursor: 'pointer',
                                        background: isExpanded ? '#f8fafc' : 'transparent',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {isExpanded ? <ChevronDown size={18} color="#4f46e5" /> : <ChevronRight size={18} color="#94a3b8" />}
                                    <FolderOpen size={20} color={isExpanded ? '#4f46e5' : '#94a3b8'} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {teacher.displayName}
                                        </div>
                                        {teacher.email && (
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1px' }}>
                                                {teacher.email}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        {writingCount > 0 && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#3b82f6' }}>
                                                <PenTool size={10} /> {writingCount}
                                            </span>
                                        )}
                                        {speakingCount > 0 && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: '#fffbeb', color: '#f59e0b' }}>
                                                <Mic size={10} /> {speakingCount}
                                            </span>
                                        )}
                                        <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
                                            {teacherPrompts.length} prompt
                                        </span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                                        {teacherPrompts.map((p, idx) => {
                                            const meta = SKILL_META[p.skill] || SKILL_META.writing;
                                            const SkillIcon = meta.icon;
                                            const promptKey = p.id || p._id || `${uid}-${idx}`;

                                            return (
                                                <div
                                                    key={promptKey}
                                                    style={{
                                                        padding: '14px 18px 14px 52px',
                                                        borderBottom: idx < teacherPrompts.length - 1 ? '1px solid #f8fafc' : 'none',
                                                        transition: 'background 0.1s',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#fafbfd'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                                                            background: meta.bg, color: meta.color,
                                                        }}>
                                                            <SkillIcon size={10} /> {meta.label}
                                                        </span>
                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {p.title}
                                                        </span>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: '#cbd5e1', padding: '4px', borderRadius: '6px',
                                                                transition: 'color 0.15s',
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                                                            title="Xóa prompt"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                    <div
                                                        onClick={() => togglePrompt(promptKey)}
                                                        style={{
                                                            fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6,
                                                            ...(expandedPrompts[promptKey]
                                                                ? { whiteSpace: 'pre-wrap' }
                                                                : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }),
                                                            cursor: 'pointer', borderRadius: '8px', padding: '6px 8px', margin: '-6px -8px',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        title={expandedPrompts[promptKey] ? 'Thu gọn' : 'Bấm để xem toàn bộ prompt'}
                                                    >
                                                        {p.content}
                                                    </div>
                                                    {p.content && p.content.length > 150 && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); togglePrompt(promptKey); }}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: '#4f46e5', fontSize: '0.75rem', fontWeight: 600,
                                                                padding: '4px 0', marginTop: '4px',
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            }}
                                                        >
                                                            {expandedPrompts[promptKey]
                                                                ? <><EyeOff size={12} /> Thu gọn</>
                                                                : <><Eye size={12} /> Xem toàn bộ prompt</>}
                                                        </button>
                                                    )}
                                                    {p.createdAt && (
                                                        <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '6px' }}>
                                                            {formatPromptDate(p.createdAt)}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {deleteConfirm && (
                <div className="teacher-modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '12px' }} />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Xóa prompt?</h3>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '6px' }}>
                                Prompt: <strong>{deleteConfirm.title}</strong>
                            </p>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '20px' }}>
                                Thuộc về: {teachers[deleteConfirm.createdBy]?.displayName || deleteConfirm.createdBy}
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button onClick={() => setDeleteConfirm(null)} style={{
                                    padding: '10px 24px', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
                                }}>
                                    Hủy
                                </button>
                                <button onClick={() => handleDelete(deleteConfirm.id)} style={{
                                    padding: '10px 24px', borderRadius: '12px', border: 'none',
                                    background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
                                }}>
                                    Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
