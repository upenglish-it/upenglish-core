import { useState, useEffect } from 'react';
import { MessageSquareText, CheckCheck, Loader, Send, X, Filter, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyReceivedFeedback, markFeedbackAsRead, submitFeedback, hideFeedbackForUser } from '../../services/feedbackService';
import { usersService } from '../../models/users';

const CATEGORIES = [
    { value: 'suggestion', label: 'Đề xuất', emoji: '💡', color: '#4f46e5', bg: '#eff6ff' },
    { value: 'complaint', label: 'Khiếu nại', emoji: '⚠️', color: '#dc2626', bg: '#fef2f2' },
];

const ROLE_LABELS = {
    user: { label: 'Học viên', color: '#0ea5e9', bg: '#f0f9ff' },
    staff: { label: 'Nhân viên', color: '#8b5cf6', bg: '#f5f3ff' },
    admin: { label: 'Admin', color: '#f59e0b', bg: '#fffbeb' },
    teacher: { label: 'Giáo viên', color: '#f97316', bg: '#fff7ed' },
};

function formatDate(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
    return '';
}

export default function TeacherFeedbackPage() {
    const { user } = useAuth();
    const [feedbackList, setFeedbackList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Send modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [fbCategory, setFbCategory] = useState('suggestion');
    const [fbMessage, setFbMessage] = useState('');
    const [fbSending, setFbSending] = useState(false);
    const [fbSuccess, setFbSuccess] = useState(false);
    const [fbTargetType, setFbTargetType] = useState('admin');
    const [fbTargetUser, setFbTargetUser] = useState(null);
    const [staffTeacherList, setStaffTeacherList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [hideTarget, setHideTarget] = useState(null);
    const [targetSearch, setTargetSearch] = useState('');

    useEffect(() => {
        if (!user?.uid) return;
        loadFeedback();
    }, [user?.uid]);

    async function loadFeedback() {
        setLoading(true);
        try {
            const data = await getMyReceivedFeedback(user.uid);
            setFeedbackList(data);
        } catch (err) {
            console.error('Error loading feedback:', err);
        }
        setLoading(false);
    }

    async function handleMarkRead(fb) {
        try {
            await markFeedbackAsRead(fb.id);
            setFeedbackList(prev => prev.map(f => f.id === fb.id ? { ...f, isRead: true } : f));
        } catch (err) {
            console.error('Error:', err);
        }
    }

    async function loadStaffTeachers() {
        if (staffTeacherList.length > 0) return;
        setLoadingUsers(true);
        try {
            const [staffRes, teacherRes] = await Promise.all([
                usersService.findAll({ role: 'staff' }),
                usersService.findAll({ role: 'teacher' })
            ]);
            
            const staffData = staffRes?.data || staffRes || [];
            const teacherData = teacherRes?.data || teacherRes || [];
            
            const list = [];
            [...staffData, ...teacherData].forEach(d => {
                const uid = d._id || d.id || d.uid;
                if (uid !== user.uid) {
                    list.push({ uid, displayName: d.displayName || d.email, email: d.email, role: d.role });
                }
            });
            list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
            setStaffTeacherList(list);
        } catch (err) { console.error('Error loading users:', err); }
        setLoadingUsers(false);
    }

    async function handleSendFeedback() {
        if (!fbMessage.trim() || fbSending) return;
        if (fbTargetType === 'direct' && !fbTargetUser) return;
        setFbSending(true);
        try {
            await submitFeedback({
                message: fbMessage, category: fbCategory,
                senderUid: user.uid, senderName: user.displayName || '', senderEmail: user.email || '', senderRole: user.role || 'teacher',
                targetType: fbTargetType,
                targetUid: fbTargetType === 'direct' ? fbTargetUser.uid : undefined,
                targetName: fbTargetType === 'direct' ? fbTargetUser.displayName : undefined,
                targetEmail: fbTargetType === 'direct' ? fbTargetUser.email : undefined,
            });
            setFbSuccess(true); setFbMessage(''); setFbTargetUser(null);
            setTimeout(() => { setFbSuccess(false); setShowSendModal(false); }, 1800);
        } catch (err) { console.error('Error sending feedback:', err); }
        setFbSending(false);
    }

    const unreadCount = feedbackList.filter(f => !f.isRead).length;

    return (
        <div className="admin-page">
            {/* Header */}
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0, fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>
                        <MessageSquareText size={24} color="#7c3aed" /> Góp ý ẩn danh
                        {unreadCount > 0 && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#ef4444', color: '#fff', borderRadius: '100px', padding: '2px 8px', marginLeft: '8px', verticalAlign: 'middle' }}>
                                {unreadCount} mới
                            </span>
                        )}
                    </h1>
                    <p className="admin-page-subtitle">Xem và gửi góp ý ẩn danh cho đồng nghiệp.</p>
                </div>
                <div className="admin-header-actions">
                    <button className="admin-btn admin-btn-primary" onClick={() => { setShowSendModal(true); loadStaffTeachers(); }} style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        <Send size={15} /> Gửi góp ý
                    </button>
                </div>
            </div>

            {/* Received feedback section */}
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#475569', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📩 Góp ý nhận được
            </h3>

            {loading ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <Loader size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                    Đang tải...
                </div>
            ) : feedbackList.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty-state">
                        <div className="admin-empty-icon"><MessageSquareText size={32} /></div>
                        <h3>Chưa nhận được góp ý nào</h3>
                        <p>Khi có góp ý ẩn danh gửi cho bạn, chúng sẽ hiển thị tại đây.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {feedbackList.map(fb => {
                        const cat = CATEGORIES.find(c => c.value === fb.category) || CATEGORIES[0];
                        const roleInfo = ROLE_LABELS[fb.senderRole] || ROLE_LABELS.user;
                        return (
                            <div key={fb.id} className="admin-card" style={{ padding: '16px', paddingRight: '44px', background: fb.isRead ? '#fff' : '#fefce8', transition: 'all 0.2s', position: 'relative' }}>
                                {/* Right action buttons */}
                                <div style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                    {!fb.isRead && (
                                        <button onClick={() => handleMarkRead(fb)} title="Đánh dấu đã đọc" style={{
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                            color: '#16a34a', borderRadius: '6px',
                                        }}>
                                            <CheckCheck size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => setHideTarget(fb)} title="Ẩn góp ý này" style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                        color: '#ef4444', borderRadius: '6px',
                                    }}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '38px', height: '38px', borderRadius: '12px',
                                        background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.1rem', flexShrink: 0,
                                    }}>
                                        {cat.emoji}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: cat.bg, color: cat.color }}>{cat.label}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: roleInfo.bg, color: roleInfo.color }}>{roleInfo.label}</span>
                                            {!fb.isRead && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '100px', background: '#fef2f2', color: '#ef4444' }}>Mới</span>}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px' }}>
                                            📅 {formatDate(fb.createdAt)}{timeAgo(fb.createdAt) && ` · ${timeAgo(fb.createdAt)}`}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{fb.message}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Hide confirmation modal */}
            {hideTarget && (
                <div className="teacher-modal-overlay" onClick={() => setHideTarget(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '32px 24px' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
                        <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Xóa góp ý này?</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px' }}>Góp ý sẽ bị ẩn khỏi danh sách của bạn.</p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button onClick={() => setHideTarget(null)} className="admin-btn" style={{ padding: '10px 24px' }}>Hủy</button>
                            <button onClick={async () => { await hideFeedbackForUser(hideTarget.id, user.uid); setFeedbackList(prev => prev.filter(f => f.id !== hideTarget.id)); setHideTarget(null); }} className="admin-btn" style={{ padding: '10px 24px', background: '#dc2626', color: '#fff', border: 'none' }}>Ẩn</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Feedback Modal */}
            {showSendModal && (
                <div className="teacher-modal-overlay" onClick={() => !fbSending && setShowSendModal(false)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%' }}>
                        {fbSuccess ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                                <h3 style={{ color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>Đã gửi thành công!</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Cảm ơn bạn đã góp ý.</p>
                            </div>
                        ) : (
                            <>
                                <div className="teacher-modal-header">
                                    <h3 className="teacher-modal-title">
                                        <MessageSquareText size={22} color="#7c3aed" /> Góp ý ẩn danh
                                    </h3>
                                    <button className="teacher-modal-close" onClick={() => setShowSendModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                                    Góp ý của bạn sẽ được gửi ẩn danh.
                                </p>

                                {/* Target picker */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>Gửi cho</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: fbTargetType === 'direct' ? '12px' : '0' }}>
                                        <button onClick={() => { setFbTargetType('admin'); setFbTargetUser(null); }} style={{
                                            padding: '8px 16px', borderRadius: '12px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                                            background: fbTargetType === 'admin' ? '#eff6ff' : '#f1f5f9',
                                            color: fbTargetType === 'admin' ? '#4f46e5' : '#64748b',
                                            border: `2px solid ${fbTargetType === 'admin' ? '#4f46e5' : 'transparent'}`,
                                        }}>👑 Ban quản lý</button>
                                        <button onClick={() => { setFbTargetType('direct'); loadStaffTeachers(); }} style={{
                                            padding: '8px 16px', borderRadius: '12px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                                            background: fbTargetType === 'direct' ? '#f0fdf4' : '#f1f5f9',
                                            color: fbTargetType === 'direct' ? '#16a34a' : '#64748b',
                                            border: `2px solid ${fbTargetType === 'direct' ? '#16a34a' : 'transparent'}`,
                                        }}>👤 Cá nhân</button>
                                    </div>
                                    {fbTargetType === 'direct' && (
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo tên hoặc email..."
                                                value={targetSearch}
                                                onChange={e => setTargetSearch(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #e2e8f0',
                                                    fontSize: '0.82rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
                                                }}
                                            />
                                            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '4px' }}>
                                            {loadingUsers ? (
                                                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.82rem' }}>Đang tải...</div>
                                            ) : (() => {
                                                const filtered = staffTeacherList.filter(u => {
                                                    if (!targetSearch.trim()) return true;
                                                    const q = targetSearch.toLowerCase();
                                                    return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                                                });
                                                return filtered.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.82rem' }}>
                                                        {staffTeacherList.length === 0 ? 'Không có người nhận' : 'Không tìm thấy'}
                                                    </div>
                                                ) : filtered.map(u => {
                                                const uRole = ROLE_LABELS[u.role] || { label: u.role, color: '#64748b', bg: '#f8fafc' };
                                                return (
                                                    <button key={u.uid} onClick={() => setFbTargetUser(u)} style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '10px',
                                                        border: 'none', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                                                        background: fbTargetUser?.uid === u.uid ? '#f0fdf4' : 'transparent',
                                                        fontWeight: fbTargetUser?.uid === u.uid ? 600 : 400,
                                                    }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: uRole.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: uRole.color, flexShrink: 0 }}>
                                                            {(u.displayName || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName}</div>
                                                            <div style={{ fontSize: '0.72rem', color: uRole.color }}>{uRole.label}</div>
                                                        </div>
                                                        {fbTargetUser?.uid === u.uid && <CheckCheck size={16} color="#16a34a" />}
                                                    </button>
                                                );
                                            });
                                            })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Category */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>Phân loại</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {CATEGORIES.map(c => (
                                            <button key={c.value} onClick={() => setFbCategory(c.value)} style={{
                                                padding: '8px 14px', borderRadius: '12px', fontWeight: 600, fontSize: '0.82rem',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                background: fbCategory === c.value ? c.bg : '#f1f5f9',
                                                color: fbCategory === c.value ? c.color : '#64748b',
                                                border: `2px solid ${fbCategory === c.value ? c.color : 'transparent'}`,
                                            }}>{c.emoji} {c.label}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>Nội dung</label>
                                    <textarea value={fbMessage} onChange={e => setFbMessage(e.target.value)}
                                        placeholder="Viết nội dung góp ý tại đây..." rows={4}
                                        style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontSize: '0.92rem', outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <button onClick={handleSendFeedback} disabled={!fbMessage.trim() || fbSending || (fbTargetType === 'direct' && !fbTargetUser)}
                                    className="admin-btn admin-btn-primary"
                                    style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: fbSending ? 0.7 : 1 }}>
                                    {fbSending ? <><Loader size={16} className="spin" /> Đang gửi...</> : <><Send size={16} /> Gửi góp ý</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
